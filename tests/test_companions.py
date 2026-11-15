import sys, unittest, tempfile, json
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
import bridge_server as bridge
from companion_services import EconomicCalendar, normalize_events, metadata_endpoint, resolve_music_share
class CompanionTests(unittest.TestCase):
    def test_export_respects_provider_retry_after(self):
        clock = [100]
        with patch('companion_services.urlopen', side_effect=HTTPError('https://example.com',429,'Slow down',{'Retry-After':'1200'},None)) as request:
            service = EconomicCalendar(clock=lambda:clock[0])
            self.assertEqual(service.get()['next_check_at'],1300)
            clock[0] = 1299
            service.get()
            self.assertEqual(request.call_count,1)
            clock[0] = 1300
            service.get()
            self.assertEqual(request.call_count,2)

    def test_share_redirect_is_confined_to_the_original_provider(self):
        url = 'https://vm.tiktok.com/example/'
        for destination in ('https://127.0.0.1/', 'https://open.spotify.com/track/example',
                            'http://www.tiktok.com/@example/video/1234567890'):
            with patch('companion_services.build_opener') as factory:
                opener = factory.return_value.open
                opener.side_effect = HTTPError(url,302,'Found',{'Location':destination},None)
                with self.assertRaises(ValueError):
                    resolve_music_share(url)
                self.assertEqual(opener.call_count,1)
        full = 'https://www.tiktok.com/@example/video/1234567890'
        with patch('companion_services.build_opener') as factory:
            opener = factory.return_value.open
            opener.side_effect = HTTPError(url,302,'Found',{'Location':full},None)
            self.assertEqual(resolve_music_share(url),full)
            self.assertEqual(opener.call_count,1)

    def test_calendar_rate_limit_stale_cache_and_no_realtime_claim(self):
        clock=[0];calls=[]
        def fetch():
            calls.append(1)
            if len(calls)>1:raise OSError('403 Forbidden')
            return {'generated_at':'1970-01-01T00:00:00Z','events':[
                {'title':'Release','time':'2026-11-12T08:30:00-05:00','currency':'USD',
                 'impact':'high','forecast':'1','previous':'2'}]}
        service=EconomicCalendar(fetch,lambda:clock[0]);first=service.get();self.assertFalse(first['realtime']);self.assertFalse(first['actual_available']);self.assertEqual(len(first['events']),1)
        self.assertEqual(first['source'],'ShowMyTrades')
        self.assertEqual(first['events'][0]['impact'],'High')
        clock[0]=899;service.get();self.assertEqual(len(calls),1)
        clock[0]=900;stale=service.get();self.assertEqual(len(stale['events']),1);self.assertIn('403',stale['error']);self.assertEqual(stale['updated_at'],0)
    def test_calendar_validates_dates_and_preserves_actual_only_if_supplied(self):
        self.assertEqual(normalize_events([{}, {'title':'x','time':'bad'},{'title':'x','time':'2026-11-12T08:30:00'}]),[])
        event=normalize_events([{'title':'x','time':'2026-11-12T08:30:00Z','actual':'3.1%','status':'tentative'}])[0]
        self.assertEqual(event['actual'],'3.1%')
        self.assertTrue(event['tentative'])
    def test_metadata_is_limited_to_provider_endpoints(self):
        for url in ['file:///etc/passwd','https://127.0.0.1/','https://www.youtube.com.evil.test/x','https://user:secret@www.youtube.com/x','https://soundcloud.com:8000/x']:
            with self.assertRaises(ValueError):metadata_endpoint(url)
        self.assertTrue(metadata_endpoint('https://www.youtube.com/watch?v=dQw4w9WgXcQ').startswith('https://www.youtube.com/oembed?'))
    def test_disconnect_retains_last_requested_pairs_and_disk_configuration(self):
        with tempfile.TemporaryDirectory() as directory,patch.object(bridge,'source_config',Path(directory)/'sources.json'),patch.object(bridge,'subscriptions',{}),patch.object(bridge,'last_requests',set()):
            bridge.subscriptions[1]={('ES1!','5m'),('YM1!','15m')};bridge.remember_requests();bridge.subscriptions.clear()
            self.assertEqual(bridge.requested_pairs(),{('ES1!','5m'),('YM1!','15m')});self.assertEqual(len(json.loads(bridge.source_config.read_text())),2)
    def test_existing_unmarked_chart_is_found_from_metadata_without_navigation(self):
        messages=[]
        class Socket:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def send(self,value):messages.append(json.loads(value))
            def recv(self,**args):return json.dumps({'id':1,'result':{'result':{'value':[{'symbol':'ES1!','resolution':'5'}]}}})
        with patch.object(bridge,'sync_connect',return_value=Socket()) as connect:
            self.assertEqual(bridge.source_pairs({'type':'page','url':'https://www.tradingview.com/chart/user/','webSocketDebuggerUrl':'ws://local'}),{('ES1!','5m')})
        self.assertEqual(connect.call_args.kwargs['max_size'],20 * 1024 * 1024)
        self.assertNotIn('window.open',messages[0]['params']['expression']);self.assertNotIn('setResolution',messages[0]['params']['expression'])

class SourceLoopTests(unittest.IsolatedAsyncioTestCase):
    async def exercise(self, subscriptions, actual, setup=False):
        import asyncio, io
        from unittest.mock import AsyncMock
        targets=[{'id':'main','type':'page','url':'https://www.tradingview.com/chart/user/','webSocketDebuggerUrl':'ws://main'},
                 {'id':'old','type':'page','url':'https://www.tradingview.com/chart/?terminal_live=ES1%21%3A1m','webSocketDebuggerUrl':'ws://old'}]
        active=[];real_sleep=asyncio.sleep;iterations=0
        async def poll(url,expected=None):
            active.append((url,expected));await asyncio.Event().wait()
        async def pause(seconds):
            nonlocal iterations
            iterations+=1
            await real_sleep(0)
            if iterations==2:raise asyncio.CancelledError()
        ensure=AsyncMock(return_value={'created':[]})
        with patch.object(bridge,'subscriptions',subscriptions),patch.object(bridge,'last_requests',set()), \
             patch.object(bridge,'urlopen',side_effect=lambda *a,**kw:io.BytesIO(json.dumps(targets).encode())), \
             patch.object(bridge,'source_pairs',side_effect=lambda t:actual if t['id']=='main' else {('ES1!','1m')}), \
             patch.object(bridge,'poll_source',side_effect=poll), \
             patch.object(bridge,'evaluate_target',return_value={'created':[]}) as configure, \
             patch.object(bridge.asyncio,'to_thread',new=AsyncMock(side_effect=lambda fn,*args:fn(*args))), \
             patch.object(bridge.asyncio,'sleep',side_effect=pause):
            with self.assertRaises(asyncio.CancelledError):await bridge.automatic_sources()
            self.assertEqual(configure.call_count,1 if setup else 0)
            if setup:self.assertIn('addOverlayStudy',configure.call_args.args[1])
        self.assertEqual(active,[('ws://main',None)])

    async def test_three_symbols_share_one_reader_and_never_create_a_tab(self):
        pairs={('NQ1!','1m'),('ES1!','1m'),('YM1!','1m')}
        await self.exercise({1:pairs},pairs)

    async def test_missing_peers_are_added_once_with_backoff(self):
        await self.exercise({1:{('NQ1!','1m'),('ES1!','1m')}},{('NQ1!','1m')},True)

    async def test_disconnected_ui_does_not_change_source_or_add_panes(self):
        await self.exercise({}, {('NQ1!','1m')})

    async def test_mixed_timeframes_do_not_open_more_tabs(self):
        pairs={('NQ1!','1m'),('ES1!','1m'),('YM1!','1m')}
        await self.exercise({1:{('NQ1!','1m'),('ES1!','5m')}},pairs)
