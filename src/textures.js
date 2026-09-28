// Procedural 64px block textures + normal maps, packed into an atlas with wrapped gutters.
import * as THREE from 'three';
import { TILE, BLOCKS } from './blocks.js';

const T = 64, G = 8, CELL = T + 2 * G, COLS = 4, ROWS = 15;
const W = CELL * COLS, H = CELL * ROWS;

export function tileUV(tile) {
  const c = tile % COLS, r = Math.floor(tile / COLS);
  const x0 = c * CELL + G, y0 = r * CELL + G;
  return [x0 / W, 1 - (y0 + T) / H, (x0 + T) / W, 1 - y0 / H]; // u0, v0, u1, v1
}

// ---- tileable noise helpers ---------------------------------------------------
function hi(x, y, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const wrap = (a, p) => ((a % p) + p) % p;
function vnoise(x, y, px, py, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const x0 = wrap(xi, px), x1 = wrap(xi + 1, px), y0 = wrap(yi, py), y1 = wrap(yi + 1, py);
  const a = hi(x0, y0, s), b = hi(x1, y0, s), c = hi(x0, y1, s), d = hi(x1, y1, s);
  const top = a + (b - a) * u, bot = c + (d - c) * u;
  return top + (bot - top) * v;
}
function fbm(u, v, px, py, oct, s) {
  let sum = 0, amp = 0.5, tot = 0;
  for (let i = 0; i < oct; i++) { sum += vnoise(u * px, v * py, px, py, s + i * 31) * amp; tot += amp; amp *= 0.5; px *= 2; py *= 2; }
  return sum / tot;
}
function voronoi(u, v, N, s) {
  const gx = Math.floor(u * N), gy = Math.floor(v * N);
  let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j, wx = wrap(cx, N), wy = wrap(cy, N);
    const px = (cx + 0.15 + hi(wx, wy, s) * 0.7) / N, py = (cy + 0.15 + hi(wx, wy, s + 1) * 0.7) / N;
    const d = Math.hypot(px - u, py - v);
    if (d < d1) { d2 = d1; d1 = d; id = wx + wy * N; } else if (d < d2) d2 = d;
  }
  return [d1, d2, id];
}
const px = (u, v, s) => hi(Math.floor(u * T), Math.floor(v * T), s);
const sc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// ---- painters: (u, v) with v = 0 at the top of the tile -> [r, g, b, a, height] ----
const P = {};
P.dirt = (u, v) => {
  const n = fbm(u, v, 4, 4, 4, 1), s = px(u, v, 9);
  let k = 0.72 + n * 0.5, h = n * 0.6;
  if (s > 0.94) { k *= 1.3; h += 0.35; } else if (s < 0.05) { k *= 0.65; h -= 0.2; }
  return [...sc([0.46, 0.32, 0.21], k), 1, h];
};
P.grass = (u, v) => {
  const n = fbm(u, v, 4, 4, 4, 3), s = px(u, v, 11);
  const k = 0.7 + n * 0.45 + (s - 0.5) * 0.3;
  return [0.3 * k, 0.56 * k, 0.17 * k, 1, n * 0.4 + s * 0.5];
};
const sideTop = (base, topFn, seed, depth) => (u, v) => {
  const edge = depth + fbm(u, 0.5, 16, 1, 2, seed) * 0.16;
  if (v < edge) { const c = topFn(u, v); if (v > edge - 0.035) { c[0] *= 0.75; c[1] *= 0.75; c[2] *= 0.75; } return c; }
  const c = base(u, v); if (v < edge + 0.05) { c[0] *= 0.8; c[1] *= 0.8; c[2] *= 0.8; } return c;
};
P.grassSide = sideTop(P.dirt, P.grass, 5, 0.1);
P.stone = (u, v) => {
  const n = fbm(u, v, 4, 4, 5, 21), r = Math.abs(fbm(u, v, 3, 3, 3, 33) - 0.5);
  let k = 0.62 + n * 0.4, h = n;
  if (r < 0.018) { k *= 0.62; h -= 0.35; }
  return [...sc([0.52, 0.52, 0.54], k), 1, h];
};
P.sand = (u, v) => {
  const n = fbm(u, v, 8, 8, 3, 41), g = px(u, v, 43);
  const rip = Math.sin((v + fbm(u, v, 2, 2, 2, 44) * 0.25) * Math.PI * 2 * 5) * 0.04;
  return [...sc([0.88, 0.79, 0.57], 0.86 + n * 0.16 + g * 0.08 + rip), 1, n * 0.3 + rip * 3 + g * 0.2];
};
P.logSide = (u, v) => {
  const n = fbm(u, v, 16, 2, 3, 51), f = fbm(u, v, 8, 8, 2, 52);
  let k = 0.6 + n * 0.6 + f * 0.1, h = n;
  if (n < 0.38) { k *= 0.6; h -= 0.3; }
  return [...sc([0.4, 0.29, 0.18], k), 1, h];
};
P.logTop = (u, v) => {
  const dx = u - 0.5, dy = v - 0.5, d = Math.max(Math.abs(dx), Math.abs(dy)) * 0.6 + Math.hypot(dx, dy) * 0.4;
  if (d > 0.43) return P.logSide(u, v);
  const r = Math.sin((d + fbm(u, v, 4, 4, 2, 61) * 0.06) * Math.PI * 2 * 8) * 0.5 + 0.5;
  return [...sc([0.72, 0.56, 0.35], 0.78 + r * 0.22), 1, r * 0.4];
};
P.leaves = (u, v) => {
  const n = fbm(u, v, 8, 8, 3, 71), c = fbm(u, v, 4, 4, 2, 72), s = px(u, v, 73);
  const a = n * 0.7 + c * 0.3 + (s - 0.5) * 0.2 > 0.4 ? 1 : 0;
  return [...sc([0.19, 0.4, 0.12], 0.6 + n * 0.7 + s * 0.15), a, n];
};
P.planks = (u, v) => {
  const board = Math.floor(v * 4), bv = v * 4 - board;
  const seamX = wrap(u + hi(board, 1, 83) , 1) < 0.018 && board % 2 === 0;
  const grain = fbm(u + board * 0.31, v, 2, 32, 3, 81);
  let k = (0.74 + grain * 0.45) * (0.9 + hi(board, 2, 84) * 0.18), h = 0.55 + grain * 0.3;
  if (bv < 0.05 || bv > 0.97 || seamX) { k *= 0.45; h = 0; }
  return [...sc([0.66, 0.49, 0.3], k), 1, h];
};
P.glass = (u, v) => {
  const e = 1.5 / 16;
  if (u < e || u > 1 - e || v < e || v > 1 - e) return [0.82, 0.9, 0.95, 1, 1];
  const st = wrap((u + v) * 2.5, 1);
  if (st > 0.1 && st < 0.14 && u > 0.2 && u < 0.8) return [0.95, 0.98, 1, 1, 0.8];
  return [0.8, 0.9, 1, 0, 0];
};
P.cobble = (u, v) => {
  const [d1, d2, id] = voronoi(u, v, 5, 91), edge = d2 - d1, n = fbm(u, v, 8, 8, 3, 92);
  if (edge < 0.03) return [...sc([0.3, 0.3, 0.31], 0.8 + n * 0.3), 1, 0];
  const k = 0.5 + hi(id, 0, 93) * 0.28 + n * 0.3;
  return [...sc([0.6, 0.6, 0.6], k), 1, Math.min(1, edge * 7) * 0.8 + n * 0.2];
};
P.snow = (u, v) => {
  const n = fbm(u, v, 4, 4, 4, 101), s = px(u, v, 102);
  return [...sc([0.92, 0.95, 1], 0.9 + n * 0.1 + (s > 0.97 ? 0.05 : 0)), 1, n * 0.35];
};
P.snowSide = sideTop(P.dirt, P.snow, 103, 0.18);
P.brick = (u, v) => {
  const row = Math.floor(v * 4), rv = v * 4 - row, offs = row % 2 ? 0.25 : 0;
  const bu = wrap((u + offs) * 2, 1), id = Math.floor(wrap(u + offs, 1) * 2) + row * 7;
  const n = fbm(u, v, 8, 8, 3, 111);
  if (rv < 0.09 || bu < 0.035) return [...sc([0.74, 0.71, 0.66], 0.8 + n * 0.25), 1, 0];
  return [...sc([0.6, 0.27, 0.19], 0.72 + hi(id, 3, 112) * 0.28 + n * 0.3), 1, 0.7 + n * 0.3];
};
function blades(u, v, count, seed, colFn) {
  const x = u * T, fromBottom = (1 - v) * T;
  for (let i = 0; i < count; i++) {
    const b = 4 + hi(i, 0, seed) * (T - 8), t = b + (hi(i, 1, seed) - 0.5) * 24, hh = T * (0.45 + hi(i, 2, seed) * 0.5);
    if (fromBottom > hh) continue;
    const f = fromBottom / hh, c = b + (t - b) * f * f, w = 2.2 * (1 - f) + 0.4;
    if (Math.abs(x - c) < w) return colFn(i, f);
  }
  return null;
}
P.tallgrass = (u, v) =>
  blades(u, v, 14, 121, (i, f) => [...sc([0.3, 0.55, 0.17], 0.55 + f * 0.55 + hi(i, 4, 122) * 0.2), 1, 0.5 + f * 0.5])
  ?? [0.3, 0.5, 0.2, 0, 0];
P.flower = (u, v) => {
  const dx = u - 0.5, dy = v - 0.3, d = Math.hypot(dx, dy);
  if (d < 0.07) return [0.95, 0.8, 0.2, 1, 1];
  const ang = Math.atan2(dy, dx), petal = 0.17 + Math.cos(ang * 5) * 0.05;
  if (d < petal) return [...sc([0.85, 0.12, 0.1], 0.8 + (1 - d / petal) * 0.3), 1, 0.8];
  if (Math.abs(u - 0.5 - Math.sin(v * 6) * 0.02) < 0.025 && v > 0.3) return [0.2, 0.45, 0.14, 1, 0.5];
  if (v > 0.6) { const l = Math.abs(u - 0.5) - (v - 0.6) * 0.6; if (l < 0.12 && l > 0 && Math.abs(v - 0.72 - (u - 0.5) * 0.3) < 0.06) return [0.25, 0.5, 0.16, 1, 0.5]; }
  return [0.3, 0.5, 0.2, 0, 0];
};

const ore = (col, seed, size) => (u, v) => {
  const [d1, , id] = voronoi(u, v, 4, seed);
  const r = size * (0.6 + hi(id, 5, seed) * 0.6);
  if (hi(id, 6, seed) < 0.75 && d1 < r) {
    const k = 0.75 + (1 - d1 / r) * 0.45 + (px(u, v, seed) - 0.5) * 0.2;
    return [...sc(col, k), 1, 0.9 - d1 / r * 0.3];
  }
  return P.stone(u, v);
};
P.coal = ore([0.12, 0.12, 0.13], 131, 0.17);
P.iron = ore([0.85, 0.62, 0.45], 133, 0.17);
P.gold = ore([1, 0.84, 0.22], 135, 0.17);
P.diamond = ore([0.35, 1, 0.95], 137, 0.17);
const FONT = { T: ['111', '010', '010', '010', '010'], N: ['1001', '1101', '1011', '1001', '1001'] };
P.tntSide = (u, v) => {
  const n = fbm(u, v, 8, 8, 2, 141);
  if (v > 0.3 && v < 0.7) {
    const S = 3, x = Math.floor(u * T), y = Math.floor(v * T) - 25;
    let gx = 14;
    for (const ch of 'TNT') {
      const g = FONT[ch], w = g[0].length * S;
      if (x >= gx && x < gx + w && y >= 0 && y < 5 * S && g[Math.floor(y / S)][Math.floor((x - gx) / S)] === '1') return [0.12, 0.12, 0.12, 1, 0.2];
      gx += w + S;
    }
    return [...sc([0.93, 0.92, 0.88], 0.9 + n * 0.1), 1, 0.6];
  }
  const stripe = Math.floor(u * 8) % 2;
  return [...sc([0.78, 0.16, 0.12], 0.8 + n * 0.25 - stripe * 0.12), 1, 0.4 + stripe * 0.2];
};
P.tntTop = (u, v) => {
  const d = Math.hypot(u - 0.5, v - 0.5), n = fbm(u, v, 8, 8, 2, 143);
  if (d < 0.09) return [0.15, 0.13, 0.12, 1, 0];
  if (d < 0.14) return [0.55, 0.5, 0.45, 1, 0.3];
  return [...sc([0.8, 0.2, 0.15], 0.8 + n * 0.25), 1, 0.5];
};

const QMARK = ['01110', '10001', '00001', '00010', '00100', '00000', '00100'];
const rivets = (u, v) => [[0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]].some(([a, b]) => Math.hypot(u - a, v - b) < 0.045);
P.qblock = (u, v) => {
  const x = Math.floor(u * T), y = Math.floor(v * T), S = 5, gx = 20, gy = 14;
  const glyph = (ox, oy) => { const cx = Math.floor((x - gx - ox) / S), cy = Math.floor((y - gy - oy) / S);
    return cx >= 0 && cx < 5 && cy >= 0 && cy < 7 && QMARK[cy][cx] === '1'; };
  if (glyph(0, 0)) return [1, 0.97, 0.9, 1, 1];
  if (glyph(3, 3)) return [0.45, 0.24, 0.05, 1, 0.3];
  if (rivets(u, v)) return [0.35, 0.2, 0.05, 1, 0.2];
  const e = Math.min(u, v, 1 - u, 1 - v), n = fbm(u, v, 8, 8, 2, 151);
  if (e < 0.04) return [0.55, 0.3, 0.05, 1, 0.1];
  return [...sc([1, 0.72, 0.12], 0.9 + n * 0.12 - (e < 0.08 ? 0.12 : 0)), 1, 0.6];
};
P.used = (u, v) => {
  if (rivets(u, v)) return [0.22, 0.13, 0.07, 1, 0.2];
  const e = Math.min(u, v, 1 - u, 1 - v), n = fbm(u, v, 8, 8, 2, 153);
  return [...sc([0.55, 0.36, 0.2], 0.85 + n * 0.2 - (e < 0.05 ? 0.25 : 0)), 1, e < 0.05 ? 0.1 : 0.6];
};

P.mycel = (u, v) => {
  const n = fbm(u, v, 4, 4, 4, 161), s = px(u, v, 162);
  const k = 0.7 + n * 0.4 + (s > 0.93 ? 0.35 : 0);
  return [0.5 * k, 0.4 * k, 0.55 * k, 1, n * 0.5 + (s > 0.93 ? 0.4 : 0)];
};
P.mycelSide = sideTop(P.dirt, P.mycel, 163, 0.14);
P.stem = (u, v) => {
  const n = fbm(u, v, 16, 2, 3, 171);
  return [...sc([0.9, 0.85, 0.74], 0.78 + n * 0.3), 1, n];
};
const cap = (base, spot, seed, spotGlow) => (u, v) => {
  const [d1, , id] = voronoi(u, v, 3, seed), n = fbm(u, v, 8, 8, 2, seed + 1);
  if (hi(id, 7, seed) < 0.55 && d1 < 0.11 + hi(id, 8, seed) * 0.05) return [...sc(spot, 0.92 + n * 0.1), 1, 0.9];
  const e = Math.min(u, v, 1 - u, 1 - v);
  return [...sc(base, 0.8 + n * 0.3 - (e < 0.03 ? 0.15 : 0)), 1, 0.5 + n * 0.2];
};
P.capRed = cap([0.8, 0.12, 0.1], [0.97, 0.95, 0.9], 181);
P.capGlow = cap([0.36, 0.14, 0.5], [0.4, 1, 0.95], 183);
P.capGold = cap([0.95, 0.68, 0.12], [1, 0.97, 0.85], 185);
P.obsidian = (u, v) => {
  const n = fbm(u, v, 4, 4, 4, 191), st = Math.abs(fbm(u, v, 2, 6, 3, 192) - 0.5);
  return [...sc([0.12, 0.08, 0.18], 0.7 + n * 0.5 + (st < 0.03 ? 0.8 : 0)), 1, n];
};
P.starstone = (u, v) => {
  const x = Math.floor(u * 8), y = Math.floor(v * 8), cellU = u * 8 - x, cellV = v * 8 - y;
  const rune = hi(x, y, 201) < 0.45 && (cellU < 0.3 || cellV < 0.3) && cellU < 0.9 && cellV < 0.9;
  if (rune) return [0.35, 0.95, 1, 1, 0.9];
  return [...sc([0.1, 0.1, 0.2], 0.8 + fbm(u, v, 4, 4, 2, 202) * 0.4), 1, 0.3];
};
P.cracked = (u, v) => {
  const b = P.brick(u, v), r = Math.abs(fbm(u, v, 3, 3, 4, 211) - 0.5);
  if (r < 0.025) return [0.08, 0.06, 0.05, 1, 0];
  return [b[0] * 0.75, b[1] * 0.8, b[2] * 0.85, 1, b[4]];
};
P.geode = (u, v) => {
  const n = fbm(u, v, 8, 8, 4, 221), s = px(u, v, 222);
  return [...sc([0.42, 0.36, 0.5], 0.65 + n * 0.5 + (s > 0.9 ? 0.25 : 0)), 1, n];
};
P.crystal = (u, v) => {
  const [d1, d2] = voronoi(u, v, 4, 231), e = d2 - d1;
  return [...sc([0.78, 0.55, 1], 0.7 + Math.min(1, e * 6) * 0.45), 1, Math.min(1, e * 5)];
};
P.vaultSide = (u, v) => {
  const n = fbm(u, v, 2, 16, 3, 241);
  if (v > 0.12 && v < 0.2 || v > 0.8 && v < 0.88) return [...sc([0.95, 0.75, 0.25], 0.85 + n * 0.2), 1, 0.9];
  if (Math.hypot(u - 0.5, v - 0.5) < 0.09) return [0.2, 0.15, 0.08, 1, 0.1];
  return [...sc([0.38, 0.22, 0.12], 0.7 + n * 0.5), 1, 0.4 + n * 0.3];
};
P.vaultTop = (u, v) => {
  const a = Math.atan2(v - 0.5, u - 0.5), d = Math.hypot(u - 0.5, v - 0.5);
  if (d < 0.18 + Math.cos(a * 5) * 0.08) return [1, 0.82, 0.3, 1, 1];
  return P.vaultSide(u, 0.5);
};
P.beacon = (u, v) => {
  const d = Math.hypot(u - 0.5, v - 0.5);
  if (d < 0.2) return [...sc([1, 0.85, 0.45], 1.1 - d * 2), 1, 1];
  if (d < 0.26) return [0.3, 0.25, 0.2, 1, 0.2];
  return P.stone(u, v);
};
P.trophy = (u, v) => {
  const n = fbm(u, v, 4, 4, 3, 251), d = Math.hypot(u - 0.5, v - 0.45);
  if (d < 0.2 && v < 0.5) return [...sc([1, 0.8, 0.2], 1), 1, 1];
  if (Math.abs(u - 0.5) < 0.08 && v >= 0.45 && v < 0.8) return [0.95, 0.9, 0.75, 1, 0.8];
  return [...sc([0.55, 0.4, 0.15], 0.8 + n * 0.3), 1, 0.4];
};

P.basalt = (u, v) => {
  const n = fbm(u, v, 12, 3, 3, 261), c = Math.abs(fbm(u, v, 4, 4, 2, 262) - 0.5);
  return [...sc([0.22, 0.22, 0.25], 0.7 + n * 0.5 - (c < 0.02 ? 0.3 : 0)), 1, n];
};
P.magma = (u, v) => {
  const [d1, d2] = voronoi(u, v, 5, 271), e = d2 - d1;
  if (e < 0.05) return [1, 0.45 + (0.05 - e) * 6, 0.1, 1, 0];
  return [...sc([0.3, 0.12, 0.08], 0.7 + fbm(u, v, 8, 8, 2, 272) * 0.5), 1, 0.7];
};
P.lava = (u, v) => {
  const n = fbm(u, v, 4, 4, 4, 281), f = fbm(u + n * 0.3, v, 8, 8, 2, 282);
  return [1, 0.35 + f * 0.45, 0.05 + f * 0.1, 1, f];
};
P.ice = (u, v) => {
  const n = fbm(u, v, 4, 4, 3, 291), cr = Math.abs(fbm(u, v, 3, 3, 3, 292) - 0.5) < 0.015;
  return [...sc([0.66, 0.84, 0.98], 0.85 + n * 0.2 + (cr ? 0.15 : 0)), 1, n * 0.3];
};
const coral = (col, seed) => (u, v) => {
  const x = u * T, fromBottom = (1 - v) * T;
  for (let i = 0; i < 6; i++) {
    const b = 8 + hi(i, 0, seed) * 48, hgt = T * (0.4 + hi(i, 1, seed) * 0.55), w = 3 + hi(i, 2, seed) * 3;
    const c = b + Math.sin(fromBottom * 0.12 + i) * 5;
    if (fromBottom < hgt && Math.abs(x - c) < w * (fromBottom > hgt - 6 ? 1.6 : 1)) return [...sc(col, 0.7 + fromBottom / T * 0.5), 1, 0.6];
  }
  return [0, 0, 0, 0, 0];
};
P.coralRed = coral([0.95, 0.35, 0.3], 301);
P.coralBlue = coral([0.3, 0.6, 1], 303);
P.fossil = (u, v) => {
  const b = Math.abs(v - 0.5 - Math.sin(u * 9) * 0.08) < 0.07 || (Math.abs(u - 0.3) < 0.05 && v > 0.25 && v < 0.75) || (Math.abs(u - 0.7) < 0.05 && v > 0.25 && v < 0.75);
  if (b) return [0.92, 0.88, 0.76, 1, 0.9];
  return P.stone(u, v);
};
P.boneSide = (u, v) => {
  const n = fbm(u, v, 2, 12, 3, 311);
  return [...sc([0.92, 0.89, 0.8], 0.8 + n * 0.25), 1, n];
};
P.boneTop = (u, v) => {
  const d = Math.hypot(u - 0.5, v - 0.5);
  return d > 0.4 ? P.boneSide(u, v) : [...sc([0.8, 0.72, 0.6], 0.8 + fbm(u, v, 8, 8, 2, 313) * 0.3), 1, 0.4];
};
P.lantern = (u, v) => {
  const e = Math.min(u, v, 1 - u, 1 - v);
  if (e < 0.1 || Math.abs(u - 0.5) < 0.04 || Math.abs(v - 0.5) < 0.04) return [0.2, 0.18, 0.16, 1, 1];
  return [1, 0.82, 0.45, 1, 0.3];
};
const wool = (col, seed) => (u, v) => {
  const n = fbm(u, v, 16, 16, 2, seed), r = Math.sin((u + v) * 60) * 0.03;
  return [...sc(col, 0.82 + n * 0.25 + r), 1, n * 0.4];
};
P.woolRed = wool([0.75, 0.18, 0.18], 321);
P.woolBlue = wool([0.2, 0.32, 0.75], 322);
P.woolYellow = wool([0.95, 0.8, 0.2], 323);
P.woolWhite = wool([0.93, 0.93, 0.9], 324);
const metal = (col, seed) => (u, v) => {
  const e = Math.min(u, v, 1 - u, 1 - v), n = fbm(u, v, 4, 4, 2, seed);
  const shine = Math.max(0, 1 - Math.abs(u - v) * 4) * 0.25;
  return [...sc(col, (e < 0.06 ? 0.7 : 0.9) + n * 0.15 + shine), 1, e < 0.06 ? 0.2 : 0.7];
};
P.goldBlock = metal([1, 0.8, 0.25], 331);
P.diamondBlock = metal([0.45, 0.95, 0.92], 333);
P.portal = (u, v) => {
  const a = Math.atan2(v - 0.5, u - 0.5), d = Math.hypot(u - 0.5, v - 0.5);
  const sw = Math.sin(a * 3 + d * 18) * 0.5 + 0.5;
  return [0.55 + sw * 0.3, 0.2 + sw * 0.2, 0.95, sw > 0.25 ? 1 : 0, sw];
};
P.moss = (u, v) => {
  const n = fbm(u, v, 4, 4, 4, 341), s = px(u, v, 342);
  const k = 0.65 + n * 0.45 + (s - 0.5) * 0.2;
  return [0.2 * k, 0.48 * k, 0.16 * k, 1, n * 0.5];
};
P.mossSide = sideTop(P.dirt, P.moss, 343, 0.22);

const PAINT = {
  [TILE.GRASS_TOP]: P.grass, [TILE.GRASS_SIDE]: P.grassSide, [TILE.DIRT]: P.dirt, [TILE.STONE]: P.stone,
  [TILE.SAND]: P.sand, [TILE.LOG_SIDE]: P.logSide, [TILE.LOG_TOP]: P.logTop, [TILE.LEAVES]: P.leaves,
  [TILE.PLANKS]: P.planks, [TILE.GLASS]: P.glass, [TILE.COBBLE]: P.cobble, [TILE.SNOW]: P.snow,
  [TILE.SNOW_SIDE]: P.snowSide, [TILE.TALLGRASS]: P.tallgrass, [TILE.FLOWER]: P.flower, [TILE.BRICK]: P.brick,
  [TILE.COAL]: P.coal, [TILE.IRON]: P.iron, [TILE.GOLD]: P.gold, [TILE.DIAMOND]: P.diamond,
  [TILE.TNT_SIDE]: P.tntSide, [TILE.TNT_TOP]: P.tntTop, [TILE.QBLOCK]: P.qblock, [TILE.USED]: P.used,
  [TILE.MYCEL_TOP]: P.mycel, [TILE.MYCEL_SIDE]: P.mycelSide, [TILE.STEM]: P.stem, [TILE.CAP_RED]: P.capRed,
  [TILE.CAP_GLOW]: P.capGlow, [TILE.CAP_GOLD]: P.capGold, [TILE.OBSIDIAN]: P.obsidian, [TILE.STARSTONE]: P.starstone,
  [TILE.CRACKED]: P.cracked, [TILE.GEODE]: P.geode, [TILE.CRYSTAL]: P.crystal, [TILE.VAULT_SIDE]: P.vaultSide,
  [TILE.VAULT_TOP]: P.vaultTop, [TILE.BEACON]: P.beacon, [TILE.TROPHY]: P.trophy,
  [TILE.BASALT]: P.basalt, [TILE.MAGMA]: P.magma, [TILE.LAVA]: P.lava, [TILE.ICE]: P.ice, [TILE.CORAL_RED]: P.coralRed,
  [TILE.CORAL_BLUE]: P.coralBlue, [TILE.FOSSIL]: P.fossil, [TILE.BONE_SIDE]: P.boneSide, [TILE.BONE_TOP]: P.boneTop,
  [TILE.LANTERN]: P.lantern, [TILE.WOOL_RED]: P.woolRed, [TILE.WOOL_BLUE]: P.woolBlue, [TILE.WOOL_YELLOW]: P.woolYellow,
  [TILE.WOOL_WHITE]: P.woolWhite, [TILE.GOLD_BLOCK]: P.goldBlock, [TILE.DIAMOND_BLOCK]: P.diamondBlock,
  [TILE.PORTAL]: P.portal, [TILE.MOSS_TOP]: P.moss, [TILE.MOSS_SIDE]: P.mossSide,
};

export function buildAtlas(anisotropy = 4) {
  const color = document.createElement('canvas'); color.width = W; color.height = H;
  const normal = document.createElement('canvas'); normal.width = W; normal.height = H;
  const ci = color.getContext('2d').createImageData(W, H), ni = normal.getContext('2d').createImageData(W, H);
  const avg = [];
  for (let tile = 0; tile < COLS * ROWS; tile++) {
    if (!PAINT[tile]) continue;
    const paint = PAINT[tile];
    const px = new Array(T * T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px[x + y * T] = paint((x + 0.5) / T, (y + 0.5) / T);
    // plants and glass must not wrap into their gutters (they are not tileable)
    const clampEdges = [TILE.TALLGRASS, TILE.FLOWER, TILE.GLASS, TILE.CORAL_RED, TILE.CORAL_BLUE, TILE.LANTERN].includes(tile);
    const at = (x, y) => clampEdges
      ? px[Math.min(T - 1, Math.max(0, x)) + Math.min(T - 1, Math.max(0, y)) * T]
      : px[wrap(x, T) + wrap(y, T) * T];
    let sr = 0, sg = 0, sb = 0, cnt = 0;
    const c0 = (tile % COLS) * CELL, r0 = Math.floor(tile / COLS) * CELL;
    for (let y = -G; y < T + G; y++) for (let x = -G; x < T + G; x++) {
      const p = at(x, y), o = ((r0 + G + y) * W + (c0 + G + x)) * 4;
      ci.data[o] = Math.min(255, p[0] * 255); ci.data[o + 1] = Math.min(255, p[1] * 255);
      ci.data[o + 2] = Math.min(255, p[2] * 255); ci.data[o + 3] = p[3] * 255;
      const S = 3.5;
      const dx = (at(x + 1, y)[4] - at(x - 1, y)[4]) * S, dy = (at(x, y - 1)[4] - at(x, y + 1)[4]) * S;
      const l = Math.hypot(dx, dy, 1);
      ni.data[o] = (-dx / l * 0.5 + 0.5) * 255; ni.data[o + 1] = (-dy / l * 0.5 + 0.5) * 255;
      ni.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[o + 3] = 255;
      if (x >= 0 && y >= 0 && x < T && y < T && p[3] > 0) { sr += p[0]; sg += p[1]; sb += p[2]; cnt++; }
    }
    avg[tile] = [sr / cnt, sg / cnt, sb / cnt];
  }
  color.getContext('2d').putImageData(ci, 0, 0);
  normal.getContext('2d').putImageData(ni, 0, 0);

  const mk = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapLinearFilter;
    t.anisotropy = anisotropy;
    return t;
  };
  return { canvas: color, map: mk(color, true), normalMap: mk(normal, false), avg };
}

/** Isometric hotbar icon for a block. */
export function makeIcon(atlasCanvas, id, size = 64) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const b = BLOCKS[id];
  const src = (tile) => [(tile % COLS) * CELL + G, Math.floor(tile / COLS) * CELL + G];
  const s = size / 64, k = 28 * s / T;
  if (b.kind === 'water') {
    const gr = ctx.createLinearGradient(0, 0, 0, size); gr.addColorStop(0, '#5ab4e8'); gr.addColorStop(1, '#1d5a78');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(size / 2, 6 * s); ctx.quadraticCurveTo(size - 8 * s, size * 0.6, size / 2, size - 6 * s); ctx.quadraticCurveTo(8 * s, size * 0.6, size / 2, 6 * s); ctx.fill();
    return cv.toDataURL();
  }
  if (b.kind !== 'cube') { const [sx, sy] = src(b.tile); ctx.drawImage(atlasCanvas, sx, sy, T, T, 4 * s, 4 * s, 56 * s, 56 * s); return cv.toDataURL(); }
  const faces = [
    [b.tiles[0], [k, -k / 2, k, k / 2, 4 * s, 18 * s], 0],
    [b.tiles[2], [k, k / 2, 0, k, 4 * s, 18 * s], 0.18],
    [b.tiles[2], [k, -k / 2, 0, k, 32 * s, 32 * s], 0.38],
  ];
  for (const [tile, m, shade] of faces) {
    ctx.setTransform(...m);
    const [sx, sy] = src(tile);
    ctx.drawImage(atlasCanvas, sx, sy, T, T, 0, 0, T, T);
    ctx.fillStyle = `rgba(0,0,0,${shade})`;
    ctx.globalCompositeOperation = 'source-atop'; ctx.fillRect(0, 0, T, T); ctx.globalCompositeOperation = 'source-over';
  }
  return cv.toDataURL();
}

/** Tileable water normal map. */
export function makeWaterNormal(size = 256) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size);
  const hgt = (x, y) => {
    const u = wrap(x, size) / size, v = wrap(y, size) / size;
    return fbm(u, v, 4, 4, 5, 500) + Math.sin((u + v) * Math.PI * 8) * 0.05 + Math.sin((u * 3 - v) * Math.PI * 4) * 0.04;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (hgt(x + 1, y) - hgt(x - 1, y)) * 12, dy = (hgt(x, y - 1) - hgt(x, y + 1)) * 12, l = Math.hypot(dx, dy, 1);
    const o = (y * size + x) * 4;
    img.data[o] = (-dx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (-dy / l * 0.5 + 0.5) * 255;
    img.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  return t;
}
