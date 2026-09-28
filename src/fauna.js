// Ambient life and spectacle: fish schools, pterodactyl flocks, distant dragons, and volcanoes that erupt.
import * as THREE from 'three';
import { B, BLOCKS, SEA } from './blocks.js';
import { sitesNear } from './landmarks.js';
import { realmAt } from './realms.js';

const geo = new THREE.BoxGeometry(1, 1, 1);
const mats = new Map();
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o })); return mats.get(k); };
function box(g, w, h, d, c, x, y, z, o) { const m = new THREE.Mesh(geo, mat(c, o)); m.scale.set(w, h, d); m.position.set(x, y, z); g.add(m); return m; }

function fish(color) {
  const g = new THREE.Group();
  box(g, 0.14, 0.22, 0.4, color, 0, 0, 0); box(g, 0.04, 0.2, 0.14, color, 0, 0, 0.26);
  return g;
}
function ptero() {
  const g = new THREE.Group(), c = 0x9c6b4a;
  box(g, 0.35, 0.3, 1.1, c, 0, 0, 0); box(g, 0.2, 0.2, 0.7, c, 0, 0.1, -0.7); box(g, 0.1, 0.35, 0.3, 0xc0392b, 0, 0.3, -0.5);
  const wings = [-1, 1].map((s) => { const w = new THREE.Group(); w.position.set(s * 0.18, 0.05, 0); g.add(w); box(w, 2, 0.04, 0.7, 0xb07d5c, s * 1, 0, 0, { side: THREE.DoubleSide }); return w; });
  g.userData.wings = wings; return g;
}
function farDragon() {
  const g = new THREE.Group(), c = 0x2c1d4a, o = { fog: false };
  const s = new THREE.Group(); s.scale.setScalar(6); g.add(s);
  box(s, 0.7, 0.6, 1.6, c, 0, 0, 0, o); box(s, 0.3, 0.3, 1, c, 0, 0.3, -1.1, o); box(s, 0.5, 0.4, 0.6, c, 0, 0.5, -1.7, o);
  box(s, 0.3, 0.3, 1.6, c, 0, 0, 1.4, o);
  for (const sd of [-1, 1]) box(s, 0.08, 0.08, 0.05, 0xffaa00, sd * 0.2, 0.6, -2, { fog: false, emissive: 0xffaa00, emissiveIntensity: 3 });
  const wings = [-1, 1].map((sd) => { const w = new THREE.Group(); w.position.set(sd * 0.35, 0.2, 0); s.add(w); box(w, 2.8, 0.05, 1.3, c, sd * 1.4, 0, 0, { fog: false, side: THREE.DoubleSide }); return w; });
  g.userData.wings = wings; return g;
}

export class Fauna {
  constructor({ scene, world, player, rpg, chat, hooks }) {
    Object.assign(this, { scene, world, player, rpg, chat, hooks });
    this.fish = []; this.flyers = []; this.bombs = []; this.smoke = [];
    this.t = 0; this.fishT = 0; this.flyT = 0; this.eruptT = 5;
    this.smokeMat = new THREE.MeshBasicMaterial({ color: 0x4a4540, transparent: true, opacity: 0.5, depthWrite: false });
    this.bombMat = new THREE.MeshStandardMaterial({ color: 0xff5a10, emissive: 0xff4000, emissiveIntensity: 2 });
    this.sphere = new THREE.IcosahedronGeometry(1, 1);
  }

  update(dt) {
    const p = this.player.pos, w = this.world, realm = realmAt(p.x, p.z);
    this.t += dt;
    // fish schools stay in water around you
    if ((this.fishT -= dt) <= 0) {
      this.fishT = 3;
      for (const f of [...this.fish]) if (f.g.position.distanceTo(p) > 60) { this.scene.remove(f.g); this.fish.splice(this.fish.indexOf(f), 1); }
      if (this.fish.length < 24) {
        const a = Math.random() * 6.28, cx = p.x + Math.cos(a) * 18, cz = p.z + Math.sin(a) * 18, cy = SEA - 2 - Math.random() * 4;
        if (w.get(Math.floor(cx), Math.floor(cy), Math.floor(cz)) === B.WATER) {
          const color = [0xff8c1a, 0x3aa0ff, 0xffe14a, 0xff5fa2][Math.floor(Math.random() * 4)];
          for (let i = 0; i < 6; i++) {
            const g = fish(color); g.position.set(cx + Math.random() * 2, cy + Math.random(), cz + Math.random() * 2);
            this.scene.add(g); this.fish.push({ g, c: new THREE.Vector3(cx, cy, cz), ph: Math.random() * 6, r: 1.5 + Math.random() * 2 });
          }
        }
      }
    }
    for (const f of this.fish) {
      f.ph += dt * 1.2;
      const nx = f.c.x + Math.cos(f.ph) * f.r, nz = f.c.z + Math.sin(f.ph) * f.r, ny = f.c.y + Math.sin(f.ph * 2) * 0.3;
      if (w.get(Math.floor(nx), Math.floor(ny), Math.floor(nz)) === B.WATER) f.g.position.set(nx, ny, nz); else f.r *= -1;
      f.g.rotation.y = -f.ph + (f.r > 0 ? Math.PI : 0);
      // scatter from swimmers
      if (f.g.position.distanceTo(p) < 2) f.c.add(f.g.position.clone().sub(p).setY(0).normalize().multiplyScalar(dt * 6));
    }

    // flyers: pterodactyls over the Primeval jungle, dragons circling mountains and spires
    if ((this.flyT -= dt) <= 0) {
      this.flyT = 8;
      for (const f of [...this.flyers]) if (f.g.position.distanceTo(p) > 400) { this.scene.remove(f.g); this.flyers.splice(this.flyers.indexOf(f), 1); }
      if (realm === 'primeval' && this.flyers.filter((f) => f.kind === 'ptero').length < 6) {
        const c = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 80, 30 + Math.random() * 20, (Math.random() - 0.5) * 80));
        for (let i = 0; i < 3; i++) { const g = ptero(); g.position.copy(c); this.scene.add(g); this.flyers.push({ kind: 'ptero', g, c, r: 12 + i * 4, ph: i, sp: 0.35 }); }
      }
      const dragonHere = (realm === 'dragon' && Math.random() < 0.5) || (realm === 'over' && Math.hypot(p.x, p.z) > 500 && p.y > 70 && Math.random() < 0.15);
      if (dragonHere && !this.flyers.some((f) => f.kind === 'dragon')) {
        const c = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 200, 60, (Math.random() - 0.5) * 200)); c.y = Math.max(c.y, 115);
        const g = farDragon(); g.position.copy(c); this.scene.add(g);
        this.flyers.push({ kind: 'dragon', g, c, r: 70, ph: 0, sp: 0.12 });
        this.chat('', realm === 'over' ? '🐉 …was that a DRAGON? It came from somewhere far away.' : '🐉 A great shadow passes over the isles.');
      }
    }
    for (const f of this.flyers) {
      f.ph += dt * f.sp;
      const x = f.c.x + Math.cos(f.ph) * f.r, z = f.c.z + Math.sin(f.ph) * f.r, y = f.c.y + Math.sin(f.ph * 3) * 3;
      f.g.position.set(x, y, z);
      f.g.rotation.set(0, -f.ph, 0.3);
      f.g.userData.wings.forEach((wg, i) => { wg.rotation.z = (i ? 1 : -1) * Math.sin(this.t * (f.kind === 'dragon' ? 2 : 6)) * 0.6; });
    }

    // volcanoes: smoke always, eruptions now and then — lava bombs land and leave magma behind
    const v = sitesNear(w, 'volcano', p.x, p.z, 220)[0];
    if (v) {
      const top = new THREE.Vector3(v.x + 0.5, v.y + Math.min(118 - v.y, 46) - 4, v.z + 0.5);
      if (this.smoke.length < 14 && Math.random() < dt * 4) {
        const m = new THREE.Mesh(this.sphere, this.smokeMat); m.position.copy(top).add(new THREE.Vector3((Math.random() - 0.5) * 4, 2, (Math.random() - 0.5) * 4));
        this.scene.add(m); this.smoke.push({ m, t: 0 });
      }
      if ((this.eruptT -= dt) <= 0) {
        this.eruptT = 9 + Math.random() * 10;
        const near = Math.hypot(p.x - v.x, p.z - v.z) < 90;
        if (near) this.chat('', '🌋 The volcano rumbles…');
        this.hooks.shake(near ? 0.5 : 0.15);
        for (let i = 0; i < 5; i++) {
          const m = new THREE.Mesh(this.sphere, this.bombMat); m.scale.setScalar(0.7); m.position.copy(top);
          this.scene.add(m);
          const a = Math.random() * 6.28, s = 6 + Math.random() * 10;
          this.bombs.push({ m, v: new THREE.Vector3(Math.cos(a) * s, 22 + Math.random() * 10, Math.sin(a) * s), t: 0 });
        }
      }
    }
    for (const s of [...this.smoke]) {
      s.t += dt; s.m.position.y += dt * 3; s.m.scale.setScalar(1.5 + s.t * 1.6);
      if (s.t > 5) { this.scene.remove(s.m); this.smoke.splice(this.smoke.indexOf(s), 1); }
    }
    for (const b of [...this.bombs]) {
      b.t += dt; b.v.y -= 20 * dt; b.m.position.addScaledVector(b.v, dt);
      const q = b.m.position, id = w.get(Math.floor(q.x), Math.floor(q.y), Math.floor(q.z));
      if (BLOCKS[id].solid || b.t > 8) {
        this.scene.remove(b.m); this.bombs.splice(this.bombs.indexOf(b), 1);
        if (b.t <= 8) {
          this.hooks.setBlocks([[Math.floor(q.x), Math.floor(q.y), Math.floor(q.z), B.MAGMA]]);
          this.hooks.fx(q.x, q.y + 0.5, q.z, 1.5);
          if (q.distanceTo(p) < 3.5) this.hooks.burn(6, 'A lava bomb!');
        }
      }
    }
  }
}

