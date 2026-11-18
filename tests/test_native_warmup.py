import sys,unittest,asyncio
sys.path.insert(0,'backend')
from native_warmup import NativeWarmup
from derived_history import aggregate_six_hour
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
class WarmupTests(unittest.IsolatedAsyncioTestCase):
 async def test_sequential_all_three_symbols_and_restore_original(self):
  state={'interval':'1'};changes=[];accepted=[];reports=[]
  async def read():return state['interval']
  async def change(expected,value):self.assertEqual(state['interval'],expected);state['interval']=value;changes.append(value)
  async def snapshot():return [{'symbol':s,'resolution':state['interval'],'bars':[{'time':60}]} for s in ['NQ1!','ES1!','YM1!']]
  async def history():return {'complete':True,'reason':'source_limit'}
  w=NativeWarmup(read,change,snapshot,history,accepted.extend,reports.append);w.request(['D','1h','D']);await w.cycle()
  self.assertEqual(changes,['D','60','1']);self.assertEqual(len(accepted),6);self.assertEqual(state['interval'],'1');self.assertEqual(reports[-1]['state'],'complete')
 async def test_user_changes_interval_interrupts_without_restoring_over_their_choice(self):
  state={'interval':'1'};changes=[];reports=[]
  async def read():return state['interval']
  async def change(expected,value):state['interval']=value;changes.append(value)
  async def snapshot():state['interval']='15';return []
  async def history():return {}
  async def sleep(_):pass
  w=NativeWarmup(read,change,snapshot,history,lambda _:None,reports.append,sleep=sleep);w.request(['D','W']);await w.cycle()
  self.assertEqual(changes,['D']);self.assertEqual(state['interval'],'15');self.assertEqual(w.queue,[]);self.assertEqual(reports[-1]['state'],'interrupted')
 async def test_failure_restores_original_interval(self):
  state={'interval':'5'}
  async def read():return state['interval']
  async def change(expected,value):state['interval']=value
  async def snapshot():raise RuntimeError('CDP error')
  w=NativeWarmup(read,change,snapshot,None,lambda _:None,lambda _:None);w.request(['D'])
  with self.assertRaises(RuntimeError):await w.cycle()
  self.assertEqual(state['interval'],'5')
 async def test_tradingview_daily_alias_is_not_mistaken_for_a_user_interval_change(self):
  state={'interval':'1'};reports=[]
  async def read():return state['interval']
  async def change(expected,value):state['interval']='1D' if value=='D' else value
  async def snapshot():return [{'symbol':s,'resolution':'1D','bars':[{'time':60}]} for s in ['NQ1!','ES1!','YM1!']]
  async def history():return {'complete':True,'reason':'source_limit'}
  w=NativeWarmup(read,change,snapshot,history,lambda _:None,reports.append);w.request(['D']);await w.cycle()
  self.assertEqual(state['interval'],'1');self.assertEqual(reports[-1]['state'],'complete')
 async def test_a_second_page_preload_does_not_requeue_already_completed_intervals(self):
  async def read():return '1'
  w=NativeWarmup(read,None,None,None,None,None);w.running=True;w.finished={'D','1h'};w.active='1m';w.queue=['5m']
  w.request(['1m','5m','1h','D','W'])
  self.assertEqual(w.queue,['5m','W'])
 async def test_keep_one_minute_hands_over_immediately_once_all_three_symbols_have_1m_bars(self):
  state={'interval':'60'};reports=[]
  async def read():return state['interval']
  async def change(expected,value):state['interval']=value
  async def snapshot():return [{'symbol':s,'resolution':'1','bars':[{'time':60}]} for s in ['NQ1!','ES1!','YM1!']]
  async def history():return {'complete':False,'loading':True}
  w=NativeWarmup(read,change,snapshot,history,lambda _:None,reports.append)
  w.keep_one_minute=True;w.request(['1m']);await w.cycle()
  self.assertEqual(state['interval'],'1')
  self.assertEqual(reports[-1]['state'],'complete')
 async def test_quick_boundary_sync_captures_htf_and_restores_1m_immediately(self):
  state={'interval':'1'};changes=[];accepted=[];reports=[]
  async def read():return state['interval']
  async def change(expected,value):self.assertEqual(state['interval'],expected);state['interval']=value;changes.append(value)
  async def snapshot():return [{'symbol':s,'resolution':state['interval'],'bars':[{'time':900}]} for s in ['NQ1!','ES1!','YM1!']]
  async def history():return {'complete':False,'loading':True}
  w=NativeWarmup(read,change,snapshot,history,accepted.extend,reports.append)
  w.keep_one_minute=True;w.request(['15m'],priority=True,quick=True);await w.cycle()
  self.assertEqual(changes,['15','1'])
  self.assertEqual(state['interval'],'1')
  self.assertEqual(len(accepted),3)
  self.assertEqual(reports[-1]['state'],'complete')
class DerivedSixHourTests(unittest.TestCase):
 def bars(self,date,hours):
  start=datetime.fromisoformat(date).replace(tzinfo=ZoneInfo('America/Chicago'))
  return [{'time':int((start+timedelta(hours=i)).timestamp()),'open':100+i,'high':102+i,'low':99+i,'close':101+i,'volume':10+i} for i in range(hours)]
 def test_session_buckets_and_overnight_short_last_bucket(self):
  source=self.bars('2026-11-12T17:00',23)
  result,skipped=aggregate_six_hour(source,{'timezone':'America/Chicago','session':'1700-1600'})
  self.assertEqual(len(result),4);self.assertEqual(skipped,0);self.assertEqual(result[0]['time'],source[0]['time']);self.assertEqual(result[0]['open'],100);self.assertEqual(result[0]['close'],106);self.assertEqual(result[0]['volume'],sum(b['volume'] for b in source[:6]));self.assertEqual(result[-1]['volume'],sum(b['volume'] for b in source[18:]))
 def test_dst_session_open_is_local_not_fixed_utc(self):
  for date,utc in [('2026-10-29T17:00',22),('2026-11-12T17:00',23)]:
   result,_=aggregate_six_hour(self.bars(date,6),{'timezone':'America/Chicago','session':'1700-1600'})
   self.assertEqual(datetime.fromtimestamp(result[0]['time'],ZoneInfo('UTC')).hour,utc)
 def test_internal_hour_gap_is_not_filled_and_trailing_partial_bucket_is_allowed(self):
  source=self.bars('2026-11-12T17:00',9);source.pop(3)
  result,skipped=aggregate_six_hour(source,{'timezone':'America/Chicago','session':'1700-1600'})
  self.assertEqual(len(result),1);self.assertEqual(result[0]['open'],106);self.assertEqual(skipped,1)
 def test_early_close_clips_last_bucket(self):
  source=self.bars('2026-11-25T17:00',20)
  # Last H1 starts at12:00 and ends at12:15 on the corrected trading date.
  result,_=aggregate_six_hour(source,{'timezone':'America/Chicago','session':'1700-1600','sessionCorrections':'1700-1215:20261126'})
  self.assertEqual(len(result),4);self.assertEqual(result[-1]['close'],120)
 def test_cme_multi_segment_holiday_and_weekday_suffix_sessions(self):
  # Thanksgiving Thu early halt + Black Friday early close expressed via CME F-offset syntax
  thu=self.bars('2026-11-25T17:00',19)
  fri=self.bars('2026-11-26T17:00',20)
  meta={'timezone':'America/Chicago','session':'1700-1600:23456','sessionCorrections':'1700F2-1200F1,1700-1215:20261127'}
  result,skipped=aggregate_six_hour(thu+fri,meta)
  self.assertEqual(skipped,0)
  self.assertEqual(len(result),8)
