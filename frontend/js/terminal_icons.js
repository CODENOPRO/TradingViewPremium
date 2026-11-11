/* Terminal Outline — local, resolution-independent UI icons. */
(function (root) {
  'use strict';
  const paths = {
    cursor: '<path d="m6 3 13 9-6 1-3 7z"/>',
    crosshair: '<circle cx="12" cy="12" r="5"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
    trend: '<path d="m5 19 14-14"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="4" r="2"/>',
    fib: '<path d="M4 5h16M4 10h12M4 15h16M4 20h12"/><path d="m6 20 12-15" stroke-dasharray="2 3"/>',
    patterns: '<path d="m3 17 5-10 5 9 6-12 3 6"/><circle cx="8" cy="7" r="1.5"/><circle cx="13" cy="16" r="1.5"/>',
    forecast: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 14h16M12 6v5m-2-2 2-3 2 3"/>',
    shapes: '<rect x="3" y="3" width="10" height="10" rx="2"/><circle cx="16.5" cy="16.5" r="4.5"/>',
    text: '<path d="M4 7V4h16v3M12 4v16m-4 0h8"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14a4.5 4.5 0 0 0 8 0M8 9h.01M16 9h.01"/>',
    magnet: '<path d="M5 4v9a7 7 0 0 0 14 0V4h-4v9a3 3 0 0 1-6 0V4zM5 8h4m6 0h4"/>',
    pencil: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    unlock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 7.5-2M12 14v3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="3"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    up: '<path d="M12 20V4m-6 6 6-6 6 6"/>',
    down: '<path d="M12 4v16m-6-6 6 6 6-6"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--icon-surface, #131722)"/><circle cx="15" cy="17" r="3" fill="var(--icon-surface, #131722)"/>',
    refresh: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
    indicator: '<path d="M4 18 9 6l6 12 5-8M3 21h18"/>',
    bell: '<path d="M5 16h14l-2-3V9a5 5 0 0 0-10 0v4zM10 20h4M12 2v2"/>',
    replay: '<path d="M5 5v14m14-14L8 12l11 7z"/>',
    play: '<path d="m7 4 13 8-13 8z"/>',
    pause: '<path d="M8 4v16M16 4v16"/>',
    next: '<path d="m5 4 11 8-11 8zM20 4v16"/>',
    wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6"/><path d="M20 12h-6v5h6M16 14.5h.01"/>',
    link: '<path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1" transform="translate(1 0) scale(.92)"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M11 3v18m0-9h10"/>',
    fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    ruler: '<path d="m3 16 13-13 5 5L8 21zM12 7l2 2m-6 2 2 2m-6 2 2 2"/>',
    rectangle: '<rect x="3" y="5" width="18" height="14" rx="2"/>',
    circle: '<circle cx="12" cy="12" r="9"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="10" ry="6" transform="rotate(-30 12 12)"/>',
    triangle: '<path d="m12 3 10 18H2z"/>',
    arrow: '<path d="M4 20 20 4M9 4h11v11"/>',
    channel: '<path d="m3 14 16-11M5 21 21 10M4 18 20 7"/>',
    pitchfork: '<path d="M12 21V9m-7 6V4m14 11V4M5 9l7 6 7-6"/>',
    wave: '<path d="M2 12c3-13 7-13 10 0s7 13 10 0"/>',
    arc: '<path d="M3 20a17 17 0 0 1 18-17M3 20h18"/>',
    spiral: '<path d="M12 12c-4-4 5-7 6-1 2 10-13 13-15 2C1 1 20-2 22 11"/>',
    fan: '<path d="M3 21 21 3M3 21h18M3 21l18-9M3 21 12 3"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/>',
    bars: '<path d="M5 6v14m7-17v14m7-10v14M3 9h4m3-2h4m3 4h4"/>',
    volume: '<path d="M3 21h18M5 21v-5h4v5m2 0V9h4v12m2 0V3h4v18"/>',
    note: '<path d="M4 3h16v12l-6 6H4zM14 21v-6h6M8 7h8M8 11h5"/>',
    comment: '<path d="M21 14a3 3 0 0 1-3 3H9l-6 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3zM7 8h10M7 12h6"/>',
    pin: '<path d="M18 9c0 5-6 12-6 12S6 14 6 9a6 6 0 0 1 12 0Z"/><circle cx="12" cy="9" r="2"/>',
    flag: '<path d="M5 21V3m0 1c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="2"/><path d="m3 18 6-6 4 4 4-5 4 5"/>',
    horizontal: '<path d="M2 12h20"/><circle cx="7" cy="12" r="2"/>',
    vertical: '<path d="M12 2v20"/><circle cx="12" cy="7" r="2"/>',
    time: '<path d="M5 3v18M12 3v18M19 3v18M3 18l18-12"/>',
    angle: '<path d="M3 20h18M3 20 17 4M12 20a9 9 0 0 0-3-7"/>',
    range: '<path d="M5 3h14M5 21h14M12 6v12m-3-9 3-3 3 3m-6 6 3 3 3-3"/>',
  };
  function svg(name) {
    return `<svg class="tt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.trend}</svg>`;
  }
  function tool(kind) {
    if (paths[kind]) return svg(kind);
    const rules = [
      [/horizontal/, 'horizontal'], [/vertical/, 'vertical'], [/cross-line/, 'crosshair'],
      [/pitchfork/, 'pitchfork'], [/channel|regression|flat-top|disjoint/, 'channel'],
      [/angle/, 'angle'], [/spiral/, 'spiral'], [/circles/, 'circle'], [/arcs|sector/, 'arc'],
      [/fan|wedge/, 'fan'], [/gann/, 'grid'], [/fib.*time|time-zone|cyclic/, 'time'], [/fib/, 'fib'],
      [/elliott|pattern|drives/, 'patterns'], [/sine|cycles|curve/, 'wave'],
      [/volume/, 'volume'], [/vwap|ghost/, 'indicator'], [/position|forecast/, 'forecast'],
      [/range/, 'range'], [/brush|highlighter/, 'pencil'], [/arrow.*down/, 'down'], [/arrow.*up/, 'up'], [/arrow/, 'arrow'],
      [/rectangle/, 'rectangle'], [/path|polyline/, 'patterns'], [/note|label|signpost/, 'note'],
      [/callout/, 'comment'], [/table/, 'grid'], [/flag/, 'flag'], [/line|ray/, 'trend'],
    ];
    return svg((rules.find(([pattern]) => pattern.test(kind)) || [null, 'trend'])[1]);
  }
  root.TerminalIcons = { svg, tool };
  if (typeof module !== 'undefined') module.exports = root.TerminalIcons;
})(typeof window !== 'undefined' ? window : globalThis);
