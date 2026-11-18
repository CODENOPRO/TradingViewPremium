/* Quantaibay Core — Constants, Schema, Timezone Clock, Cycle Math & Shared Series Helpers. */
const QTCore = (() => {
  const DAY_SEC = 86400;
  const HOUR_SEC = 3600;
  const MIN_SEC = 60;

  const TIMEZONES = [
    'UTC', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Phoenix',
    'America/Denver', 'America/Chicago', 'America/Mexico_City', 'America/New_York', 'America/Toronto',
    'America/Bogota', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'Atlantic/Reykjavik',
    'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
    'Europe/Rome', 'Europe/Zurich', 'Europe/Amsterdam', 'Europe/Stockholm', 'Europe/Athens',
    'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Moscow', 'Asia/Jerusalem', 'Africa/Cairo',
    'Africa/Johannesburg', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Tehran', 'Asia/Karachi', 'Asia/Kolkata',
    'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Ho_Chi_Minh', 'Asia/Jakarta', 'Asia/Shanghai', 'Asia/Hong_Kong',
    'Asia/Singapore', 'Asia/Taipei', 'Asia/Manila', 'Asia/Seoul', 'Asia/Tokyo', 'Australia/Perth',
    'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Sydney', 'Pacific/Auckland'
  ];

  const ASSET_OPTIONS = [
    'AUTO',
    'CME_MINI:NQ1!',
    'CME_MINI:ES1!',
    'CBOT_MINI:YM1!',
    'CME_MINI:MNQ1!',
    'CME_MINI:MES1!',
    'CBOT_MINI:MYM1!'
  ];

  const DEFAULTS = {
    // General
    tz: 'America/New_York',
    symA: 'AUTO',
    symB: 'CME_MINI:ES1!',
    symC: 'CBOT_MINI:YM1!',
    m1Timing: 'Bar Open (:23, :53, :08, :38)',

    // SSMT Display
    showSsmt: true,
    en0: true,
    en1: true,
    en2: true,
    en3: true,
    en4: true,
    en5: true,
    en6: true,
    showAll: false,
    showNorm: true,
    showHid: true,
    showOld: true,
    showSsmtTxt: true,
    maxRow: 10,

    // SSMT Style
    cBull: '#000000ff',
    cBear: '#000000ff',
    cHBull: '#000000ff',
    cHBear: '#000000ff',
    wN: 1,
    wH: 1,
    stN: 'Solid',
    stH: 'Dashed',
    lblClr: '#363a45d9',
    lblSizeIn: 'Small',

    // Cycle Lines / Q Labels
    showCycLines: true,
    lineColor: '#00000047',
    lineWidth: 1,
    cycOpenColor: '#2962ffff',
    cycOpenWidth: 1,
    cycOpenStyle: 'Dotted',
    maxVL: 150,
    showQLabels: true,
    qColor: '#363a4599',
    qSizeInput: 'Small',
    labelPadPct: 8.0,
    showSub: true,
    maxQL: 300,

    // AMDX / XAMD
    useAMDX: true,
    rangeMode: 'Previous Quarter (Q0 / Q4)',

    // Cycle Table
    showCycTbl: true,
    cycPos: 'top_right',
    cyTblSizeIn: 'Small',
    cyTblText: '#2a2e45cc',
    cyTblBg: '#e0e0e0ff',
    cyTblHi: '#ff98008c',
    cyTblFrame: '#787b8699',

    // True Open (unified as original)
    trTMCO: true,
    tr90: true,
    trTDO: true,
    trTWO: true,
    trTMO: true,
    trTQO: true,
    trTYO: true,

    // True Open Style
    trCol: '#2962ffff',
    trWid: 1,
    trStyleIn: 'Dashed',
    trShowLbl: true,
    trLblPos: 'Left',
    trLblVert: 'Above',
    trLblSizeIn: 'Small',
    trMaxKeep: 16,

    // Advanced PSP
    usePsp: true,
    maxPspBars: 30,
    pspVisLimit: '15m',
    pspMode: 'Body Only',
    pspBullClr: '#3292e042',
    pspBearClr: '#d8393936',
    pspBullShape: '●',
    pspBearShape: '●',
    pspSizeStr: 'Tiny',
    pspBullBody: '#2195f345',
    pspBearBody: '#dd455c47',
    pspShowSmt1: true,
    pspShowSmt2: true,
    pspInv1: false,
    pspInv2: false
  };

  const INPUT_SCHEMA = [
    // General
    { key: 'tz', label: 'Cycle Timezone', type: 'string', group: 'General', options: TIMEZONES, tooltip: 'Cycles and the weekly reset are anchored to 18:00 of this timezone. Keep America/New_York for NQ: it follows EST/EDT automatically.' },
    { key: 'symA', label: 'Asset 1 (AUTO = theo chart)', type: 'string', group: 'General', options: ASSET_OPTIONS, tooltip: 'AUTO tự lấy mã của từng chart (NQ/ES/YM) và gán 2 mã còn lại làm peer SSMT. Chọn mã cụ thể nếu muốn cố định như Pine gốc.' },
    { key: 'symB', label: 'Asset 2 (SSMT khi tắt AUTO)', type: 'string', group: 'General', options: ASSET_OPTIONS.slice(1) },
    { key: 'symC', label: 'Asset 3 (SSMT khi tắt AUTO)', type: 'string', group: 'General', options: ASSET_OPTIONS.slice(1) },
    { key: 'm1Timing', label: 'M1 Quarter Timing (22.5m)', type: 'string', group: 'General', options: ['Mid / Close (:22, :52, :07, :37)', 'Bar Open (:23, :53, :08, :38)'], tooltip: 'Chu kỳ Micro 22m30s cắt giữa nến :22/:52/:07/:37. Mid/Close dùng tâm/đóng nến (time + 30s) khớp vạch Q2/Q4 trên M1, sửa lỗi lệch 1 nến do chỉ lấy time mở nến.' },

    // SSMT Display
    { key: 'showSsmt', label: 'Enable SSMT', type: 'bool', group: 'SSMT Display', tooltip: 'Master switch. OFF = no SSMT calculation.' },
    { key: 'en0', label: '1M', type: 'bool', group: 'SSMT Display', inline: 'r1' },
    { key: 'en1', label: '5M', type: 'bool', group: 'SSMT Display', inline: 'r1' },
    { key: 'en2', label: '15M', type: 'bool', group: 'SSMT Display', inline: 'r1' },
    { key: 'en3', label: '1H', type: 'bool', group: 'SSMT Display', inline: 'r1' },
    { key: 'en4', label: '4H', type: 'bool', group: 'SSMT Display', inline: 'r2' },
    { key: 'en5', label: '6H', type: 'bool', group: 'SSMT Display', inline: 'r2' },
    { key: 'en6', label: '1D', type: 'bool', group: 'SSMT Display', inline: 'r2' },
    { key: 'showAll', label: 'Show all live SSMT of every TF', type: 'bool', group: 'SSMT Display', tooltip: 'Draws every enabled row, not only the row matching the chart TF.' },
    { key: 'showNorm', label: 'Normal SSMT', type: 'bool', group: 'SSMT Display', inline: 'k' },
    { key: 'showHid', label: 'Hidden SSMT', type: 'bool', group: 'SSMT Display', inline: 'k' },
    { key: 'showOld', label: 'Show SSMT of old cycles (still alive)', type: 'bool', group: 'SSMT Display' },
    { key: 'showSsmtTxt', label: 'Show SSMT text', type: 'bool', group: 'SSMT Display' },
    { key: 'maxRow', label: 'Max OLD-cycle SSMT kept per TF', type: 'int', group: 'SSMT Display', min: 0, max: 20, step: 1, tooltip: 'Only limits old-cycle SSMT (display only). SSMT of the current cycle are never dropped.' },

    // SSMT Style
    { key: 'cBull', label: 'Bull', type: 'color', group: 'SSMT Style', inline: 'c1' },
    { key: 'cBear', label: 'Bear', type: 'color', group: 'SSMT Style', inline: 'c1' },
    { key: 'cHBull', label: 'Hidden Bull', type: 'color', group: 'SSMT Style', inline: 'c2' },
    { key: 'cHBear', label: 'Hidden Bear', type: 'color', group: 'SSMT Style', inline: 'c2' },
    { key: 'wN', label: 'Normal width', type: 'int', group: 'SSMT Style', min: 1, max: 5, step: 1, inline: 'w' },
    { key: 'wH', label: 'Hidden width', type: 'int', group: 'SSMT Style', min: 1, max: 5, step: 1, inline: 'w' },
    { key: 'stN', label: 'Normal style', type: 'string', group: 'SSMT Style', options: ['Solid', 'Dotted', 'Dashed'], inline: 's' },
    { key: 'stH', label: 'Hidden style', type: 'string', group: 'SSMT Style', options: ['Solid', 'Dotted', 'Dashed'], inline: 's' },
    { key: 'lblClr', label: 'Text color', type: 'color', group: 'SSMT Style', inline: 't' },
    { key: 'lblSizeIn', label: 'Text size', type: 'string', group: 'SSMT Style', options: ['Tiny', 'Small', 'Normal', 'Large'], inline: 't' },

    // Cycle Lines / Q Labels
    { key: 'showCycLines', label: 'Show cycle vertical lines', type: 'bool', group: 'Cycle Lines / Q Labels' },
    { key: 'lineColor', label: 'Vertical Line', type: 'color', group: 'Cycle Lines / Q Labels' },
    { key: 'lineWidth', label: 'Line Width', type: 'int', group: 'Cycle Lines / Q Labels', min: 1, max: 3, step: 1 },
    { key: 'cycOpenColor', label: 'New cycle open line - color', type: 'color', group: 'Cycle Lines / Q Labels' },
    { key: 'cycOpenWidth', label: 'New cycle open line - width', type: 'int', group: 'Cycle Lines / Q Labels', min: 1, max: 5, step: 1 },
    { key: 'cycOpenStyle', label: 'New cycle open line - type', type: 'string', group: 'Cycle Lines / Q Labels', options: ['Solid', 'Dotted', 'Dashed'] },
    { key: 'maxVL', label: 'Max cycle lines kept', type: 'int', group: 'Cycle Lines / Q Labels', min: 10, max: 300, step: 1 },
    { key: 'showQLabels', label: 'Show Q Labels', type: 'bool', group: 'Cycle Lines / Q Labels' },
    { key: 'qColor', label: 'Q Text', type: 'color', group: 'Cycle Lines / Q Labels' },
    { key: 'qSizeInput', label: 'Q Text Size', type: 'string', group: 'Cycle Lines / Q Labels', options: ['Tiny', 'Small', 'Normal', 'Large', 'Huge'] },
    { key: 'labelPadPct', label: 'Label Offset (% of visible range)', type: 'float', group: 'Cycle Lines / Q Labels', min: 0, max: 50, step: 1 },
    { key: 'showSub', label: 'Show Day / Session names under Q', type: 'bool', group: 'Cycle Lines / Q Labels' },
    { key: 'maxQL', label: 'Max Q labels kept', type: 'int', group: 'Cycle Lines / Q Labels', min: 20, max: 450, step: 1 },

    // AMDX / XAMD
    { key: 'useAMDX', label: 'Use AMDX / XAMD letters (off = Q1-Q4)', type: 'bool', group: 'AMDX / XAMD' },
    { key: 'rangeMode', label: 'Reference Range', type: 'string', group: 'AMDX / XAMD', options: ['Previous Quarter (Q0 / Q4)', 'Whole Previous Cycle'] },

    // Cycle Table
    { key: 'showCycTbl', label: 'Show Cycle (AMDX) table', type: 'bool', group: 'Cycle Table' },
    { key: 'cycPos', label: 'Cycle table position', type: 'string', group: 'Cycle Table', options: ['top_right', 'top_center', 'top_left', 'middle_right', 'middle_center', 'middle_left', 'bottom_right', 'bottom_center', 'bottom_left'] },
    { key: 'cyTblSizeIn', label: 'Table Text Size', type: 'string', group: 'Cycle Table', options: ['Tiny', 'Small', 'Normal', 'Large'] },
    { key: 'cyTblText', label: 'Table Text', type: 'color', group: 'Cycle Table' },
    { key: 'cyTblBg', label: 'Table Background', type: 'color', group: 'Cycle Table' },
    { key: 'cyTblHi', label: 'Current Q Highlight', type: 'color', group: 'Cycle Table' },
    { key: 'cyTblFrame', label: 'Table Border', type: 'color', group: 'Cycle Table' },

    // True Open (unified as original)
    { key: 'trTMCO', label: 'TMCO - True Micro Open (chart 1M)', type: 'bool', group: 'True Open' },
    { key: 'tr90', label: '90 Open - TAO / TLO / TNY AM / TNY PM (chart 5M)', type: 'bool', group: 'True Open' },
    { key: 'trTDO', label: 'TDO - Daily Open (chart 15M)', type: 'bool', group: 'True Open' },
    { key: 'trTWO', label: 'TWO - Weekly Open (chart 1H)', type: 'bool', group: 'True Open' },
    { key: 'trTMO', label: 'TMO - Monthly Open (chart 4H)', type: 'bool', group: 'True Open' },
    { key: 'trTQO', label: 'TQO - Quarterly Open (chart 6H)', type: 'bool', group: 'True Open' },
    { key: 'trTYO', label: 'TYO - Yearly Open (chart D)', type: 'bool', group: 'True Open' },

    // True Open Style
    { key: 'trCol', label: 'Line / Text Color', type: 'color', group: 'True Open Style' },
    { key: 'trWid', label: 'Line Width', type: 'int', group: 'True Open Style', min: 1, max: 5, step: 1 },
    { key: 'trStyleIn', label: 'Line Style', type: 'string', group: 'True Open Style', options: ['Solid', 'Dashed', 'Dotted'] },
    { key: 'trShowLbl', label: 'Show Label', type: 'bool', group: 'True Open Style' },
    { key: 'trLblPos', label: 'Label Position (horizontal)', type: 'string', group: 'True Open Style', options: ['Left', 'Mid', 'Right'] },
    { key: 'trLblVert', label: 'Label Position (vertical)', type: 'string', group: 'True Open Style', options: ['Above', 'On line', 'Below'] },
    { key: 'trLblSizeIn', label: 'Label Size', type: 'string', group: 'True Open Style', options: ['Tiny', 'Small', 'Normal', 'Large'] },
    { key: 'trMaxKeep', label: 'Max cycles kept', type: 'int', group: 'True Open Style', min: 1, max: 100, step: 1 },

    // Advanced PSP
    { key: 'usePsp', label: 'Enable Advanced PSP', type: 'bool', group: 'Advanced PSP' },
    { key: 'maxPspBars', label: 'Max PSP Markers', type: 'int', group: 'Advanced PSP', min: 10, max: 500, step: 1 },
    { key: 'pspVisLimit', label: 'Show on Timeframes >=', type: 'string', group: 'Advanced PSP', options: ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', 'D', 'W'], tooltip: 'The PSP will only be visible if the Chart Timeframe is Greater Than or Equal to this setting.' },
    { key: 'pspMode', label: 'Display Mode', type: 'string', group: 'Advanced PSP', options: ['Icons Only', 'Body Only', 'Both'] },
    { key: 'pspBullClr', label: 'Bullish Icon', type: 'color', group: 'Advanced PSP', inline: 'psp_style' },
    { key: 'pspBearClr', label: 'Bearish Icon', type: 'color', group: 'Advanced PSP', inline: 'psp_style' },
    { key: 'pspBullShape', label: 'Bull Shape', type: 'string', group: 'Advanced PSP', options: ['●', '✦', '▲', '♦', '♟'], inline: 'psp_icon' },
    { key: 'pspBearShape', label: 'Bear Shape', type: 'string', group: 'Advanced PSP', options: ['●', '✦', '▼', '♦', '♟'], inline: 'psp_icon' },
    { key: 'pspSizeStr', label: 'Size', type: 'string', group: 'Advanced PSP', options: ['Tiny', 'Small', 'Normal', 'Large', 'Huge', 'Auto'], inline: 'psp_icon' },
    { key: 'pspBullBody', label: 'Bull Body', type: 'color', group: 'Advanced PSP', inline: 'psp_body' },
    { key: 'pspBearBody', label: 'Bear Body', type: 'color', group: 'Advanced PSP', inline: 'psp_body' },
    { key: 'pspShowSmt1', label: 'Show SMT 1', type: 'bool', group: 'Advanced PSP', inline: 'psp_smt' },
    { key: 'pspShowSmt2', label: 'Show SMT 2', type: 'bool', group: 'Advanced PSP', inline: 'psp_smt' },
    { key: 'pspInv1', label: 'Inverse Peer 1', type: 'bool', group: 'Advanced PSP', inline: 'psp_inv' },
    { key: 'pspInv2', label: 'Inverse Peer 2', type: 'bool', group: 'Advanced PSP', inline: 'psp_inv' }
  ];

  const TFN = ['1M', '5M', '15M', '1H', '4H', '6H', 'D'];
  const ROW_KEYS = ['1m', '5m', '15m', '1h', '4h', '6h', 'D'];
  const ROW_SEC = [60, 300, 900, 3600, 14400, 21600, 86400];

  const fmtCache = new Map();
  const partCache = new Map();
  const wallCache = new Map();

  function getFormatter(tz) {
    let fmt = fmtCache.get(tz);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23'
      });
      fmtCache.set(tz, fmt);
    }
    return fmt;
  }

  function parts(sec, tz) {
    const tInt = Math.floor(sec);
    const key = tz + ':' + tInt;
    let p = partCache.get(key);
    if (p) return p;
    if (tz === 'UTC') {
      const d = new Date(tInt * 1000);
      p = {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
        second: d.getUTCSeconds(),
        dow: d.getUTCDay() + 1
      };
    } else {
      const raw = getFormatter(tz).formatToParts(new Date(tInt * 1000));
      let year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0;
      for (let i = 0; i < raw.length; i++) {
        const it = raw[i];
        if (it.type === 'year') year = +it.value;
        else if (it.type === 'month') month = +it.value;
        else if (it.type === 'day') day = +it.value;
        else if (it.type === 'hour') hour = +it.value;
        else if (it.type === 'minute') minute = +it.value;
        else if (it.type === 'second') second = +it.value;
      }
      const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 1;
      p = { year, month, day, hour, minute, second, dow };
    }
    if (partCache.size >= 40000) partCache.clear();
    partCache.set(key, p);
    return p;
  }

  function timestamp(tz, year, month, day, hour = 0, minute = 0, second = 0) {
    const target = Date.UTC(year, month - 1, day, hour, minute, second) / 1000;
    if (tz === 'UTC') return target;
    const key = tz + ':' + target;
    const hit = wallCache.get(key);
    if (hit !== undefined) return hit;
    let val = target;
    for (let i = 0; i < 4; i++) {
      const p = parts(val, tz);
      const obs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) / 1000;
      const diff = target - obs;
      val += diff;
      if (!diff) break;
    }
    if (wallCache.size >= 20000) wallCache.clear();
    wallCache.set(key, val);
    return val;
  }

  function parseColor(raw, fallback = '#2962ff') {
    const str = String(raw || fallback).trim();
    if (/^#[0-9a-f]{8}$/i.test(str)) {
      const hex = str.slice(0, 7);
      const alpha = parseInt(str.slice(7, 9), 16) / 255;
      return {
        hex,
        opacity: Math.round(alpha * 100),
        css: `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${+alpha.toFixed(4)})`
      };
    }
    if (/^#[0-9a-f]{6}$/i.test(str)) {
      return { hex: str, opacity: 100, css: str };
    }
    const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/i.exec(str);
    if (m) {
      const r = +m[1], g = +m[2], b = +m[3], a = m[4] !== undefined ? +m[4] : 1;
      const hex = '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
      return { hex, opacity: Math.round(a * 100), css: `rgba(${r},${g},${b},${+a.toFixed(4)})` };
    }
    return { hex: fallback, opacity: 100, css: fallback };
  }

  const DARK_CANVAS_FALLBACKS = {
    cBull: '#e5e9f0f2',
    cBear: '#e5e9f0f2',
    cHBull: '#e5e9f0f2',
    cHBear: '#e5e9f0f2',
    lblClr: '#cbd5e1eb',
    lineColor: '#94a3b838',
    cycOpenColor: '#4dabf7ff',
    qColor: '#94a3b8cc',
    trCol: '#4dabf7ff',
    cyTblText: '#e2e8f0f2',
    cyTblBg: '#161b26e6',
    cyTblHi: '#f59e0b66',
    cyTblFrame: '#334155cc'
  };

  function isDarkCanvas(bg) {
    if (!bg) return false;
    const hex = parseColor(bg, '#c2baae').hex;
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return false;
    const ch = [1, 3, 5].map(i => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]) < 0.24;
  }

  function themeColor(s, key, darkBg, fallback) {
    const val = String(s[key] ?? DEFAULTS[key] ?? fallback);
    if (darkBg && DARK_CANVAS_FALLBACKS[key] && val.toLowerCase() === String(DEFAULTS[key]).toLowerCase()) {
      return parseColor(DARK_CANVAS_FALLBACKS[key], fallback);
    }
    return parseColor(val, fallback);
  }

  function sizePx(sizeStr, fallback = 11) {
    const s = String(sizeStr || '').toLowerCase();
    if (s === 'tiny') return 10;
    if (s === 'small') return 11;
    if (s === 'normal') return 13;
    if (s === 'large') return 16;
    if (s === 'huge') return 20;
    return fallback;
  }

  function lineStyleNorm(styleStr) {
    const s = String(styleStr || 'Solid').toLowerCase();
    return s === 'dashed' ? 'dashed' : s === 'dotted' ? 'dotted' : 'solid';
  }

  function tfToSeconds(tfStr) {
    const raw = String(tfStr || '15m').trim();
    const map = {
      '1': 60, '1m': 60, '3': 180, '3m': 180, '5': 300, '5m': 300,
      '10': 600, '10m': 600, '15': 900, '15m': 900, '30': 1800, '30m': 1800,
      '45': 2700, '45m': 2700, '60': 3600, '1h': 3600, '120': 7200, '2h': 7200,
      '180': 10800, '3h': 10800, '240': 14400, '4h': 14400, '360': 21600, '6h': 21600,
      '720': 43200, '12h': 43200, D: 86400, '1D': 86400, W: 604800, '1W': 604800,
      M: 2592000, '1M': 2592000, '3M': 7776000
    };
    if (map[raw] !== undefined) return map[raw];
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n * 60 : 900;
  }

  function shortSym(sym) {
    return String(sym || '').trim().split(':').pop();
  }

  function resolveTriad(chartSymbol, settings) {
    const own = shortSym(chartSymbol || 'NQ1!');
    if (settings.symA && settings.symA !== 'AUTO') {
      return [shortSym(settings.symA), shortSym(settings.symB), shortSym(settings.symC)];
    }
    const isMicro = own.startsWith('M') && ['MNQ1!', 'MES1!', 'MYM1!'].includes(own);
    const family = isMicro ? ['MNQ1!', 'MES1!', 'MYM1!'] : ['NQ1!', 'ES1!', 'YM1!'];
    if (family.includes(own)) {
      return [own, ...family.filter(x => x !== own)];
    }
    return ['NQ1!', 'ES1!', 'YM1!'];
  }

  function sessionStart(tSec, tz) {
    const p = parts(tSec, tz);
    const today1800 = timestamp(tz, p.year, p.month, p.day, 18, 0, 0);
    return tSec >= today1800 ? today1800 : timestamp(tz, p.year, p.month, p.day - 1, 18, 0, 0);
  }

  function weekCycleQ(sessSec, dow, tz) {
    const start = sessionStart(sessSec - (dow - 1) * DAY_SEC + 3 * HOUR_SEC, tz);
    const monday = start + 18 * HOUR_SEC;
    const mp = parts(monday, tz);
    const idx = Math.floor((mp.day - 1) / 7);
    const q = idx <= 3 ? idx + 1 : 0;
    return [start, q];
  }

  function wkStart(tSec, tz) {
    const sess = sessionStart(tSec, tz);
    const dow = parts(sess, tz).dow;
    return sessionStart(sess - (dow - 1) * DAY_SEC + 3 * HOUR_SEC, tz);
  }

  function wkNext(tSec, tz) {
    return sessionStart(wkStart(tSec, tz) + 7 * DAY_SEC + 3 * HOUR_SEC, tz);
  }

  function yearOpen(y, q, tz) {
    if (q === 1) return timestamp(tz, y, 1, 1, 18, 0, 0);
    if (q === 2) return timestamp(tz, y, 4, 2, 18, 0, 0);
    if (q === 3) return timestamp(tz, y, 7, 1, 18, 0, 0);
    if (q === 4) return timestamp(tz, y, 9, 29, 18, 0, 0);
    return timestamp(tz, y, 12, 29, 18, 0, 0);
  }

  function yearQ(tSec, tz) {
    let y = parts(tSec, tz).year;
    if (tSec < yearOpen(y, 1, tz)) y -= 1;
    const q = tSec >= yearOpen(y, 4, tz) ? 4 : tSec >= yearOpen(y, 3, tz) ? 3 : tSec >= yearOpen(y, 2, tz) ? 2 : 1;
    const start = yearOpen(y, q, tz);
    const mid = start + Math.trunc((yearOpen(y, q + 1, tz) - start) / 2);
    const q4End = yearOpen(y, 5, tz);
    return [start, mid, q, q4End];
  }

  function createSessionTracker(tz) {
    let cur = null, nxt = null, dow = 1, wStart = 0, wQ = 1;
    return function getSess(tSec) {
      if (cur === null || tSec >= nxt || tSec < cur) {
        cur = sessionStart(tSec, tz);
        const cp = parts(cur, tz);
        nxt = timestamp(tz, cp.year, cp.month, cp.day + 1, 18, 0, 0);
        dow = cp.dow;
        const w = weekCycleQ(cur, dow, tz);
        wStart = w[0];
        wQ = w[1];
      }
      return { sess: cur, dow, wkStart: wStart, wkQ: wQ };
    };
  }

  function makeCycleEvaluator(tz, m1UseMid) {
    const getSess = createSessionTracker(tz);
    return function evalCycle(barTimeSec, tfSec) {
      const evalT = (tfSec === 60 && m1UseMid) ? barTimeSec + 30 : barTimeSec;
      const { sess, dow, wkStart: ws, wkQ: wq } = getSess(evalT);
      let qMid = null, qNum = null, segStart = null, extra = null;

      if (tfSec === 60 || tfSec === 180 || tfSec === 300 || tfSec === 900) {
        const segSec = tfSec === 60 ? 1350 : tfSec === 900 ? 21600 : 5400;
        const idx = Math.floor((evalT - sess) / segSec);
        segStart = sess + idx * segSec;
        qNum = ((idx % 4) + 4) % 4 + 1;
        qMid = segStart + segSec / 2;
      } else if (tfSec === 3600) {
        qMid = sess + 12 * HOUR_SEC;
        qNum = dow <= 4 ? dow : 0;
        segStart = sess;
      } else if (tfSec === 14400) {
        qMid = ws + 2.5 * DAY_SEC;
        qNum = wq;
        segStart = ws;
      } else if (tfSec === 21600) {
        const tp = parts(evalT, tz);
        const qMonth = 3 * Math.floor((tp.month - 1) / 3) + 1;
        const quarterFirst = timestamp(tz, tp.year, qMonth, 1, 18, 0, 0);
        const qfDow = parts(quarterFirst, tz).dow;
        const cycleBase = quarterFirst + ((8 - qfDow) % 7) * DAY_SEC;
        const periodSec = 22.75 * DAY_SEC;
        qNum = Math.max(1, Math.min(4, Math.floor((evalT - cycleBase) / periodSec) + 1));
        segStart = cycleBase + Math.trunc((qNum - 1) * periodSec);
        qMid = segStart + Math.trunc(periodSec / 2);
      } else if (tfSec === 86400) {
        const [s, m, q, e] = yearQ(evalT, tz);
        segStart = s;
        qMid = m;
        qNum = q;
        extra = e;
      }
      return { qMid, qNum, segStart, extra, sess };
    };
  }

  function createAmdxTracker(wholeCycle) {
    let segHi = null, segLo = null, prevSegHi = null, prevSegLo = null;
    let cycHi = null, cycLo = null, refHi = null, refLo = null;
    let isX = false, cycId = null, pQ = null, pSS = null, pCl = null;

    return function stepAmdx(bar, qNum, segStart) {
      if (pQ === 1 && !isX && refHi !== null && refLo !== null) {
        if (pCl > refHi || pCl < refLo) isX = true;
      }
      const newSeg = segStart !== null && (pSS === null || segStart !== pSS);
      if (segStart !== null) {
        if (newSeg) {
          prevSegHi = segHi;
          prevSegLo = segLo;
          segHi = bar.high;
          segLo = bar.low;
          if (qNum === 1) {
            refHi = wholeCycle ? cycHi : prevSegHi;
            refLo = wholeCycle ? cycLo : prevSegLo;
            cycHi = bar.high;
            cycLo = bar.low;
            isX = false;
            cycId = segStart;
          } else {
            cycHi = cycHi === null ? bar.high : Math.max(cycHi, bar.high);
            cycLo = cycLo === null ? bar.low : Math.min(cycLo, bar.low);
          }
        } else {
          segHi = segHi === null ? bar.high : Math.max(segHi, bar.high);
          segLo = segLo === null ? bar.low : Math.min(segLo, bar.low);
          cycHi = cycHi === null ? bar.high : Math.max(cycHi, bar.high);
          cycLo = cycLo === null ? bar.low : Math.min(cycLo, bar.low);
        }
      }
      const haveRef = refHi !== null && refLo !== null;
      pQ = qNum;
      pSS = segStart;
      pCl = bar.close;
      return { isX, haveRef, cycId };
    };
  }

  function qText(q, isX, useLetters) {
    if (useLetters && q >= 1 && q <= 4) {
      return (isX ? 'XAMD' : 'AMDX')[q - 1];
    }
    return 'Q' + q;
  }

  function subText(tfKey, q) {
    if (tfKey === 3600) {
      return q === 1 ? 'Mon' : q === 2 ? 'Tue' : q === 3 ? 'Wed' : q === 4 ? 'Thu' : '';
    }
    if (tfKey === 900) {
      return q === 1 ? 'Asia' : q === 2 ? 'London' : q === 3 ? 'NY AM' : q === 4 ? 'NY PM' : '';
    }
    return '';
  }

  function formatQLabel(tfKey, q, isX, useLetters, withSub) {
    const base = qText(q, isX, useLetters);
    const sub = withSub ? subText(tfKey, q) : '';
    return sub ? base + '\n' + sub : base;
  }

  function getSeriesForRow(markets, symbol, tfKey, sessionMode, cutoffTime) {
    const sym = shortSym(symbol);
    const entry = markets?.[sym] || Object.entries(markets || {}).find(([k]) => shortSym(k) === sym)?.[1];
    if (!entry) return [];
    const meta = entry.metadata || { timezone: 'America/Chicago', session: '1700-1600' };
    const filterCut = arr => Number.isFinite(cutoffTime) ? arr.filter(b => b.time <= cutoffTime) : arr;

    if (sessionMode === 'RTH' && meta.sessionRegular?.session && !['D', 'W', '1M', '3M'].includes(tfKey) && typeof MarketData !== 'undefined') {
      const mins = filterCut(entry['1m'] || []).filter(b => MarketData.inRegularSession(b, meta));
      return MarketData.aggregate(mins, tfKey, { ...meta, session: meta.sessionRegular.session, sessionType: 'RTH' });
    }

    if (tfKey === '1m') return filterCut(entry['1m'] || []);

    const native = filterCut(entry[tfKey] || []);
    const mins = filterCut(entry['1m'] || []);
    if (!mins.length || typeof MarketData === 'undefined') return native;
    if (!native.length) return MarketData.aggregate(mins, tfKey, meta);

    const lastNativeOpen = native[native.length - 1].time;
    let idx = mins.length;
    while (idx > 0 && mins[idx - 1].time >= lastNativeOpen) idx--;
    if (idx >= mins.length) return native;
    const tailAgg = MarketData.aggregate(mins.slice(idx), tfKey, meta);
    if (!tailAgg.length) return native;
    const merged = native.slice(0, -1);
    if (tailAgg[0].time > lastNativeOpen) merged.push(native[native.length - 1]);
    for (const b of tailAgg) {
      if (!merged.length || b.time > merged[merged.length - 1].time) merged.push(b);
      else if (b.time === merged[merged.length - 1].time) merged[merged.length - 1] = b;
    }
    return merged;
  }

  function snapToChartBar(chartBars, tSec, tfSeconds) {
    if (!chartBars.length) return tSec;
    if (tSec <= chartBars[0].time) return chartBars[0].time;
    const last = chartBars[chartBars.length - 1].time;
    if (tSec >= last) {
      return tSec < last + tfSeconds ? last : tSec;
    }
    let lo = 0, hi = chartBars.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (chartBars[mid].time <= tSec) lo = mid;
      else hi = mid - 1;
    }
    return chartBars[lo].time;
  }

  function firstBarAtOrAfter(arr, tSec) {
    if (!arr.length) return tSec;
    if (tSec <= arr[0].time) return arr[0].time;
    if (tSec > arr[arr.length - 1].time) return tSec;
    let lo = 0, hi = arr.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].time < tSec) lo = mid + 1;
      else hi = mid;
    }
    return arr[lo].time;
  }

  return {
    DAY_SEC,
    HOUR_SEC,
    MIN_SEC,
    TIMEZONES,
    ASSET_OPTIONS,
    DEFAULTS,
    INPUT_SCHEMA,
    TFN,
    ROW_KEYS,
    ROW_SEC,
    parts,
    timestamp,
    parseColor,
    isDarkCanvas,
    themeColor,
    sizePx,
    lineStyleNorm,
    tfToSeconds,
    shortSym,
    resolveTriad,
    sessionStart,
    wkStart,
    wkNext,
    makeCycleEvaluator,
    createAmdxTracker,
    formatQLabel,
    getSeriesForRow,
    snapToChartBar,
    firstBarAtOrAfter
  };
})();

if (typeof window !== 'undefined') window.QTCore = QTCore;
if (typeof module !== 'undefined') module.exports = QTCore;
