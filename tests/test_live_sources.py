import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from bridge_server import subscriptions,validate_subscription,requested_pairs
class LiveSourceTests(unittest.TestCase):
    def setUp(self):self.previous=dict(subscriptions);subscriptions.clear()
    def tearDown(self):subscriptions.clear();subscriptions.update(self.previous)
    def test_mixed_timeframes_remain_subscribed_when_another_chart_changes(self):
        subscriptions[1]=validate_subscription([{'symbol':'NQ1!','timeframe':'1m'},{'symbol':'ES1!','timeframe':'5m'},{'symbol':'YM1!','timeframe':'15m'}])
        self.assertEqual(requested_pairs(),{('NQ1!','1m'),('ES1!','5m'),('YM1!','15m')})
        subscriptions[1]=validate_subscription([{'symbol':'NQ1!','timeframe':'1m'},{'symbol':'ES1!','timeframe':'1h'},{'symbol':'YM1!','timeframe':'15m'}])
        self.assertEqual(requested_pairs(),{('NQ1!','1m'),('ES1!','1h'),('YM1!','15m')})
    def test_multiple_windows_share_feeds_and_disconnect_only_releases_its_own_requests(self):
        subscriptions[1]={('NQ1!','1m'),('ES1!','5m')};subscriptions[2]={('ES1!','5m'),('YM1!','15m')}
        self.assertEqual(len(requested_pairs()),3)
        subscriptions.pop(1);self.assertEqual(requested_pairs(),{('ES1!','5m'),('YM1!','15m')})
    def test_invalid_requests_rejected_before_changing_feeds(self):
        for value in (None,{},[{}],[{'symbol':'fake','timeframe':'1m'}],[{'symbol':'NQ1!','timeframe':'bad'}],[{}]*17):
            with self.assertRaises(ValueError):validate_subscription(value)
    def test_only_owned_tradingview_chart_markers_are_managed(self):
        from bridge_server import source_marker
        self.assertEqual(source_marker({'url':'https://www.tradingview.com/chart/a/?terminal_live=NQ1%21%3A1m'}),'NQ1!:1m')
        for url in ('https://example.com/chart/a/?terminal_live=NQ1%21%3A1m','https://www.tradingview.com/chart/a/?terminal_live=unknown','https://www.tradingview.com/chart/a/'):
            self.assertIsNone(source_marker({'url':url}))
