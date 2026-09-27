import { createNoise, hash3 } from './noise.js';
import { B, BLOCKS, CS, CH, SEA } from './blocks.js';
import { stampLandmarks, sitesNear } from './landmarks.js';

export const chunkKey = (cx, cz) => cx + ',' + cz;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.data = new Uint8Array(CS * CS * CH);
    this.maxY = 0;
    this.dirty = true;
    this.meshes = [];
  }
}

export class World {
  constructor(seed) {
    this.seed = seed;
    this.noise = createNoise(seed);
    this.chunks = new Map();
    this.edits = new Map(); // chunkKey -> Map(localIndex -> id)
  }

  getChunk(cx, cz) { return this.chunks.get(chunkKey(cx, cz)); }

  get(x, y, z) {
    if (y < 0) return B.STONE;
    if (y >= CH) return B.AIR;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return B.AIR;
    return c.data[(x - cx * CS) + (z - cz * CS) * CS + y * CS * CS];
  }

  /** Records an edit and applies it to a loaded chunk. Returns the chunks that need remeshing. */
  set(x, y, z, id) {
    if (y < 0 || y >= CH) return [];
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const lx = x - cx * CS, lz = z - cz * CS, idx = lx + lz * CS + y * CS * CS;
    const k = chunkKey(cx, cz);
    if (!this.edits.has(k)) this.edits.set(k, new Map());
    this.edits.get(k).set(idx, id);
    const c = this.chunks.get(k);
    if (!c) return [];
    c.data[idx] = id;
    if (id !== B.AIR) c.maxY = Math.max(c.maxY, y);
    const out = [c];
    const dx = lx === 0 ? -1 : lx === CS - 1 ? 1 : 0;
    const dz = lz === 0 ? -1 : lz === CS - 1 ? 1 : 0;
    const add = (ax, az) => { const n = this.getChunk(cx + ax, cz + az); if (n) out.push(n); };
    if (dx) add(dx, 0);
    if (dz) add(0, dz);
    if (dx && dz) add(dx, dz);
    for (const ch of out) ch.dirty = true;
    return out;
  }

  column(x, z, raw = false) {
    const n = this.noise;
    const cont = n.fbm2(x * 0.0022, z * 0.0022, 4);
    const temp = n.s2(x * 0.0011 + 100, z * 0.0011 - 50);
    const moist = n.fbm2(x * 0.0016 - 300, z * 0.0016 + 200, 2);
    let h = SEA + 3 + cont * 20;
    const mask = smooth(0.05, 0.55, cont + n.s2(x * 0.0013 + 7, z * 0.0013) * 0.35);
    h += Math.pow(n.ridged2(x * 0.0055, z * 0.0055, 4), 2) * 70 * mask;
    h += n.fbm2(x * 0.03, z * 0.03, 2) * 2.2;
    h = Math.min(CH - 12, Math.floor(h));
    let biome;
    if (h > SEA + 44 + n.s2(x * 0.05, z * 0.05) * 4) biome = 'snow';
    else if (h <= SEA + 1) biome = 'beach';
    else if (temp > 0.25 && moist < 0.05) biome = 'desert';
    else if (moist > 0.12) biome = 'forest';
    else biome = 'plains';
    // Glowcap Groves: always around a boss site, and (rarer, more often far from spawn) wherever the spore noise peaks
    if (!raw && h > SEA && biome !== 'snow' && biome !== 'desert') {
      const far = Math.hypot(x, z);
      let grove = far > 180 && n.s2(x * 0.004 + 900, z * 0.004 - 400) > (far > 700 ? 0.45 : 0.62);
      if (!grove) for (const st of sitesNear(this, 'boss', x, z, 100)) if (Math.hypot(st.x - x, st.z - z) < 70 + n.s2(x * 0.03, z * 0.03) * 10) grove = true;
      if (grove) biome = 'grove';
    }
    return { h, biome };
  }

  generateChunk(cx, cz) {
    const c = new Chunk(cx, cz);
    const d = c.data, n = this.noise, S2 = CS * CS;
    const ox = cx * CS, oz = cz * CS;
    const cols = [];
    // columns in a 2-block margin so trees can cross chunk borders
    for (let lz = -3; lz < CS + 3; lz++) for (let lx = -3; lx < CS + 3; lx++) cols.push(this.column(ox + lx, oz + lz));
    const col = (lx, lz) => cols[(lx + 3) + (lz + 3) * (CS + 6)];
    let maxY = SEA;

    for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
      const x = ox + lx, z = oz + lz;
      const { h, biome } = col(lx, lz);
      const under = h < SEA;
      const top = under ? (h < SEA - 4 ? B.DIRT : B.SAND)
        : biome === 'beach' || biome === 'desert' ? B.SAND : biome === 'snow' ? B.SNOW : biome === 'grove' ? B.MYCEL : B.GRASS;
      const sub = top === B.SAND ? B.SAND : biome === 'snow' ? B.STONE : B.DIRT;
      for (let y = 0; y <= Math.max(h, SEA); y++) {
        let id = B.AIR;
        if (y <= h) {
          id = y < h - 3 ? B.STONE : y < h ? sub : top;
          if (id === B.STONE && y < h - 4) {
            // ores come in small clusters: pick 2x2x2 cells, then fill most of the cell
            const cell = hash3(x >> 1, y >> 1, z >> 1), fill = hash3(x, y, z) < 0.6;
            if (fill) {
              if (y < 16 && cell < 0.0035) id = B.DIAMOND_ORE;
              else if (y < 30 && cell < 0.004) id = B.GOLD_ORE;
              else if (y < 60 && cell < 0.009) id = B.IRON_ORE;
              else if (cell < 0.012) id = B.COAL_ORE;
            }
          }
          if (y > 3 && y < h - (under ? 6 : 0)) {
            const a = n.s3(x * 0.045, y * 0.07, z * 0.045), b = n.s3(x * 0.045 + 71, y * 0.07, z * 0.045 - 33);
            if (a * a + b * b < 0.009) id = B.AIR;
          }
        } else if (y <= SEA) id = B.WATER;
        d[lx + lz * CS + y * S2] = id;
      }
      if (h > maxY) maxY = h;
      // ground cover
      if ((top === B.GRASS || top === B.MYCEL) && d[lx + lz * CS + h * S2] === top) {
        const r = hash3(x, 7, z) , dens = biome === 'forest' ? 0.22 : 0.3;
        if (r < dens) d[lx + lz * CS + (h + 1) * S2] = r < 0.012 ? B.FLOWER : B.TALLGRASS;
      }
      // floating ? blocks
      if (h > SEA && h + 4 < CH && top !== B.SNOW && hash3(x, 23, z) < 0.003) { d[lx + lz * CS + (h + 4) * S2] = B.QBLOCK; maxY = Math.max(maxY, h + 4); }
    }

    // giant mushrooms in groves
    for (let lz = -3; lz < CS + 3; lz++) for (let lx = -3; lx < CS + 3; lx++) {
      const { h, biome } = col(lx, lz);
      if (biome !== 'grove') continue;
      const x = ox + lx, z = oz + lz;
      if (hash3(x, 29, z) > 0.015) continue;
      const th = 4 + Math.floor(hash3(x, 31, z) * 4), R = 2 + (hash3(x, 33, z) > 0.5 ? 1 : 0);
      const capId = hash3(x, 35, z) < 0.4 ? B.CAP_GLOW : B.CAP_RED;
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) for (let dy = 0; dy <= 1; dy++) {
        const px = lx + dx, pz = lz + dz, py = h + th + dy;
        if (px < 0 || px >= CS || pz < 0 || pz >= CS || py >= CH) continue;
        const dd = Math.hypot(dx, dz);
        if (dy === 1 ? dd > R - 0.8 : dd > R + 0.4) continue;
        d[px + pz * CS + py * S2] = capId;
      }
      if (lx >= 0 && lx < CS && lz >= 0 && lz < CS) for (let y = h + 1; y < h + th; y++) d[lx + lz * CS + y * S2] = B.STEM;
      maxY = Math.max(maxY, h + th + 2);
    }

    // trees
    for (let lz = -3; lz < CS + 3; lz++) for (let lx = -3; lx < CS + 3; lx++) {
      const { h, biome } = col(lx, lz);
      if (h <= SEA || (biome !== 'forest' && biome !== 'plains')) continue;
      const x = ox + lx, z = oz + lz, r = hash3(x, 13, z);
      if (r > (biome === 'forest' ? 0.035 : 0.004)) continue;
      const big = hash3(x, 17, z) > 0.7;
      const th = 4 + Math.floor(hash3(x, 19, z) * 3) + (big ? 2 : 0);
      const R = big ? 3.2 : 2.4;
      const cy = h + th;
      for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const px = lx + dx, pz = lz + dz, py = cy + dy;
        if (px < 0 || px >= CS || pz < 0 || pz >= CS || py >= CH) continue;
        const dist = Math.sqrt(dx * dx + dy * dy * 1.6 + dz * dz);
        if (dist > R + hash3(x + dx, py, z + dz) * 0.8 - 0.4) continue;
        const i = px + pz * CS + py * S2;
        if (d[i] === B.AIR || d[i] === B.TALLGRASS) d[i] = B.LEAVES;
      }
      if (lx >= 0 && lx < CS && lz >= 0 && lz < CS) {
        for (let y = h + 1; y < cy + (big ? 1 : 0); y++) d[lx + lz * CS + y * S2] = B.LOG;
        d[lx + lz * CS + h * S2] = B.DIRT;
      }
      maxY = Math.max(maxY, cy + 4);
    }

    // landmarks: obelisks, vaults, geodes, sky islands, the giant glowcap
    stampLandmarks(this, cx, cz, CS, (x, y, z, id, onlyAir) => {
      const lx = x - ox, lz = z - oz;
      if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || y < 1 || y >= CH) return;
      const i = lx + lz * CS + y * S2;
      if (onlyAir && d[i] !== B.AIR) return;
      d[i] = id;
      if (id && y > maxY) maxY = y;
    });

    const ed = this.edits.get(chunkKey(cx, cz));
    if (ed) for (const [i, id] of ed) { d[i] = id; if (id) maxY = Math.max(maxY, Math.floor(i / S2)); }
    c.maxY = Math.min(CH - 1, maxY + 1);
    this.chunks.set(chunkKey(cx, cz), c);
    return c;
  }

  isSolid(x, y, z) { return BLOCKS[this.get(x, y, z)].solid; }

  /** Voxel DDA raycast. Returns { hit:[x,y,z], prev:[x,y,z], id } or null. */
  raycast(o, dir, maxDist) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    const tdx = Math.abs(1 / dir.x), tdy = Math.abs(1 / dir.y), tdz = Math.abs(1 / dir.z);
    let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx;
    let ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy;
    let tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
    let prev = [x, y, z], t = 0;
    while (t <= maxDist) {
      const id = this.get(x, y, z);
      if (id !== B.AIR && id !== B.WATER) return { hit: [x, y, z], prev, id };
      prev = [x, y, z];
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; }
      else { z += sz; t = tz; tz += tdz; }
    }
    return null;
  }
}
