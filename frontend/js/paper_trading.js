/* Local paper ledger. Fill reference is the observed last trade, never a fabricated bid/ask. */
class PaperTrading {
  constructor(state = { accounts: [], active: null }, save = () => {}) {
    this.state = state;
    this.persist = save;
    this.quotes = new Map();
  }
  get account() { return this.state.accounts.find(a => a.id === this.state.active); }
  save() { this.persist(this.state); }
  create(name, balance, marginPercent) {
    if (!name.trim() || !Number.isFinite(balance) || balance <= 0 || !Number.isFinite(marginPercent) || marginPercent <= 0 || marginPercent > 100) throw new Error('Tên, balance hoặc margin không hợp lệ.');
    const account = { id: crypto.randomUUID(), name: name.trim(), balance, initialBalance: balance, marginPercent, positions: [], orders: [], history: [] };
    this.state.accounts.push(account);
    this.state.active = account.id;
    this.save();
    return account;
  }
  equity(account = this.account) {
    if (!account) return 0;
    return account.balance + account.positions.reduce((sum, p) => sum + ((this.quotes.get(p.symbol)?.price ?? p.price) - p.price) * (p.side === 'buy' ? 1 : -1) * p.qty * p.pointValue, 0);
  }
  usedMargin(account = this.account) { return (account?.positions || []).reduce((sum, p) => sum + p.margin, 0); }
  place(order, metadata) {
    const a = this.account;
    if (!a) throw new Error('Tạo/chọn tài khoản demo trước.');
    const quote = this.quotes.get(order.symbol);
    if (!quote || Date.now() - quote.received > 5000) throw new Error('Không có giá live mới để mô phỏng khớp lệnh.');
    if (!['buy', 'sell'].includes(order.side) || !['market', 'limit', 'stop'].includes(order.type) || !Number.isInteger(order.qty) || order.qty <= 0) throw new Error('Lệnh không hợp lệ.');
    if (!Number.isFinite(metadata.pointValue) || metadata.pointValue <= 0) throw new Error('Chưa có thông số hợp đồng từ TradingView.');
    const reference = order.type === 'market' ? quote.price : order.price;
    if (!Number.isFinite(reference) || reference <= 0) throw new Error('Giá lệnh không hợp lệ.');
    for (const [key, direction] of [['sl', -1], ['tp', 1]]) {
      if (order[key] != null && (!Number.isFinite(order[key]) || (order[key] - reference) * (order.side === 'buy' ? 1 : -1) * direction <= 0)) throw new Error('SL/TP nằm sai phía giá vào lệnh.');
    }
    const item = { ...order, id: crypto.randomUUID(), pointValue: metadata.pointValue, created: Date.now() };
    if (order.type === 'market') this.fill(item, quote.price);
    else { a.orders.push(item); this.save(); }
    return item;
  }
  fill(order, price) {
    const a = this.account;
    const margin = Math.abs(price * order.qty * order.pointValue * a.marginPercent / 100);
    if (margin > this.equity() - this.usedMargin()) throw new Error('Không đủ free margin.');
    a.positions.push({ ...order, price, margin });
    a.history.push({ ...order, event: 'filled', price, at: Date.now() });
    this.save();
  }
  close(id, reason = 'manual') {
    const a = this.account;
    const p = a?.positions.find(p => p.id === id);
    if (!p) return;
    const quote = this.quotes.get(p.symbol);
    if (!quote || Date.now() - quote.received > 5000) throw new Error('Không có giá live mới để đóng vị thế.');
    const pnl = (quote.price - p.price) * (p.side === 'buy' ? 1 : -1) * p.qty * p.pointValue;
    a.balance += pnl;
    a.positions = a.positions.filter(item => item.id !== id);
    a.history.push({ ...p, event: 'closed', exit: quote.price, pnl, reason, at: Date.now() });
    this.save();
  }
  tick(symbol, price) {
    if (!Number.isFinite(price)) return;
    this.quotes.set(symbol, { price, received: Date.now() });
    const active = this.state.active;
    try {
      for (const a of this.state.accounts) {
        this.state.active = a.id;
        for (const order of [...a.orders]) {
          if (order.symbol !== symbol) continue;
          const crossed = order.type === 'limit' ? (order.side === 'buy' ? price <= order.price : price >= order.price) : (order.side === 'buy' ? price >= order.price : price <= order.price);
          if (!crossed) continue;
          a.orders = a.orders.filter(item => item.id !== order.id);
          try { this.fill(order, price); }
          catch (error) { a.history.push({ ...order, event: 'rejected', reason: error.message, at: Date.now() }); }
        }
        for (const p of [...a.positions]) {
          if (p.symbol !== symbol) continue;
          const sign = p.side === 'buy' ? 1 : -1;
          if (p.sl != null && (price - p.sl) * sign <= 0) this.close(p.id, 'stop-loss');
          else if (p.tp != null && (price - p.tp) * sign >= 0) this.close(p.id, 'take-profit');
        }
      }
    } finally { this.state.active = active; this.save(); }
  }
  cancel(id) {
    if (!this.account) return;
    this.account.orders = this.account.orders.filter(order => order.id !== id);
    this.save();
  }
}
if (typeof module !== 'undefined') module.exports = PaperTrading;
