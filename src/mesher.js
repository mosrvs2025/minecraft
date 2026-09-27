// Builds chunk geometry: culled cube faces with smooth per-vertex AO, cross-quad plants and water.
import * as THREE from 'three';
import { B, BLOCKS, CS, CH, XRAY_SHOW } from './blocks.js';
import { tileUV } from './textures.js';
import { hash3 } from './noise.js';

// [normal, corners: [x, y, z, u, v] x4]; triangles (0,1,2)(2,1,3)
const FACES = [
  { n: [-1, 0, 0], c: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { n: [1, 0, 0], c: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { n: [0, -1, 0], c: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { n: [0, 1, 0], c: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { n: [0, 0, -1], c: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
const AO_CURVE = [0.38, 0.58, 0.8, 1];
const UVS = Array.from({ length: 24 }, (_, t) => tileUV(t));

class Buf {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.wind = []; this.idx = []; this.n = 0; }
  vert(x, y, z, nx, ny, nz, u, v, c, w) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, v); this.col.push(c, c, c); this.wind.push(w);
  }
  geometry() {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('wind', new THREE.Float32BufferAttribute(this.wind, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

export function meshChunk(world, chunk) {
  const { data } = chunk, ox = chunk.cx * CS, oz = chunk.cz * CS, S2 = CS * CS;
  const get = (x, y, z) => {
    if (y < 0) return B.STONE;
    if (y >= CH) return B.AIR;
    if (x >= 0 && x < CS && z >= 0 && z < CS) return data[x + z * CS + y * S2];
    return world.get(ox + x, y, oz + z);
  };
  // X-ray: everything except ores/TNT is treated as air
  const xray = world.xray, shown = (id) => !xray || XRAY_SHOW.has(id);
  const occ = (x, y, z) => { const id = get(x, y, z); return BLOCKS[id].ao && shown(id) ? 1 : 0; };
  const solid = new Buf(), plant = new Buf(), water = new Buf();
  const ymax = Math.min(CH - 1, chunk.maxY + 1);

  for (let y = 0; y <= ymax; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const id = data[x + z * CS + y * S2];
    if (id === B.AIR || !shown(id)) continue;
    const b = BLOCKS[id];

    if (b.kind === 'cube') {
      for (let f = 0; f < 6; f++) {
        const { n, c } = FACES[f];
        const nb = get(x + n[0], y + n[1], z + n[2]);
        const nbb = BLOCKS[nb];
        if ((nbb.opaque && shown(nb)) || (nb === id && id === B.GLASS)) continue;
        const [u0, v0, u1, v1] = UVS[b.tiles[f === 3 ? 0 : f === 2 ? 1 : 2]];
        const ax = n[0] ? 0 : n[1] ? 1 : 2, a1 = ax === 0 ? 1 : 0, a2 = ax === 2 ? 1 : 2;
        const ao = [];
        for (const cr of c) {
          const p = [x + n[0], y + n[1], z + n[2]];
          const s1 = cr[a1] ? 1 : -1, s2 = cr[a2] ? 1 : -1;
          const q1 = p.slice(), q2 = p.slice(), q3 = p.slice();
          q1[a1] += s1; q2[a2] += s2; q3[a1] += s1; q3[a2] += s2;
          const e1 = occ(...q1), e2 = occ(...q2), cc = occ(...q3);
          ao.push(AO_CURVE[e1 && e2 ? 0 : 3 - (e1 + e2 + cc)]);
        }
        const base = solid.n;
        for (let i = 0; i < 4; i++) {
          const cr = c[i];
          solid.vert(x + cr[0], y + cr[1], z + cr[2], n[0], n[1], n[2],
            u0 + (u1 - u0) * cr[3], v0 + (v1 - v0) * cr[4], ao[i], b.wind * cr[1]);
        }
        if (ao[0] + ao[3] > ao[1] + ao[2]) solid.idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
        else solid.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        solid.n += 4;
      }
    } else if (b.kind === 'plant') {
      const [u0, v0, u1, v1] = UVS[b.tile];
      const jx = (hash3(ox + x, y, oz + z) - 0.5) * 0.3, jz = (hash3(ox + x, y + 1, oz + z) - 0.5) * 0.3;
      const hgt = 0.75 + hash3(ox + x, y + 2, oz + z) * 0.35;
      const quads = [[0.15, 0.15, 0.85, 0.85], [0.85, 0.15, 0.15, 0.85]];
      for (const [xa, za, xb, zb] of quads) {
        const base = plant.n;
        plant.vert(x + xa + jx, y, z + za + jz, 0, 1, 0, u0, v0, 0.85, 0);
        plant.vert(x + xb + jx, y, z + zb + jz, 0, 1, 0, u1, v0, 0.85, 0);
        plant.vert(x + xa + jx, y + hgt, z + za + jz, 0, 1, 0, u0, v1, 1, 1);
        plant.vert(x + xb + jx, y + hgt, z + zb + jz, 0, 1, 0, u1, v1, 1, 1);
        plant.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        plant.n += 4;
      }
    } else if (b.kind === 'water') {
      const above = get(x, y + 1, z) === B.WATER;
      const top = above ? 1 : 0.88;
      for (let f = 0; f < 6; f++) {
        const { n, c } = FACES[f];
        const nb = get(x + n[0], y + n[1], z + n[2]);
        if (nb === B.WATER || BLOCKS[nb].opaque) continue;
        const base = water.n;
        for (const cr of c) {
          const wy = y + (cr[1] ? top : 0), wx = ox + x + cr[0], wz = oz + z + cr[2];
          const u = n[0] ? wz : wx, v = n[1] ? wz : wy;
          water.vert(x + cr[0], wy, z + cr[2], n[0], n[1], n[2], u * 0.25, v * 0.25, 1, 0);
        }
        water.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        water.n += 4;
      }
    }
  }
  return { solid: solid.geometry(), plant: plant.geometry(), water: water.geometry() };
}
