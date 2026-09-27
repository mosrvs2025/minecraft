// Procedural 64px block textures + normal maps, packed into an atlas with wrapped gutters.
import * as THREE from 'three';
import { TILE, BLOCKS } from './blocks.js';

const T = 64, G = 8, CELL = T + 2 * G, COLS = 4, ROWS = 4;
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

const PAINT = {
  [TILE.GRASS_TOP]: P.grass, [TILE.GRASS_SIDE]: P.grassSide, [TILE.DIRT]: P.dirt, [TILE.STONE]: P.stone,
  [TILE.SAND]: P.sand, [TILE.LOG_SIDE]: P.logSide, [TILE.LOG_TOP]: P.logTop, [TILE.LEAVES]: P.leaves,
  [TILE.PLANKS]: P.planks, [TILE.GLASS]: P.glass, [TILE.COBBLE]: P.cobble, [TILE.SNOW]: P.snow,
  [TILE.SNOW_SIDE]: P.snowSide, [TILE.TALLGRASS]: P.tallgrass, [TILE.FLOWER]: P.flower, [TILE.BRICK]: P.brick,
};

export function buildAtlas(anisotropy = 4) {
  const color = document.createElement('canvas'); color.width = W; color.height = H;
  const normal = document.createElement('canvas'); normal.width = W; normal.height = H;
  const ci = color.getContext('2d').createImageData(W, H), ni = normal.getContext('2d').createImageData(W, H);
  const avg = [];
  for (let tile = 0; tile < 16; tile++) {
    const paint = PAINT[tile];
    const px = new Array(T * T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px[x + y * T] = paint((x + 0.5) / T, (y + 0.5) / T);
    // plants and glass must not wrap into their gutters (they are not tileable)
    const clampEdges = tile === TILE.TALLGRASS || tile === TILE.FLOWER || tile === TILE.GLASS;
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
