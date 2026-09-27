// Super Mario RPG-style layer: roaming enemies, turn-based battles with timed hits, HP/FP/XP, coins, items, ? blocks.
import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { B, BLOCKS, CS, CH } from './blocks.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// ---- enemy models (face -z) ------------------------------------------------------------------
const geo = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map();
const mat = (c, o = {}) => {
  const k = c + JSON.stringify(o);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o }));
  return matCache.get(k);
};
function box(g, w, h, d, c, x, y, z, o) {
  const m = new THREE.Mesh(geo, mat(c, o)); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
}
function eyes(g, y, z, spread = 0.12, angry = true) {
  for (const s of [-1, 1]) {
    box(g, 0.12, 0.18, 0.03, 0xffffff, s * spread, y, z);
    box(g, 0.06, 0.1, 0.03, 0x111111, s * spread, y - 0.02, z - 0.01);
    if (angry) { const b = box(g, 0.16, 0.04, 0.03, 0x2b1606, s * spread, y + 0.13, z - 0.01); b.rotation.z = s * 0.35; }
  }
}
const ENEMIES = {
  shroomba: {
    name: 'Shroomba', hp: 12, atk: 5, def: 1, xp: 4, coins: [2, 5], speed: 2.4,
    build(g) {
      box(g, 0.9, 0.42, 0.9, 0x8a4b22, 0, 0.78, 0);
      box(g, 0.7, 0.14, 0.7, 0x6d3a19, 0, 1.02, 0);
      box(g, 0.56, 0.42, 0.5, 0xf2d3a5, 0, 0.42, 0);
      eyes(g, 0.5, -0.26);
      const feet = [-1, 1].map((s) => box(g, 0.24, 0.14, 0.34, 0x3a1e0c, s * 0.16, 0.07, -0.04));
      return { feet };
    },
  },
  spikey: {
    name: 'Spikey', hp: 18, atk: 7, def: 4, xp: 7, coins: [3, 7], speed: 1.6, spiky: true,
    build(g) {
      box(g, 0.8, 0.5, 0.9, 0xd8322b, 0, 0.5, 0.05);
      const spike = new THREE.ConeGeometry(0.1, 0.28, 6);
      for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [0, 0.05], [-0.22, 0.3], [0.22, 0.3]]) {
        const s = new THREE.Mesh(spike, mat(0xf4f1e6)); s.position.set(x, 0.88, z); s.castShadow = true; g.add(s);
      }
      box(g, 0.44, 0.34, 0.2, 0xf6c86a, 0, 0.42, -0.45);
      eyes(g, 0.46, -0.56, 0.09);
      const feet = [-1, 1].map((s) => box(g, 0.2, 0.14, 0.26, 0xf6c86a, s * 0.24, 0.07, -0.1));
      return { feet };
    },
  },
  buzzbee: {
    name: 'Buzzbee', hp: 10, atk: 6, def: 0, xp: 5, coins: [2, 6], speed: 3.2, fly: true,
    build(g) {
      box(g, 0.5, 0.46, 0.66, 0xf5c518, 0, 0, 0);
      box(g, 0.52, 0.48, 0.1, 0x1b1b1b, 0, 0, 0.06); box(g, 0.52, 0.48, 0.1, 0x1b1b1b, 0, 0, 0.25);
      const st = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6), mat(0x222222)); st.rotation.x = Math.PI / 2; st.position.z = 0.42; g.add(st);
      eyes(g, 0.06, -0.34, 0.1);
      const wings = [-1, 1].map((s) => {
        const p = new THREE.Group(); p.position.set(s * 0.22, 0.25, 0.05); g.add(p);
        box(p, 0.5, 0.03, 0.3, 0xdff4ff, s * 0.25, 0, 0, { transparent: true, opacity: 0.6 });
        return p;
      });
      return { wings, lift: 1.1 };
    },
  },
};
const ETYPES = Object.keys(ENEMIES);

class Enemy {
  constructor(type, x, y, z, lvl) {
    const T = ENEMIES[type];
    this.type = type; this.T = T; this.lvl = lvl;
    this.maxHp = Math.round(T.hp * (1 + 0.35 * (lvl - 1))); this.hp = this.maxHp;
    this.atk = T.atk + (lvl - 1) * 2; this.def = T.def + (lvl - 1);
    this.group = new THREE.Group();
    this.inner = new THREE.Group(); this.group.add(this.inner);
    Object.assign(this, T.build(this.inner));
    this.lift = this.lift || 0;
    this.pos = new THREE.Vector3(x, y, z); this.yaw = Math.random() * 6.28; this.t = Math.random() * 10; this.think = 0; this.stun = 0;
    this.group.position.copy(this.pos);
  }
}

// ---- player stats --------------------------------------------------------------------------------
const FRESH = { lvl: 1, xp: 0, hp: 20, maxHp: 20, fp: 10, maxFp: 10, atk: 6, def: 2, mag: 5, coins: 0, items: { mushroom: 2, syrup: 1 } };
const xpNeeded = (lvl) => 10 + (lvl - 1) * 14;
const ITEMS = {
  mushroom: { icon: '🍄', name: 'Mushroom', desc: '+25 HP' },
  syrup: { icon: '🍯', name: 'Honey Syrup', desc: '+10 FP' },
};

export class Rpg {
  constructor({ scene, camera, world, player, controls, burst, chat, onBattle, isMobile, getSun }) {
    Object.assign(this, { scene, camera, world, player, controls, burst, chat, onBattle, isMobile, getSun });
    this.enemies = []; this.spawnTimer = 3; this.enabled = true;
    this.inBattle = false; this.tweens = []; this.clock = 0;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('vx-rpg')); } catch { /* ignore */ }
    this.s = saved && saved.lvl ? { ...FRESH, ...saved, items: { ...FRESH.items, ...saved.items } } : structuredClone(FRESH);
    this.coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 20);
    this.coinMat = new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: 0.8, roughness: 0.25, emissive: 0x6a4300 });
    this.popups = [];
    this.bindBattleInput();
    this.renderHud();
  }

  save() { try { localStorage.setItem('vx-rpg', JSON.stringify(this.s)); } catch { /* ignore */ } }

  renderHud() {
    const s = this.s;
    $('rpg-hud').innerHTML = `<span class="lv">Lv ${s.lvl}</span>
      <span class="bar hp"><i style="width:${(s.hp / s.maxHp) * 100}%"></i><b>❤ ${s.hp}/${s.maxHp}</b></span>
      <span class="bar fp"><i style="width:${(s.fp / s.maxFp) * 100}%"></i><b>✦ ${s.fp}/${s.maxFp}</b></span>
      <span>🪙 ${s.coins}</span><span>🍄${s.items.mushroom} 🍯${s.items.syrup}</span>
      <span class="xp"><i style="width:${(s.xp / xpNeeded(s.lvl)) * 100}%"></i></span>`;
    this.save();
  }

  // ---- floating text & coins ----------------------------------------------------------------------
  popText(text, pos, cls = '') {
    const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text;
    $('pops').appendChild(el);
    this.popups.push({ el, pos: pos.clone(), t: 0 });
  }
  coinFountain(pos, n) {
    for (let i = 0; i < Math.min(n, 8); i++) {
      const m = new THREE.Mesh(this.coinGeo, this.coinMat); m.rotation.x = Math.PI / 2;
      m.position.copy(pos); this.scene.add(m);
      const v = new THREE.Vector3((Math.random() - 0.5) * 3, 6 + Math.random() * 3, (Math.random() - 0.5) * 3);
      this.tween(0.9, (k, dt) => { v.y -= 18 * dt; m.position.addScaledVector(v, dt); m.rotation.z += dt * 14; m.scale.setScalar(1 - k * k); })
        .then(() => this.scene.remove(m));
    }
  }

  /** Punching a ? block. Returns the block that replaces it. */
  openQBlock(x, y, z) {
    const r = Math.random(), p = new THREE.Vector3(x + 0.5, y + 1.2, z + 0.5);
    if (r < 0.7) {
      const c = rand(3, 10); this.s.coins += c; this.coinFountain(p, c); this.popText(`+${c} 🪙`, p, 'coin');
    } else if (r < 0.9) { this.s.items.mushroom++; this.popText('🍄 Mushroom!', p, 'item'); }
    else { this.s.items.syrup++; this.popText('🍯 Honey Syrup!', p, 'item'); }
    this.renderHud();
    return B.USED;
  }

  // ---- tweens (driven by update so battles pause cleanly) ---------------------------------------------
  tween(dur, fn) {
    return new Promise((resolve) => this.tweens.push({ t: 0, dur, fn, resolve }));
  }
  wait(s) { return this.tween(s, () => {}); }
  runTweens(dt) {
    for (const tw of [...this.tweens]) {
      tw.t += dt; const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k, dt);
      if (k >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.resolve(); }
    }
  }

  // ---- world enemies ---------------------------------------------------------------------------------------
  groundAt(x, y, z, depth = 8) {
    const w = this.world, fx = Math.floor(x), fz = Math.floor(z);
    for (let yy = Math.min(CH - 1, Math.floor(y) + 1); yy > Math.floor(y) - depth && yy > 0; yy--) {
      const id = w.get(fx, yy, fz);
      if (BLOCKS[id].solid || id === B.WATER) return id === B.WATER ? null : yy + 1;
    }
    return null;
  }

  spawn(type, x, z, lvl) {
    const w = this.world;
    if (!w.getChunk(Math.floor(x / CS), Math.floor(z / CS))) return null;
    const g = this.groundAt(x, CH - 2, z, CH);
    if (g === null) return null;
    const e = new Enemy(type, x, g, z, lvl);
    this.enemies.push(e); this.scene.add(e.group); return e;
  }

  removeEnemy(e) { this.scene.remove(e.group); this.enemies.splice(this.enemies.indexOf(e), 1); }

  update(dt, eye) {
    this.clock += dt;
    this.runTweens(dt);
    this.updatePops(dt);
    if (this.inBattle) { this.animateEnemies(dt); return; }
    const p = this.player.pos;
    if (this.enabled && (this.spawnTimer -= dt) <= 0) {
      this.spawnTimer = 5;
      if (this.enemies.length < 7) {
        const a = Math.random() * 6.28, r = 20 + Math.random() * 25;
        const lvl = Math.max(1, Math.min(this.s.lvl + rand(-1, 1), 1 + Math.floor(Math.hypot(p.x, p.z) / 120) + this.s.lvl));
        const type = ETYPES[rand(0, ETYPES.length - 1)];
        const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
        const lead = this.spawn(type, x, z, lvl);
        if (lead && Math.random() < 0.4) this.spawn(type, x + 1.5, z + 1, lvl);
      }
    }
    for (const e of [...this.enemies]) {
      const d = e.pos.distanceTo(p);
      if (d > 90 || !this.enabled) { this.removeEnemy(e); continue; }
      e.stun = Math.max(0, e.stun - dt);
      const chase = d < 11 && !e.stun;
      if (chase) e.yaw = Math.atan2(-(p.x - e.pos.x), -(p.z - e.pos.z));
      else if ((e.think -= dt) <= 0) { e.think = 1 + Math.random() * 3; e.walk = Math.random() < 0.6; e.yaw += (Math.random() - 0.5) * 3; }
      const sp = chase ? e.T.speed : e.walk ? e.T.speed * 0.4 : 0;
      const nx = e.pos.x - Math.sin(e.yaw) * sp * dt, nz = e.pos.z - Math.cos(e.yaw) * sp * dt;
      const g = this.groundAt(nx, e.pos.y + 1, nz);
      if (g !== null && g <= e.pos.y + 1.1) { e.pos.x = nx; e.pos.z = nz; e.pos.y += (g - e.pos.y) * Math.min(1, dt * 10); }
      else e.think = 0;
      // touching the player starts a battle; landing on top gives a first strike
      const dy = p.y - (e.pos.y + e.lift);
      if (Math.hypot(p.x - e.pos.x, p.z - e.pos.z) < 0.9 && dy > -1.6 && dy < 1.3 && !e.stun) {
        const stomp = this.player.vel.y < -1 && dy > 0.4;
        this.startBattle(e, stomp);
        return;
      }
    }
    this.animateEnemies(dt);
  }

  animateEnemies(dt) {
    for (const e of this.enemies) {
      e.t += dt;
      if (!this.inBattle) { e.group.position.copy(e.pos); e.group.rotation.y = e.yaw; }
      e.inner.position.y = e.lift + (e.T.fly ? Math.sin(e.t * 3) * 0.15 : Math.abs(Math.sin(e.t * 7)) * 0.08);
      e.feet?.forEach((f, i) => { f.position.z = -0.04 + Math.sin(e.t * 9 + i * Math.PI) * 0.08; });
      e.wings?.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * Math.sin(e.t * 40) * 0.6; });
    }
  }

  updatePops(dt) {
    const cam = this.camera, v = new THREE.Vector3();
    for (const pp of [...this.popups]) {
      pp.t += dt; pp.pos.y += dt * 1.2;
      v.copy(pp.pos).project(cam);
      const vis = v.z < 1;
      pp.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.3 - pp.t)})`;
      pp.el.style.opacity = vis ? Math.max(0, 1.4 - pp.t) : 0;
      if (pp.t > 1.4) { pp.el.remove(); this.popups.splice(this.popups.indexOf(pp), 1); }
    }
  }

  // ---- battle -----------------------------------------------------------------------------------------------
  bindBattleInput() {
    const press = () => { if (this.timing && !this.timing.result) this.timing.result = this.timing.t >= this.timing.a && this.timing.t <= this.timing.b ? 'good' : 'miss'; };
    this.press = press;
    $('battle').addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) press(); });
    document.addEventListener('keydown', (e) => {
      if (!this.inBattle) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); press(); }
      const map = { KeyA: 'attack', KeyX: 'special', KeyY: 'item', KeyB: 'defend', KeyR: 'run' };
      if (map[e.code] && this.menuResolve) this.menuResolve({ kind: map[e.code] });
    });
  }

  /** Runs a timing window of `dur` seconds; returns 'good' if pressed between a and b. */
  async timed(dur, a, b, target) {
    const ring = $('ring');
    this.timing = { t: 0, a, b, result: null };
    ring.hidden = false;
    await this.tween(dur, (k) => {
      this.timing.t = k * dur;
      const v = target.clone().project(this.camera);
      const size = 30 + Math.max(0, (b - k * dur)) * 260;
      ring.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%)`;
      ring.style.width = ring.style.height = `${size}px`;
      ring.classList.toggle('now', k * dur >= a && k * dur <= b);
    });
    ring.hidden = true;
    const r = this.timing.result === 'good' ? 'good' : 'miss';
    this.timing = null;
    return r;
  }

  startBattle(first, stomp) {
    this.inBattle = true;
    const p = this.player.pos;
    // gather up to 3 enemies nearby
    const foes = [first, ...this.enemies.filter((e) => e !== first && e.pos.distanceTo(first.pos) < 6)].slice(0, 3);
    this.foes = foes;
    const axis = new THREE.Vector3(first.pos.x - p.x, 0, first.pos.z - p.z);
    if (axis.lengthSq() < 0.01) axis.set(0, 0, -1);
    axis.normalize();
    const perp = new THREE.Vector3(-axis.z, 0, axis.x);
    const sun = this.getSun?.();
    if (sun && perp.x * sun.x + perp.z * sun.z < 0) perp.negate(); // keep the camera on the sunlit side
    const center = first.pos.clone();
    const gy = (x, z, fb) => this.groundAt(x, fb + 3, z) ?? fb;
    // hero stands 3.5 blocks in front of the enemy line
    const hx = center.x - axis.x * 3.5, hz = center.z - axis.z * 3.5;
    this.heroHome = new THREE.Vector3(hx, gy(hx, hz, center.y), hz);
    foes.forEach((e, i) => {
      const off = (i - (foes.length - 1) / 2) * 1.8;
      const ex = center.x + perp.x * off + axis.x * (i % 2) * 0.8, ez = center.z + perp.z * off + axis.z * (i % 2) * 0.8;
      e.home = new THREE.Vector3(ex, gy(ex, ez, center.y), ez);
      e.pos.copy(e.home); e.group.position.copy(e.home);
      e.group.rotation.y = Math.atan2(axis.x, axis.z); // face the hero
    });
    this.heroYaw = Math.atan2(-axis.x, -axis.z);
    this.hero = new Avatar(7, 'You');
    this.hero.tag.visible = false;
    this.hero.setState([this.heroHome.x, this.heroHome.y, this.heroHome.z], [this.heroYaw, 0]);
    this.hero.group.position.copy(this.heroHome);
    this.scene.add(this.hero.group);

    // isometric-ish battle camera
    const mid = this.heroHome.clone().lerp(center, 0.5);
    this.savedCam = { fov: this.camera.fov, pos: this.camera.position.clone(), rot: this.camera.rotation.clone() };
    this.camera.fov = 45; this.camera.updateProjectionMatrix();
    const far = innerWidth < innerHeight ? 1.7 : 1; // portrait screens need a wider shot
    const camPos = mid.clone().addScaledVector(perp, 8.5 * far).addScaledVector(axis, -2.5); camPos.y += 6 * far;
    const from = this.camera.position.clone();
    this.tween(0.6, (k) => { this.camera.position.lerpVectors(from, camPos, k * k * (3 - 2 * k)); this.camera.lookAt(mid.x, mid.y + 0.9, mid.z); });
    this.onBattle(true);
    $('battle').hidden = false;
    this.battleLoop(stomp).catch((e) => console.error(e));
  }

  heroTo(target, dur, arc = 0) {
    const from = this.hero.group.position.clone();
    return this.tween(dur, (k) => {
      const q = k * k * (3 - 2 * k);
      this.hero.group.position.lerpVectors(from, target, q);
      this.hero.group.position.y += Math.sin(k * Math.PI) * arc;
      this.hero.target.copy(this.hero.group.position);
    });
  }

  damage(e, amount, crit) {
    e.hp = Math.max(0, e.hp - amount);
    const at = e.group.position.clone(); at.y += 1.4 + e.lift;
    this.popText(String(amount), at, crit ? 'crit' : 'dmg');
    if (crit) this.popText('Nice!', at.clone().add(new THREE.Vector3(0, 0.6, 0)), 'nice');
    const g = e.inner; this.tween(0.25, (k) => { g.rotation.z = Math.sin(k * Math.PI * 4) * 0.3 * (1 - k); });
    this.renderFoes();
  }

  renderFoes() {
    $('b-foes').innerHTML = this.foes.map((e) => `<div class="foe ${e.hp ? '' : 'dead'}"><b>${e.T.name}</b> <small>Lv${e.lvl}</small>
      <span class="bar hp"><i style="width:${(e.hp / e.maxHp) * 100}%"></i></span></div>`).join('');
    const s = this.s;
    $('b-hero').innerHTML = `<b>You</b> Lv${s.lvl}<span class="bar hp"><i style="width:${(s.hp / s.maxHp) * 100}%"></i><b>❤ ${s.hp}/${s.maxHp}</b></span>
      <span class="bar fp"><i style="width:${(s.fp / s.maxFp) * 100}%"></i><b>✦ ${s.fp}/${s.maxFp}</b></span>`;
  }

  setMsg(t) { $('b-msg').textContent = t; }

  menu() {
    const s = this.s, m = $('b-menu');
    m.hidden = false;
    m.innerHTML = `
      <button class="dm y" data-k="item">🍄<span>Item</span></button>
      <button class="dm x" data-k="special">✨<span>Special</span></button>
      <button class="dm b" data-k="defend">🛡<span>Defend</span></button>
      <button class="dm a" data-k="attack">⚔️<span>Attack</span></button>
      <button class="run" data-k="run">🏃 Run</button>`;
    return new Promise((resolve) => {
      this.menuResolve = (v) => { this.menuResolve = null; m.hidden = true; resolve(v); };
      m.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => this.menuResolve?.({ kind: b.dataset.k })));
    });
  }

  choose(options) {
    const m = $('b-menu');
    m.hidden = false;
    m.innerHTML = `<div class="list">${options.map((o, i) => `<button data-i="${i}" ${o.disabled ? 'disabled' : ''}>${o.label}</button>`).join('')}<button data-i="-1">↩ Back</button></div>`;
    return new Promise((resolve) => {
      m.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { m.hidden = true; resolve(Number(b.dataset.i)); }));
    });
  }

  async pickTarget() {
    const alive = this.foes.filter((e) => e.hp > 0);
    if (alive.length === 1) return alive[0];
    const i = await this.choose(alive.map((e) => ({ label: `🎯 ${e.T.name} (${e.hp} HP)` })));
    return i < 0 ? null : alive[i];
  }

  async battleLoop(stomp) {
    const s = this.s;
    this.renderFoes();
    await this.wait(0.6);
    if (stomp) {
      this.setMsg('First Strike!');
      const e = this.foes[0], dmg = e.T.spiky ? 0 : Math.max(1, Math.round((s.atk - e.def) * 1.5));
      if (e.T.spiky) { this.hurtHero(3); this.setMsg('Ouch! Spikey is spiky!'); }
      else this.damage(e, dmg, true);
      await this.wait(0.8);
    }
    let result = null;
    while (!result) {
      // ---- hero turn
      if (this.foes.every((e) => e.hp <= 0)) { result = 'win'; break; }
      this.defending = false;
      this.setMsg(this.isMobile ? 'Your move! Tap at the right moment for bonus damage.' : 'Your move!  A attack · X special · Y item · B defend — press Space at the right moment!');
      const act = await this.menu();
      let acted = false;
      if (act.kind === 'attack') {
        const t = await this.pickTarget(); if (!t) continue;
        await this.attack(t); acted = true;
      } else if (act.kind === 'special') {
        const i = await this.choose([
          { label: `🦘 Super Jump — 3 FP (combo!)`, disabled: s.fp < 3 },
          { label: `🔥 Fire Burst — 4 FP (all foes)`, disabled: s.fp < 4 },
        ]);
        if (i === 0) { const t = await this.pickTarget(); if (!t) continue; s.fp -= 3; await this.superJump(t); acted = true; }
        else if (i === 1) { s.fp -= 4; await this.fireBurst(); acted = true; }
        else continue;
      } else if (act.kind === 'item') {
        const keys = Object.keys(ITEMS);
        const i = await this.choose(keys.map((k) => ({ label: `${ITEMS[k].icon} ${ITEMS[k].name} ×${s.items[k]} — ${ITEMS[k].desc}`, disabled: !s.items[k] })));
        if (i < 0) continue;
        const k = keys[i]; s.items[k]--;
        const at = this.hero.group.position.clone(); at.y += 2.2;
        if (k === 'mushroom') { const h = Math.min(25, s.maxHp - s.hp); s.hp += h; this.popText(`+${h} HP`, at, 'heal'); }
        else { const f = Math.min(10, s.maxFp - s.fp); s.fp += f; this.popText(`+${f} FP`, at, 'heal'); }
        await this.heroTo(this.heroHome.clone(), 0.4, 0.8); acted = true;
      } else if (act.kind === 'defend') {
        this.defending = true; this.setMsg('Defending — incoming damage halved.'); await this.wait(0.5); acted = true;
      } else if (act.kind === 'run') {
        if (Math.random() < 0.65) { this.setMsg('Got away safely!'); await this.heroTo(this.heroHome.clone().add(new THREE.Vector3(0, 0, 0)), 0.3, 0.6); result = 'run'; break; }
        this.setMsg("Couldn't escape!"); await this.wait(0.8); acted = true;
      }
      this.renderHud(); this.renderFoes();
      if (!acted) continue;
      if (this.foes.every((e) => e.hp <= 0)) { result = 'win'; break; }

      // ---- enemy turns
      for (const e of this.foes) {
        if (e.hp <= 0) continue;
        await this.enemyAttack(e);
        if (s.hp <= 0) { result = 'lose'; break; }
      }
    }
    await this.endBattle(result);
  }

  async attack(e) {
    const s = this.s, home = this.heroHome.clone();
    this.setMsg('Press when the ring turns gold!');
    const front = e.group.position.clone().lerp(home, 1.1 / home.distanceTo(e.group.position));
    await this.heroTo(front, 0.45);
    const hitAt = e.group.position.clone(); hitAt.y += 0.8 + e.lift;
    const swing = this.timed(0.7, 0.42, 0.62, hitAt);
    this.tween(0.5, (k) => { this.hero.armR.rotation.x = -Math.sin(k * Math.PI) * 2.2; });
    const r = await swing;
    const base = Math.max(1, s.atk - e.def + rand(-1, 1));
    this.damage(e, r === 'good' ? base * 2 : base, r === 'good');
    await this.wait(0.3);
    await this.defeatCheck(e);
    await this.heroTo(home, 0.45);
  }

  async superJump(e) {
    const s = this.s, home = this.heroHome.clone();
    this.setMsg('Super Jump! Keep timing each landing to chain hits!');
    const top = e.group.position.clone(); top.y += 1.1 + e.lift;
    await this.heroTo(top, 0.6, 3);
    let hits = 0;
    while (e.hp > 0 && hits < 8) {
      const r = await this.timed(0.55, 0.32, 0.5, top);
      const up = top.clone(); up.y += 2.2;
      await this.heroTo(up, 0.001);
      const dmg = Math.max(1, s.mag + 1 - Math.floor(e.def / 2) + hits);
      this.damage(e, dmg, r === 'good' && hits > 0);
      hits++;
      if (r !== 'good') break;
      this.popText(`${hits} hit${hits > 1 ? 's' : ''}!`, top.clone().add(new THREE.Vector3(0, 1.4, 0)), 'nice');
      this.heroTo(top, 0.5, 1.5);
    }
    await this.wait(0.5);
    await this.heroTo(home, 0.6, 2.5);
    await this.defeatCheck(e);
  }

  async fireBurst() {
    const s = this.s;
    this.setMsg('Fire Burst! Press at the flash for extra power!');
    const center = this.foes[0].group.position.clone(); center.y += 1;
    const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.8 }));
    const from = this.hero.group.position.clone(); from.y += 1.2;
    fire.position.copy(from); this.scene.add(fire);
    const timing = this.timed(0.8, 0.5, 0.7, center);
    await this.tween(0.8, (k) => { fire.position.lerpVectors(from, center, k); fire.scale.setScalar(0.3 + k * 1.6); });
    const r = await timing;
    this.scene.remove(fire); fire.geometry.dispose();
    for (const e of this.foes) if (e.hp > 0) {
      const d = Math.max(1, Math.round((s.mag + 2) * (r === 'good' ? 1.6 : 1)) - Math.floor(e.def / 2));
      this.damage(e, d, r === 'good');
      this.burst(e.group.position.x - 0.5, e.group.position.y, e.group.position.z - 0.5, B.FLOWER);
    }
    await this.wait(0.5);
    for (const e of this.foes) await this.defeatCheck(e);
  }

  async defeatCheck(e) {
    if (e.hp > 0 || e.dying) return;
    e.dying = true;
    const g = e.group, y0 = g.position.y;
    await this.tween(0.5, (k) => { g.rotation.y += 0.4; g.position.y = y0 + k * 1.5; g.scale.setScalar(1 - k); });
    g.visible = false;
  }

  async enemyAttack(e) {
    const s = this.s, home = e.home.clone(), heroPos = this.hero.group.position.clone();
    this.setMsg(`${e.T.name} attacks! Press to guard as it hits!`);
    const near = heroPos.clone().lerp(home, 0.25);
    const g = e.group;
    await this.tween(0.35, (k) => { g.position.lerpVectors(home, home.clone().lerp(near, 0.3), k); });
    const hitAt = heroPos.clone(); hitAt.y += 1;
    const guard = this.timed(0.6, 0.38, 0.56, hitAt);
    const from = g.position.clone();
    await this.tween(0.5, (k) => { g.position.lerpVectors(from, near, k * k); g.position.y += Math.sin(k * Math.PI) * 1.2; });
    const r = await guard;
    let dmg = Math.max(1, e.atk - s.def + rand(-1, 1));
    if (r === 'good') { dmg = Math.floor(dmg / 2); this.popText('Guard!', hitAt.clone().add(new THREE.Vector3(0, 0.8, 0)), 'nice'); }
    if (this.defending) dmg = Math.floor(dmg / 2);
    this.hurtHero(dmg);
    const back = g.position.clone();
    await this.tween(0.4, (k) => { g.position.lerpVectors(back, home, k); g.position.y += Math.sin(k * Math.PI) * 0.8; });
  }

  hurtHero(dmg) {
    const s = this.s;
    s.hp = Math.max(0, s.hp - dmg);
    const at = this.hero.group.position.clone(); at.y += 2.2;
    this.popText(dmg ? String(dmg) : 'Miss', at, 'hurt');
    const h = this.hero.group;
    this.tween(0.3, (k) => { h.rotation.z = Math.sin(k * Math.PI * 3) * 0.2 * (1 - k); });
    this.renderHud(); this.renderFoes();
  }

  async endBattle(result) {
    const s = this.s;
    let msg = '';
    if (result === 'win') {
      const xp = this.foes.reduce((a, e) => a + e.T.xp * e.lvl, 0);
      const coins = this.foes.reduce((a, e) => a + rand(...e.T.coins) * e.lvl, 0);
      s.xp += xp; s.coins += coins;
      this.coinFountain(this.foes[0].home.clone().add(new THREE.Vector3(0, 1, 0)), coins);
      msg = `Victory! +${xp} XP, +${coins} coins`;
      while (s.xp >= xpNeeded(s.lvl)) {
        s.xp -= xpNeeded(s.lvl); s.lvl++;
        s.maxHp += 5; s.maxFp += 2; s.atk += 2; s.def += 1; s.mag += 2;
        s.hp = s.maxHp; s.fp = s.maxFp;
        msg += ` · LEVEL UP! Lv ${s.lvl}`;
        this.popText(`LEVEL UP! Lv ${s.lvl}`, this.hero.group.position.clone().add(new THREE.Vector3(0, 2.6, 0)), 'lvl');
      }
      for (const e of this.foes) this.removeEnemy(e);
    } else if (result === 'lose') {
      const lost = Math.floor(s.coins / 2);
      s.coins -= lost; s.hp = s.maxHp; s.fp = s.maxFp;
      msg = `You were defeated… lost ${lost} coins.`;
      for (const e of this.foes) { e.stun = 5; e.hp = e.maxHp; }
    } else {
      for (const e of this.foes) e.stun = 4;
    }
    this.setMsg(msg || 'Escaped!');
    this.renderHud(); this.renderFoes();
    await this.wait(result === 'win' ? 1.6 : 0.9);
    this.scene.remove(this.hero.group); this.hero.dispose();
    $('battle').hidden = true;
    this.camera.fov = this.savedCam.fov; this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.savedCam.pos); this.camera.rotation.copy(this.savedCam.rot);
    this.inBattle = false;
    this.chat('', msg || 'Escaped!');
    this.onBattle(false, result);
  }

  update3DHero(dt) { if (this.inBattle && this.hero) { this.hero.yaw = this.heroYaw; this.hero.update(dt); } }
}
