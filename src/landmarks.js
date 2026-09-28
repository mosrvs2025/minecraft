// Deterministic landmark placement. The same `site()` answer drives chunk generation *and* gameplay queries
// (compass, starstone hints, rumors, boss spawning), so what you hear about is exactly what is out there.
import { B, CH, SEA } from './blocks.js';
import { hash3 } from './noise.js';
import { REALMS, realmAt } from './realms.js';

// type: cell size, spawn chance per cell, footprint radius, minimum distance from spawn
export const LANDMARKS = {
  boss: { cell: 640, p: 1, r: 11, minDist: 260, icon: '👑', name: 'Giant Glowcap' },
  obelisk: { cell: 176, p: 0.6, r: 2, minDist: 60, icon: '🗼', name: 'Starstone' },
  vault: { cell: 144, p: 0.55, r: 5, minDist: 50, icon: '🏛', name: 'Ruin Vault' },
  geode: { cell: 80, p: 0.45, r: 5, minDist: 30, icon: '💎', name: 'Geode' },
  island: { cell: 224, p: 0.65, r: 10, minDist: 160, icon: '☁️', name: 'Sky Island' },
  volcano: { cell: 420, p: 0.6, r: 31, minDist: 260, icon: '🌋', name: 'Volcano' },
  fossil: { cell: 160, p: 0.5, r: 9, minDist: 60, icon: '🦴', name: 'Fossil Site' },
  portal: { cell: 400, p: 0.85, r: 4, minDist: 70, icon: '🌀', name: 'Ancient Portal' },
  nest: { cell: 320, p: 0.7, r: 8, minDist: 120, icon: '🐉', name: 'Dragon Spire' },
};
const SALT = { boss: 11, obelisk: 23, vault: 37, geode: 53, island: 71, volcano: 89, fossil: 97, portal: 101, nest: 113 };
// which landmarks exist in which realm, and how common they are there
const ALLOW = {
  over: { boss: 1, obelisk: 1, vault: 1, geode: 1, island: 1, volcano: 1, fossil: 1, portal: 1 },
  primeval: { obelisk: 0.5, geode: 1, volcano: 1.6, portal: 1 },
  dragon: { island: 1.5, geode: 1, portal: 1, nest: 1, obelisk: 0.6 },
};

/** Returns the landmark in grid cell (gx, gz) of `type`, or null. Cached per world. */
export function site(world, type, gx, gz) {
  const key = type + gx + ',' + gz;
  const cache = world.siteCache ??= new Map();
  if (cache.has(key)) return cache.get(key);
  const L = LANDMARKS[type], s = SALT[type] + world.seed % 9973;
  const realm = realmAt(gx * L.cell + L.cell / 2, gz * L.cell + L.cell / 2), R = REALMS[realm], mult = ALLOW[realm][type] || 0;
  let out = null;
  if (type === 'portal' && realm !== 'over') {
    // realm portals mirror an overworld portal that leads here
    const base = site(world, 'portal', gx - R.dx / L.cell, gz - R.dz / L.cell);
    if (base && base.dest === realm) {
      const x = base.x + R.dx, z = base.z + R.dz;
      out = { ...base, x, z, y: Math.max(world.column(x, z, true).h, 40), dest: 'over', id: `portal:${gx},${gz}` };
    }
    cache.set(key, out);
    return out;
  }
  const forced = type === 'portal' && ((gx === 0 && gz === 0) || (gx === -1 && gz === -1)); // two portals near spawn
  if (mult && (forced || hash3(gx, s, gz) < L.p * mult)) {
    const m = L.cell * 0.2;
    const x = Math.floor(gx * L.cell + m + hash3(gx, s + 1, gz) * (L.cell - 2 * m));
    const z = Math.floor(gz * L.cell + m + hash3(gx, s + 2, gz) * (L.cell - 2 * m));
    if (Math.hypot(x - R.dx, z - R.dz) >= L.minDist) {
      const { h, biome } = world.column(x, z, true);
      const r = hash3(gx, s + 3, gz);
      if (type === 'boss') out = { x, z, y: Math.max(h, SEA + 1) };
      else if (type === 'obelisk' && h > SEA + 1) out = { x, z, y: h, tall: 18 + Math.floor(r * 10) };
      else if (type === 'vault' && h > SEA + 1 && biome !== 'grove' && biome !== 'snow') out = { x, z, y: h };
      else if (type === 'geode' && h > 28) out = { x, z, y: 10 + Math.floor(r * Math.min(20, h - 26)) };
      else if (type === 'island') out = { x, z, y: 86 + Math.floor(r * 12) };
      else if (type === 'volcano' && h > SEA) out = { x, z, y: h };
      else if (type === 'fossil' && h > SEA + 1) out = { x, z, y: h };
      else if (type === 'portal') out = { x, z, y: Math.max(h, SEA + 1), dest: forced ? (gx === 0 ? 'primeval' : 'dragon') : r < 0.5 ? 'primeval' : 'dragon' };
      else if (type === 'nest') out = { x, z, y: Math.max(h, SEA - 4) };
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

BUILD.volcano = (st, put) => {
  const { x, z, y } = st, R = 28, H = Math.min(CH - 8 - y, 46), crater = 6;
  for (let dx = -31; dx <= 31; dx++) for (let dz = -31; dz <= 31; dz++) {
    const ang = Math.atan2(dz, dx), d = Math.hypot(dx, dz), rr = R + Math.sin(ang * 4 + st.seed * 7) * 2.5;
    if (d > rr) continue;
    let top = y + Math.floor(Math.pow(1 - d / rr, 1.3) * H);
    const floor = y + H - 9;
    if (d < crater) top = floor;
    for (let yy = y - 3; yy <= top; yy++) put(x + dx, yy, z + dz, hash3(x + dx, yy, z + dz) < 0.06 ? B.MAGMA : B.BASALT);
    // lava rivers run down three sides of the cone
    const river = Math.cos(ang * 3 + st.seed * 5) > 0.975 && d > crater;
    if (river) put(x + dx, top, z + dz, B.LAVA);
    if (d < crater) { for (let yy = floor + 1; yy <= floor + 2; yy++) put(x + dx, yy, z + dz, B.LAVA); for (let yy = floor + 3; yy <= y + H + 2; yy++) put(x + dx, yy, z + dz, B.AIR); }
  }
};
BUILD.fossil = (st, put) => {
  // a dinosaur, mostly buried; two rib tips break the surface
  const { x, z, y } = st, base = y - 3;
  for (let i = -7; i <= 6; i++) {
    const sy = base + Math.round(Math.sin(i * 0.35) * 1.2);
    put(x + i, sy, z, B.BONE);
    if (i % 2 === 0 && i > -6 && i < 5) {
      const tall = i === 0 || i === 2 ? 5 : 3;
      for (let k = 1; k <= tall; k++) { put(x + i, sy + k, z - 2, B.BONE); put(x + i, sy + k, z + 2, B.BONE); }
      put(x + i, sy + tall, z - 1, B.BONE); put(x + i, sy + tall, z + 1, B.BONE);
    }
  }
  for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) for (let dz = -1; dz <= 1; dz++) put(x + 7 + dx, base + dy, z + dz, dy === 1 && dx === 1 ? B.AIR : B.BONE);
  for (let i = 0; i < 18; i++) {
    const a = hash3(x, i, z) * 6.28, r = 3 + hash3(z, i, x) * 6;
    put(x + Math.round(Math.cos(a) * r), base - 1 - Math.floor(hash3(i, x, z) * 4), z + Math.round(Math.sin(a) * r), B.FOSSIL);
  }
};
BUILD.portal = (st, put) => {
  const { x, z, y, dest } = st, prim = dest === 'primeval' || (dest === 'over' && st.x > 200000);
  const frame = prim ? B.BONE : B.OBSIDIAN, accent = prim ? B.MOSS : B.CRYSTAL;
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { put(x + dx, y, z + dz, B.COBBLE); for (let yy = y + 1; yy <= y + 7; yy++) put(x + dx, yy, z + dz, B.AIR); }
  for (let dx = -2; dx <= 2; dx++) for (let dy = 1; dy <= 6; dy++) {
    const edge = Math.abs(dx) === 2 || dy === 1 || dy === 6;
    put(x + dx, y + dy, z, edge ? ((Math.abs(dx) === 2 && (dy === 1 || dy === 6)) ? accent : frame) : B.PORTAL);
  }
  put(x - 3, y + 1, z, B.LANTERN); put(x + 3, y + 1, z, B.LANTERN);
};
BUILD.nest = (st, put) => {
  // an obsidian spire rising from the sea, crowned with a basalt nest
  const { x, z } = st, top = 96;
  for (let yy = st.y - 4; yy <= top; yy++) {
    const r = yy > top - 3 ? 0 : 2 + (yy < st.y + 10 ? 1 : 0);
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (dx * dx + dz * dz <= r * r + 1) put(x + dx, yy, z + dz, B.OBSIDIAN);
  }
  for (let dx = -7; dx <= 7; dx++) for (let dz = -7; dz <= 7; dz++) {
    const d = Math.hypot(dx, dz); if (d > 7.5) continue;
    put(x + dx, top + 1, z + dz, B.BASALT);
    if (d > 6) { put(x + dx, top + 2, z + dz, B.BASALT); if (hash3(x + dx, 3, z + dz) < 0.3) put(x + dx, top + 3, z + dz, B.CRYSTAL); }
    else if (hash3(x + dx, 4, z + dz) < 0.08) put(x + dx, top + 2, z + dz, B.GOLD_BLOCK);
  }
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
