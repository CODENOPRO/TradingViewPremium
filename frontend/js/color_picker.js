/* Shared TradingView-style color palette, persistent custom swatches and HSV custom picker. */
const ColorPicker = (() => {
  const STORAGE_KEY = 'terminal_custom_colors_v1';
  const MAX_CUSTOM = 19;
  const PALETTE = [
    '#ffffff', '#e0e3eb', '#b2b5be', '#9598a1', '#787b86', '#5d606b', '#434651', '#2a2e39', '#1e222d', '#000000',
    '#f23645', '#ff9800', '#fbc02d', '#4caf50', '#089981', '#00bcd4', '#2962ff', '#673ab7', '#9c27b0', '#e91e63',
    '#fccbcd', '#ffe0b2', '#fff9c4', '#c8e6c9', '#ace5dc', '#b2ebf2', '#bbd9fb', '#d1c4e9', '#e1bee7', '#f8bbd0',
    '#f77c80', '#ffb74d', '#fff176', '#81c784', '#66d3c1', '#4dd0e1', '#5b9cf6', '#9575cd', '#ba68c8', '#f06292',
    '#cc2936', '#e65100', '#f9a825', '#2e7d32', '#067361', '#00838f', '#1848cc', '#512da8', '#7b1fa2', '#c2185b',
    '#801922', '#8a3100', '#8d6e00', '#1b5e20', '#03453a', '#004d54', '#0c3299', '#311b92', '#4a148c', '#880e4f'
  ];

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  function normalizeHex(raw) {
    const text = String(raw || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(text)) {
      return '#' + [...text].map(c => c + c).join('').toLowerCase();
    }
    if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(text)) {
      return '#' + text.slice(0, 6).toLowerCase();
    }
    return null;
  }

  function parseColor(raw, fallbackOpacity = 100) {
    const fbOp = clamp(Math.round(Number(fallbackOpacity ?? 100)), 0, 100);
    if (!raw || raw === 'transparent') return { hex: '#000000', opacity: raw === 'transparent' ? 0 : fbOp };
    const str = String(raw).trim();
    const hex8 = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(str);
    if (hex8) {
      return {
        hex: '#' + hex8[1].toLowerCase(),
        opacity: Math.round((parseInt(hex8[2], 16) / 255) * 100)
      };
    }
    const hex = normalizeHex(str);
    if (hex) return { hex, opacity: fbOp };
    const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(str);
    if (rgb) {
      const toHex = n => clamp(Math.round(Number(n)), 0, 255).toString(16).padStart(2, '0');
      const alpha = rgb[4] === undefined ? fbOp : Math.round(clamp(Number(rgb[4]), 0, 1) * 100);
      return { hex: '#' + toHex(rgb[1]) + toHex(rgb[2]) + toHex(rgb[3]), opacity: alpha };
    }
    return { hex: '#2962ff', opacity: fbOp };
  }

  function hexToRgb(hex) {
    const h = normalizeHex(hex) || '#000000';
    return {
      r: parseInt(h.slice(1, 3), 16),
      g: parseInt(h.slice(3, 5), 16),
      b: parseInt(h.slice(5, 7), 16)
    };
  }

  function rgbToHex(r, g, b) {
    const p = n => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
    return '#' + p(r) + p(g) + p(b);
  }

  function hexToHsv(hex) {
    const { r, g, b } = hexToRgb(hex);
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min;
    let h = 0;
    if (d > 0) {
      if (max === rn) h = 60 * (((gn - bn) / d) % 6);
      else if (max === gn) h = 60 * ((bn - rn) / d + 2);
      else h = 60 * ((rn - gn) / d + 4);
      if (h < 0) h += 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
  }

  function hsvToHex(h, s, v) {
    const hh = ((Number(h) || 0) % 360 + 360) % 360;
    const ss = clamp(Number(s) || 0, 0, 1);
    const vv = clamp(Number(v) || 0, 0, 1);
    const c = vv * ss;
    const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
    const m = vv - c;
    let r = 0, g = 0, b = 0;
    if (hh < 60) { r = c; g = x; }
    else if (hh < 120) { r = x; g = c; }
    else if (hh < 180) { g = c; b = x; }
    else if (hh < 240) { g = x; b = c; }
    else if (hh < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  function toCss(hex, opacity = 100) {
    const h = normalizeHex(hex) || '#000000';
    const op = clamp(Math.round(Number(opacity ?? 100)), 0, 100);
    if (op >= 100) return h;
    const { r, g, b } = hexToRgb(h);
    return `rgba(${r}, ${g}, ${b}, ${Number((op / 100).toFixed(2))})`;
  }

  function toHexAlpha(hex, opacity = 100) {
    const h = normalizeHex(hex) || '#000000';
    const op = clamp(Math.round(Number(opacity ?? 100)), 0, 100);
    if (op >= 100) return h;
    return h + clamp(Math.round((op / 100) * 255), 0, 255).toString(16).padStart(2, '0');
  }

  function resolveStore(storage) {
    if (storage) return storage;
    if (typeof Workspace !== 'undefined') return Workspace;
    return null;
  }

  function listCustomColors(storage) {
    const store = resolveStore(storage);
    let raw = null;
    if (store?.read) raw = store.read(STORAGE_KEY, []);
    else if (typeof localStorage !== 'undefined') {
      try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { raw = []; }
    }
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const clean = [];
    for (const item of raw) {
      const h = normalizeHex(item);
      if (h && !seen.has(h)) {
        seen.add(h);
        clean.push(h);
        if (clean.length >= MAX_CUSTOM) break;
      }
    }
    return clean;
  }

  function writeCustomColors(list, storage) {
    const store = resolveStore(storage);
    if (store?.write) { store.write(STORAGE_KEY, list); return; }
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
    }
  }

  function addCustomColor(hex, storage) {
    const normalized = normalizeHex(hex);
    if (!normalized) return listCustomColors(storage);
    const list = listCustomColors(storage).filter(c => c !== normalized);
    list.push(normalized);
    while (list.length > MAX_CUSTOM) list.shift();
    writeCustomColors(list, storage);
    return list;
  }

  function removeCustomColor(hex, storage) {
    const normalized = normalizeHex(hex);
    const list = listCustomColors(storage).filter(c => c !== normalized);
    writeCustomColors(list, storage);
    return list;
  }

  function keepInView(pop) {
    if (!pop.isConnected) return;
    const vw = globalThis.window?.innerWidth ?? globalThis.innerWidth ?? 1280;
    const vh = globalThis.window?.innerHeight ?? globalThis.innerHeight ?? 800;
    const bounds = pop.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(bounds.left, vw - bounds.width - 8)) + 'px';
    pop.style.top = Math.max(8, Math.min(bounds.top, vh - bounds.height - 8)) + 'px';
  }

  function bindAreaDrag(el, onRatio) {
    let pointer = null;
    const update = event => {
      const r = el.getBoundingClientRect?.() || { left: 0, top: 0, width: 180, height: 180 };
      const rx = clamp((event.clientX - r.left) / (r.width || 1), 0, 1);
      const ry = clamp((event.clientY - r.top) / (r.height || 1), 0, 1);
      onRatio(rx, ry);
    };
    el.addEventListener('pointerdown', event => {
      if (event.button !== 0 || pointer !== null) return;
      event.preventDefault();
      event.stopPropagation();
      el.focus({ preventScroll: true });
      pointer = event.pointerId ?? 1;
      el.setPointerCapture?.(pointer);
      update(event);
    });
    el.addEventListener('pointermove', event => { if (event.pointerId === pointer) update(event); });
    el.addEventListener('lostpointercapture', event => { if (event.pointerId === pointer) pointer = null; });
  }

  function closeActiveSub(pop) {
    if (pop?._closeCustomSub) return pop._closeCustomSub();
    return false;
  }

  function mount(pop, options = {}) {
    const label = text => typeof ui === 'function' ? ui(text) : text;
    pop.classList.add('tv-color-picker');
    const parsed = parseColor(options.value, options.opacity ?? 100);
    const state = {
      hex: parsed.hex,
      opacity: options.opacity !== undefined ? clamp(Math.round(Number(options.opacity)), 0, 100) : parsed.opacity,
      ...hexToHsv(parsed.hex)
    };
    const showOpacity = options.showOpacity !== false;
    const storage = options.storage;

    const notify = () => {
      const payload = {
        hex: state.hex,
        opacity: state.opacity,
        css: toCss(state.hex, state.opacity),
        hexAlpha: toHexAlpha(state.hex, state.opacity)
      };
      options.onChange?.(payload);
      options.onColor?.(payload.hex);
    };

    const grid = document.createElement('div');
    grid.className = 'tv-palette-grid';
    for (const c of PALETTE) {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'tv-palette-swatch';
      sw.style.background = c;
      sw.title = c;
      sw.dataset.hex = c;
      sw.setAttribute('aria-label', c);
      if (c === state.hex) sw.classList.add('selected');
      sw.onclick = () => {
        applyHex(c, { syncHsv: true, syncInput: true });
        notify();
      };
      grid.appendChild(sw);
    }

    const customSection = document.createElement('div');
    customSection.className = 'tv-cp-custom-section';
    const customGrid = document.createElement('div');
    customGrid.className = 'tv-cp-custom-grid';
    customSection.appendChild(customGrid);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'tv-cp-add-btn';
    addBtn.textContent = label('Custom color');
    addBtn.setAttribute('aria-expanded', 'false');

    let subPanel = null;
    let previewBox = null;
    let hexInput = null;
    let svBox = null;
    let svThumb = null;
    let hueBox = null;
    let opacityRange = null;
    let opacityValue = null;

    const syncSelectionHighlight = () => {
      for (const container of [grid, customGrid]) {
        container.querySelectorAll('.tv-palette-swatch').forEach(el => {
          el.classList.toggle('selected', el.dataset.hex === state.hex);
        });
      }
    };

    const syncSubUI = (syncInputText = true) => {
      if (previewBox) {
        previewBox.style.setProperty?.('--cp-preview', toCss(state.hex, state.opacity));
        previewBox.style.background = toCss(state.hex, state.opacity);
      }
      if (hexInput && syncInputText) hexInput.value = state.hex;
      if (hexInput && syncInputText) hexInput.removeAttribute('aria-invalid');
      if (opacityRange) {
        opacityRange.value = String(state.opacity);
        opacityRange.setAttribute('aria-valuetext', state.opacity + '%');
        opacityValue.textContent = state.opacity + '%';
      }
      if (svBox) svBox.style.backgroundColor = hsvToHex(state.h, 1, 1);
      if (svThumb) {
        svThumb.style.left = `${(state.s * 100).toFixed(2)}%`;
        svThumb.style.top = `${((1 - state.v) * 100).toFixed(2)}%`;
      }
      if (hueBox) {
        hueBox.value = String(Math.round(state.h));
        hueBox.style.setProperty?.('--cp-hue', hsvToHex(state.h, 1, 1));
      }
    };

    function applyHex(hex, { syncHsv = true, syncInput = true } = {}) {
      const norm = normalizeHex(hex);
      if (!norm) return false;
      state.hex = norm;
      if (syncHsv) {
        const hsv = hexToHsv(norm);
        if (hsv.s > 0.001) state.h = hsv.h;
        state.s = hsv.s;
        state.v = hsv.v;
      }
      syncSelectionHighlight();
      syncSubUI(syncInput);
      return true;
    }

    const renderCustomSwatches = () => {
      customGrid.replaceChildren();
      for (const c of listCustomColors(storage)) {
        const wrap = document.createElement('div');
        wrap.className = 'tv-cp-custom-item';
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'tv-palette-swatch';
        sw.style.background = c;
        sw.title = `${c} (right-click to remove)`;
        sw.dataset.hex = c;
        sw.setAttribute('aria-label', `Custom color ${c}`);
        if (c === state.hex) sw.classList.add('selected');
        sw.onclick = () => {
          applyHex(c, { syncHsv: true, syncInput: true });
          notify();
        };
        sw.oncontextmenu = e => {
          e.preventDefault();
          removeCustomColor(c, storage);
          renderCustomSwatches();
        };
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'tv-cp-swatch-del';
        del.textContent = '×';
        del.title = `Remove ${c}`;
        del.setAttribute('aria-label', `Remove custom color ${c}`);
        del.onclick = e => {
          e.stopPropagation();
          removeCustomColor(c, storage);
          renderCustomSwatches();
        };
        wrap.append(sw, del);
        customGrid.appendChild(wrap);
      }
      customSection.hidden = !customGrid.childElementCount || !!subPanel;
    };

    const closeSub = () => {
      if (!subPanel) return false;
      const restoreFocus = subPanel.contains(document.activeElement);
      subPanel.remove();
      subPanel = null;
      previewBox = hexInput = svBox = svThumb = hueBox = null;
      grid.hidden = false;
      customSection.hidden = !customGrid.childElementCount;
      addBtn.textContent = label('Custom color');
      addBtn.setAttribute('aria-expanded', 'false');
      keepInView(pop);
      if (restoreFocus) addBtn.focus({ preventScroll: true });
      return true;
    };
    pop._closeCustomSub = closeSub;

    const openSub = (focusInput = false) => {
      const panel = document.createElement('div');
      panel.className = 'tv-cp-panel';
      panel.setAttribute('role', 'group');
      panel.setAttribute('aria-label', label('Custom color'));

      const head = document.createElement('div');
      head.className = 'tv-cp-head';
      previewBox = document.createElement('span');
      previewBox.className = 'tv-cp-preview';
      hexInput = document.createElement('input');
      hexInput.type = 'text';
      hexInput.className = 'tv-cp-hex-input';
      hexInput.setAttribute('aria-label', label('Hex color code'));
      hexInput.maxLength = 9;
      hexInput.spellcheck = false;
      hexInput.autocomplete = 'off';
      const submit = document.createElement('button');
      submit.type = 'button';
      submit.className = 'tv-cp-submit';
      submit.textContent = label('Save swatch');
      head.append(previewBox, hexInput, submit);

      const body = document.createElement('div');
      body.className = 'tv-cp-body';
      svBox = document.createElement('div');
      svBox.className = 'tv-cp-sv';
      svBox.tabIndex = 0;
      svBox.setAttribute('role', 'group');
      svBox.setAttribute('aria-label', label('Color area. Use left and right for saturation and up and down for brightness.'));
      svThumb = document.createElement('span');
      svThumb.className = 'tv-cp-sv-thumb';
      svBox.appendChild(svThumb);

      hueBox = document.createElement('input');
      hueBox.className = 'tv-cp-hue';
      hueBox.type = 'range';
      hueBox.min = '0';
      hueBox.max = '360';
      hueBox.setAttribute('aria-label', label('Hue'));
      body.append(svBox, hueBox);

      panel.append(body, head);
      if (typeof grid.before === 'function') grid.before(panel);
      else if (Array.isArray(pop.children)) {
        panel.parentNode = pop;
        const idx = pop.children.indexOf(grid);
        pop.children.splice(idx >= 0 ? idx : 0, 0, panel);
      } else pop.appendChild(panel);
      subPanel = panel;
      grid.hidden = true;
      customSection.hidden = true;
      addBtn.textContent = label('Preset colors');
      addBtn.setAttribute('aria-expanded', 'true');
      syncSubUI(true);
      keepInView(pop);

      const applyHsv = () => {
        state.hex = hsvToHex(state.h, state.s, state.v);
        syncSelectionHighlight();
        syncSubUI(true);
        notify();
      };
      bindAreaDrag(svBox, (rx, ry) => {
        state.s = rx;
        state.v = 1 - ry;
        applyHsv();
      });
      svBox.onkeydown = event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const step = event.shiftKey ? .1 : .01;
        if (event.key === 'ArrowLeft') state.s = clamp(state.s - step, 0, 1);
        if (event.key === 'ArrowRight') state.s = clamp(state.s + step, 0, 1);
        if (event.key === 'ArrowUp') state.v = clamp(state.v + step, 0, 1);
        if (event.key === 'ArrowDown') state.v = clamp(state.v - step, 0, 1);
        applyHsv();
      };
      hueBox.oninput = () => {
        state.h = Number(hueBox.value);
        applyHsv();
      };

      const applyInput = () => {
        const raw = hexInput.value.trim().replace(/^#/, '');
        if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return false;
        if (showOpacity && raw.length === 8) {
          state.opacity = parseColor('#' + raw).opacity;
          options.onOpacity?.(state.opacity);
        }
        applyHex(raw, { syncInput: false });
        return true;
      };
      hexInput.oninput = () => {
        hexInput.removeAttribute('aria-invalid');
        const raw = hexInput.value.trim().replace(/^#/, '');
        if (raw.length >= 6 && applyInput()) notify();
      };

      const commitCustom = () => {
        if (!applyInput()) {
          hexInput.setAttribute('aria-invalid', 'true');
          hexInput.focus();
          return;
        }
        syncSubUI(true);
        addCustomColor(state.hex, storage);
        renderCustomSwatches();
        notify();
        closeSub();
        customGrid.querySelector('.selected')?.focus({ preventScroll: true });
      };

      hexInput.onkeydown = e => {
        if (e.key === 'Enter') { e.preventDefault(); commitCustom(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSub(); }
      };
      submit.onclick = e => {
        e.stopPropagation();
        commitCustom();
      };

      if (focusInput) {
        hexInput.focus({ preventScroll: true });
        hexInput.select();
      }
    };

    addBtn.onclick = e => {
      e.stopPropagation();
      if (!closeSub()) openSub(true);
    };

    renderCustomSwatches();
    pop.append(addBtn, grid, customSection);

    if (showOpacity) {
      const row = document.createElement('div');
      row.className = 'tv-pop-row';
      const lbl = document.createElement('span');
      lbl.textContent = label('Opacity');
      const range = document.createElement('input');
      range.type = 'range';
      range.min = '0';
      range.max = '100';
      range.value = String(state.opacity);
      range.setAttribute('aria-label', label('Opacity'));
      const val = document.createElement('span');
      val.className = 'tv-pop-val';
      val.textContent = state.opacity + '%';
      opacityRange = range;
      opacityValue = val;
      range.oninput = () => {
        state.opacity = clamp(Math.round(Number(range.value)), 0, 100);
        syncSubUI(false);
        if (options.onOpacity) options.onOpacity(state.opacity);
        notify();
      };
      row.append(lbl, range, val);
      pop.appendChild(row);
    }

    return {
      setHex: hex => applyHex(hex, { syncHsv: true, syncInput: true }),
      closeSub,
      getState: () => ({ ...state })
    };
  }

  return {
    PALETTE,
    STORAGE_KEY,
    normalizeHex,
    parseColor,
    hexToHsv,
    hsvToHex,
    toCss,
    toHexAlpha,
    listCustomColors,
    addCustomColor,
    removeCustomColor,
    closeActiveSub,
    mount
  };
})();

if (typeof module !== 'undefined') module.exports = ColorPicker;
