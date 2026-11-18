/* Quantaibay (QT Cycle + AMDX + True Open + SSMT) — Native Web Engine.
 * Ported 1:1 from Quantaibay Pine v6 with M1 half-minute (:22:30/:52:30/:07:30/:37:30)
 * quarter alignment fix and multi-asset gap-safe segment tracking.
 */
const QuantaibayEngine = (() => {
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

  const TRUE_OPEN_ITEMS = [
    { id: 'trTMCO',  tier: 0, blk: -1, code: 'TMCO',   label: 'TMCO — True Micro Open',      short: 'Micro · 22.5m Q2' },
    { id: 'trTAO',   tier: 1, blk: 0,  code: 'TAO',    label: 'TAO — True Asia Open',        short: 'Asia · 19:30 NY' },
    { id: 'trTLO',   tier: 1, blk: 1,  code: 'TLO',    label: 'TLO — True London Open',      short: 'London · 01:30 NY' },
    { id: 'trTNYAM', tier: 1, blk: 2,  code: 'TNY AM', label: 'TNY AM — True NY AM Open',    short: 'NY AM · 07:30 NY' },
    { id: 'trTNYPM', tier: 1, blk: 3,  code: 'TNY PM', label: 'TNY PM — True NY PM Open',    short: 'NY PM · 13:30 NY' },
    { id: 'trTDO',   tier: 2, blk: -1, code: 'TDO',    label: 'TDO — True Daily Open',       short: 'Daily · 00:00 NY' },
    { id: 'trTWO',   tier: 3, blk: -1, code: 'TWO',    label: 'TWO — True Weekly Open',      short: 'Weekly · Tue Q2' },
    { id: 'trTMO',   tier: 4, blk: -1, code: 'TMO',    label: 'TMO — True Monthly Open',     short: 'Monthly · Week 2' },
    { id: 'trTQO',   tier: 5, blk: -1, code: 'TQO',    label: 'TQO — True Quarterly Open',   short: 'Quarterly · Q2' },
    { id: 'trTYO',   tier: 6, blk: -1, code: 'TYO',    label: 'TYO — True Yearly Open',      short: 'Yearly · Apr Q2' }
  ];

  const TRUE_OPEN_PER_ITEM_DEFAULTS = {};
  for (const it of TRUE_OPEN_ITEMS) {
    TRUE_OPEN_PER_ITEM_DEFAULTS[it.id] = true;
    TRUE_OPEN_PER_ITEM_DEFAULTS[it.id + '_col'] = '#2962ffff';
    TRUE_OPEN_PER_ITEM_DEFAULTS[it.id + '_st'] = 'Dashed';
    TRUE_OPEN_PER_ITEM_DEFAULTS[it.id + '_wid'] = 1;
    TRUE_OPEN_PER_ITEM_DEFAULTS[it.id + '_lbl'] = true;
    TRUE_OPEN_PER_ITEM_DEFAULTS[it.id + '_txt'] = '#2962ffff';
    TRUE_OPEN_PER_ITEM_DEFAULTS[it.id + '_sz'] = 'Small';
    TRUE_OPEN_PER_ITEM_DEFAULTS[it.id + '_pos'] = 'Left';
    TRUE_OPEN_PER_ITEM_DEFAULTS[it.id + '_vert'] = 'Above';
    TRUE_OPEN_PER_ITEM_DEFAULTS[it.id + '_keep'] = 16;
  }

  // Exact defaults matching quantaibay.txt (colors in #rrggbbaa where aa = 100% - Pine transp)
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
    lineColor: '#00000047',      // color.new(color.black, 72) -> 28% alpha = 0x47
    lineWidth: 1,
    cycOpenColor: '#2962ffff',   // color.new(#2962ff, 0)
    cycOpenWidth: 1,
    cycOpenStyle: 'Dotted',
    maxVL: 150,
    showQLabels: true,
    qColor: '#363a4599',         // color.new(#363a45, 40) -> 60% alpha = 0x99
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
    cyTblText: '#2a2e45cc',      // color.new(#2a2e45, 20) -> 80% alpha = 0xcc
    cyTblBg: '#e0e0e0ff',        // color.new(#e0e0e0, 0)
    cyTblHi: '#ff98008c',        // color.new(color.orange, 45) -> 55% alpha = 0x8c
    cyTblFrame: '#787b8699',     // color.new(color.gray, 40) -> 60% alpha = 0x99

    // True Open (legacy global fallbacks + complete independent per-True-Open settings)
    tr90: true,
    trCol: '#2962ffff',          // color.blue
    trWid: 1,
    trStyleIn: 'Dashed',
    trShowLbl: true,
    trLblPos: 'Left',
    trLblVert: 'Above',
    trLblSizeIn: 'Small',
    trMaxKeep: 16,
    ...TRUE_OPEN_PER_ITEM_DEFAULTS,

    // Advanced PSP
    usePsp: true,
    maxPspBars: 30,
    pspVisLimit: '15m',
    pspMode: 'Body Only',
    pspBullClr: '#3292e042',     // color.rgb(50, 146, 224, 74) -> 26% opacity
    pspBearClr: '#d8393936',     // color.rgb(216, 57, 57, 79) -> 21% opacity
    pspBullShape: '●',
    pspBearShape: '●',
    pspSizeStr: 'Tiny',
    pspBullBody: '#2195f345',    // color.new(#2195f3, 73) -> 27% opacity
    pspBearBody: '#dd455c47',    // color.new(#dd455c, 72) -> 28% opacity
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

    // True Open (Per-Item Individual Settings)
    ...TRUE_OPEN_ITEMS.flatMap(it => [
      { key: it.id,           label: it.label,                   type: 'bool',   group: 'True Open', toItem: it.id },
      { key: it.id + '_col',  label: `${it.code} Line Color`,    type: 'color',  group: 'True Open', toItem: it.id },
      { key: it.id + '_st',   label: `${it.code} Line Style`,    type: 'string', group: 'True Open', toItem: it.id, options: ['Solid', 'Dashed', 'Dotted'] },
      { key: it.id + '_wid',  label: `${it.code} Line Width`,    type: 'int',    group: 'True Open', toItem: it.id, min: 1, max: 5, step: 1 },
      { key: it.id + '_keep', label: `${it.code} Max Keep`,      type: 'int',    group: 'True Open', toItem: it.id, min: 1, max: 100, step: 1 },
      { key: it.id + '_lbl',  label: `${it.code} Show Label`,    type: 'bool',   group: 'True Open', toItem: it.id },
      { key: it.id + '_txt',  label: `${it.code} Text Color`,    type: 'color',  group: 'True Open', toItem: it.id },
      { key: it.id + '_pos',  label: `${it.code} Label H-Pos`,   type: 'string', group: 'True Open', toItem: it.id, options: ['Left', 'Mid', 'Right'] },
      { key: it.id + '_vert', label: `${it.code} Label V-Pos`,   type: 'string', group: 'True Open', toItem: it.id, options: ['Above', 'On line', 'Below'] },
      { key: it.id + '_sz',   label: `${it.code} Label Size`,    type: 'string', group: 'True Open', toItem: it.id, options: ['Tiny', 'Small', 'Normal', 'Large'] }
    ]),

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

  // Fast cached timezone decomposition & wall-clock timestamp builder
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
        dow: d.getUTCDay() + 1 // Pine dayofweek: Sunday=1 .. Saturday=7
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

  // ---- Shared Cycle Engine (anchored to 18:00 of selected tz) ----
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
      // M1 half-minute fix: Micro quarters are 22.5m (1350s), so Q2/Q4 start at :22:30 / :52:30 / :07:30 / :37:30.
      // Using bar midpoint (barTime + 30s) aligns candle :22/:52/:07/:37 with the :22:30/:07:30 boundary and vertical line.
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
        qNum = dow <= 4 ? dow : 0; // Sun(1)=Mon .. Wed(4)=Thu, Thu(5)=Fri(Q0)
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

  // Merge native HTF history with any newer 1m tail so Cycle Table & SSMT stay live on every tick
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
    // Re-aggregate from 1m starting at the bucket of the last native HTF candle so the forming tail is up to date
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

  // Snap a sub-bar LTF timestamp onto the containing HTF chart bar [bars[i].time, bars[i+1].time)
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

  // Refine an HTF pivot timestamp (which only stores HTF candle open time) onto the exact LTF chart candle
  // inside [htfTime, htfEnd) that actually formed the wick/body extreme -> eliminates HTF SSMT gap on M1/M5/M15!
  function refineHtfPivotTime(chartBars, htfTime, htfEnd, htfBar, dir, hid) {
    if (!chartBars.length) return htfTime;
    let lo = 0, hi = chartBars.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (chartBars[mid].time < htfTime) lo = mid + 1;
      else hi = mid;
    }
    if (lo >= chartBars.length || chartBars[lo].time >= htfEnd) return htfTime;

    let endIdx = lo;
    while (endIdx + 1 < chartBars.length && chartBars[endIdx + 1].time < htfEnd) {
      endIdx++;
    }

    if (hid) {
      if (htfBar) {
        if (dir === -1) return htfBar.close >= htfBar.open ? chartBars[endIdx].time : chartBars[lo].time;
        return htfBar.close <= htfBar.open ? chartBars[endIdx].time : chartBars[lo].time;
      }
      let bestT = chartBars[lo].time;
      let bestV = dir === -1 ? Math.max(chartBars[lo].open, chartBars[lo].close) : Math.min(chartBars[lo].open, chartBars[lo].close);
      for (let i = lo + 1; i <= endIdx; i++) {
        const v = dir === -1 ? Math.max(chartBars[i].open, chartBars[i].close) : Math.min(chartBars[i].open, chartBars[i].close);
        if (dir === -1 ? v >= bestV : v <= bestV) { bestV = v; bestT = chartBars[i].time; }
      }
      return bestT;
    }

    let bestT = chartBars[lo].time;
    let bestV = dir === -1 ? chartBars[lo].high : chartBars[lo].low;
    for (let i = lo + 1; i <= endIdx; i++) {
      const v = dir === -1 ? chartBars[i].high : chartBars[i].low;
      if (dir === -1 ? v >= bestV : v <= bestV) {
        bestV = v;
        bestT = chartBars[i].time;
      }
    }
    return bestT;
  }

  // Run one SSMT row across the 3 aligned assets (gap-safe segment rollover)
  function computeRowSsmtAndCode(r, cs, triad, markets, settings, evalCycle, needSsmt, needTable, sessionMode, cutoffTime) {
    const tfKey = ROW_KEYS[r];
    const barsA = getSeriesForRow(markets, triad[0], tfKey, sessionMode, cutoffTime);
    if (!barsA.length) return { ssmts: [], code: null };

    // Compute Cycle Table AMDX code for Asset 1 if needed
    let tableCode = null;
    if (needTable) {
      const stepAmdx = createAmdxTracker(settings.rangeMode === 'Whole Previous Cycle');
      let lastQ = null, lastRes = null;
      for (let i = 0; i < barsA.length; i++) {
        const b = barsA[i];
        const cyc = evalCycle(b.time, cs);
        lastQ = cyc.qNum;
        lastRes = stepAmdx(b, cyc.qNum, cyc.segStart);
      }
      if (lastQ !== null && lastQ !== undefined && lastRes) {
        tableCode = lastQ * 4 + (lastRes.isX ? 2 : 0) + (lastRes.haveRef ? 1 : 0);
      }
    }

    if (!needSsmt) return { ssmts: [], code: tableCode };

    const barsB = getSeriesForRow(markets, triad[1], tfKey, sessionMode, cutoffTime);
    const barsC = getSeriesForRow(markets, triad[2], tfKey, sessionMode, cutoffTime);

    // Rows 1M..1H are wiped every Sunday 18:00 anyway -> skip history older than current week - 2 days
    const lastBarTime = barsA[barsA.length - 1].time;
    const cutSec = r <= 3 ? wkStart(lastBarTime, settings.tz) - 2 * DAY_SEC : -Infinity;

    const sliceFrom = (arr, minT) => {
      if (minT === -Infinity || !arr.length) return arr;
      let lo = 0, hi = arr.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid].time < minT) lo = mid + 1;
        else hi = mid;
      }
      return lo > 0 ? arr.slice(lo) : arr;
    };

    const sA = sliceFrom(barsA, cutSec);
    const sB = sliceFrom(barsB, cutSec);
    const sC = sliceFrom(barsC, cutSec);
    if (!sA.length || (!sB.length && !sC.length)) return { ssmts: [], code: tableCode };

    const activeAssets = [sA.length > 0, sB.length > 0, sC.length > 0];
    const activeCount = (activeAssets[0] ? 1 : 0) + (activeAssets[1] ? 1 : 0) + (activeAssets[2] ? 1 : 0);

    // Build sorted union of timestamps across all 3 assets so peer segment transitions never lag on missing bars
    const mapA = new Map(), mapB = new Map(), mapC = new Map();
    const timeSet = new Set();
    for (let i = 0; i < sA.length; i++) { mapA.set(sA[i].time, sA[i]); timeSet.add(sA[i].time); }
    for (let i = 0; i < sB.length; i++) { mapB.set(sB[i].time, sB[i]); timeSet.add(sB[i].time); }
    for (let i = 0; i < sC.length; i++) { mapC.set(sC[i].time, sC[i]); timeSet.add(sC[i].time); }
    const timeline = Array.from(timeSet).sort((a, b) => a - b);
    const maps = [mapA, mapB, mapC];

    // Per-asset segment state: c=[H, L, bodyH, bodyL], p=[prevH..], ct=[tH..], pt=[ptH..]
    const segState = [0, 1, 2].map(() => ({
      last: null,
      cq: null,
      pq: null,
      c: [null, null, null, null],
      p: [null, null, null, null],
      ct: [null, null, null, null],
      pt: [null, null, null, null]
    }));

    let live = [];
    let cycId = 0;
    let nextWeekReset = 0;

    const capOld = () => {
      let oldCnt = 0;
      for (let i = 0; i < live.length; i++) if (live[i].old) oldCnt++;
      let excess = oldCnt - settings.maxRow;
      if (excess > 0) {
        let i = 0;
        while (excess > 0 && i < live.length) {
          if (live[i].old) { live.splice(i, 1); excess--; }
          else i++;
        }
      }
    };

    for (let step = 0; step < timeline.length; step++) {
      const t = timeline[step];
      const { qNum: q, segStart: ss } = evalCycle(t, cs);

      // Update segment trackers for all 3 assets cleanly at exact segment boundary ss
      for (let a = 0; a < 3; a++) {
        const st = segState[a];
        if (ss !== null && (st.last === null || st.last !== ss)) {
          st.p = [st.c[0], st.c[1], st.c[2], st.c[3]];
          st.pt = [st.ct[0], st.ct[1], st.ct[2], st.ct[3]];
          st.pq = st.cq;
          st.c = [null, null, null, null];
          st.ct = [null, null, null, null];
          st.cq = q;
          st.last = ss;
        }
        const bar = maps[a].get(t);
        if (bar) {
          const bh = Math.max(bar.open, bar.close);
          const bl = Math.min(bar.open, bar.close);
          if (st.c[0] === null || bar.high >= st.c[0]) { st.c[0] = bar.high; st.ct[0] = t; }
          if (st.c[1] === null || bar.low <= st.c[1]) { st.c[1] = bar.low; st.ct[1] = t; }
          if (st.c[2] === null || bh >= st.c[2]) { st.c[2] = bh; st.ct[2] = t; }
          if (st.c[3] === null || bl <= st.c[3]) { st.c[3] = bl; st.ct[3] = t; }
        }
      }

      // Weekly reset (1M / 5M / 15M / 1H only) anchored to Sunday 18:00 tz
      if (t >= nextWeekReset) {
        nextWeekReset = wkNext(t, settings.tz);
        if (r <= 3) {
          live = [];
          cycId = 0;
        }
      }

      // Only evaluate SSMT creation & Asset 1 coordinate updates when Asset 1 has data in this segment
      const barA = mapA.get(t);
      if (q !== null && ss !== null) {
        if (q === 1 && ss !== cycId) {
          cycId = ss;
          for (let i = 0; i < live.length; i++) live[i].old = true;
          capOld();
        }

        if (barA) {
          for (let k = 0; k < 4; k++) {
            const hid = k >= 2;
            const dr = k % 2 === 0 ? -1 : 1; // -1 bear, 1 bull
            if ((hid && !settings.showHid) || (!hid && !settings.showNorm)) continue;
            const f = (dr === -1 ? 0 : 1) + (hid ? 2 : 0);
            let cnt = 0;
            let prvOk = activeCount >= 2;
            for (let a = 0; a < 3; a++) {
              if (!activeAssets[a]) continue;
              const prv = segState[a].p[f];
              const cur = segState[a].c[f];
              if (prv === null || cur === null) { prvOk = false; break; }
              if (dr === -1 ? cur > prv : cur < prv) cnt++;
            }
            if (prvOk && cnt >= 1 && cnt < activeCount && !live.some(o => o.dir === dr && o.hid === hid && o.seg === ss)) {
              const rf = [0, 1, 2].map(a => segState[a].p[f]);
              const lt = [0, 1, 2].map(a => {
                const cur = segState[a].c[f];
                return cur !== null && (dr === -1 ? cur > rf[a] : cur < rf[a]);
              });
              const q1 = segState[0].pq !== null && segState[0].pq !== undefined ? segState[0].pq : (((q + 2) % 4) + 1);
              live.push({
                dir: dr, hid, seg: ss, q1, q2: q, ref: rf, lat: lt, old: false,
                tx1: null, py1: null, tx2: null, py2: null
              });
            }
          }
        }
      }

      // Check invalidation (all 3 assets swept ref) & update Asset 1 line coordinates in creating Q
      for (let i = live.length - 1; i >= 0; i--) {
        const o = live[i];
        const f = (o.dir === -1 ? 0 : 1) + (o.hid ? 2 : 0);
        let nl = 0;
        for (let a = 0; a < 3; a++) {
          if (!activeAssets[a]) continue;
          const cur = segState[a].c[f];
          const rv = o.ref[a];
          if (!o.lat[a] && cur !== null && rv !== null && (o.dir === -1 ? cur > rv : cur < rv)) {
            o.lat[a] = true;
          }
          if (o.lat[a]) nl++;
        }
        if (nl >= activeCount) {
          live.splice(i, 1);
          continue;
        }
        if (ss !== null && o.seg === ss && segState[0].c[f] !== null && segState[0].p[f] !== null) {
          o.tx1 = segState[0].pt[f];
          o.py1 = segState[0].p[f];
          o.tx2 = segState[0].ct[f];
          o.py2 = segState[0].c[f];
        }
      }
    }

    return { ssmts: live, code: tableCode, mapA };
  }

  function calculate(chartBars, context = {}) {
    const rawIn = context.settings || {};
    const s = { ...DEFAULTS, ...rawIn };
    const bars = Array.isArray(chartBars) ? chartBars : [];
    const tf = context.timeframe || '1m';
    const isWeekly = tf === 'W' || tf === '1W';
    const isDaily = tf === 'D' || tf === '1D';
    const chartSec = context.timeframeSeconds || ({
      '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
      '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '12h': 43200,
      D: 86400, W: 604800, '1M': 2592000, '3M': 7776000
    }[tf] || 60);

    const tfKey = (isDaily || isWeekly) ? 86400 : chartSec;
    const chartRow = chartSec === 60 ? 0
      : chartSec === 300 ? 1
      : chartSec === 900 ? 2
      : chartSec === 3600 ? 3
      : chartSec === 14400 ? 4
      : chartSec === 21600 ? 5
      : (chartSec === 86400 || isWeekly) ? 6
      : -1;

    const m1UseMid = s.m1Timing !== 'Bar Open (:23, :53, :08, :38)';
    const evalCycle = makeCycleEvaluator(s.tz, m1UseMid);
    const triad = resolveTriad(context.symbol || 'NQ1!', s);
    const markets = { ...(context.markets || {}) };
    const ownShort = shortSym(context.symbol || 'NQ1!');
    if (!markets[ownShort] && bars.length) {
      markets[ownShort] = { [tf]: bars, metadata: context.metadata || {} };
    }

    const rowOn = [s.en0, s.en1, s.en2, s.en3, s.en4, s.en5, s.en6];
    const rowDr = rowOn.map((on, i) => !!(s.showSsmt && on && (s.showAll || i === chartRow)));
    const sessionMode = context.sessionMode || 'ETH';
    // Bound all multi-asset & 1m-tail queries to the chart's actual last candle so QT never draws future lines past closed/stalled chart candles
    const cutoffTime = bars.length
      ? (context.replay ? bars[bars.length - 1].time : bars[bars.length - 1].time + chartSec - 1)
      : undefined;

    const drawings = [];
    const qLabelMeta = []; // Dynamic Y-pinning metadata so scrolling/zooming updates pinY in O(k)
    const trLabelMeta = []; // Dynamic X-pinning metadata so spanning HTF True Open labels stay visible
    const warnings = [];

    const firstBarAtOrAfter = (arr, tSec) => {
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
    };

    const darkBg = isDarkCanvas(context.chartBg);

    // ---- 1. Cycle Vertical Lines + Q Labels + Multi-TF True Open ----
    if (bars.length) {
      const stepChartAmdx = createAmdxTracker(s.rangeMode === 'Whole Previous Cycle');
      const vLines = [];
      const qLabels = [];
      const trLines = [];
      const trLabels = [];

      const cVLine = themeColor(s, 'lineColor', darkBg, '#000000');
      const cOpenLine = themeColor(s, 'cycOpenColor', darkBg, '#2962ff');
      const cQText = themeColor(s, 'qColor', darkBg, '#363a45');
      const qFontPx = sizePx(s.qSizeInput, 11);
      const cycOpenStyle = lineStyleNorm(s.cycOpenStyle);

      let prevSeg = null;
      let prevBarMid = null;
      let prevIsX = false;
      let prevUseLetters = false;
      let curLbl = null;
      let curStartIdx = null;
      let q1Lbl = null;
      let q1LblCyc = null;

      const pushVLine = (tSec, isOpen, refBar) => {
        const col = isOpen ? cOpenLine : cVLine;
        vLines.push({
          type: 'line',
          axis: 'vertical',
          p1: { time: tSec, price: refBar.low },
          p2: { time: tSec, price: refBar.high },
          borderColor: col.hex,
          strokeOpacity: col.opacity,
          width: isOpen ? s.cycOpenWidth : s.lineWidth,
          lineStyle: isOpen ? cycOpenStyle : 'dotted',
          extend: 'both'
        });
        if (vLines.length > s.maxVL) vLines.shift();
      };

      for (let i = 0; i < bars.length; i++) {
        const b = bars[i];
        const prevBar = i > 0 ? bars[i - 1] : null;
        const { qMid: cQMid, qNum: cQNum, segStart: cSeg, extra: cExtra } = evalCycle(b.time, tfKey);
        const { isX: cIsX, haveRef: cHave, cycId: cCyc } = stepChartAmdx(b, cQNum, cSeg);

        // Vertical cycle lines
        if (s.showCycLines && cSeg !== null && (i === 0 || cSeg !== prevSeg)) {
          // Snap M1 :22:30/:07:30 or weekend/holiday gap starts cleanly onto the opening candle of the segment
          const lineTime = (tfKey === 60 && m1UseMid && i > 0)
            ? b.time
            : (prevBar && cSeg > prevBar.time && cSeg <= b.time ? b.time : cSeg);
          pushVLine(lineTime, cQNum === 1, b);
        }
        if (s.showCycLines && cExtra !== null && cQNum === 4 && b.time >= cExtra && (!prevBar || prevBar.time < cExtra)) {
          pushVLine(prevBar && cExtra > prevBar.time && cExtra <= b.time ? b.time : cExtra, true, b);
        }

        // Q / AMDX Labels
        const useLetters = !!(s.useAMDX && cHave);
        const barMid = b.time + chartSec / 2;

        if (s.showQLabels) {
          if (cSeg !== null && prevSeg !== null && cSeg !== prevSeg) {
            if (curLbl && curStartIdx !== null) {
              const midIdx = Math.round((curStartIdx + i - 1) / 2);
              curLbl.p1.time = bars[Math.max(0, Math.min(bars.length - 1, midIdx))].time;
            }
            curLbl = null;
            curStartIdx = i;
          } else if (cSeg !== null && curStartIdx === null) {
            curStartIdx = i;
          }

          const hit = cQMid !== null && cQNum !== null && cQNum >= 1 && cQNum <= 4
            && barMid >= cQMid && prevBarMid !== null && prevBarMid < cQMid;

          if (hit) {
            const newLbl = {
              type: 'text',
              _qtQLabel: true,
              p1: { time: b.time, price: b.low },
              text: formatQLabel(tfKey, cQNum, cIsX, useLetters, s.showSub),
              labelBg: null,
              textStyle: {
                pine: true,
                placement: 'center',
                color: cQText.css,
                size: qFontPx,
                horizontal: 'center',
                vertical: 'inside'
              }
            };
            qLabels.push(newLbl);
            if (qLabels.length > s.maxQL) qLabels.shift();
            curLbl = newLbl;
            if (cQNum === 1) {
              q1Lbl = newLbl;
              q1LblCyc = cCyc;
            }
          }

          if (q1Lbl && cCyc !== null && cCyc === q1LblCyc && (cIsX !== prevIsX || useLetters !== prevUseLetters)) {
            q1Lbl.text = formatQLabel(tfKey, 1, cIsX, useLetters, s.showSub);
          }
        }

        prevSeg = cSeg;
        prevBarMid = barMid;
        prevIsX = cIsX;
        prevUseLetters = useLetters;
      }

      // Multi-TF True Open: independent settings per True Open (TMCO, TAO, TLO, TNY AM, TNY PM, TDO, TWO, TMO, TQO, TYO)
      const TR_SPANS = [4050, 16200, 64800, 259200, 1814400, 5896800, 23414400];
      const firstChartT = bars[0].time;
      const lastChartT = bars[bars.length - 1].time;
      const maxFutureT = lastChartT + chartSec * 45;

      const resolveToColor = rawVal => {
        const str = String(rawVal || '#2962ffff');
        if (darkBg && str.toLowerCase() === '#2962ffff') return parseColor('#4dabf7ff', '#4dabf7');
        return parseColor(str, '#2962ff');
      };

      const itemCfgMap = new Map();
      const itemsByTier = Array.from({ length: 7 }, () => []);
      for (const item of TRUE_OPEN_ITEMS) {
        const id = item.id;
        const en = (item.tier === 1 && rawIn.tr90 === false && rawIn[id] === undefined) ? false : !!s[id];
        const colRaw = rawIn[id + '_col'] ?? rawIn.trCol ?? s[id + '_col'];
        const txtRaw = rawIn[id + '_txt'] ?? (rawIn[id + '_col'] !== undefined && s[id + '_txt'] === DEFAULTS[id + '_txt'] ? rawIn[id + '_col'] : (rawIn.trCol ?? s[id + '_txt']));
        const stRaw = rawIn[id + '_st'] ?? rawIn.trStyleIn ?? s[id + '_st'];
        const widRaw = rawIn[id + '_wid'] ?? rawIn.trWid ?? s[id + '_wid'];
        const lblRaw = rawIn[id + '_lbl'] ?? rawIn.trShowLbl ?? s[id + '_lbl'];
        const szRaw = rawIn[id + '_sz'] ?? rawIn.trLblSizeIn ?? s[id + '_sz'];
        const pos = rawIn[id + '_pos'] ?? rawIn.trLblPos ?? s[id + '_pos'];
        const vert = rawIn[id + '_vert'] ?? rawIn.trLblVert ?? s[id + '_vert'];
        const keep = Math.max(1, Number(rawIn[id + '_keep'] ?? rawIn.trMaxKeep ?? s[id + '_keep']) || 16);

        let placement = 'center', horizontal = 'center';
        if (vert === 'Above') {
          placement = 'above';
          horizontal = pos === 'Left' ? 'left' : pos === 'Right' ? 'right' : 'center';
        } else if (vert === 'Below') {
          placement = 'below';
          horizontal = pos === 'Left' ? 'left' : pos === 'Right' ? 'right' : 'center';
        } else {
          placement = pos === 'Left' ? 'label_left' : pos === 'Right' ? 'label_right' : 'center';
          horizontal = pos === 'Left' ? 'left' : pos === 'Right' ? 'right' : 'center';
        }

        const cfg = {
          item,
          en,
          col: resolveToColor(colRaw),
          txtCol: resolveToColor(txtRaw),
          lineStyle: lineStyleNorm(stRaw),
          width: Math.max(1, Math.min(5, Number(widRaw) || 1)),
          showLbl: !!lblRaw,
          fontPx: sizePx(szRaw, 11),
          pos,
          vert,
          placement,
          horizontal,
          keep
        };
        itemCfgMap.set(id, cfg);
        itemsByTier[item.tier].push(cfg);
      }

      // Emit from highest tier (TYO) down to lowest tier (TMCO) so HTF True Open labels claim anti-collision priority first
      for (let r = 6; r >= 0; r--) {
        const tierCfgs = itemsByTier[r];
        if (!tierCfgs.some(c => c.en) || TR_SPANS[r] < chartSec * 2) continue;
        let srcBars = getSeriesForRow(markets, ownShort, ROW_KEYS[r], sessionMode, cutoffTime);
        if (r === 5 && srcBars.length) {
          const h4 = getSeriesForRow(markets, ownShort, '4h', sessionMode, cutoffTime);
          if (h4.length && h4[0].time < srcBars[0].time) {
            const cut = srcBars[0].time;
            srcBars = [...h4.filter(b => b.time < cut), ...srcBars];
          }
        }
        if (!srcBars.length && ROW_SEC[r] >= chartSec) srcBars = bars;
        if (!srcBars.length) continue;

        const cs = ROW_SEC[r];
        let pQ = null;
        let pSeg = null;
        const foundBuckets = new Map();
        for (const c of tierCfgs) if (c.en) foundBuckets.set(c.item.id, []);

        for (let i = 0; i < srcBars.length; i++) {
          const b = srcBars[i];
          const { qNum: cQNum, segStart: cSeg, extra: cExtra, sess: cSess } = evalCycle(b.time, cs);
          const q2Start = cQNum === 2 && i > 0 && pQ !== null && (pQ !== 2 || cSeg !== pSeg);
          if (q2Start) {
            let endT = null, txt = '', cfg = null;
            if (r === 0) {
              endT = cSeg + Math.trunc(67.5 * MIN_SEC);
              txt = 'TMCO';
              cfg = tierCfgs[0];
            } else if (r === 1) {
              const blk = ((Math.floor((b.time - cSess) / (6 * HOUR_SEC)) % 4) + 4) % 4;
              txt = blk === 0 ? 'TAO' : blk === 1 ? 'TLO' : blk === 2 ? 'TNY AM' : 'TNY PM';
              endT = cSeg + 270 * MIN_SEC;
              cfg = tierCfgs[blk];
            } else if (r === 2) {
              endT = cSeg + 18 * HOUR_SEC;
              txt = 'TDO';
              cfg = tierCfgs[0];
            } else if (r === 3) {
              endT = sessionStart(cSeg + 3 * DAY_SEC + 3 * HOUR_SEC, s.tz);
              txt = 'TWO';
              cfg = tierCfgs[0];
            } else if (r === 4) {
              endT = sessionStart(cSeg + 21 * DAY_SEC + 3 * HOUR_SEC, s.tz);
              txt = 'TMO';
              cfg = tierCfgs[0];
            } else if (r === 5) {
              endT = cSeg + Math.trunc(68.25 * DAY_SEC);
              txt = 'TQO';
              cfg = tierCfgs[0];
            } else if (r === 6) {
              endT = cExtra;
              txt = 'TYO';
              cfg = tierCfgs[0];
            }
            if (endT !== null && cfg?.en) {
              const bucket = foundBuckets.get(cfg.item.id);
              bucket.push({ startT: b.time, endT, price: b.open, txt, cfg });
              if (bucket.length > cfg.keep) bucket.shift();
            }
          }
          pQ = cQNum;
          pSeg = cSeg;
        }

        const mergedFound = [];
        for (const bucket of foundBuckets.values()) mergedFound.push(...bucket);
        mergedFound.sort((a, b) => b.startT - a.startT);

        for (let j = 0; j < mergedFound.length; j++) {
          const it = mergedFound[j];
          const cfg = it.cfg;
          if (it.endT < firstChartT || it.startT >= lastChartT + chartSec) continue;
          const x1 = it.startT <= firstChartT
            ? firstChartT
            : cs < chartSec
              ? snapToChartBar(bars, it.startT, chartSec)
              : firstBarAtOrAfter(bars, it.startT);
          const x2 = it.endT <= lastChartT
            ? snapToChartBar(bars, it.endT, chartSec)
            : Math.min(it.endT, maxFutureT);
          if (x2 <= x1) continue;

          const isActive = it.endT > lastChartT;
          const lineOpacity = (!isActive && r <= 1)
            ? Math.max(28, Math.round(cfg.col.opacity * (r === 0 ? 0.5 : 0.68)))
            : cfg.col.opacity;
          const txtOpacity = (!isActive && r <= 1)
            ? Math.max(28, Math.round(cfg.txtCol.opacity * (r === 0 ? 0.55 : 0.72)))
            : cfg.txtCol.opacity;
          const lblCss = (!isActive && r <= 1)
            ? parseColor(cfg.txtCol.hex + Math.round((txtOpacity / 100) * 255).toString(16).padStart(2, '0')).css
            : cfg.txtCol.css;

          const onLineLbl = cfg.showLbl && cfg.vert === 'On line';
          trLines.push({
            type: 'line',
            _qtTrueOpen: true,
            _qtTier: r,
            _qtTrActive: isActive,
            p1: { time: x1, price: it.price },
            p2: { time: x2, price: it.price },
            borderColor: cfg.col.hex,
            strokeOpacity: lineOpacity,
            width: cfg.width,
            lineStyle: cfg.lineStyle,
            ...(onLineLbl ? {
              text: it.txt,
              textStyle: {
                inlineOnLine: true,
                inlinePos: cfg.pos === 'Left' ? 'left' : cfg.pos === 'Right' ? 'right' : 'center',
                color: lblCss,
                size: cfg.fontPx
              }
            } : {})
          });

          if (cfg.showLbl && !onLineLbl) {
            const lx = cfg.pos === 'Left' ? x1 : cfg.pos === 'Right' ? x2 : Math.trunc((x1 + x2) / 2);
            const lbl = {
              type: 'text',
              _qtTrueOpenOnLine: false,
              _qtTier: r,
              _qtTrActive: isActive,
              _qtTrueOpenSpan: { x1, x2, pos: cfg.pos },
              p1: { time: lx, price: it.price },
              text: it.txt,
              labelBg: null,
              textStyle: {
                pine: true,
                placement: cfg.placement,
                color: lblCss,
                size: cfg.fontPx,
                horizontal: cfg.horizontal,
                vertical: 'inside'
              }
            };
            trLabels.push(lbl);
            trLabelMeta.push(lbl);
          }
        }
      }

      // Pin Q labels and spanning HTF True Open labels to Initial Visible Range
      pinQLabels(qLabels, bars, context.visibleLogicalRange, s.labelPadPct);
      pinTrueOpenLabels(trLabels, bars, context.visibleLogicalRange, chartSec);
      for (const lb of qLabels) qLabelMeta.push(lb);

      drawings.push(...vLines, ...trLines, ...trLabels, ...qLabels);
    }

    // ---- 2. SSMT Rows + Cycle (AMDX) Table ----
    const rowCodes = new Array(7).fill(null);
    const cBull = themeColor(s, 'cBull', darkBg, '#000000');
    const cBear = themeColor(s, 'cBear', darkBg, '#000000');
    const cHBull = themeColor(s, 'cHBull', darkBg, '#000000');
    const cHBear = themeColor(s, 'cHBear', darkBg, '#000000');
    const cSsmtLbl = themeColor(s, 'lblClr', darkBg, '#363a45');
    const ssmtLblPx = sizePx(s.lblSizeIn, 11);
    const stNorm = lineStyleNorm(s.stN);
    const stHid = lineStyleNorm(s.stH);
    const chartFirstT = bars.length ? bars[0].time : 0;
    const chartLastT = bars.length ? bars[bars.length - 1].time : 0;
    const chartEndT = chartLastT + chartSec;
    const ssmtBySegment = new Map();

    for (let r = 0; r < 7; r++) {
      const wantSsmt = rowDr[r];
      const wantTbl = !!s.showCycTbl;
      if (!wantSsmt && !wantTbl) continue;

      const { ssmts, code, mapA } = computeRowSsmtAndCode(
        r, ROW_SEC[r], triad, markets, s, evalCycle,
        wantSsmt, wantTbl, sessionMode, cutoffTime
      );
      rowCodes[r] = code;

      if (wantSsmt && ssmts.length && bars.length) {
        const snapSubBar = ROW_SEC[r] < chartSec;
        const refineSuperBar = ROW_SEC[r] > chartSec;
        const htfEndOf = t => r === 6 ? sessionStart(t + 27 * HOUR_SEC, s.tz) : t + ROW_SEC[r];

        for (let i = 0; i < ssmts.length; i++) {
          const o = ssmts[i];
          // Hidden SSMT suppressed when normal SSMT of SAME row, SAME Q and SAME direction is drawn
          let hideH = false;
          if (o.hid && s.showNorm) {
            for (let j = 0; j < ssmts.length; j++) {
              const p = ssmts[j];
              if (!p.hid && p.dir === o.dir && p.seg === o.seg && (s.showOld || !p.old)) {
                hideH = true;
                break;
              }
            }
          }
          const want = !hideH
            && (o.hid ? s.showHid : s.showNorm)
            && (s.showOld || !o.old)
            && o.tx1 !== null && o.tx2 !== null && o.py1 !== null && o.py2 !== null;

          if (!want) continue;

          // Reject SSMTs whose pivots lie outside the chart's loaded candle range (prevents stacking on Bar 0 or floating past last candle)
          const p1End = refineSuperBar ? htfEndOf(o.tx1) : o.tx1 + ROW_SEC[r];
          if (p1End <= chartFirstT || (!refineSuperBar && o.tx1 < chartFirstT)) continue;
          if (o.tx2 >= chartEndT) continue;

          const x1 = snapSubBar
            ? snapToChartBar(bars, o.tx1, chartSec)
            : refineSuperBar
              ? refineHtfPivotTime(bars, o.tx1, htfEndOf(o.tx1), mapA?.get(o.tx1), o.dir, o.hid)
              : o.tx1;
          const x2 = snapSubBar
            ? snapToChartBar(bars, o.tx2, chartSec)
            : refineSuperBar
              ? refineHtfPivotTime(bars, o.tx2, htfEndOf(o.tx2), mapA?.get(o.tx2), o.dir, o.hid)
              : o.tx2;

          // Both endpoints must land on distinct loaded chart candles (never collapse onto 1 bar or Bar 0)
          if (x1 < chartFirstT || x2 > chartLastT || x2 <= x1) continue;

          const clr = o.dir === 1 ? (o.hid ? cHBull : cBull) : (o.hid ? cHBear : cBear);
          const qPairTxt = s.showSsmtTxt ? `Q${o.q1 ?? 1} Q${o.q2 ?? 2} ${TFN[r]}` : '';

          // Deduplicate identical-endpoint swings across TFs so higher TF (e.g. Q1 Q2 5M) cleanly replaces lower TF (Q4 Q1 1M) without overlapping text
          const segKey = `${x1}:${o.py1}:${x2}:${o.py2}`;
          ssmtBySegment.set(segKey, {
            type: 'line',
            _qtSsmt: true,
            _qtDir: o.dir,
            _qtTier: r,
            p1: { time: x1, price: o.py1 },
            p2: { time: x2, price: o.py2 },
            borderColor: clr.hex,
            strokeOpacity: clr.opacity,
            width: o.hid ? s.wH : s.wN,
            lineStyle: o.hid ? stHid : stNorm,
            ...(qPairTxt ? {
              text: qPairTxt,
              textStyle: {
                inlineOnLine: true,
                color: cSsmtLbl.css,
                size: ssmtLblPx
              }
            } : {})
          });
        }
      }
    }
    for (const d of ssmtBySegment.values()) drawings.push(d);

    // ---- 3. Build Cycle (AMDX) Table ----
    const tables = [];
    if (s.showCycTbl) {
      const cTxt = themeColor(s, 'cyTblText', darkBg, '#2a2e45').css;
      const cBg = themeColor(s, 'cyTblBg', darkBg, '#e0e0e0').css;
      const cHi = themeColor(s, 'cyTblHi', darkBg, '#ff9800').css;
      const cFrm = themeColor(s, 'cyTblFrame', darkBg, '#787b86').css;
      const tblFontPx = sizePx(s.cyTblSizeIn, 11);

      const decodePhase = code => {
        if (code === null || code === undefined || !Number.isFinite(code)) return '-';
        const qn = Math.trunc(code / 4);
        const ix = (code % 4) >= 2;
        const hr = (code % 2) === 1;
        if (qn === 0) return 'Q0';
        if (!hr || qn < 1 || qn > 4) return '-';
        return (ix ? 'XAMD' : 'AMDX')[qn - 1];
      };

      const cell = (text, bg = cBg, bold = false, align = 'center') => ({
        text,
        color: cTxt,
        background: bg,
        align,
        size: tblFontPx,
        bold
      });

      const rows = [
        [cell('Cycle', cBg, true, 'left'), cell('Phase', cBg, true, 'center')],
        ...[
          ['Yearly', 6],
          ['Quarterly', 5],
          ['Monthly', 4],
          ['Weekly', 3],
          ['Daily', 2],
          ['90 Min', 1],
          ['Micro', 0]
        ].map(([name, idx]) => {
          const ph = decodePhase(rowCodes[idx]);
          return [cell(name, cBg, false, 'left'), cell(ph, ph === 'D' ? cHi : cBg, ph !== '-', 'center')];
        })
      ];

      tables.push({
        id: 'qt-cycle-table',
        position: s.cycPos,
        bgcolor: cBg,
        borderWidth: 1,
        borderColor: cFrm,
        frameWidth: 1,
        frameColor: cFrm,
        rows
      });
    }

    // ---- 4. Advanced PSP (Adaptive Triad/Dyad Peer Candle Crack) ----
    const candleColors = [];
    const pspVisOk = s.usePsp && bars.length > 0 && chartSec >= tfToSeconds(s.pspVisLimit);
    if (pspVisOk) {
      const showIcons = s.pspMode === 'Icons Only' || s.pspMode === 'Both';
      const showBody = s.pspMode === 'Body Only' || s.pspMode === 'Both';
      const peer1Sym = triad[1] && triad[1] !== ownShort ? triad[1] : null;
      const peer2Sym = triad[2] && triad[2] !== ownShort ? triad[2] : null;

      if ((showIcons || showBody) && (peer1Sym || peer2Sym)) {
        const p1Bars = (s.pspShowSmt1 !== false && peer1Sym) ? getSeriesForRow(markets, peer1Sym, tf, sessionMode, cutoffTime) : [];
        const p2Bars = (s.pspShowSmt2 !== false && peer2Sym) ? getSeriesForRow(markets, peer2Sym, tf, sessionMode, cutoffTime) : [];
        const mapP1 = new Map();
        const mapP2 = new Map();
        for (let i = 0; i < p1Bars.length; i++) mapP1.set(p1Bars[i].time, p1Bars[i]);
        for (let i = 0; i < p2Bars.length; i++) mapP2.set(p2Bars[i].time, p2Bars[i]);

        const cBullIcon = parseColor(s.pspBullClr, '#3292e0').css;
        const cBearIcon = parseColor(s.pspBearClr, '#d83939').css;
        const cBullBody = parseColor(s.pspBullBody, '#2195f3').css;
        const cBearBody = parseColor(s.pspBearBody, '#dd455c').css;
        const pspPx = sizePx(s.pspSizeStr === 'Auto' ? 'Small' : s.pspSizeStr, 10);
        const maxMarkers = Math.max(10, Number(s.maxPspBars) || 30);
        const pspLabels = [];

        for (let i = 0; i < bars.length; i++) {
          const b = bars[i];
          const mDir = b.close > b.open ? 1 : b.close < b.open ? -1 : 0;
          if (mDir === 0) continue;

          const c1 = mapP1.get(b.time);
          const c2 = mapP2.get(b.time);
          let c1Dir = c1 ? (c1.close > c1.open ? 1 : c1.close < c1.open ? -1 : 0) : 0;
          let c2Dir = c2 ? (c2.close > c2.open ? 1 : c2.close < c2.open ? -1 : 0) : 0;
          if (s.pspInv1) c1Dir = -c1Dir;
          if (s.pspInv2) c2Dir = -c2Dir;

          const crack1 = s.pspShowSmt1 !== false && c1 !== undefined && c1Dir !== 0 && mDir !== c1Dir;
          const crack2 = s.pspShowSmt2 !== false && c2 !== undefined && c2Dir !== 0 && mDir !== c2Dir;

          if (crack1 || crack2) {
            const isBull = mDir === 1;
            if (showBody) {
              candleColors.push({ time: b.time, color: isBull ? cBullBody : cBearBody });
            }
            if (showIcons) {
              pspLabels.push({
                type: 'text',
                _qtPspIcon: true,
                p1: { time: b.time, price: isBull ? b.low : b.high },
                text: isBull ? s.pspBullShape : s.pspBearShape,
                labelBg: null,
                textStyle: {
                  pine: true,
                  placement: isBull ? 'below' : 'above',
                  color: isBull ? cBullIcon : cBearIcon,
                  size: pspPx,
                  horizontal: 'center',
                  vertical: 'inside'
                }
              });
              if (pspLabels.length > maxMarkers) pspLabels.shift();
            }
          }
        }
        if (pspLabels.length) drawings.push(...pspLabels);
      }
    }

    return {
      name: 'Quantaibay',
      triad,
      drawings,
      candleColors,
      qLabels: qLabelMeta,
      trLabels: trLabelMeta,
      labelPadPct: s.labelPadPct,
      tables,
      warnings
    };
  }

  // Fast O(visibleBars + qLabels) viewport Y-pinning for Q Labels (called on scroll/zoom without recalculating SSMT)
  function pinQLabels(qLabels, bars, logicalRange, labelPadPct = 8) {
    if (!qLabels?.length || !bars?.length) return;
    let fromIdx = 0;
    let toIdx = bars.length - 1;
    if (logicalRange && Number.isFinite(logicalRange.from) && Number.isFinite(logicalRange.to)) {
      fromIdx = Math.max(0, Math.floor(logicalRange.from));
      toIdx = Math.min(bars.length - 1, Math.ceil(logicalRange.to));
    } else {
      fromIdx = Math.max(0, bars.length - 85);
    }
    if (fromIdx > toIdx) {
      fromIdx = Math.max(0, bars.length - 85);
      toIdx = bars.length - 1;
    }
    let visHi = -Infinity;
    let visLo = Infinity;
    for (let i = fromIdx; i <= toIdx; i++) {
      const b = bars[i];
      if (b.high > visHi) visHi = b.high;
      if (b.low < visLo) visLo = b.low;
    }
    if (!Number.isFinite(visLo) || !Number.isFinite(visHi)) return;
    const pinY = visLo - (visHi - visLo) * (Number(labelPadPct) || 0) / 100;
    for (let i = 0; i < qLabels.length; i++) {
      qLabels[i].p1.price = pinY;
    }
  }

  // Fast O(trLabels) horizontal clamping so spanning HTF True Open labels (TDO/TWO/TMO/TQO/TYO) remain visible on screen
  function pinTrueOpenLabels(trLabels, bars, logicalRange, chartSec = 60) {
    if (!trLabels?.length || !bars?.length) return;
    const step = chartSec || 60;
    let leftIdx = Math.max(0, bars.length - 85);
    let rightIdx = bars.length - 1;
    if (logicalRange && Number.isFinite(logicalRange.from) && Number.isFinite(logicalRange.to)) {
      leftIdx = Math.max(0, Math.min(bars.length - 1, Math.ceil(logicalRange.from) + 1));
      rightIdx = Math.max(0, Math.min(bars.length - 1, Math.floor(logicalRange.to)));
    }
    const visLeftT = bars[leftIdx].time;
    const visRightT = (logicalRange && Number.isFinite(logicalRange.to) && logicalRange.to >= bars.length)
      ? bars[bars.length - 1].time + (logicalRange.to - (bars.length - 1)) * step
      : bars[rightIdx].time;

    for (let i = 0; i < trLabels.length; i++) {
      const lb = trLabels[i];
      const sp = lb._qtTrueOpenSpan;
      if (!sp) continue;
      if (sp.pos === 'Left') {
        lb.p1.time = (sp.x1 < visLeftT && sp.x2 > visLeftT + step * 2) ? visLeftT : sp.x1;
      } else if (sp.pos === 'Right') {
        lb.p1.time = (sp.x2 > visRightT && sp.x1 < visRightT - step * 2) ? Math.max(sp.x1, visRightT - step) : sp.x2;
      } else {
        const a = Math.max(sp.x1, visLeftT);
        const b = Math.min(sp.x2, visRightT);
        lb.p1.time = a < b ? Math.trunc((a + b) / 2) : Math.trunc((sp.x1 + sp.x2) / 2);
      }
    }
  }

  return {
    name: 'Quantaibay',
    DEFAULTS,
    TRUE_OPEN_ITEMS,
    INPUT_SCHEMA,
    TIMEZONES,
    ASSET_OPTIONS,
    parseColor,
    isDarkCanvas,
    tfToSeconds,
    resolveTriad,
    parts,
    timestamp,
    sessionStart,
    makeCycleEvaluator,
    calculate,
    pinQLabels,
    pinTrueOpenLabels
  };
})();

if (typeof window !== 'undefined') window.QuantaibayEngine = QuantaibayEngine;
if (typeof module !== 'undefined') module.exports = QuantaibayEngine;
