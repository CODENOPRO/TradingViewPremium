/* Scripts execute off the UI thread; an infinite loop is stopped by the host timeout. */
let calculate;
self.onmessage = async ({ data }) => {
  const started = performance.now();
  try {
    if (data.type === 'init') {
      if (/^\s*(?:\/\/\s*@version|indicator\s*\(|import\s+\w+\/)/m.test(data.code)) {
        throw new Error('Đây là Pine Script. Cần bản JavaScript đã chuyển đổi; không hỗ trợ chạy Pine nguyên bản.');
      }
      const plugin = new Function('"use strict";\n' + data.code + '\nreturn typeof indicator !== "undefined" ? indicator : (typeof calculate === "function" ? { calculate } : null);')();
      if (!plugin || typeof plugin.calculate !== 'function') throw new Error('Script cần function calculate(bars, context) hoặc const indicator = { calculate }.');
      calculate = plugin.calculate;
      self.postMessage({ type: 'ready', defaults: plugin.defaults || {}, name: plugin.name || 'Custom indicator' });
      return;
    }
    if (data.type === 'run') {
      const output = await calculate(data.bars, data.context);
      const result = Array.isArray(output) ? { series: output } : output;
      if (!result || typeof result !== 'object') throw new Error('Indicator phải trả về {series, drawings, tables}.');
      self.postMessage({ type: 'result', id: data.id, result, elapsed: performance.now() - started });
    }
  } catch (error) {
    self.postMessage({ type: 'error', id: data.id, error: error.message || String(error) });
  }
};
