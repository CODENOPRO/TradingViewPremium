"""6h OHLCV built exclusively from native 1h bars, aligned to source sessions."""
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from market_store import normalize_bars

_SEG_RE = re.compile(r'(\d{2})(\d{2})(?:F(\d+))?-(\d{2})(\d{2})(?:F(\d+))?')


def aggregate_six_hour(values, metadata):
    hourly = normalize_bars(values, timeframe='1h')
    if not hourly:
        return [], 0
    meta = metadata if isinstance(metadata, dict) else {}
    tz_name = meta.get('timezone') or ''
    if not tz_name:
        raise ValueError('Thiếu timezone cho lịch phiên 6h')
    zone = ZoneInfo(tz_name)
    regular_raw = meta.get('session') or ''
    match = re.fullmatch(r'(\d{2})(\d{2})-(\d{2})(\d{2})(?::[1-7]+)?', regular_raw)
    if not match:
        raise ValueError('Lịch phiên chưa hỗ trợ ghép 6h từ 1h: ' + str(regular_raw))
    sh, sm, eh, em = map(int, match.groups())
    overnight = (eh, em) <= (sh, sm)

    corrected_days = set()
    explicit_windows = []
    corrections_raw = meta.get('sessionCorrections') or ''
    for correction in corrections_raw.split(';'):
        split = correction.rfind(':')
        if split < 0:
            continue
        spec = correction[:split].strip()
        dates = [d.strip() for d in correction[split + 1:].split(',') if len(d.strip()) == 8 and d.strip().isdigit()]
        for ymd in dates:
            corrected_days.add(ymd)
            if spec == 'dayoff':
                continue
            base = datetime.strptime(ymd, '%Y%m%d')
            for part in spec.split(','):
                seg = _SEG_RE.fullmatch(part.strip())
                if not seg:
                    explicit_windows.append(('unsupported', ymd))
                    continue
                csh, csm, fs, ceh, cem, fe = seg.groups()
                csh, csm, ceh, cem = int(csh), int(csm), int(ceh), int(cem)
                end_back = int(fe) if fe is not None else 0
                start_back = int(fs) if fs is not None else (end_back + (1 if (ceh, cem) <= (csh, csm) else 0))
                s_dt = (base - timedelta(days=start_back)).replace(hour=csh, minute=csm, second=0, microsecond=0, tzinfo=zone)
                e_dt = (base - timedelta(days=end_back)).replace(hour=ceh, minute=cem, second=0, microsecond=0, tzinfo=zone)
                if end_back > 0:
                    corrected_days.add(e_dt.strftime('%Y%m%d'))
                explicit_windows.append((int(s_dt.timestamp()), int(e_dt.timestamp())))

    bad_days = {w[1] for w in explicit_windows if w[0] == 'unsupported'}
    intervals = sorted(w for w in explicit_windows if w[0] != 'unsupported')

    groups = {}
    skipped = 0
    for bar in hourly:
        t = bar['time']
        matched = None
        for s_ts, e_ts in intervals:
            if s_ts <= t < e_ts:
                matched = (s_ts, e_ts)
                break
        if matched is None:
            local = datetime.fromtimestamp(t, zone)
            anchor = local.replace(hour=sh, minute=sm, second=0, microsecond=0)
            if local < anchor:
                anchor -= timedelta(days=1)
            close = (anchor + timedelta(days=1 if overnight else 0)).replace(hour=eh, minute=em)
            trading_date = close.strftime('%Y%m%d')
            if trading_date in bad_days:
                skipped += 1
                continue
            if trading_date in corrected_days:
                continue
            s_ts, e_ts = int(anchor.timestamp()), int(close.timestamp())
            if not s_ts <= t < e_ts:
                continue
            matched = (s_ts, e_ts)
        start, end = matched
        bucket = start + ((t - start) // 21600) * 21600
        entry = groups.setdefault(bucket, {'end': min(bucket + 21600, end), 'bars': []})
        entry['bars'].append(bar)

    output = []
    last = hourly[-1]['time']
    for start, entry in sorted(groups.items()):
        bars = entry['bars']
        end = entry['end']
        expected_end = min(end, last + 3600) if bars[-1]['time'] == last else end
        expected = list(range(start, expected_end, 3600))
        if [b['time'] for b in bars] != expected:
            skipped += 1
            continue
        output.append({
            'time': start,
            'open': bars[0]['open'],
            'high': max(b['high'] for b in bars),
            'low': min(b['low'] for b in bars),
            'close': bars[-1]['close'],
            'volume': sum(b['volume'] for b in bars)
        })
    return output, skipped
