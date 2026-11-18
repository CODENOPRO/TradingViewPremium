"""Sequential native history loading in one source tab, with guarded restore."""
import asyncio
import logging
import time

NATIVE_INTERVALS = {'1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '2h': '120', '4h': '240', 'D': 'D', 'W': 'W', '1M': '1M', '3M': '3M'}


def canonical_resolution(value):
    return {'1D': 'D', '1W': 'W', 'M': '1M'}.get(str(value), str(value))


class SourceChanged(Exception):
    pass


class NativeWarmup:
    def __init__(self, read, change, snapshot, history, accept, report, clock=time.monotonic, sleep=asyncio.sleep):
        async def canonical_read():
            return canonical_resolution(await read())
        self.read = canonical_read
        self.change = change
        self.snapshot = snapshot
        self.history = history
        self.accept = accept
        self.report = report
        self.clock = clock
        self.sleep = sleep
        self.queue = []
        self.wake = asyncio.Event()
        self.active = None
        self.running = False
        self.finished = set()
        self.keep_one_minute = False

    def request_startup(self, initial=False):
        if initial:
            self.request(NATIVE_INTERVALS)
        if self.active != '1m':
            self.finished.discard('1m')
            self.request(['1m'], priority=True)

    def request(self, timeframes, priority=False):
        values = [tf for tf in dict.fromkeys(timeframes) if tf in NATIVE_INTERVALS and tf != self.active and not (self.running and tf in self.finished)]
        for tf in values:
            if tf in self.queue:
                self.queue.remove(tf)
        self.queue = values + self.queue if priority else self.queue + values
        if self.keep_one_minute and '1m' in self.queue:
            self.queue.remove('1m')
            self.queue.insert(0, '1m')
        self.wake.set()

    async def cycle(self):
        original = await self.read()
        expected = original
        done = []
        failures = []
        warnings = []
        interrupted = False
        self.running = True
        self.finished.clear()
        try:
            while self.queue:
                if await self.read() != expected:
                    raise SourceChanged('Source interval changed by user')
                tf = self.queue.pop(0)
                self.active = tf
                desired = NATIVE_INTERVALS[tf]
                self.report({'state': 'loading', 'timeframe': tf, 'completed': done[:], 'remaining': self.queue[:], 'original_resolution': original})
                if expected != desired:
                    await self.change(expected, desired)
                expected = desired
                deadline = self.clock() + 120
                last_count = None
                growth = self.clock()
                captured = False
                complete = False
                reason = 'time_limit'
                aliases = {desired}
                if desired in ('D', 'W'):
                    aliases.add('1' + desired)
                elif desired == '1M':
                    aliases.add('M')
                while self.clock() < deadline:
                    if await self.read() != desired:
                        raise SourceChanged('Source interval changed by user')
                    entries = await self.snapshot()
                    ready = [e for e in entries if str(e.get('resolution')) in aliases and e.get('bars')]
                    counts = tuple(sorted((e['symbol'], len(e['bars'])) for e in ready))
                    if ready and counts != last_count:
                        self.accept(ready)
                        captured = True
                        last_count = counts
                        growth = self.clock()
                    if ready and self.history:
                        progress = await self.history()
                        all_three = {'NQ1!', 'ES1!', 'YM1!'} <= {e.get('symbol') for e in ready}
                        if progress and progress.get('complete') and (all_three or self.clock() - growth >= 4):
                            reason = progress.get('reason') if all_three else 'partial_symbols'
                            complete = all_three and reason == 'source_limit'
                            break
                        if self.clock() - growth >= 12 and not (progress or {}).get('loading'):
                            reason = 'no_growth' if all_three else 'partial_symbols'
                            break
                    elif ready and self.clock() - growth >= 12:
                        reason = 'partial_symbols'
                        break
                    await self.sleep(0.5)
                if not captured:
                    failures.append({'timeframe': tf, 'error': 'Không nhận được nến native trong 120 giây'})
                elif not complete:
                    warnings.append({'timeframe': tf, 'reason': reason, 'message': 'Đã lưu nến native nhận được; chưa xác nhận hết lịch sử'})
                done.append(tf)
                self.finished.add(tf)
                self.active = None
        except SourceChanged:
            interrupted = True
            self.queue.clear()
            self.report({'state': 'interrupted', 'completed': done, 'message': 'Đã dừng quét vì timeframe nguồn được thay đổi.'})
            return
        finally:
            self.active = None
            self.running = False
            restore = NATIVE_INTERVALS['1m'] if self.keep_one_minute and not self.queue else original
            self.keep_one_minute = False
            if not interrupted:
                try:
                    current = await self.read()
                    if current == expected and current != restore:
                        await self.change(current, restore)
                except Exception as exc:
                    logging.warning('Could not restore source interval to %s: %s', restore, exc)
        self.report({'state': 'complete', 'completed': done, 'failures': failures, 'warnings': warnings, 'restored_resolution': restore})
