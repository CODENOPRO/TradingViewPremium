const Workspace = {
  read(key, fallback) {
    try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); }
    catch (error) { console.warn(`Cannot read ${key}; keeping original storage`, error); return fallback; }
  },
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { window.dispatchEvent(new CustomEvent('storage-error', { detail: `Không lưu được ${key}: ${error.message}` })); return false; }
  }
};
