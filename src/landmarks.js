// Deterministic landmark placement. The same `site()` answer drives chunk generation *and* gameplay queries
// (compass, starstone hints, rumors, boss spawning), so what you hear about is exactly what is out there.
import { B, CH, SEA } from './blocks.js';
import { hash3 } from './noise.js';

// type: cell size, spawn chance per cell, footprint radius, minimum distance from spawn
export const LANDMARKS = {
  boss: { cell: 640, p: 1, r: 11, minDist: 260, icon: '👑', name: 'Giant Glowcap' },
  obelisk: { cell: 176, p: 0.6, r: 2, minDist: 60, icon: '🗼', name: 'Starstone' },
  vault: { cell: 144, p: 0.55, r: 5, minDist: 50, icon: '🏛', name: 'Ruin Vault' },
  geode: { cell: 80, p: 0.45, r: 5, minDist: 30, icon: '💎', name: 'Geode' },
  island: { cell: 224, p: 0.65, r: 10, minDist: 160, icon: '☁️', name: 'Sky Island' },
};
const SALT = { boss: 11, obelisk: 23, vault: 37, geode: 53, island: 71 };

/** Returns the landmark in grid cell (gx, gz) of `type`, or null. Cached per world. */
export function site(world, type, gx, gz) {
  const key = type + gx + ',' + gz;
  const cache = world.siteCache ??= new Map();
  if (cache.has(key)) return cache.get(key);
  const L = LANDMARKS[type], s = SALT[type] + world.seed % 9973;
  let out = null;
  if (hash3(gx, s, gz) < L.p) {
    const m = L.cell * 0.2;
    const x = Math.floor(gx * L.cell + m + hash3(gx, s + 1, gz) * (L.cell - 2 * m));
    const z = Math.floor(gz * L.cell + m + hash3(gx, s + 2, gz) * (L.cell - 2 * m));
    if (Math.hypot(x, z) >= L.minDist) {
      const { h, biome } = world.column(x, z, true);
      const r = hash3(gx, s + 3, gz);
      if (type === 'boss') out = { x, z, y: Math.max(h, SEA + 1) };
      else if (type === 'obelisk' && h > SEA + 1) out = { x, z, y: h, tall: 18 + Math.floor(r * 10) };
      else if (type === 'vault' && h > SEA + 1 && biome !== 'grove' && biome !== 'snow') out = { x, z, y: h };
      else if (type === 'geode' && h > 28) out = { x, z, y: 10 + Math.floor(r * Math.min(20, h - 26)) };
      else if (type === 'island') out = { x, z, y: 86 + Math.floor(r * 12) };
      if (out) { out.type = type; out.id = `${type}:${gx},${gz}`; out.seed = r; }
    }
  }
  cache.set(key, out);
  return out;
}

/** All landmarks of `type` whose centers are within `radius` of (x, z). */
export function sitesNear(world, type, x, z, radius) {
  const L = LANDMARKS[type], out = [];
  const g0x = Math.floor((x - radius) / L.cell), g1x = Math.floor((x + radius) / L.cell);
  const g0z = Math.floor((z - radius) / L.cell), g1z = Math.floor((z + radius) / L.cell);
  for (let gz = g0z; gz <= g1z; gz++) for (let gx = g0x; gx <= g1x; gx++) {
    const st = site(world, type, gx, gz);
    if (st && Math.hypot(st.x - x, st.z - z) <= radius) out.push(st);
  }
  return out;
}

export function nearestSite(world, type, x, z, radius, skip) {
  let best = null, bd = Infinity;
  for (const st of sitesNear(world, type, x, z, radius)) {
    const d = Math.hypot(st.x - x, st.z - z);
    if (d < bd && !skip?.(st)) { bd = d; best = st; }
  }
  return best;
}

// ---- builders: write blocks through put(x, y, z, id) which clips to the current chunk --------------------
const BUILD = {
  boss(st, put) {
    // a colossal glowcap: the Mycelord sleeps beneath it
    const { x, z, y } = st, top = y + 17;
    for (let dy = 1; dy < top - y; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      if (dx * dx + dz * dz <= 5) put(x + dx, y + dy, z + dz, B.STEM);
    for (let dx = -11; dx <= 11; dx++) for (let dz = -11; dz <= 11; dz++) for (let dy = -3; dy <= 4; dy++) {
      const d = Math.hypot(dx, dz), shell = 11 - dy * dy * 0.45;
      if (d <= shell && d > shell - 2.2) put(x + dx, top + dy, z + dz, B.CAP_GLOW);
    }
  },
  obelisk(st, put) {
    const { x, z, y, tall } = st;
    for (let dy = -2; dy <= tall; dy++) {
      const r = dy < 4 ? 1 : dy < tall * 0.6 ? (dy % 2 ? 1 : 0) : 0;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++)
        if (dy < 4 || r === 0 || Math.abs(dx) + Math.abs(dz) <= 1) put(x + dx, y + dy, z + dz, B.OBSIDIAN);
    }
    put(x, y + tall + 1, z, B.STARSTONE); put(x, y + tall + 2, z, B.STARSTONE);
    put(x, y + 2, z + 1, B.STARSTONE); // the altar stone you can actually touch
  },
  vault(st, put, w) {
    const { x, z, y } = st;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
      for (let yy = y - 3; yy <= y; yy++) put(x + dx, yy, z + dz, dx * dx + dz * dz < 30 ? B.COBBLE : B.STONE);
      for (let yy = y + 1; yy <= y + 7; yy++) put(x + dx, yy, z + dz, B.AIR);
    }
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3;
      for (let yy = y + 1; yy <= y + 4; yy++) {
        if (!edge) continue;
        const crumble = yy === y + 4 && hash3(x + dx, yy, z + dz) < 0.3; // only the top course crumbles: a clever builder can still sneak in
        put(x + dx, yy, z + dz, crumble ? B.AIR : hash3(x + dx, yy + 9, z + dz) < 0.5 ? B.BRICK : B.COBBLE);
      }
      put(x + dx, y + 5, z + dz, B.CRACKED);
    }
    // sealed door on a random side
    const side = Math.floor(st.seed * 4), [ddx, ddz] = [[0, 3], [0, -3], [3, 0], [-3, 0]][side];
    put(x + ddx, y + 1, z + ddz, B.CRACKED); put(x + ddx, y + 2, z + ddz, B.CRACKED);
    put(x, y + 1, z, B.VAULT);
    // two broken pillars outside
    for (const [px, pz] of [[-5, -5], [5, 5]]) for (let yy = 1; yy <= 2 + Math.floor(hash3(x + px, 3, z + pz) * 3); yy++) put(x + px, w.column(x + px, z + pz).h + yy, z + pz, B.COBBLE);
  },
  geode(st, put) {
    const { x, z, y } = st;
    for (let dx = -5; dx <= 5; dx++) for (let dy = -5; dy <= 5; dy++) for (let dz = -5; dz <= 5; dz++) {
      const d = Math.hypot(dx, dy * 1.1, dz);
      if (d > 4.6) continue;
      const id = d > 3.7 ? B.GEODE : d > 2.7 && hash3(x + dx, y + dy, z + dz) < 0.6 ? B.CRYSTAL : B.AIR;
      put(x + dx, y + dy, z + dz, id);
    }
  },
  island(st, put) {
    const { x, z, y } = st;
    const R = 7 + st.seed * 3;
    for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++) {
      const wob = R + Math.sin(Math.atan2(dz, dx) * 3 + st.seed * 9) * 1.5;
      const d = Math.hypot(dx, dz);
      if (d > wob) continue;
      const depth = Math.floor(Math.pow(1 - d / wob, 0.7) * 10) + 1;
      for (let k = 0; k < depth; k++) {
        const yy = y - k;
        let id = k === 0 ? B.GRASS : k < 3 ? B.DIRT : B.STONE;
        if (k > 3 && hash3(x + dx, yy, z + dz) < 0.05) id = hash3(x + dx, yy + 1, z + dz) < 0.4 ? B.DIAMOND_ORE : B.GOLD_ORE;
        put(x + dx, yy, z + dz, id);
      }
      if (d < wob - 1 && hash3(x + dx, 5, z + dz) < 0.3) put(x + dx, y + 1, z + dz, hash3(x + dx, 6, z + dz) < 0.2 ? B.FLOWER : B.TALLGRASS);
    }
    put(x, y + 1, z, B.VAULT);
    put(x + 3, y + 4, z - 2, B.QBLOCK); put(x - 3, y + 4, z + 2, B.QBLOCK);
    // a lonely tree
    for (let k = 1; k <= 4; k++) put(x - 4, y + k, z - 3, B.LOG);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 3; dy <= 6; dy++)
      if (Math.hypot(dx, dy - 5, dz) < 2.6) put(x - 4 + dx, y + dy, z - 3 + dz, B.LEAVES, true);
  },
};

/** Stamp every landmark that overlaps chunk (cx, cz). */
export function stampLandmarks(world, cx, cz, CS, put) {
  const x0 = cx * CS, z0 = cz * CS;
  for (const type of Object.keys(LANDMARKS)) {
    const L = LANDMARKS[type];
    const g0x = Math.floor((x0 - L.r) / L.cell), g1x = Math.floor((x0 + CS + L.r) / L.cell);
    const g0z = Math.floor((z0 - L.r) / L.cell), g1z = Math.floor((z0 + CS + L.r) / L.cell);
    for (let gz = g0z; gz <= g1z; gz++) for (let gx = g0x; gx <= g1x; gx++) {
      const st = site(world, type, gx, gz);
      if (!st || st.x + L.r < x0 || st.x - L.r >= x0 + CS || st.z + L.r < z0 || st.z - L.r >= z0 + CS) continue;
      BUILD[type](st, put, world);
    }
  }
}

export const MAX_Y = CH - 1;
