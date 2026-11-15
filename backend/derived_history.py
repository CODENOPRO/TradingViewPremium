"""6h OHLCV built exclusively from native 1h bars, aligned to source sessions."""
import re
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from market_store import normalize_bars


def aggregate_six_hour(values,metadata):
    hourly=normalize_bars(values)
    if not hourly:return [],0
    zone=ZoneInfo(metadata['timezone'])
    regular=metadata.get('session','')
    match=re.fullmatch(r'(\d{2})(\d{2})-(\d{2})(\d{2})(?::[1-7]+)?',regular)
    if not match:raise ValueError('Lịch phiên chưa hỗ trợ ghép 6h từ 1h: '+regular)
    sh,sm,eh,em=map(int,match.groups());groups={};skipped=0
    for bar in hourly:
        local=datetime.fromtimestamp(bar['time'],zone)
        anchor=local.replace(hour=sh,minute=sm,second=0,microsecond=0)
        if local<anchor:anchor-=timedelta(days=1)
        overnight=(eh,em)<=(sh,sm)
        close=(anchor+timedelta(days=1 if overnight else 0)).replace(hour=eh,minute=em)
        trading_date=close.strftime('%Y%m%d');schedule=regular
        for correction in metadata.get('sessionCorrections','').split(';'):
            split=correction.rfind(':')
            if split>=0 and trading_date in correction[split+1:].split(','):schedule=correction[:split];break
        corrected=re.fullmatch(r'(\d{2})(\d{2})-(\d{2})(\d{2})',schedule)
        if not corrected:
            skipped+=1;continue
        csh,csm,ceh,cem=map(int,corrected.groups())
        anchor=anchor.replace(hour=csh,minute=csm)
        close=close.replace(hour=ceh,minute=cem)
        start=int(anchor.timestamp());end=int(close.timestamp())
        if not start<=bar['time']<end:continue
        bucket=start+((bar['time']-start)//21600)*21600
        entry=groups.setdefault(bucket,{'end':min(bucket+21600,end),'bars':[]})
        entry['bars'].append(bar)
    output=[];last=hourly[-1]['time']
    for start,entry in sorted(groups.items()):
        bars=entry['bars'];end=entry['end']
        # Only the trailing bucket may still be forming. Interior gaps and
        # an incomplete leading bucket must never become fabricated candles.
        expected_end=min(end,last+3600) if bars[-1]['time']==last else end
        expected=list(range(start,expected_end,3600))
        if [b['time'] for b in bars]!=expected:skipped+=1;continue
        output.append({'time':start,'open':bars[0]['open'],'high':max(b['high'] for b in bars),
                       'low':min(b['low'] for b in bars),'close':bars[-1]['close'],'volume':sum(b['volume'] for b in bars)})
    return output,skipped
