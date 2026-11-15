/* Shared template persistence and menu/dialog UI for chart themes and drawing tools. */
const TemplateMenu = (() => {
  const CHART_KEY = 'terminal_chart_templates_v1';
  const LEGACY_CHART_KEY = 'terminal_chart_template_v1';
  const DRAWING_KEY = 'drawing_templates_v1';
  const FORBIDDEN = ['__proto__', 'constructor', 'prototype'];

  function assertName(raw) {
    const name = String(raw || '').trim();
    if (!name) throw new Error('Nhập tên template.');
    if (name.length > 64) throw new Error('Tên template tối đa 64 ký tự.');
    if (FORBIDDEN.includes(name)) throw new Error('Tên template không hợp lệ.');
    return name;
  }

  function clone(value) {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  /** Build built-in chart appearance presets matching desktop profiles. */
  function chartPresets(ChartAppearance, symbol) {
    const base = ChartAppearance.desktopProfile(null, {}, symbol);
    const { session: _b, ...defaultData } = base;
    const darkData = {
      ...defaultData,
      bg: '#131722',
      bgBottom: '#131722',
      grid: '#2a2e39',
      verticalGridColor: '#2a2e39',
      horizontalGridColor: '#2a2e39',
      scaleLines: '#2a2e39',
      separator: '#2a2e39',
      textColor: '#b2b5be',
      bodyUp: '#089981',
      bodyDown: '#f23645',
      borderUp: '#089981',
      borderDown: '#f23645',
      wickUp: '#089981',
      wickDown: '#f23645',
      symbolLineColor: '#b2b5be',
      crosshair: '#787b86',
      watermarkColor: '#434651'
    };
    return [
      { name: 'Default', data: defaultData, builtin: true },
      { name: 'Dark', data: darkData, builtin: true }
    ];
  }

  /** Return all built-in presets and user-saved chart templates. */
  function listChartTemplates(Workspace, ChartAppearance, symbol) {
    const stored = Workspace.read(CHART_KEY, {});
    const userMap = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    const items = [...chartPresets(ChartAppearance, symbol)];
    for (const [name, data] of Object.entries(userMap)) {
      if (data && typeof data === 'object' && !FORBIDDEN.includes(name)) {
        const idx = items.findIndex(x => x.name === name);
        const entry = { name, data: clone(data), builtin: false };
        if (idx >= 0) items[idx] = entry;
        else items.push(entry);
      }
    }
    const legacy = Workspace.read(LEGACY_CHART_KEY, null);
    if (legacy && typeof legacy === 'object' && !Array.isArray(legacy) && !userMap['Saved template']) {
      items.push({ name: 'Saved template', data: clone(legacy), builtin: false, legacy: true });
    }
    return items;
  }

  function saveChartTemplate(Workspace, ChartAppearance, rawName, settings) {
    const name = assertName(rawName);
    const validated = ChartAppearance.validate(clone(settings));
    const { session: _s, ...themeData } = validated;
    const stored = Workspace.read(CHART_KEY, {});
    const next = stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...stored } : {};
    next[name] = themeData;
    if (!Workspace.write(CHART_KEY, next)) throw new Error('Không lưu được chart template.');
    return name;
  }

  function deleteChartTemplate(Workspace, name, legacy = false) {
    if (legacy) {
      Workspace.write(LEGACY_CHART_KEY, null);
      return true;
    }
    const stored = Workspace.read(CHART_KEY, {});
    const next = stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...stored } : {};
    delete next[name];
    return Workspace.write(CHART_KEY, next);
  }

  /** Strip geometry and per-instance flags when storing a drawing template. */
  function cleanDrawingStyle(draft) {
    const { id, type, p1, p2, p3, points, locked, hidden, title, isTemp, ...style } = clone(draft);
    return style;
  }

  function applyDrawingStyle(DrawingModel, target, style, isDefault = false) {
    const base = clone(target);
    const patch = clone(style);
    const merged = DrawingModel.normalize({
      ...base,
      ...patch,
      id: base.id,
      type: base.type,
      p1: base.p1,
      p2: base.p2,
      p3: base.p3,
      points: base.points,
      locked: base.locked,
      hidden: base.hidden,
      title: base.title
    });
    merged.text = isDefault ? (base.text || '') : (patch.text ? patch.text : (base.text || ''));
    return merged;
  }

  function listDrawingTemplates(Workspace, type) {
    const stored = Workspace.read(DRAWING_KEY, {});
    const group = stored && typeof stored === 'object' ? stored[type] : null;
    if (!group || typeof group !== 'object') return [];
    return Object.entries(group)
      .filter(([name, data]) => data && typeof data === 'object' && !FORBIDDEN.includes(name))
      .map(([name, data]) => ({ name, data: clone(data), builtin: false }));
  }

  function saveDrawingTemplate(Workspace, type, rawName, draft) {
    const name = assertName(rawName);
    const stored = Workspace.read(DRAWING_KEY, {});
    const next = stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...stored } : {};
    next[type] = next[type] && typeof next[type] === 'object' ? { ...next[type] } : {};
    next[type][name] = cleanDrawingStyle(draft);
    if (!Workspace.write(DRAWING_KEY, next)) throw new Error('Không lưu được drawing template.');
    return name;
  }

  function deleteDrawingTemplate(Workspace, type, name) {
    const stored = Workspace.read(DRAWING_KEY, {});
    if (!stored?.[type]) return true;
    const next = { ...stored, [type]: { ...stored[type] } };
    delete next[type][name];
    return Workspace.write(DRAWING_KEY, next);
  }

  let activeSaveModal = null;
  function openSaveDialog({ title = 'Save template', defaultValue = '', placeholder = 'Template name', opener = document.activeElement, onSave }) {
    activeSaveModal?.remove();
    const modal = document.createElement('div');
    modal.className = 'modal show tv-template-save-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', title);
    modal.innerHTML = `<div class="modal-content tv-save-dialog">
      <div class="modal-header"><span></span><button type="button" class="modal-close" aria-label="Close">×</button></div>
      <form class="tv-save-form">
        <div class="modal-body">
          <label class="tv-save-label">Template name<input type="text" class="tv-save-input" maxlength="64" autocomplete="off"></label>
          <p class="tv-save-error" role="alert"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary tv-save-cancel">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>`;
    modal.querySelector('.modal-header span').textContent = title;
    const input = modal.querySelector('.tv-save-input');
    input.placeholder = placeholder;
    input.value = defaultValue;
    const errorEl = modal.querySelector('.tv-save-error');
    const close = () => {
      modal.remove();
      if (activeSaveModal === modal) activeSaveModal = null;
      opener?.focus?.();
    };
    modal.querySelector('.modal-close').onclick = close;
    modal.querySelector('.tv-save-cancel').onclick = close;
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    });
    modal.querySelector('form').onsubmit = e => {
      e.preventDefault();
      try {
        onSave(input.value);
        close();
      } catch (err) {
        errorEl.textContent = err.message;
        input.focus();
      }
    };
    document.body.appendChild(modal);
    activeSaveModal = modal;
    input.focus();
    input.select();
    return modal;
  }

  /** Populate a menu container with Save As, Apply Defaults, and template rows (with delete). */
  function buildMenuItems(container, { getItems, saveLabel = 'Save as…', defaultLabel = 'Apply defaults', onSaveAs, onDefault, onApply, onDelete, onDone }) {
    const render = () => {
      container.replaceChildren();
      const addAction = (label, handler, cls = '') => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        if (cls) b.className = cls;
        const span = document.createElement('span');
        span.textContent = label;
        b.appendChild(span);
        b.onclick = e => {
          e.stopPropagation();
          handler();
          onDone?.();
        };
        container.appendChild(b);
      };
      if (onSaveAs) addAction(saveLabel, onSaveAs, 'tv-tpl-action');
      if (onDefault) addAction(defaultLabel, onDefault, 'tv-tpl-action');
      const items = getItems() || [];
      const div = document.createElement('div');
      div.className = 'chart-context-divider';
      div.setAttribute('role', 'separator');
      container.appendChild(div);
      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'tv-tpl-empty';
        empty.textContent = 'Chưa có template đã lưu';
        container.appendChild(empty);
        return;
      }
      for (const item of items) {
        const row = document.createElement('div');
        row.className = 'tv-tpl-row';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tv-tpl-apply';
        btn.setAttribute('role', 'menuitem');
        const labelSpan = document.createElement('span');
        labelSpan.textContent = item.name;
        btn.appendChild(labelSpan);
        if (item.builtin) {
          const badge = document.createElement('kbd');
          badge.textContent = 'Preset';
          btn.appendChild(badge);
        }
        btn.onclick = e => {
          e.stopPropagation();
          onApply(item);
          onDone?.();
        };
        row.appendChild(btn);
        if (!item.builtin && onDelete) {
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'tv-tpl-delete';
          del.textContent = '×';
          del.title = `Delete ${item.name}`;
          del.setAttribute('aria-label', `Delete template ${item.name}`);
          del.onclick = e => {
            e.stopPropagation();
            onDelete(item);
            render();
          };
          row.appendChild(del);
        }
        container.appendChild(row);
      }
    };
    render();
    return render;
  }

  let activePopup = null;
  function closePopup(focusOpener = false) {
    if (!activePopup) return;
    const { el, cleanup, anchor } = activePopup;
    activePopup = null;
    cleanup();
    el.remove();
    if (anchor) anchor.setAttribute('aria-expanded', 'false');
    if (focusOpener) anchor?.focus?.();
  }

  function openPopup({ anchor, prefer = 'above', ...menuOpts }) {
    const sameAnchor = activePopup?.anchor === anchor;
    closePopup(false);
    if (sameAnchor) return null;
    const pop = document.createElement('div');
    pop.className = 'tv-template-menu chart-context-menu';
    pop.setAttribute('role', 'menu');
    pop.setAttribute('aria-label', 'Templates');
    if (anchor) anchor.setAttribute('aria-expanded', 'true');
    buildMenuItems(pop, { ...menuOpts, onDone: () => closePopup(false) });
    document.body.appendChild(pop);
    const rect = anchor.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(window.innerWidth - popRect.width - margin, rect.left));
    let top = prefer === 'above' ? rect.top - popRect.height - 6 : rect.bottom + 6;
    if (top < margin) top = Math.min(window.innerHeight - popRect.height - margin, rect.bottom + 6);
    if (top + popRect.height > window.innerHeight - margin) top = Math.max(margin, rect.top - popRect.height - 6);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    const onPointerDown = e => {
      if (!pop.contains(e.target) && !anchor.contains(e.target)) closePopup(false);
    };
    const onKeyDown = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePopup(true); return; }
      const items = [...pop.querySelectorAll('button[role="menuitem"]:not([disabled])')];
      if (!items.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      const idx = items.indexOf(document.activeElement);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    };
    const onResize = () => closePopup(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onResize);
    activePopup = {
      el: pop,
      anchor,
      cleanup: () => {
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener('resize', onResize);
      }
    };
    pop.querySelector('button[role="menuitem"]')?.focus();
    return pop;
  }

  return {
    CHART_KEY,
    LEGACY_CHART_KEY,
    DRAWING_KEY,
    assertName,
    chartPresets,
    listChartTemplates,
    saveChartTemplate,
    deleteChartTemplate,
    cleanDrawingStyle,
    applyDrawingStyle,
    listDrawingTemplates,
    saveDrawingTemplate,
    deleteDrawingTemplate,
    buildMenuItems,
    openPopup,
    closePopup,
    openSaveDialog
  };
})();
if (typeof module !== 'undefined') module.exports = TemplateMenu;
