"""Provider-owned calendar export and oEmbed metadata; no audio extraction."""
import json
import math
from pathlib import Path
import threading
import time
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlsplit, urlunsplit, parse_qs
from email.utils import parsedate_to_datetime
from datetime import datetime

try:
    from market_store import atomic_json
except ImportError:
    from backend.market_store import atomic_json

CALENDAR_URL = 'https://showmytrades.com/api/public/calendar/v1?impact=all&days=7'
CALENDAR_WEBSITE = 'https://showmytrades.com/tools/economic-calendar'
CALENDAR_REFRESH_SECONDS = 900
CALENDAR_RETENTION_SECONDS = 14 * 86400
CALENDAR_MAX_EVENTS = 4000


def _merge_events(existing, incoming, now):
    cutoff = now - CALENDAR_RETENTION_SECONDS
    merged = {}
    for item in (*existing, *incoming):
        if not isinstance(item, dict) or not isinstance(item.get('title'), str):
            continue
        ts = item.get('time')
        if not isinstance(ts, (int, float)) or isinstance(ts, bool) or not math.isfinite(ts) or ts < cutoff:
            continue
        key = (round(float(ts)), str(item.get('currency', '')), item['title'])
        merged[key] = item
    return sorted(merged.values(), key=lambda value: value['time'])[-CALENDAR_MAX_EVENTS:]


def normalize_events(values):
    if not isinstance(values, list):
        raise ValueError('Invalid calendar events')
    result = []
    for value in values[:3000]:
        if not isinstance(value, dict) or not isinstance(value.get('title'), str):
            continue
        date = value.get('time')
        try:
            parsed = datetime.fromisoformat(date.replace('Z', '+00:00'))
            if parsed.tzinfo is None:
                continue
            timestamp = parsed.timestamp()
        except (ValueError, TypeError, AttributeError):
            continue
        result.append({'title': value['title'][:250], 'currency': str(value.get('currency', ''))[:8].upper(),
                       'time': timestamp, 'impact': str(value.get('impact', ''))[:24].title(),
                       'tentative': value.get('status') == 'tentative',
                       **{key: ('' if value.get(key) is None else str(value[key]))[:100] for key in ('actual', 'forecast', 'previous')}})
    return sorted(result, key=lambda value: value['time'])


class EconomicCalendar:
    def __init__(self, fetch=None, clock=time.time, history_path=None):
        self.fetch = fetch or self._fetch
        self.clock = clock
        self.history_path = Path(history_path) if history_path else None
        self.lock = threading.Lock()
        self.events = []
        self.checked = None
        self.updated = None
        self.error = None
        self.next_check = None
        if self.history_path:
            self._load_history()

    def _load_history(self):
        if not self.history_path or not self.history_path.exists():
            return
        try:
            payload = json.loads(self.history_path.read_text(encoding='utf-8'))
            raw = payload.get('events', []) if isinstance(payload, dict) else payload
            if isinstance(raw, list):
                self.events = _merge_events([], raw, self.clock())
            if isinstance(payload, dict) and isinstance(payload.get('updated_at'), (int, float)):
                self.updated = payload['updated_at']
        except (OSError, ValueError, TypeError):
            pass

    def _save_history(self):
        if not self.history_path:
            return
        try:
            atomic_json(self.history_path, {'events': self.events, 'updated_at': self.updated})
        except OSError:
            pass

    @staticmethod
    def _fetch():
        with urlopen(Request(CALENDAR_URL, headers={'Accept': 'application/json'}), timeout=12) as response:
            payload = json.loads(response.read(2_000_000))
        if not isinstance(payload, dict):
            raise ValueError('Invalid calendar response')
        return payload

    def get(self):
        with self.lock:
            now = self.clock()
            if self.next_check is None or now >= self.next_check:
                self.checked = now
                self.next_check = now + CALENDAR_REFRESH_SECONDS
                try:
                    payload = self.fetch()
                    events = normalize_events(payload.get('events'))
                    generated = datetime.fromisoformat(payload['generated_at'].replace('Z', '+00:00'))
                    if generated.tzinfo is None:
                        raise ValueError('Calendar update time has no UTC offset')
                    self.events = _merge_events(self.events, events, now)
                    self.updated = generated.timestamp()
                    self.error = None
                    self._save_history()
                except Exception as exc:
                    self.error = 'Calendar feed unavailable: ' + str(exc)[:180]
                    if isinstance(exc, HTTPError) and exc.code in (403, 429, 503):
                        retry = exc.headers.get('Retry-After') if exc.headers else None
                        if retry:
                            try:
                                after = now + int(retry) if retry.isdecimal() else parsedate_to_datetime(retry).timestamp()
                                self.next_check = max(self.next_check, after)
                            except (TypeError, ValueError, OverflowError):
                                pass
            return {'source': 'ShowMyTrades', 'url': CALENDAR_URL, 'website': CALENDAR_WEBSITE,
                    'events': self.events, 'checked_at': self.checked, 'updated_at': self.updated,
                    'error': self.error, 'next_check_at': self.next_check,
                    'realtime': False, 'actual_available': any(e['actual'] for e in self.events),
                    'notice': 'Calendar feed cached for 15 minutes. Actual values appear when supplied.'}


_SHARE_HOSTS = {
    'vm.tiktok.com': {'tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'},
    'vt.tiktok.com': {'tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'},
    'on.soundcloud.com': {'soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com', 'on.soundcloud.com'},
    'spotify.link': {'open.spotify.com', 'spotify.link'},
}


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def resolve_music_share(url, opener=None):
    """Resolve official short links without following redirects outside that provider."""
    allowed = _SHARE_HOSTS.get(urlsplit(url).hostname, set())
    open_request = opener or build_opener(_NoRedirect()).open
    for attempt in range(6):
        parsed = urlsplit(url)
        if (len(url) > 2048 or parsed.scheme != 'https' or parsed.hostname not in allowed
                or parsed.username is not None or parsed.password is not None or parsed.port not in (None, 443)):
            raise ValueError('Share link must stay on its official provider')
        if parsed.hostname not in _SHARE_HOSTS:
            return url
        if attempt==5:
            break
        try:
            with open_request(Request(url), timeout=3):
                break
        except HTTPError as exc:
            try:
                location = exc.headers.get('Location') if exc.headers else None
                if exc.code not in (301, 302, 303, 307, 308) or not location:
                    raise ValueError('Provider could not resolve this share link') from exc
                url = urljoin(url, location)
            finally:
                exc.close()
        except (TimeoutError, URLError) as exc:
            raise MusicProviderError('Nhà cung cấp không phản hồi link rút gọn. Thử link đầy đủ.',504) from exc
    raise ValueError('Paste the full link from the provider')


# Only known provider oEmbed endpoints; never fetch a user-supplied host.

class MusicProviderError(Exception):
    def __init__(self,message,status=502,retry_after=None):
        super().__init__(message)
        self.status=status
        self.retry_after=retry_after


def canonical_music_url(url):
    parsed=urlsplit(url)
    if len(url)>2048 or parsed.scheme!='https' or parsed.username or parsed.password or parsed.port not in (None,443):
        raise ValueError('Use an official HTTPS provider link')
    aliases={'m.youtube.com':'www.youtube.com','youtube.com':'www.youtube.com',
             'm.soundcloud.com':'soundcloud.com','www.soundcloud.com':'soundcloud.com',
             'm.tiktok.com':'www.tiktok.com','tiktok.com':'www.tiktok.com'}
    host=aliases.get(parsed.hostname,parsed.hostname)
    query=parse_qs(parsed.query)
    path=parsed.path
    if host=='open.spotify.com':
        parts=path.strip('/').split('/')
        if parts and parts[0].startswith('intl-'):parts.pop(0)
        if parts and parts[0]=='embed':parts.pop(0)
        path='/'+ '/'.join(parts)
        query={}
    elif host in ('www.youtube.com','youtu.be'):
        query={k:v for k,v in query.items() if k in ('v','list')}
    elif host=='soundcloud.com':
        query={k:v for k,v in query.items() if k=='secret_token'}
    else:
        query={}
    return urlunsplit(('https',host or '',path,urlencode(query,doseq=True),''))


def metadata_endpoint(url):
    url=canonical_music_url(url)
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or parsed.username or parsed.password:
        raise ValueError('Use an official HTTPS provider link')
    host = parsed.hostname
    endpoints = {'www.youtube.com': 'https://www.youtube.com/oembed', 'youtube.com': 'https://www.youtube.com/oembed',
                 'youtu.be': 'https://www.youtube.com/oembed', 'open.spotify.com': 'https://open.spotify.com/oembed',
                 'soundcloud.com': 'https://soundcloud.com/oembed', 'www.soundcloud.com': 'https://soundcloud.com/oembed',
                 'www.tiktok.com': 'https://www.tiktok.com/oembed', 'tiktok.com': 'https://www.tiktok.com/oembed'}
    if host not in endpoints or parsed.port not in (None, 443):
        raise ValueError('Unsupported music provider')
    return endpoints[host] + '?' + urlencode({'url': url, 'format': 'json'})


_metadata = {}
_metadata_lock = threading.Lock()
_metadata_errors = {}


def music_metadata(url):
    endpoint = metadata_endpoint(url)
    with _metadata_lock:
        cached = _metadata.get(endpoint)
        if cached and time.time()-cached[0] < 3600:
            return cached[1]
        failure=_metadata_errors.get(endpoint)
        if failure and time.time()<failure[0]:
            raise MusicProviderError(failure[1],failure[2],max(1,int(failure[0]-time.time())))
    try:
        with urlopen(Request(endpoint, headers={'Accept': 'application/json'}), timeout=8) as response:
            raw=response.read(300_001)
        if len(raw)>300_000:
            raise MusicProviderError('Metadata nhà cung cấp vượt giới hạn phản hồi.')
        try:
            value=json.loads(raw)
        except (ValueError,UnicodeError) as exc:
            raise MusicProviderError('Nhà cung cấp trả metadata không hợp lệ.') from exc
        if not isinstance(value,dict) or not isinstance(value.get('title'),str) or not value['title'].strip():
            raise MusicProviderError('Nhà cung cấp không trả thông tin bài nhạc hợp lệ.')
    except HTTPError as exc:
        retry=exc.headers.get('Retry-After','') if exc.headers else ''
        try:
            wait=max(1,min(3600,int(retry)))
        except (ValueError,TypeError):
            try:wait=max(1,min(3600,int(parsedate_to_datetime(retry).timestamp()-time.time())))
            except (ValueError,TypeError,OverflowError):wait=30
        message=('Nhà cung cấp giới hạn lượt lấy metadata; thử lại sau.' if exc.code==429 else
                 'Nhà cung cấp từ chối metadata (HTTP '+str(exc.code)+'). Kiểm tra link và quyền truy cập bài nhạc.')
        code=429 if exc.code==429 else 502
        with _metadata_lock:
            if len(_metadata_errors)>=128:_metadata_errors.clear()
            _metadata_errors[endpoint]=(time.time()+wait,message,code)
        exc.close()
        raise MusicProviderError(message,code,wait) from exc
    except (TimeoutError,URLError) as exc:
        raise MusicProviderError('Kết nối metadata quá hạn hoặc nhà cung cấp không sẵn sàng.',504) from exc
    result = {key: str(value.get(key) or '')[:2000] for key in ('title', 'author_name', 'thumbnail_url')}
    if not result['thumbnail_url'].startswith('https://'):
        result['thumbnail_url'] = ''
    with _metadata_lock:
        if len(_metadata) > 128:
            _metadata.clear()
        _metadata[endpoint] = (time.time(), result)
        _metadata_errors.pop(endpoint,None)
    return result
