const Workspace = {
  prefix:typeof window!=='undefined'&&window.TERMINAL_ENGINE_V5?'terminal_v5_preview:':'',
  read(key, fallback) {
    try { const value = localStorage.getItem(this.prefix+key) ?? (this.prefix?localStorage.getItem(key):null); return value === null ? fallback : JSON.parse(value); }
    catch (error) { console.warn(`Cannot read ${key}; keeping original storage`, error); return fallback; }
  },
  write(key, value) {
    try { localStorage.setItem(this.prefix+key, JSON.stringify(value)); return true; }
    catch (error) { window.dispatchEvent(new CustomEvent('storage-error', { detail: `Không lưu được ${key}: ${error.message}` })); return false; }
  }
};
