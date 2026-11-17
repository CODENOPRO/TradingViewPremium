/* One context menu per workspace; actions reuse the existing controllers and template stores. */
class ChartContextMenu {
  static clickedPoint(chart, x, y) {
    const plotBottom = chart.plotBottom ?? chart.plotHeight - 26;
    const priceAxisWidth = chart.chart?.priceScale('right').width() ?? 65;
    if (y < 0 || y > plotBottom || x < 0 || x > chart.container.clientWidth - priceAxisWidth) return null;
    const time = chart.coordinateToTime(x), raw = chart.coordinateToPrice(y), tick = chart.metadata.tickSize;
    if (!Number.isFinite(time) || !Number.isFinite(raw)) return null;
    const price = Number.isFinite(tick) && tick > 0 ? Math.round(raw / tick) * tick : raw;
    return { time, price };
  }

  static orderKinds(price, referencePrice) {
    if (!Number.isFinite(price) || !Number.isFinite(referencePrice) || price === referencePrice) {
      return { sellType: 'limit', buyType: 'limit' };
    }
    return price > referencePrice
      ? { sellType: 'limit', buyType: 'stop' }
      : { sellType: 'stop', buyType: 'limit' };
  }

  static formatPrice(price, metadata = {}, appearance = {}) {
    if (!Number.isFinite(price)) return '';
    let decimals = 2;
    if (appearance?.precision && appearance.precision !== 'Default' && Number.isFinite(Number(appearance.precision))) {
      decimals = Math.max(0, Math.min(8, Number(appearance.precision)));
    } else if (Number.isFinite(metadata?.tickSize) && metadata.tickSize > 0) {
      const text = String(metadata.tickSize);
      const exp = /e-(\d+)$/i.exec(text);
      decimals = exp ? Number(exp[1]) : (text.includes('.') ? text.split('.')[1].length : 0);
      decimals = Math.max(0, Math.min(8, decimals));
    }
    return price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: Math.max(decimals, 8) });
  }

  static pasteDrawing(chart, source, targetPoint, DrawingModelRef = typeof DrawingModel !== 'undefined' ? DrawingModel : null) {
    if (!chart || !source || !DrawingModelRef) return null;
    const copy = typeof structuredClone === 'function' ? structuredClone(source) : JSON.parse(JSON.stringify(source));
    copy.id = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    copy.locked = false;
    copy.hidden = false;
    delete copy.isTemp;
    const anchor = copy.p1 || copy.points?.[0];
    if (targetPoint && anchor) {
      const dPrice = targetPoint.price - anchor.price;
      const fromIdx = DrawingModelRef.logicalIndex(chart, anchor.time);
      const toIdx = DrawingModelRef.logicalIndex(chart, targetPoint.time);
      const canShiftBars = Number.isFinite(fromIdx) && Number.isFinite(toIdx) && chart.bars?.length;
      const barDelta = canShiftBars ? Math.round(toIdx - fromIdx) : 0;
      const timeDelta = targetPoint.time - anchor.time;
      const shiftPoint = (pt, continuous = false) => {
        if (!pt) return pt;
        const idx = canShiftBars ? DrawingModelRef.logicalIndex(chart, pt.time) : null;
        const nextTime = canShiftBars && Number.isFinite(idx)
          ? DrawingModelRef.timeAt(chart, idx + barDelta, continuous)
          : pt.time + timeDelta;
        return { time: nextTime ?? pt.time + timeDelta, price: pt.price + dPrice };
      };
      if (copy.p1) copy.p1 = shiftPoint(copy.p1);
      if (copy.p2) copy.p2 = shiftPoint(copy.p2);
      if (copy.p3) copy.p3 = shiftPoint(copy.p3);
      if (Array.isArray(copy.points)) {
        copy.points = copy.points.map(p => shiftPoint(p, true));
        if (copy.points[0]) copy.p1 = { ...copy.points[0] };
      }
    } else if (!targetPoint && anchor && chart.bars?.length) {
      const shiftBars = (pt, continuous = false) => {
        if (!pt) return pt;
        const idx = DrawingModelRef.logicalIndex(chart, pt.time);
        return { ...pt, time: Number.isFinite(idx) ? DrawingModelRef.timeAt(chart, idx + 2, continuous) : pt.time };
      };
      if (copy.p1) copy.p1 = shiftBars(copy.p1);
      if (copy.p2) copy.p2 = shiftBars(copy.p2);
      if (copy.p3) copy.p3 = shiftBars(copy.p3);
      if (Array.isArray(copy.points)) {
        copy.points = copy.points.map(p => shiftBars(p, true));
        if (copy.points[0]) copy.p1 = { ...copy.points[0] };
      }
    }
    return DrawingModelRef.normalize(copy);
  }

  static iconSvg(name) {
    const paths = {
      reset: 'M4 12a8 8 0 1 0 2.5-5.8L4 8.5m0-4.5v4.5h4.5',
      alert: 'M12 10.5v5M9.5 13h5M6 4.5 3.5 7M18 4.5 20.5 7M12 19a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z',
      sell: 'M7 7.5 12 12.5 17 7.5M7 13 12 18 17 13',
      buy: 'M7 11.5 12 6.5 17 11.5M7 17 12 12 17 17',
      order: 'M4 16.5l4-4 3 2.5 4.5-5.5M15.5 17h5M18 14.5v5M3.5 5.5v13a1 1 0 0 0 1 1h8.5',
      check: 'M5 12.5 9.5 17 19 7.5',
      cursor: 'M12 3v18M3 12h18M9 9h6v6H9z',
      paste: 'M9 5H6v15h12V5h-3M9 4h6v3H9z',
      table: 'M4 5h16v14H4zM4 10h16M10 10v9M15 10v9',
      snapshot: 'M4 7h4l2-3h4l2 3h4v12H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      template: 'M4 4h16v16H4zM4 9h16M10 9v11',
      settings: 'M12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6zM19.2 13.3l1.3-1.3-1.3-1.3a1.3 1.3 0 0 1-.3-1.4l.7-1.7-1.6-.9-1.1 1.4a1.3 1.3 0 0 1-1.4.4l-1.7-.4-.6-1.7h-2.4l-.6 1.7-1.7.4a1.3 1.3 0 0 1-1.4-.4L6.4 6.7l-1.6.9.7 1.7a1.3 1.3 0 0 1-.3 1.4L3.9 12l1.3 1.3a1.3 1.3 0 0 1 .3 1.4l-.7 1.7 1.6.9 1.1-1.4a1.3 1.3 0 0 1 1.4-.4l1.7.4.6 1.7h2.4l.6-1.7 1.7-.4a1.3 1.3 0 0 1 1.4.4l1.1 1.4 1.6-.9-.7-1.7a1.3 1.3 0 0 1 .3-1.4z',
      text: 'M5 6V4.5h14V6M12 4.5v15M9 19.5h6',
      layers: 'M12 3.5 3.5 8l8.5 4.5L20.5 8 12 3.5zM3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5',
      clone: 'M8.5 8.5h11v11h-11zM5 15.5V5h10.5',
      copy: 'M9 9h10v11H9zM5.5 15V5.5A1.5 1.5 0 0 1 7 4h7.5',
      lock: 'M6 11h12v9H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
      eye: 'M2.5 12s3.8-6.5 9.5-6.5S21.5 12 21.5 12s-3.8 6.5-9.5 6.5S2.5 12 2.5 12zM4 4l16 16',
      trash: 'M4.5 6.5h15M9.5 4h5M7 6.5l.7 12.5a1 1 0 0 0 1 .9h6.6a1 1 0 0 0 1-.9L17 6.5'
    };
    const d = paths[name];
    if (!d) return '';
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  constructor({ charts, drawing, desktop, activate, openAlert, chartSettings = null, paperPanel = null, sync = null, toast = null }) {
    Object.assign(this, { charts, drawing, desktop, activate, openAlert, chartSettings, paperPanel, sync, toast });
    this.clipboard = null;
    this.activeSubmenu = null;
    this.submenuTimer = null;
    this.root = document.createElement('div');
    this.root.className = 'chart-context-menu';
    this.root.hidden = true;
    this.root.setAttribute('role', 'menu');
    this.root.setAttribute('aria-label', 'Chart context menu');
    this.root.addEventListener('scroll', () => this.closeSubmenu(), { passive: true });
    document.body.appendChild(this.root);

    for (const chart of charts) {
      chart.container.addEventListener('contextmenu', event => {
        if (event.target.closest('input,textarea,select,button,.indicator-tables')) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = chart.container.getBoundingClientRect();
        this.open(chart, event.clientX - rect.left, event.clientY - rect.top, event.clientX, event.clientY);
      });
    }

    document.addEventListener('pointerdown', e => {
      if (!this.root.contains(e.target) && !this.activeSubmenu?.el.contains(e.target)) this.close();
    }, true);
    window.addEventListener('resize', () => this.close());
    window.addEventListener('blur', () => this.close());
    window.addEventListener('keydown', e => {
      if (this.root.hidden) return;
      if (this.activeSubmenu?.el.contains(document.activeElement)) {
        if (e.key === 'Escape' || e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopImmediatePropagation();
          const trigger = this.activeSubmenu.trigger;
          this.closeSubmenu();
          trigger?.focus();
          return;
        }
        if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const items = [...this.activeSubmenu.el.querySelectorAll('button[role="menuitem"]:not([disabled])')];
          const index = items.indexOf(document.activeElement);
          const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          items[next]?.focus();
          return;
        }
      }
      if (!['Escape', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') { this.close(true); return; }
      if (e.key === 'ArrowRight' && document.activeElement?.getAttribute('aria-haspopup') === 'menu') {
        document.activeElement.dispatchEvent(new CustomEvent('tv-open-submenu'));
        this.activeSubmenu?.el.querySelector('button[role="menuitem"]:not([disabled])')?.focus();
        return;
      }
      const items = [...this.root.querySelectorAll('button[role="menuitem"]:not([disabled])')];
      const index = items.indexOf(document.activeElement);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }, true);
  }

  closeSubmenu() {
    clearTimeout(this.submenuTimer);
    if (!this.activeSubmenu) return;
    this.activeSubmenu.trigger?.setAttribute('aria-expanded', 'false');
    this.activeSubmenu.el.remove();
    this.activeSubmenu = null;
  }

  close(focus = false) {
    this.closeSubmenu();
    this.root.hidden = true;
    if (focus) this.opener?.focus?.();
  }

  item(label, action, shortcut = '', disabled = false, iconName = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.disabled = disabled;
    if (iconName) button.dataset.icon = iconName;
    const icon = document.createElement('span');
    icon.className = 'tv-ctx-icon';
    icon.setAttribute('aria-hidden', 'true');
    if (iconName) icon.innerHTML = ChartContextMenu.iconSvg(iconName);
    const text = document.createElement('span');
    text.className = 'tv-ctx-label';
    text.textContent = label;
    button.append(icon, text);
    if (shortcut) {
      const key = document.createElement('kbd');
      key.className = 'tv-ctx-key';
      key.textContent = shortcut;
      button.appendChild(key);
    }
    button.addEventListener('pointerenter', () => this.scheduleSubmenuClose());
    button.onclick = async () => {
      try {
        await action();
        this.close();
      } catch (error) {
        this.status.textContent = error.message;
      }
    };
    this.root.appendChild(button);
    return button;
  }

  scheduleSubmenuClose() {
    clearTimeout(this.submenuTimer);
    this.submenuTimer = setTimeout(() => this.closeSubmenu(), 120);
  }

  submenu(label, populateFn, iconName = '', disabled = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.disabled = disabled;
    const icon = document.createElement('span');
    icon.className = 'tv-ctx-icon';
    icon.setAttribute('aria-hidden', 'true');
    if (iconName) icon.innerHTML = ChartContextMenu.iconSvg(iconName);
    const text = document.createElement('span');
    text.className = 'tv-ctx-label';
    text.textContent = label;
    const arrow = document.createElement('span');
    arrow.className = 'tv-ctx-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '›';
    button.append(icon, text, arrow);

    const openSub = () => {
      if (disabled) return;
      clearTimeout(this.submenuTimer);
      if (this.activeSubmenu?.trigger === button) return;
      this.closeSubmenu();
      const sub = document.createElement('div');
      sub.className = 'chart-context-menu chart-context-submenu';
      sub.setAttribute('role', 'menu');
      sub.setAttribute('aria-label', label);
      populateFn(sub, () => this.close());
      document.body.appendChild(sub);
      const triggerRect = button.getBoundingClientRect();
      const margin = 8;
      let left = triggerRect.right + 2;
      if (left + sub.offsetWidth > window.innerWidth - margin) {
        left = triggerRect.left - sub.offsetWidth - 2;
      }
      left = Math.max(margin, Math.min(left, innerWidth - sub.offsetWidth - margin));
      const top = Math.max(margin, Math.min(window.innerHeight - sub.offsetHeight - margin, triggerRect.top));
      sub.style.left = `${left}px`;
      sub.style.top = `${top}px`;
      sub.addEventListener('pointerenter', () => clearTimeout(this.submenuTimer));
      sub.addEventListener('pointerleave', () => this.scheduleSubmenuClose());
      button.setAttribute('aria-expanded', 'true');
      this.activeSubmenu = { el: sub, trigger: button };
    };

    button.addEventListener('pointerenter', openSub);
    button.addEventListener('tv-open-submenu', openSub);
    button.addEventListener('click', e => {
      e.stopPropagation();
      if (this.activeSubmenu?.trigger === button) this.closeSubmenu();
      else openSub();
    });
    this.root.appendChild(button);
    return button;
  }

  divider() {
    const line = document.createElement('div');
    line.className = 'chart-context-divider';
    line.setAttribute('role', 'separator');
    this.root.appendChild(line);
  }

  copyDrawing(drawing) {
    if (!drawing) return false;
    this.clipboard = typeof structuredClone === 'function' ? structuredClone(drawing) : JSON.parse(JSON.stringify(drawing));
    return true;
  }

  pasteClipboard(chart, point = null) {
    if (!this.clipboard || !chart) return null;
    const pasted = ChartContextMenu.pasteDrawing(chart, this.clipboard, point);
    if (!pasted) return null;
    chart.drawings.push(pasted);
    this.drawing.saveDrawings(chart);
    this.drawing.editor.select(chart, pasted);
    chart.renderDrawings();
    return pasted;
  }

  toggleVerticalCursorLock() {
    if (!this.sync) return false;
    this.sync.options.crosshair = !this.sync.options.crosshair;
    if (typeof Workspace !== 'undefined') Workspace.write('terminal_sync_options_v1', this.sync.options);
    const syncCheckbox = document.querySelector('#layout-popover input[aria-label="Sync Crosshair"]');
    if (syncCheckbox) syncCheckbox.checked = !!this.sync.options.crosshair;
    if (!this.sync.options.crosshair) {
      for (const c of this.sync.charts || []) {
        try { c.chart?.clearCrosshairPosition?.(); } catch {}
      }
    }
    return this.sync.options.crosshair;
  }

  open(chart, x, y, clientX, clientY) {
    this.opener = document.activeElement;
    this.activate(chart);
    this.closeSubmenu();
    this.root.replaceChildren();
    const point = ChartContextMenu.clickedPoint(chart, x, y);
    const hit = this.drawing.editor.find(chart, x, y);
    const more = this.drawing.editor.toolbar?.querySelector('.drawing-more');
    if (more) more.hidden = true;

    const run = action => () => {
      this.drawing.editor.select(chart, hit.drawing);
      this.drawing.editor.toolbar.querySelector(`[data-action="${action}"]`).click();
    };

    if (hit) {
      const target = hit.drawing;
      this.drawing.editor.select(chart, target);
      this.item('Settings…', () => this.drawing.editor.open(), '', false, 'settings');
      if (typeof TemplateMenu !== 'undefined' && this.drawing.editor.settings?.templateMenuOptions) {
        this.submenu('Template', (sub, closeAll) => {
          const opts = this.drawing.editor.settings.templateMenuOptions(target, true);
          TemplateMenu.buildMenuItems(sub, {
            ...opts,
            saveLabel: 'Save as…',
            defaultLabel: 'Apply default',
            onSaveAs: () => { closeAll(); opts.onSaveAs(); },
            onDone: closeAll
          });
        }, 'template');
      }
      if (['box', 'line', 'hline', 'text'].includes(target.type)) {
        this.item('Text…', () => this.drawing.editor.open('text'), '', false, 'text');
      }
      this.divider();
      this.submenu('Visual order', (sub, closeAll) => {
        const addSub = (lbl, fn) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('role', 'menuitem');
          const s = document.createElement('span');
          s.className = 'tv-ctx-label';
          s.textContent = lbl;
          b.appendChild(s);
          b.onclick = () => { fn(); closeAll(); };
          sub.appendChild(b);
        };
        addSub('Bring to front', run('front'));
        addSub('Send to back', run('back'));
      }, 'layers');
      this.divider();
      this.item('Clone', run('duplicate'), '', false, 'clone');
      this.item('Copy', () => { this.copyDrawing(target); }, 'Ctrl + C', false, 'copy');
      this.divider();
      this.item(target.locked ? 'Unlock' : 'Lock', run('lock'), '', false, 'lock');
      this.item('Hide', () => {
        this.drawing.editor.commit({ ...target, hidden: true });
        this.drawing.editor.clear();
      }, '', false, 'eye');
      this.item('Remove', run('delete'), 'Delete', !!target.locked || this.drawing.drawingsLocked, 'trash');
    } else {
      this.item('Reset chart view', () => chart.resetView(), 'Alt + R', false, 'reset');
      this.divider();

      if (point) {
        const value = ChartContextMenu.formatPrice(point.price, chart.metadata, chart.appearance);
        this.item(`Copy price ${value}`, async () => {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable in this browser.');
          await navigator.clipboard.writeText(String(point.price));
        }, '', false, 'copy');
        this.item('Paste', () => {
          if (!this.clipboard) throw new Error('Chưa có đối tượng đã sao chép.');
          this.pasteClipboard(chart, point);
        }, 'Ctrl + V', !this.clipboard, 'paste');
        this.divider();

        const lastClose = chart.bars?.at(-1)?.close ?? this.paperPanel?.paper?.quotes?.get(chart.symbol)?.price;
        const { sellType, buyType } = ChartContextMenu.orderKinds(point.price, lastClose);
        const qty = Math.max(1, parseInt(document.getElementById('order-qty')?.value || '1', 10) || 1);
        const placeOrder = (side, type) => {
          if (!this.paperPanel) throw new Error('Paper Trading chưa sẵn sàng.');
          this.paperPanel.guard(chart.symbol);
          this.paperPanel.placeFromChart(chart, { symbol: chart.symbol, side, type, qty, price: point.price });
          this.paperPanel.render();
        };

        this.item(`Add alert on ${chart.symbol} at ${value}…`, () => this.openAlert(chart, point.price), 'Alt + A', false, 'alert');
        this.item(`Sell ${qty} ${chart.symbol} @ ${value} ${sellType}`, () => placeOrder('sell', sellType), 'Alt + Shift + S', false, 'sell');
        this.item(`Buy ${qty} ${chart.symbol} @ ${value} ${buyType}`, () => placeOrder('buy', buyType), '', false, 'buy');
        this.item(`Add order on ${chart.symbol} at ${value}…`, () => {
          chart.container.dispatchEvent(new CustomEvent('chart-activate'));
          document.getElementById('paper-panel')?.dispatchEvent(new CustomEvent('paper-new-ticket', { detail: { price: point.price } }));
        }, 'Shift + T', false, 'order');
      } else {
        this.item('Paste', () => {
          if (!this.clipboard) throw new Error('Chưa có đối tượng đã sao chép.');
          this.pasteClipboard(chart, null);
        }, 'Ctrl + V', !this.clipboard, 'paste');
      }

      this.divider();
      const cursorLocked = this.sync ? !!this.sync.options?.crosshair : false;
      this.item('Lock vertical cursor line by time', () => this.toggleVerticalCursorLock(), '', !this.sync, cursorLocked ? 'check' : 'cursor');

      this.divider();
      this.item('Table view', () => { this.desktop.objectTab = 'data'; this.desktop.open('objects'); }, '', false, 'table');
      this.item('Save chart snapshot', () => chart.saveSnapshot(), '', false, 'snapshot');
      this.item('Object tree', () => { this.desktop.objectTab = 'tree'; this.desktop.open('objects'); }, '', false, 'layers');
      if (typeof TemplateMenu !== 'undefined' && this.chartSettings?.templateMenuOptions) {
        this.submenu('Chart template', (sub, closeAll) => {
          const opts = this.chartSettings.templateMenuOptions(chart, false);
          TemplateMenu.buildMenuItems(sub, {
            ...opts,
            saveLabel: 'Save as…',
            defaultLabel: 'Apply defaults',
            onSaveAs: () => { closeAll(); opts.onSaveAs(); },
            onDone: closeAll
          });
        }, 'template');
      }

      this.divider();
      const drawingCount = chart.drawings?.length || 0;
      const indicatorCount = chart.runner?.entries?.length || 0;
      const drawingLabel = drawingCount > 0 ? `Remove ${drawingCount} ${drawingCount === 1 ? 'drawing' : 'drawings'}` : 'Remove drawings';
      const indicatorLabel = indicatorCount > 0 ? `Remove ${indicatorCount} ${indicatorCount === 1 ? 'indicator' : 'indicators'}` : 'Remove indicators';
      this.item(drawingLabel, () => this.drawing.setTool('trash'), '', this.drawing.drawingsLocked || !drawingCount, 'trash');
      this.item(indicatorLabel, () => {
        for (const entry of [...(chart.runner?.entries || [])]) chart.runner.remove(entry.record.id);
        this.desktop?.refresh?.();
      }, '', !indicatorCount, 'trash');

      this.divider();
      this.item('Settings…', () => chart.onChartSettings?.(), '', false, 'settings');
    }

    this.status = document.createElement('div');
    this.status.className = 'chart-context-status';
    this.status.setAttribute('role', 'alert');
    this.root.appendChild(this.status);
    this.root.hidden = false;
    this.root.scrollTop = 0;
    this.root.style.left = Math.max(8, Math.min(innerWidth - this.root.offsetWidth - 8, clientX)) + 'px';
    this.root.style.top = Math.max(8, Math.min(innerHeight - this.root.offsetHeight - 8, clientY)) + 'px';
    this.root.querySelector('button:not([disabled])')?.focus();
  }
}
if (typeof module !== 'undefined') module.exports = ChartContextMenu;
