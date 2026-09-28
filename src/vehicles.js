// Rideable things: go-kart, boat, brontosaurus and dragon. Driving uses the normal move/look controls with a
// third-person chase camera; ramming an enemy at speed starts a battle with a First Strike.
import * as THREE from 'three';
import { B, BLOCKS, CH, SEA } from './blocks.js';

const geo = new THREE.BoxGeometry(1, 1, 1);
function box(g, w, h, d, color, x, y, z, o = {}) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o }));
  m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
}

export const VEHICLES = {
  kart: { icon: '🏎', name: 'Go-kart', desc: 'Fast on land. Climbs single blocks. Shift for turbo.', seat: 0.9, cam: [6, 2.6] },
  boat: { icon: '🛶', name: 'Boat', desc: 'Glides over water. Crawls on land.', seat: 0.7, cam: [6, 2.5] },
  bronto: { icon: '🦕', name: 'Brontosaurus', desc: 'Gentle giant of the Primeval Realm. Walk up to one and ride it.', seat: 5.4, cam: [11, 4] },
  dragon: { icon: '🐉', name: 'Elder Dragon', desc: 'Flies wherever you look. Jump climbs, C dives.', seat: 3.2, cam: [12, 4] },
};

function buildKart(g) {
  box(g, 1.3, 0.35, 2, 0xe63946, 0, 0.45, 0, { metalness: 0.4 });
  box(g, 1.1, 0.5, 0.5, 0x222222, 0, 0.75, 0.55);
  box(g, 1.3, 0.15, 0.4, 0xf1c40f, 0, 0.7, -0.95);
  box(g, 0.05, 0.5, 0.05, 0x333333, 0, 1.0, -0.2);
  box(g, 0.5, 0.05, 0.05, 0x333333, 0, 1.25, -0.2);
  const wheels = [];
  for (const [x, z] of [[-0.7, -0.65], [0.7, -0.65], [-0.7, 0.7], [0.7, 0.7]]) wheels.push(box(g, 0.25, 0.5, 0.5, 0x111111, x, 0.25, z));
  return { wheels };
}
function buildBoat(g) {
  const wood = 0x9b6b3d;
  box(g, 1.4, 0.2, 2.6, wood, 0, 0.1, 0);
  for (const s of [-1, 1]) box(g, 0.12, 0.45, 2.6, wood, s * 0.7, 0.35, 0);
  box(g, 1.4, 0.45, 0.12, wood, 0, 0.35, 1.3); box(g, 0.9, 0.45, 0.12, wood, 0, 0.35, -1.35);
  box(g, 1.3, 0.08, 0.3, 0x7a5230, 0, 0.35, 0.3);
  const oar = box(g, 0.08, 0.08, 1.6, 0x7a5230, 0.9, 0.45, 0.2);
  return { oar };
}
export function buildBronto(g) {
  const c = 0x7d8f5a, d = 0x5f6d42;
  box(g, 2.2, 2, 4, c, 0, 3.2, 0);
  const neck = new THREE.Group(); neck.position.set(0, 3.8, -1.8); g.add(neck);
  for (let i = 0; i < 5; i++) box(neck, 0.7 - i * 0.05, 0.7, 0.8, c, 0, i * 0.8, -i * 0.45);
  const head = box(neck, 0.7, 0.6, 1, c, 0, 4.2, -2.5);
  for (const s of [-1, 1]) box(neck, 0.06, 0.12, 0.12, 0x111111, s * 0.36, 4.3, -2.7);
  const tail = new THREE.Group(); tail.position.set(0, 3.4, 2); g.add(tail);
  for (let i = 0; i < 5; i++) box(tail, 0.8 - i * 0.14, 0.7 - i * 0.1, 0.9, c, 0, -i * 0.3, i * 0.85);
  const legs = [];
  for (const [x, z] of [[-0.8, -1.4], [0.8, -1.4], [-0.8, 1.4], [0.8, 1.4]]) {
    const p = new THREE.Group(); p.position.set(x, 2.3, z); g.add(p); box(p, 0.7, 2.3, 0.7, d, 0, -1.15, 0); legs.push(p);
  }
  box(g, 1.6, 0.3, 1.2, 0x8b2f2f, 0, 4.3, -0.2); // saddle blanket
  return { legs, tail, neck, head };
}
function buildDragon(g) {
  const c = 0x5a2d91, glow = { emissive: 0x3b0f6e, emissiveIntensity: 0.4 };
  const s = new THREE.Group(); s.scale.setScalar(2.2); s.position.y = 1.4; g.add(s);
  box(s, 0.7, 0.6, 1.4, c, 0, 0, 0, glow); box(s, 0.66, 0.2, 1.2, 0xe0b060, 0, -0.3, 0);
  box(s, 0.3, 0.3, 0.8, c, 0, 0.35, -0.9, glow);
  const head = new THREE.Group(); head.position.set(0, 0.6, -1.4); s.add(head);
  box(head, 0.5, 0.4, 0.7, c, 0, 0, 0, glow);
  for (const sd of [-1, 1]) box(head, 0.08, 0.08, 0.05, 0xffe600, sd * 0.2, 0.1, -0.35, { emissive: 0xffaa00, emissiveIntensity: 1.5 });
  const tail = new THREE.Group(); tail.position.set(0, 0, 0.7); s.add(tail); box(tail, 0.3, 0.3, 1.4, c, 0, 0, 0.7, glow);
  const wings = [-1, 1].map((sd) => { const w = new THREE.Group(); w.position.set(sd * 0.35, 0.25, -0.1); s.add(w); box(w, 2.2, 0.05, 1.1, c, sd * 1.1, 0, 0, { side: THREE.DoubleSide, ...glow }); return w; });
  box(s, 0.5, 0.15, 0.5, 0x8b2f2f, 0, 0.36, -0.2);
  return { wings, tail };
}

class Vehicle {
  constructor(kind, x, y, z, yaw = 0) {
    this.kind = kind; this.V = VEHICLES[kind];
    this.group = new THREE.Group();
    Object.assign(this, { kart: buildKart, boat: buildBoat, bronto: buildBronto, dragon: buildDragon }[kind](this.group));
    this.pos = new THREE.Vector3(x, y, z); this.yaw = yaw; this.speed = 0; this.vy = 0; this.t = 0; this.wild = false;
    this.group.position.copy(this.pos);
  }
}

export class Vehicles {
  constructor({ scene, world, player, rpg, chat }) {
    Object.assign(this, { scene, world, player, rpg, chat });
    this.list = []; this.riding = null; this.herdTimer = 2;
  }

  ground(x, y, z, depth = 8) {
    const fx = Math.floor(x), fz = Math.floor(z);
    for (let yy = Math.min(CH - 1, Math.floor(y) + 2); yy > Math.floor(y) - depth && yy > 0; yy--) {
      const id = this.world.get(fx, yy, fz);
      if (BLOCKS[id].solid) return yy + 1;
      if (id === B.WATER || id === B.LAVA) return -yy - 1; // negative = liquid surface
    }
    return null;
  }

  /** Deploy a vehicle a few blocks in front of the player (or call your dragon down from the sky). */
  deploy(kind, yaw) {
    const old = this.list.find((v) => v.kind === kind && !v.wild);
    if (old) this.remove(old);
    const p = this.player.pos, fx = p.x - Math.sin(yaw) * 3, fz = p.z - Math.cos(yaw) * 3;
    const g = this.ground(fx, p.y + 4, fz, 12);
    const y = g === null ? p.y : Math.abs(g);
    const v = new Vehicle(kind, fx, kind === 'dragon' ? y + 1 : y, fz, yaw);
    this.list.push(v); this.scene.add(v.group);
    this.chat('', `${v.V.icon} ${v.V.name} ready. Walk up to it and press R (or 🚗) to ride.`);
    return v;
  }

  remove(v) { if (this.riding === v) this.riding = null; this.scene.remove(v.group); this.list.splice(this.list.indexOf(v), 1); }

  nearest(maxD = 4) {
    let best = null, bd = maxD;
    for (const v of this.list) { const d = v.pos.distanceTo(this.player.pos) - (v.kind === 'bronto' ? 3 : v.kind === 'dragon' ? 3 : 0); if (d < bd) { bd = d; best = v; } }
    return best;
  }

  toggleRide() {
    if (this.riding) {
      const v = this.riding; this.riding = null;
      const side = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw)).multiplyScalar(v.kind === 'bronto' ? 3 : v.kind === 'dragon' ? 4 : 1.6);
      const g = this.ground(v.pos.x + side.x, v.pos.y + 6, v.pos.z + side.z, 30);
      this.player.pos.set(v.pos.x + side.x, g === null ? v.pos.y + 1 : Math.abs(g) + 0.1, v.pos.z + side.z);
      this.player.vel.set(0, 0, 0);
      return false;
    }
    const v = this.nearest();
    if (!v) { this.chat('', 'Nothing to ride nearby. Deploy a vehicle from the inventory (I).'); return false; }
    this.riding = v; v.wild = false;
    this.chat('', `${v.V.icon} Riding the ${v.V.name}. R to hop off.`);
    return true;
  }

  /** Primeval herds of brontosaurs wander near you. */
  herds(dt, inPrimeval) {
    if ((this.herdTimer -= dt) > 0) return;
    this.herdTimer = 6;
    const wild = this.list.filter((v) => v.wild);
    for (const v of wild) if (v.pos.distanceTo(this.player.pos) > 110) this.remove(v);
    if (!inPrimeval || wild.length >= 4) return;
    const p = this.player.pos, a = Math.random() * 6.28, x = p.x + Math.cos(a) * 40, z = p.z + Math.sin(a) * 40;
    const g = this.ground(x, CH - 2, z, CH);
    if (g === null || g < 0) return;
    for (let i = 0; i < 2; i++) {
      const v = new Vehicle('bronto', x + i * 5, g, z + i * 3, Math.random() * 6.28);
      v.wild = true; this.list.push(v); this.scene.add(v.group);
    }
  }

  /** Drive the mounted vehicle. Returns the seat position for the player/camera. */
  drive(dt, c, camera) {
    const v = this.riding, V = v.V;
    const fwd = c.move.f, turbo = c.sprint;
    let max = { kart: turbo ? 32 : 22, boat: 16, bronto: turbo ? 9 : 6, dragon: turbo ? 46 : 28 }[v.kind];
    const accel = v.kind === 'bronto' ? 6 : v.kind === 'dragon' ? 18 : 20;
    // steer: the vehicle follows where you look; A/D nudge the view
    c.yaw -= c.move.r * dt * 1.8;
    let dy = c.yaw - v.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    v.yaw += dy * Math.min(1, dt * (v.kind === 'bronto' ? 1.5 : 4));
    const onWater = this.world.get(Math.floor(v.pos.x), Math.floor(v.pos.y - 0.3), Math.floor(v.pos.z)) === B.WATER;
    if (v.kind === 'boat' && !onWater) max = 3;
    v.speed += (fwd * max - v.speed) * Math.min(1, dt * accel / Math.max(max, 1));
    const dir = new THREE.Vector3(-Math.sin(v.yaw), 0, -Math.cos(v.yaw));

    if (v.kind === 'dragon') {
      const pitchDir = Math.sin(c.pitch);
      v.vy += (((c.jump ? 1 : 0) - (c.down ? 1 : 0)) * 14 + pitchDir * v.speed * 0.9 - v.vy) * Math.min(1, dt * 3);
      const nx = v.pos.x + dir.x * v.speed * Math.cos(c.pitch) * dt, nz = v.pos.z + dir.z * v.speed * Math.cos(c.pitch) * dt;
      let ny = Math.min(CH + 20, v.pos.y + v.vy * dt);
      const g = this.ground(nx, ny + 2, nz, 6);
      if (g !== null && Math.abs(g) > ny - 0.5) { ny = Math.abs(g) + 0.5; v.vy = Math.max(0, v.vy); }
      if (this.world.isSolid(Math.floor(nx), Math.floor(ny + 1), Math.floor(nz))) v.speed *= 0.3; else { v.pos.x = nx; v.pos.z = nz; }
      v.pos.y = ny;
      v.t += dt;
      v.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * Math.sin(v.t * (v.speed > 5 ? 6 : 3)) * 0.7; });
      v.group.rotation.set(-v.vy * 0.02, v.yaw, dy * 0.8);
    } else {
      const nx = v.pos.x + dir.x * v.speed * dt, nz = v.pos.z + dir.z * v.speed * dt;
      const step = v.kind === 'bronto' ? 2.2 : 1.2;
      const g = this.ground(nx, v.pos.y + step, nz, 10);
      const surf = g === null ? null : g < 0 ? -g - 0.1 : g;
      if (surf !== null && surf <= v.pos.y + step) {
        v.pos.x = nx; v.pos.z = nz;
        if (surf >= v.pos.y - 0.05) { v.pos.y = surf; v.vy = c.jump && v.kind === 'kart' && surf === g ? 8 : 0; }
      } else v.speed *= -0.3; // bonk off the wall
      v.vy -= 28 * dt; v.pos.y += v.vy * dt;
      const under = this.ground(v.pos.x, v.pos.y + 0.5, v.pos.z, 3);
      const us = under === null ? -Infinity : under < 0 ? -under - 0.1 : under;
      if (v.pos.y < us) { v.pos.y = us; v.vy = Math.max(0, v.vy); }
      v.t += dt * Math.abs(v.speed);
      v.wheels?.forEach((w) => { w.rotation.x = v.t * 2; });
      if (v.oar) v.oar.rotation.y = Math.sin(v.t * 0.8) * 0.4;
      v.legs?.forEach((l, i) => { l.rotation.x = Math.sin(v.t * 0.6 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.4; });
      v.group.rotation.set(0, v.yaw, 0);
    }
    v.group.position.copy(v.pos);

    // ram enemies
    if (Math.abs(v.speed) > 8) {
      const e = this.rpg.enemies.find((en) => en.pos.distanceTo(v.pos) < (en.T.radius || 0) + 2.2);
      if (e) { v.speed = 0; this.rpg.engage(e, 'dash'); }
    }
    // chase camera
    const [dist, h] = V.cam, back = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    const target = v.pos.clone(); target.y += V.seat + 0.6;
    const want = target.clone().addScaledVector(back, dist * Math.cos(c.pitch * 0.8)).add(new THREE.Vector3(0, h - Math.sin(c.pitch) * dist * 0.8, 0));
    const camPos = target.clone(), stepV = want.clone().sub(target).divideScalar(20);
    for (let i = 0; i < 20; i++) { camPos.add(stepV); if (this.world.isSolid(Math.floor(camPos.x), Math.floor(camPos.y), Math.floor(camPos.z))) { camPos.sub(stepV); break; } }
    camera.position.copy(camPos);
    camera.lookAt(target);
    return v.pos.clone().add(new THREE.Vector3(0, V.seat, 0));
  }

  /** Idle animation for parked vehicles and wandering brontosaurs. */
  update(dt) {
    for (const v of this.list) {
      if (v === this.riding) continue;
      v.t += dt;
      if (v.kind === 'bronto' && v.wild) {
        v.yaw += Math.sin(v.t * 0.1) * dt * 0.2;
        const nx = v.pos.x - Math.sin(v.yaw) * dt * 1.5, nz = v.pos.z - Math.cos(v.yaw) * dt * 1.5;
        const g = this.ground(nx, v.pos.y + 2.2, nz, 8);
        if (g !== null && g > 0 && g <= v.pos.y + 2.2) { v.pos.set(nx, g, nz); } else v.yaw += 1;
        v.legs.forEach((l, i) => { l.rotation.x = Math.sin(v.t * 1.5 + (i % 2 ? Math.PI : 0)) * 0.25; });
        v.group.position.copy(v.pos); v.group.rotation.y = v.yaw;
      }
      if (v.kind === 'dragon') { v.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (0.3 + Math.sin(v.t * 1.5) * 0.1); }); v.group.position.y = v.pos.y + Math.sin(v.t) * 0.2; }
      if (v.kind === 'boat') v.group.position.y = v.pos.y + Math.sin(v.t * 2) * 0.05;
    }
  }
}

export { SEA };
