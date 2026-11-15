import sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from market_store import MarketStore, RESOLUTIONS
class NativeHistoryTests(unittest.TestCase):
    def test_large_history_survives_save_reload(self):
        with tempfile.TemporaryDirectory() as directory:
            store=MarketStore(directory)
            bars=[dict(time=60*(i+1),open=10,high=12,low=9,close=11,volume=5) for i in range(6000)]
            store.merge('NQ1!','1M',bars)
            store.save()
            restored=MarketStore(directory);restored.load()
            self.assertEqual(restored.data['1M']['NQ1!'],bars)
    def test_minutes_and_months_are_distinct(self):
        self.assertEqual(RESOLUTIONS['1'],'1m')
        self.assertEqual(RESOLUTIONS['1M'],'1M')
        self.assertEqual(len(set(RESOLUTIONS.values())),13)
