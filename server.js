// Voxelia server: serves the client and relays multiplayer state over WebSocket (/ws).
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const PROD = process.env.NODE_ENV === 'production';
const SAVE_FILE = path.join(__dirname, 'world.json');

// ---- persistent world state -------------------------------------------------
let seed = Math.floor(Math.random() * 2 ** 31);
const edits = new Map(); // "x,y,z" -> block id
try {
  const saved = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
  seed = saved.seed;
  for (const [k, v] of saved.edits) edits.set(k, v);
  console.log(`Loaded world (seed ${seed}, ${edits.size} edits)`);
} catch { console.log(`New world, seed ${seed}`); }

let dirty = false;
setInterval(() => {
  if (!dirty) return;
  dirty = false;
  fs.writeFile(SAVE_FILE, JSON.stringify({ seed, edits: [...edits] }), () => {});
}, 10000);

const t0 = Date.now();

// ---- http --------------------------------------------------------------------
const app = express();
const server = http.createServer(app);

if (PROD) {
  app.use(express.static(path.join(__dirname, 'dist')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  app.use(vite.middlewares);
}

// ---- websocket ---------------------------------------------------------------
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  // other upgrades (Vite HMR) are handled by Vite's own listener
});

const players = new Map(); // id -> { ws, name, p, r }
let nextId = 1;

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(msg, except) {
  const data = JSON.stringify(msg);
  for (const [id, pl] of players) if (id !== except && pl.ws.readyState === 1) pl.ws.send(data);
}
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

wss.on('connection', (ws) => {
  const id = nextId++;
  const me = { ws, name: `Player${id}`, p: [0, 80, 0], r: [0, 0] };
  players.set(id, me);

  send(ws, {
    t: 'welcome', id, seed,
    time: (Date.now() - t0) / 1000,
    edits: [...edits].map(([k, v]) => [...k.split(',').map(Number), v]),
    players: [...players].filter(([pid]) => pid !== id).map(([pid, pl]) => ({ id: pid, name: pl.name, p: pl.p, r: pl.r })),
  });

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    switch (m.t) {
      case 'hello':
        me.name = clean(m.name, 16) || me.name;
        broadcast({ t: 'join', id, name: me.name, p: me.p, r: me.r }, id);
        broadcast({ t: 'chat', from: '', text: `${me.name} joined the game` });
        break;
      case 'move':
        if (!Array.isArray(m.p) || !Array.isArray(m.r) || !m.p.every(isNum) || !m.r.every(isNum)) return;
        me.p = m.p.slice(0, 3); me.r = m.r.slice(0, 2);
        broadcast({ t: 'move', id, p: me.p, r: me.r, a: !!m.a }, id);
        break;
      case 'block': {
        const { x, y, z, b } = m;
        if (![x, y, z, b].every(Number.isInteger) || y < 0 || y > 127 || b < 0 || b > 63) return;
        edits.set(`${x},${y},${z}`, b);
        dirty = true;
        broadcast({ t: 'block', x, y, z, b }, id);
        break;
      }
      case 'chat': {
        const text = clean(m.text, 200);
        if (text) broadcast({ t: 'chat', from: me.name, text });
        break;
      }
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ t: 'leave', id });
    broadcast({ t: 'chat', from: '', text: `${me.name} left the game` });
  });
});

server.listen(PORT, () => console.log(`Voxelia running on http://localhost:${PORT} (${PROD ? 'production' : 'dev'})`));
