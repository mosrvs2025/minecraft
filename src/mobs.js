// Passive animals: blocky models, wandering AI, voxel physics, knockback and panic.
import * as THREE from 'three';
import { B, CS } from './blocks.js';

const mats = new Map();
const mat = (c) => {
  if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  return mats.get(c);
};
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
function part(group, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(boxGeo, mat(color));
  m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true;
  group.add(m); return m;
}
// a leg pivots at its top so it can swing
function leg(group, w, h, color, x, y, z) {
  const pivot = new THREE.Group(); pivot.position.set(x, y, z);
  const m = part(pivot, w, h, w, color, 0, -h / 2, 0);
  group.add(pivot); pivot.userData.mesh = m; return pivot;
}

// Models face -z. Each builder returns { group, head, legs, wings, w, h }.
const MODELS = {
  pig(g) {
    const pink = 0xeea3a0;
    part(g, 0.62, 0.52, 0.95, pink, 0, 0.58, 0);
    const head = new THREE.Group(); head.position.set(0, 0.72, -0.55); g.add(head);
    part(head, 0.5, 0.46, 0.4, pink, 0, 0, -0.1);
    part(head, 0.26, 0.16, 0.08, 0xd9828a, 0, -0.05, -0.33);
    part(head, 0.07, 0.07, 0.02, 0x222222, -0.14, 0.08, -0.305); part(head, 0.07, 0.07, 0.02, 0x222222, 0.14, 0.08, -0.305);
    const legs = [[-0.18, -0.3], [0.18, -0.3], [-0.18, 0.3], [0.18, 0.3]].map(([x, z]) => leg(g, 0.18, 0.34, pink, x, 0.34, z));
    return { head, legs, w: 0.8, h: 0.95 };
  },
  cow(g) {
    const brown = 0x5b3a26, white = 0xe8e2d6;
    part(g, 0.7, 0.68, 1.15, brown, 0, 0.98, 0);
    part(g, 0.72, 0.3, 0.4, white, 0.02, 1.08, 0.2); part(g, 0.4, 0.3, 0.3, white, -0.18, 0.86, -0.25);
    const head = new THREE.Group(); head.position.set(0, 1.18, -0.68); g.add(head);
    part(head, 0.52, 0.5, 0.36, brown, 0, 0, -0.08);
    part(head, 0.34, 0.2, 0.08, 0xc9a58f, 0, -0.14, -0.28);
    part(head, 0.08, 0.16, 0.08, white, -0.3, 0.26, -0.05); part(head, 0.08, 0.16, 0.08, white, 0.3, 0.26, -0.05);
    part(head, 0.07, 0.07, 0.02, 0x111111, -0.15, 0.08, -0.265); part(head, 0.07, 0.07, 0.02, 0x111111, 0.15, 0.08, -0.265);
    const legs = [[-0.22, -0.4], [0.22, -0.4], [-0.22, 0.4], [0.22, 0.4]].map(([x, z]) => leg(g, 0.2, 0.66, brown, x, 0.66, z));
    return { head, legs, w: 0.9, h: 1.4 };
  },
  sheep(g) {
    const wool = 0xf2f0ea, face = 0xb9a898;
    part(g, 0.8, 0.72, 1.05, wool, 0, 0.88, 0);
    const head = new THREE.Group(); head.position.set(0, 1.08, -0.6); g.add(head);
    part(head, 0.44, 0.44, 0.4, wool, 0, 0.05, 0);
    part(head, 0.36, 0.32, 0.1, face, 0, -0.02, -0.2);
    part(head, 0.06, 0.06, 0.02, 0x111111, -0.1, 0.04, -0.255); part(head, 0.06, 0.06, 0.02, 0x111111, 0.1, 0.04, -0.255);
    const legs = [[-0.22, -0.34], [0.22, -0.34], [-0.22, 0.34], [0.22, 0.34]].map(([x, z]) => leg(g, 0.16, 0.54, face, x, 0.54, z));
    return { head, legs, w: 0.9, h: 1.3 };
  },
  chicken(g) {
    const white = 0xf7f5ef;
    part(g, 0.36, 0.34, 0.5, white, 0, 0.42, 0);
    const head = new THREE.Group(); head.position.set(0, 0.7, -0.22); g.add(head);
    part(head, 0.24, 0.3, 0.2, white, 0, 0, 0);
    part(head, 0.16, 0.08, 0.1, 0xf2b233, 0, -0.02, -0.14);
    part(head, 0.08, 0.1, 0.06, 0xd1302a, 0, -0.1, -0.12);
    part(head, 0.05, 0.05, 0.02, 0x111111, -0.08, 0.06, -0.105); part(head, 0.05, 0.05, 0.02, 0x111111, 0.08, 0.06, -0.105);
    const wings = [-1, 1].map((s) => {
      const p = new THREE.Group(); p.position.set(s * 0.19, 0.55, 0); g.add(p);
      part(p, 0.05, 0.24, 0.36, white, 0, -0.12, 0); return p;
    });
    const legs = [-0.08, 0.08].map((x) => leg(g, 0.05, 0.26, 0xf2b233, x, 0.26, 0.02));
    return { head, legs, wings, w: 0.45, h: 0.8 };
  },
};
const TYPES = ['pig', 'cow', 'sheep', 'chicken'];
const WEIGHTS = [0.27, 0.25, 0.2, 0.28];
const pickType = () => { let r = Math.random(); for (let i = 0; i < 4; i++) { if ((r -= WEIGHTS[i]) < 0) return TYPES[i]; } return 'pig'; };

class Mob {
  constructor(type, x, y, z) {
    this.type = type;
    this.group = new THREE.Group();
    Object.assign(this, MODELS[type](this.group));
    this.pos = new THREE.Vector3(x, y, z); this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2; this.targetYaw = this.yaw;
    this.walk = 0; this.think = Math.random() * 3; this.panic = 0; this.hurt = 0; this.hp = 4; this.phase = 0;
    this.onGround = false;
    this.group.position.copy(this.pos);
  }
}

export class Mobs {
  constructor(scene, world) {
    this.scene = scene; this.world = world; this.list = []; this.spawnTimer = 0; this.max = 22;
    this.hurtMat = new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0x801010 });
  }

  add(type, x, y, z) {
    const m = new Mob(type, x, y, z);
    this.list.push(m); this.scene.add(m.group); return m;
  }

  remove(m) {
    this.scene.remove(m.group);
    this.list.splice(this.list.indexOf(m), 1);
  }

  /** Drop a crowd of random animals out of the sky around a point. */
  rain(center, n = 16) {
    for (let i = 0; i < n; i++) {
      const m = this.add(pickType(), center.x + (Math.random() - 0.5) * 16, center.y + 20 + Math.random() * 15, center.z + (Math.random() - 0.5) * 16);
      m.vel.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2); m.panic = 2;
    }
  }

  trySpawn(p) {
    const w = this.world;
    const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 22;
    const x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
    if (!w.getChunk(Math.floor(x / CS), Math.floor(z / CS))) return;
    const { h } = w.column(x, z);
    if (w.get(x, h, z) !== B.GRASS || w.isSolid(x, h + 1, z) || w.isSolid(x, h + 2, z)) return;
    const type = pickType(), herd = type === 'chicken' ? 3 : 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < herd && this.list.length < this.max; i++) this.add(type, x + 0.5 + (Math.random() - 0.5) * 3, h + 1.2, z + 0.5 + (Math.random() - 0.5) * 3);
  }

  collides(m, p) {
    const w = this.world, hw = m.w / 2;
    for (let x = Math.floor(p.x - hw); x <= Math.floor(p.x + hw); x++)
      for (let y = Math.floor(p.y); y <= Math.floor(p.y + m.h); y++)
        for (let z = Math.floor(p.z - hw); z <= Math.floor(p.z + hw); z++)
          if (w.isSolid(x, y, z)) return true;
    return false;
  }

  moveAxis(m, axis, d) {
    const p = m.pos, steps = Math.ceil(Math.abs(d) / 0.4) || 1, s = d / steps, hw = m.w / 2;
    for (let i = 0; i < steps; i++) {
      p[axis] += s;
      if (!this.collides(m, p)) continue;
      if (axis === 'y') p.y = s < 0 ? Math.floor(p.y) + 1 : Math.floor(p.y + m.h) - m.h - 1e-3;
      else p[axis] = s > 0 ? Math.floor(p[axis] + hw) - hw - 1e-3 : Math.floor(p[axis] - hw) + 1 + hw + 1e-3;
      return true;
    }
    return false;
  }

  /** Ray vs animal boxes; returns { mob, dist } for the closest hit. */
  raycast(o, dir, maxDist) {
    let best = null;
    for (const m of this.list) {
      const hw = m.w / 2 + 0.1;
      const min = [m.pos.x - hw, m.pos.y, m.pos.z - hw], max = [m.pos.x + hw, m.pos.y + m.h, m.pos.z + hw];
      const oo = [o.x, o.y, o.z], dd = [dir.x, dir.y, dir.z];
      let t0 = 0, t1 = maxDist;
      for (let i = 0; i < 3 && t0 <= t1; i++) {
        const inv = 1 / dd[i];
        let a = (min[i] - oo[i]) * inv, b = (max[i] - oo[i]) * inv;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      }
      if (t0 <= t1 && (!best || t0 < best.dist)) best = { mob: m, dist: t0 };
    }
    return best;
  }

  /** Knock an animal back; returns true when it dies. */
  hit(m, dir, force = 9) {
    m.vel.x += dir.x * force; m.vel.z += dir.z * force; m.vel.y = 6;
    m.panic = 4; m.hurt = 0.3; m.hp--;
    return m.hp <= 0;
  }

  blast(center, r) {
    for (const m of [...this.list]) {
      const d = m.pos.distanceTo(center);
      if (d > r * 2.2) continue;
      const k = (1 - d / (r * 2.2)) * 30;
      const dir = m.pos.clone().sub(center).normalize();
      m.vel.addScaledVector(dir, k); m.vel.y += k * 0.6; m.panic = 5; m.hurt = 0.3;
    }
  }

  update(dt, playerPos, spawnEnabled) {
    if (spawnEnabled && (this.spawnTimer -= dt) <= 0) {
      this.spawnTimer = 1.5;
      if (this.list.length < this.max) this.trySpawn(playerPos);
    }
    const w = this.world;
    for (const m of [...this.list]) {
      if (m.pos.distanceToSquared(playerPos) > 90 * 90) { this.remove(m); continue; }
      if (!w.getChunk(Math.floor(m.pos.x / CS), Math.floor(m.pos.z / CS))) continue; // freeze in unloaded chunks

      // brain
      m.panic = Math.max(0, m.panic - dt);
      if ((m.think -= dt) <= 0) {
        m.think = m.panic ? 0.4 + Math.random() * 0.6 : 2 + Math.random() * 4;
        m.walk = m.panic ? 1 : Math.random() < 0.55 ? 1 : 0;
        m.targetYaw = m.yaw + (Math.random() - 0.5) * (m.panic ? 5 : 3);
      }
      m.yaw += ((m.targetYaw - m.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * (1 - Math.exp(-dt * 4));
      const speed = m.walk * (m.panic ? 4.2 : m.type === 'chicken' ? 1.1 : 1.3);

      // physics
      const inWater = w.get(Math.floor(m.pos.x), Math.floor(m.pos.y + 0.3), Math.floor(m.pos.z)) === B.WATER;
      const tx = -Math.sin(m.yaw) * speed, tz = -Math.cos(m.yaw) * speed;
      const acc = 1 - Math.exp(-dt * (m.onGround ? 8 : 1.5));
      m.vel.x += (tx - m.vel.x) * acc; m.vel.z += (tz - m.vel.z) * acc;
      if (inWater) { m.vel.y += (2.5 - m.vel.y) * (1 - Math.exp(-dt * 3)); }
      else {
        m.vel.y -= 26 * dt;
        if (m.type === 'chicken' && m.vel.y < -2.5) m.vel.y = -2.5; // chickens flutter down
      }
      const hx = this.moveAxis(m, 'x', m.vel.x * dt); if (hx) m.vel.x *= -0.2;
      const hz = this.moveAxis(m, 'z', m.vel.z * dt); if (hz) m.vel.z *= -0.2;
      const falling = m.vel.y < 0, hy = this.moveAxis(m, 'y', m.vel.y * dt);
      m.onGround = hy && falling;
      if (hy) m.vel.y = falling && m.vel.y < -12 ? -m.vel.y * 0.35 : 0; // bounce after a long drop
      if ((hx || hz) && m.onGround && m.walk) { m.vel.y = 7.6; if (Math.random() < 0.3) m.targetYaw += Math.PI / 2; }
      if (m.pos.y < -10) { this.remove(m); continue; }

      // animation
      const hs = Math.hypot(m.vel.x, m.vel.z);
      m.phase += dt * hs * (m.type === 'chicken' ? 9 : 5);
      const sw = Math.sin(m.phase) * Math.min(1, hs / 1.5) * 0.7;
      m.legs.forEach((l, i) => { l.rotation.x = (i % 2 === (i < 2 ? 0 : 1) ? sw : -sw); });
      if (m.wings) {
        const flap = !m.onGround ? Math.sin(performance.now() * 0.04) * 0.9 + 0.9 : 0;
        m.wings[0].rotation.z = -flap; m.wings[1].rotation.z = flap;
      }
      m.head.rotation.x = m.walk || m.panic ? 0 : Math.sin(performance.now() * 0.001 + m.phase) * 0.25 - 0.2;
      m.group.position.copy(m.pos);
      m.group.rotation.y = m.yaw;
      if (m.hurt > 0) {
        m.hurt -= dt;
        m.group.traverse((o) => { if (o.isMesh) { o.userData.mat ??= o.material; o.material = m.hurt > 0 ? this.hurtMat : o.userData.mat; } });
      }
    }
  }
}
