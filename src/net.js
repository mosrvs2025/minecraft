// Thin WebSocket client. Resolves connect() with the welcome message, or null when offline.
export class Net {
  constructor() { this.ws = null; this.id = null; this.handlers = {}; }

  on(type, fn) { this.handlers[type] = fn; }

  connect() {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      setTimeout(() => finish(null), 2500);
      try {
        const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
        this.ws = ws;
        ws.onmessage = (e) => {
          let m; try { m = JSON.parse(e.data); } catch { return; }
          if (m.t === 'welcome') { this.id = m.id; finish(m); return; }
          this.handlers[m.t]?.(m);
        };
        ws.onerror = () => finish(null);
        ws.onclose = () => { finish(null); this.handlers.disconnect?.(); };
      } catch { finish(null); }
    });
  }

  get online() { return this.ws?.readyState === 1; }

  send(msg) { if (this.online) this.ws.send(JSON.stringify(msg)); }
}
