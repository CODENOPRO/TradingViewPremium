/* One source of truth for candle validation, session alignment and chart routing. */
const MarketData = (() => {
  const durations = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '6h': 21600, D: 86400, W: 604800 };
  const formatters = new Map();
  function parts(time, zone) {
    if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }));
    return Object.fromEntries(formatters.get(zone).formatToParts(new Date(time * 1000)).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  }
  function localTime(year, month, day, hour, minute, zone) {
    const target = Date.UTC(year, month - 1, day, hour, minute) / 1000;
    let value = target;
    for (let i = 0; i < 4; i++) {
      const p = parts(value, zone);
      const observed = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) / 1000;
      const delta = target - observed;
      value += delta;
      if (!delta) break;
    }
    return value;
  }
  function bucket(time, tf, metadata = {}) {
    if (tf === '1m') return time;
    const seconds = durations[tf];
    const zone = metadata.timezone || 'America/Chicago';
    const session = /^(\d{2})(\d{2})-/.exec(metadata.session || '1700-1600');
    const hour = session ? Number(session[1]) : 17, minute = session ? Number(session[2]) : 0;
    const p = parts(time, zone);
    const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
    if (p.hour * 60 + p.minute < hour * 60 + minute) date.setUTCDate(date.getUTCDate() - 1);
    if (tf === 'W') date.setUTCDate(date.getUTCDate() - (metadata.sessionType === 'RTH' ? (date.getUTCDay() + 6) % 7 : date.getUTCDay()));
    const open = localTime(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour, minute, zone);
    return tf === 'D' || tf === 'W' ? open : open + Math.floor((time - open) / seconds) * seconds;
  }
  function clean(values) {
    const result = new Map();
    for (const value of values || []) {
      if (!value || !['time', 'open', 'high', 'low', 'close'].every(k => Number.isFinite(value[k]))) continue;
      const volume = value.volume ?? 0;
      if (!Number.isFinite(volume) || volume < 0 || !Number.isInteger(value.time) || value.time <= 0 || value.low > Math.min(value.open, value.close) || value.high < Math.max(value.open, value.close)) continue;
      result.set(value.time, { time: value.time, open: value.open, high: value.high, low: value.low, close: value.close, volume });
    }
    return [...result.values()].sort((a, b) => a.time - b.time);
  }
  function aggregate(bars, tf, metadata) {
    if (tf === '1m') return bars.map(b => ({ ...b }));
    const result = new Map();
    for (const bar of bars) {
      const time = bucket(bar.time, tf, metadata);
      const current = result.get(time);
      if (!current) result.set(time, { ...bar, time });
      else { current.high = Math.max(current.high, bar.high); current.low = Math.min(current.low, bar.low); current.close = bar.close; current.volume += bar.volume; }
    }
    return [...result.values()];
  }
  function inRegularSession(bar, metadata) {
    const regular = metadata.sessionRegular;
    if (!regular?.session || !metadata.timezone) return false;
    const p = parts(bar.time, metadata.timezone);
    const date = `${p.year}${String(p.month).padStart(2, '0')}${String(p.day).padStart(2, '0')}`;
    let session = regular.session, corrected = false;
    for (const group of (regular.corrections || '').split(';')) {
      const index = group.indexOf(':');
      if (index >= 0 && group.slice(index + 1).split(',').includes(date)) { session = group.slice(0, index); corrected = true; break; }
    }
    if (session === 'dayoff' || (!corrected && (metadata.holidays || '').split(',').includes(date))) return false;
    const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
    if (weekday === 0 || weekday === 6) return false;
    const minute = p.hour * 60 + p.minute;
    return session.split(',').some(range => {
      const match = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(range);
      if (!match) return false;
      const start = Number(match[1]) * 60 + Number(match[2]), end = Number(match[3]) * 60 + Number(match[4]);
      return minute >= start && minute < end;
    });
  }
  return { durations, parts, localTime, bucket, clean, aggregate, inRegularSession };
})();
if (typeof module !== 'undefined') module.exports = MarketData;
