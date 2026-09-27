// Voxelia's RPG layer. Battles happen *in* the voxel world: the terrain around a fight becomes part of your
// options, and what you learn in battle (Echoes) becomes how you move through the world.
import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { B, BLOCKS, CS, CH, SEA } from './blocks.js';
import { sitesNear } from './landmarks.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---- models (face -z) -----------------------------------------------------------------------------------------
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
function cone(g, r, h, c, x, y, z, o) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat(c, o)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
}
function eyes(g, y, z, spread = 0.12) {
  for (const s of [-1, 1]) {
    box(g, 0.12, 0.18, 0.03, 0xffffff, s * spread, y, z);
    box(g, 0.06, 0.1, 0.03, 0x111111, s * spread, y - 0.02, z - 0.01);
    const b = box(g, 0.16, 0.04, 0.03, 0x2b1606, s * spread, y + 0.13, z - 0.01); b.rotation.z = s * 0.35;
  }
}
function shroom(g, capColor, spotColor, glow) {
  const o = glow ? { emissive: capColor, emissiveIntensity: 0.5 } : {};
  box(g, 0.9, 0.42, 0.9, capColor, 0, 0.78, 0, o);
  box(g, 0.7, 0.14, 0.7, capColor, 0, 1.02, 0, o);
  for (const [x, z] of [[-0.25, -0.2], [0.28, 0.1], [-0.05, 0.3]]) box(g, 0.2, 0.05, 0.2, spotColor, x, 1.1, z, glow ? { emissive: spotColor, emissiveIntensity: 1.2 } : {});
  box(g, 0.56, 0.42, 0.5, 0xf2d3a5, 0, 0.42, 0);
  eyes(g, 0.5, -0.26);
  return { feet: [-1, 1].map((s) => box(g, 0.24, 0.14, 0.34, 0x3a1e0c, s * 0.16, 0.07, -0.04)) };
}

// moves: what each enemy does, in order (loops). hits: [power multiplier, windup seconds]
const MOVES = {
  bonk: { name: 'Headbonk', hits: [[1, 0.5]] },
  puff: { name: 'Spore Puff', hits: [[0.6, 0.45], [0.6, 0.35]] },
  roll: { name: 'Shell Roll', hits: [[1.1, 0.55]] },
  curl: { name: 'Curl Up', curl: true },
  sting2: { name: 'Double Sting', hits: [[0.6, 0.3], [0.6, 0.25]] },
  dive: { name: 'Dive Bomb', hits: [[1.4, 0.65]] },
  pinch: { name: 'Pinch', hits: [[0.9, 0.45]] },
  windup: { name: 'Charging…', charge: true },
  spike: { name: 'Crystal Spike', hits: [[2.2, 0.8]] },
  storm: { name: 'Spore Storm', hits: [[0.6, 0.45], [0.6, 0.32], [0.6, 0.28]] },
  summon: { name: 'Call the Grove', summon: true },
  stomp: { name: 'Earthshaker', hits: [[1.6, 0.75]] },
};

const ENEMIES = {
  shroomba: { name: 'Shroomba', hp: 12, atk: 5, def: 1, xp: 4, coins: [2, 5], speed: 2.4, moves: ['bonk', 'bonk', 'puff'], echo: 'slam', build: (g) => shroom(g, 0x8a4b22, 0xf2e6d0) },
  glowshroom: { name: 'Glowshroom', hp: 16, atk: 7, def: 2, xp: 7, coins: [3, 8], speed: 2.8, moves: ['puff', 'bonk', 'puff'], echo: 'slam', drop: ['spore', 0.5], build: (g) => shroom(g, 0x5a2a7a, 0x66fff0, true) },
  spikey: {
    name: 'Spikey', hp: 18, atk: 7, def: 4, xp: 7, coins: [3, 7], speed: 1.6, spiky: true, moves: ['roll', 'curl', 'roll'], echo: 'dash',
    build(g) {
      box(g, 0.8, 0.5, 0.9, 0xd8322b, 0, 0.5, 0.05);
      for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [0, 0.05], [-0.22, 0.3], [0.22, 0.3]]) cone(g, 0.1, 0.28, 0xf4f1e6, x, 0.88, z);
      box(g, 0.44, 0.34, 0.2, 0xf6c86a, 0, 0.42, -0.45);
      eyes(g, 0.46, -0.56, 0.09);
      return { feet: [-1, 1].map((s) => box(g, 0.2, 0.14, 0.26, 0xf6c86a, s * 0.24, 0.07, -0.1)) };
    },
  },
  buzzbee: {
    name: 'Buzzbee', hp: 10, atk: 6, def: 0, xp: 5, coins: [2, 6], speed: 3.2, fly: true, moves: ['sting2', 'sting2', 'dive'], echo: 'hover',
    build(g) {
      box(g, 0.5, 0.46, 0.66, 0xf5c518, 0, 0, 0);
      box(g, 0.52, 0.48, 0.1, 0x1b1b1b, 0, 0, 0.06); box(g, 0.52, 0.48, 0.1, 0x1b1b1b, 0, 0, 0.25);
      const st = cone(g, 0.07, 0.22, 0x222222, 0, 0, 0.42); st.rotation.x = Math.PI / 2;
      eyes(g, 0.06, -0.34, 0.1);
      const wings = [-1, 1].map((s) => {
        const p = new THREE.Group(); p.position.set(s * 0.22, 0.25, 0.05); g.add(p);
        box(p, 0.5, 0.03, 0.3, 0xdff4ff, s * 0.25, 0, 0, { transparent: true, opacity: 0.6 });
        return p;
      });
      return { wings, lift: 1.1 };
    },
  },
  gemmite: {
    name: 'Gem Mite', hp: 14, atk: 6, def: 6, xp: 8, coins: [4, 9], speed: 3, moves: ['pinch', 'windup', 'spike'], echo: 'sense', drop: ['shard', 0.7], weakSlam: true,
    build(g) {
      const glow = { emissive: 0x8a4dff, emissiveIntensity: 0.6 };
      box(g, 0.7, 0.32, 0.6, 0x5b3f8f, 0, 0.3, 0);
      for (const [x, z, h] of [[-0.18, 0, 0.4], [0.15, 0.12, 0.3], [0.05, -0.15, 0.35]]) cone(g, 0.09, h, 0xc9a6ff, x, 0.5 + h / 2, z, glow);
      for (const s of [-1, 1]) { const c = box(g, 0.18, 0.12, 0.26, 0x7d5cc2, s * 0.32, 0.3, -0.38); c.rotation.y = s * 0.4; }
      eyes(g, 0.4, -0.31, 0.1);
      return { feet: [-1, 1, -1, 1].map((s, i) => box(g, 0.08, 0.2, 0.08, 0x3b2766, s * 0.3, 0.1, i < 2 ? -0.15 : 0.15)) };
    },
  },
  mycelord: {
    name: 'The Mycelord', hp: 90, atk: 8, def: 2, xp: 40, coins: [20, 30], speed: 0, boss: true, radius: 2.4, moves: ['storm', 'stomp', 'summon'],
    build(g) {
      const inner = new THREE.Group(); inner.scale.setScalar(3.2); g.add(inner);
      const r = shroom(inner, 0x4a1d6a, 0x66fff0, true);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; cone(inner, 0.07, 0.3, 0xffd23a, Math.cos(a) * 0.28, 1.28, Math.sin(a) * 0.28, { metalness: 0.8, roughness: 0.3, emissive: 0x6a4300 }); }
      return r;
    },
  },
};
const ECHOES = {
  hover: { icon: '🪽', name: 'Hover', from: 'Buzzbee', how: 'Press jump again in mid-air to double jump. Hold jump while falling to glide.', battle: 'Guard windows are wider.' },
  dash: { icon: '💨', name: 'Shell Dash', from: 'Spikey', how: 'E / 💨 — dash forward, smashing dirt, sand, leaves and cracked ruins. Ram an enemy for a First Strike.', battle: 'Shell Dash (3 FP): hits every grounded foe, ignores defense.' },
  slam: { icon: '💥', name: 'Spore Slam', from: 'Shroomba', how: 'Q / 💥 in mid-air — slam down. Cracks geodes and ruins; slam onto a mushroom cap for a huge bounce.', battle: 'Spore Slam (4 FP): heavy hit that stuns. Crushes Gem Mites.' },
  sense: { icon: '👁', name: 'Echo Sense', from: 'Gem Mite', how: 'V / 👁 — the ground turns transparent around you for a few seconds, revealing ores, crystals and vaults.', battle: "You can read every enemy's next move." },
};
export const RELICS = {
  timing: { icon: '⏱', name: 'Metronome Charm', desc: 'Timing windows are 40% wider.' },
  clover: { icon: '🍀', name: 'Lucky Clover', desc: '? blocks are far more generous.' },
  ember: { icon: '🔥', name: 'Ember Ring', desc: 'Fire Burst costs 2 FP and burns hotter.' },
  spring: { icon: '🌀', name: 'Spring Boots', desc: 'You jump 25% higher.' },
  magnet: { icon: '🧲', name: 'Coin Magnet', desc: '+50% coins from battles.' },
  lantern: { icon: '🏮', name: "Miner's Lantern", desc: 'Grants Echo Sense, and it lasts twice as long.' },
  shell: { icon: '🐚', name: 'Spiked Shell', desc: 'Shell Dash smashes stone and ore too.' },
  feather: { icon: '🪶', name: 'Feather Charm', desc: 'Glide even without Hover.' },
  clouds: { icon: '☁️', name: 'Cloud Boots', desc: 'One extra jump in mid-air.' },
  starshard: { icon: '🌟', name: 'Star Shard', desc: '+6 max FP and +4 max HP.' },
};
const VAULT_POOL = ['timing', 'clover', 'ember', 'spring', 'magnet', 'lantern', 'shell'];
const SKY_POOL = ['clouds', 'starshard'];
const ITEMS = {
  mushroom: { icon: '🍄', name: 'Mushroom', desc: '+25 HP' },
  syrup: { icon: '🍯', name: 'Honey Syrup', desc: '+10 FP' },
  shard: { icon: '🔮', name: 'Crystal Shard', desc: '18 damage, ignores defense' },
  spore: { icon: '🌫', name: 'Glow Spore', desc: 'Puts every foe to sleep' },
};
const ORE_VALUE = { [B.COAL_ORE]: 6, [B.IRON_ORE]: 10, [B.GOLD_ORE]: 15, [B.DIAMOND_ORE]: 28, [B.CRYSTAL]: 18 };

class Enemy {
  constructor(type, x, y, z, lvl, elite = false) {
    const T = ENEMIES[type];
    this.type = type; this.T = T; this.lvl = lvl; this.elite = elite;
    const k = elite ? 1.6 : 1;
    this.maxHp = Math.round(T.hp * (1 + 0.35 * (lvl - 1)) * k); this.hp = this.maxHp;
    this.atk = Math.round((T.atk + (lvl - 1) * 2) * (elite ? 1.3 : 1)); this.def = T.def + (lvl - 1);
    this.name = (elite ? 'Golden ' : '') + T.name;
    this.group = new THREE.Group();
    this.inner = new THREE.Group(); this.group.add(this.inner);
    Object.assign(this, T.build(this.inner));
    if (elite) this.inner.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0x7a5200); o.material.metalness = 0.6; } });
    this.lift = this.lift || 0;
    this.pos = V(x, y, z); this.yaw = Math.random() * 6.28; this.t = Math.random() * 10; this.think = 0; this.stun = 0;
    this.moveIdx = 0; this.skip = 0; this.blind = 0; this.curled = 0; this.charged = false;
    this.group.position.copy(this.pos);
  }
  get nextMove() { return this.T.moves[this.moveIdx % this.T.moves.length]; }
}

// ---- player stats --------------------------------------------------------------------------------------------
const FRESH = {
  lvl: 1, xp: 0, hp: 20, maxHp: 20, fp: 10, maxFp: 10, atk: 6, def: 2, mag: 5, coins: 0,
  items: { mushroom: 2, syrup: 1, shard: 0, spore: 0 }, kills: {}, echoes: {}, relics: [], bosses: [], home: null, crown: false, blessed: 0,
};
const xpNeeded = (lvl) => 10 + (lvl - 1) * 14;

export class Rpg {
  constructor({ scene, camera, world, player, controls, burst, chat, onBattle, isMobile, getSun, hooks }) {
    Object.assign(this, { scene, camera, world, player, controls, burst, chat, onBattle, isMobile, getSun, hooks });
    this.enemies = []; this.spawnTimer = 3; this.enabled = true; this.star = 0; this.warned = new WeakSet();
    this.inBattle = false; this.tweens = []; this.clock = 0;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('vx-rpg')); } catch { /* ignore */ }
    const f = structuredClone(FRESH);
    this.s = saved && saved.lvl ? { ...f, ...saved, items: { ...f.items, ...saved.items }, kills: { ...saved.kills }, echoes: { ...saved.echoes }, relics: saved.relics ?? [], bosses: saved.bosses ?? [] } : f;
    this.coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 20);
    this.coinMat = new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: 0.8, roughness: 0.25, emissive: 0x6a4300 });
    this.popups = [];
    this.bindBattleInput();
    this.renderHud();
  }

  has(relic) { return this.s.relics.includes(relic); }
  echo(k) { return !!this.s.echoes[k] || (k === 'sense' && this.has('lantern')); }
  save() { try { localStorage.setItem('vx-rpg', JSON.stringify(this.s)); } catch { /* ignore */ } }

  renderHud() {
    const s = this.s;
    const echoes = Object.keys(ECHOES).filter((k) => this.echo(k)).map((k) => ECHOES[k].icon).join('');
    $('rpg-hud').innerHTML = `<span class="lv">Lv ${s.lvl}</span>
      <span class="bar hp"><i style="width:${(s.hp / s.maxHp) * 100}%"></i><b>❤ ${s.hp}/${s.maxHp}</b></span>
      <span class="bar fp"><i style="width:${(s.fp / s.maxFp) * 100}%"></i><b>✦ ${s.fp}/${s.maxFp}</b></span>
      <span>🪙 ${s.coins}</span><span>🍄${s.items.mushroom} 🍯${s.items.syrup}${s.items.shard ? ' 🔮' + s.items.shard : ''}${s.items.spore ? ' 🌫' + s.items.spore : ''}</span>
      ${echoes ? `<span class="echoes" title="Echoes">${echoes}</span>` : ''}${s.crown ? '<span title="Spore Crown">👑</span>' : ''}
      <span class="xp"><i style="width:${(s.xp / xpNeeded(s.lvl)) * 100}%"></i></span>`;
    this.hooks.onEchoes?.(this);
    this.save();
  }

  // ---- floating text, banners, coins -------------------------------------------------------------------------
  popText(text, pos, cls = '') {
    const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text;
    $('pops').appendChild(el);
    this.popups.push({ el, pos: pos.clone(), t: 0 });
  }
  banner(title, body, icon = '✨') {
    const el = $('banner');
    el.innerHTML = `<div class="bn-icon">${icon}</div><div><b>${title}</b><p>${body}</p></div>`;
    el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.bannerT); this.bannerT = setTimeout(() => { el.hidden = true; }, 6500);
  }
  coinFountain(pos, n) {
    for (let i = 0; i < Math.min(n, 8); i++) {
      const m = new THREE.Mesh(this.coinGeo, this.coinMat); m.rotation.x = Math.PI / 2;
      m.position.copy(pos); this.scene.add(m);
      const v = V((Math.random() - 0.5) * 3, 6 + Math.random() * 3, (Math.random() - 0.5) * 3);
      this.tween(0.9, (k, dt) => { v.y -= 18 * dt; m.position.addScaledVector(v, dt); m.rotation.z += dt * 14; m.scale.setScalar(1 - k * k); })
        .then(() => this.scene.remove(m));
    }
  }

  // ---- world interactions --------------------------------------------------------------------------------------
  /** Punching a ? block. Returns the block that replaces it. */
  openQBlock(x, y, z) {
    const s = this.s, p = V(x + 0.5, y + 1.2, z + 0.5), lucky = this.has('clover');
    const r = Math.random(); // the clover doubles coins and makes ambushes rarer
    if (r < 0.45) { const c = rand(3, 10) * (lucky ? 2 : 1); s.coins += c; this.coinFountain(p, c); this.popText(`+${c} 🪙`, p, 'coin'); }
    else if (r < 0.56) { s.items.mushroom++; this.popText('🍄 Mushroom!', p, 'item'); }
    else if (r < 0.63) { s.items.syrup++; this.popText('🍯 Honey Syrup!', p, 'item'); }
    else if (r < 0.69) { s.items.shard++; this.popText('🔮 Crystal Shard!', p, 'item'); }
    else if (r < (lucky ? 0.7 : 0.77)) {
      this.popText("It's an ambush!", p, 'hurt');
      const pp = this.player.pos, e = this.spawn(this.ecologyType(pp.x, pp.z, false), pp.x + 1.2, pp.z + 1.2, this.levelAt(pp.x, pp.z), pp.y + 2);
      if (e && this.enabled) setTimeout(() => !this.inBattle && this.startBattle(e, false), 300);
    } else if (r < 0.85) { this.startStar(); this.popText('★ STARMAN ★', p, 'lvl'); }
    else if (r < 0.93) { this.popText('A beanstalk!', p, 'nice'); this.hooks.beanstalk(x, y, z); }
    else { s.items.spore++; this.popText('🌫 Glow Spore!', p, 'item'); }
    this.renderHud();
    return B.USED;
  }

  startStar() { this.star = 12; document.body.classList.add('starman'); }

  openVault(x, y, z) {
    const sky = y > 80, s = this.s, p = V(x + 0.5, y + 1.5, z + 0.5);
    const pool = (sky ? [...SKY_POOL, ...VAULT_POOL] : VAULT_POOL).filter((r) => !this.has(r));
    const seed = Math.abs(Math.imul(x, 73856093) ^ Math.imul(z, 19349663)) % 1000;
    const relic = sky && pool.some((r) => SKY_POOL.includes(r)) ? pool.find((r) => SKY_POOL.includes(r)) : pool[seed % Math.max(1, pool.length)];
    this.coinFountain(p, 8);
    if (relic) {
      s.relics.push(relic);
      if (relic === 'starshard') { s.maxFp += 6; s.maxHp += 4; s.fp = s.maxFp; s.hp = s.maxHp; }
      const R = RELICS[relic];
      this.banner(`Relic found: ${R.name}`, R.desc, R.icon);
    } else {
      s.coins += 40; s.items.shard += 1;
      this.banner('The vault holds old coins', 'You already carry every relic this vault could offer. +40 coins, +1 Crystal Shard.', '🏛');
    }
    this.renderHud();
    return B.USED;
  }

  rest() {
    const s = this.s; s.hp = s.maxHp; s.fp = s.maxFp; this.renderHud();
    this.banner('Rested at home', 'HP and FP restored. Your beacon will bring you back here if you fall.', '🏠');
  }

  setHome(x, y, z) { this.s.homeBlock = [x, y, z]; this.s.home = [x + 0.5, y + 1, z + 0.5]; this.renderHud(); this.chat('', '🏠 Home set. Rest at the beacon to heal; you will return here if defeated.'); }

  /** Mining something rare can attract attention. */
  onMined(id, x, y, z) {
    if (id === B.CRYSTAL) { this.s.items.shard++; this.popText('+1 🔮', V(x + 0.5, y + 1, z + 0.5), 'item'); this.renderHud(); }
    if ((id === B.CRYSTAL || id === B.DIAMOND_ORE) && this.enabled && Math.random() < 0.35) {
      const a = Math.random() * 6.28;
      const e = this.spawn('gemmite', x + Math.cos(a) * 4, z + Math.sin(a) * 4, this.levelAt(x, z) + 1, y + 3);
      if (e) this.chat('', 'Something skitters in the dark, drawn by the glitter…');
    }
  }

  // ---- tweens (driven by update so battles pause cleanly) ------------------------------------------------------
  tween(dur, fn) { return new Promise((resolve) => this.tweens.push({ t: 0, dur, fn, resolve })); }
  wait(s) { return this.tween(s, () => {}); }
  runTweens(dt) {
    for (const tw of [...this.tweens]) {
      tw.t += dt; const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k, dt);
      if (k >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.resolve(); }
    }
  }

  // ---- world enemies & ecology -----------------------------------------------------------------------------------
  groundAt(x, y, z, depth = 8) {
    const w = this.world, fx = Math.floor(x), fz = Math.floor(z);
    for (let yy = Math.min(CH - 1, Math.floor(y) + 1); yy > Math.floor(y) - depth && yy > 0; yy--) {
      const id = w.get(fx, yy, fz);
      if (BLOCKS[id].solid || id === B.WATER) return id === B.WATER ? null : yy + 1;
    }
    return null;
  }

  levelAt(x, z) {
    const tier = Math.floor(Math.hypot(x, z) / 180);
    return Math.max(1, Math.min(this.s.lvl + rand(-1, 1), this.s.lvl + tier) + (tier >= 3 ? rand(0, 2) : 0));
  }

  pacified(x, z) { return sitesNear(this.world, 'boss', x, z, 110).some((st) => this.s.bosses.includes(st.id)); }

  /** What lives here? Biome, depth and time decide. */
  ecologyType(x, z, underground) {
    const night = this.hooks.isNight();
    if (underground) return Math.random() < 0.7 ? 'gemmite' : night ? 'glowshroom' : 'shroomba';
    const { biome } = this.world.column(Math.floor(x), Math.floor(z));
    const shroomT = night ? 'glowshroom' : 'shroomba';
    if (biome === 'grove') return this.pacified(x, z) ? null : Math.random() < 0.8 ? shroomT : 'buzzbee';
    if (biome === 'desert' || biome === 'beach' || biome === 'snow') return Math.random() < 0.8 ? 'spikey' : night ? 'glowshroom' : 'buzzbee';
    const r = Math.random();
    if (!night && r < 0.4) return 'buzzbee';
    return r < 0.78 ? shroomT : 'spikey';
  }

  spawn(type, x, z, lvl, yHint, elite = false) {
    const w = this.world;
    if (!type || !w.getChunk(Math.floor(x / CS), Math.floor(z / CS))) return null;
    const g = yHint !== undefined ? this.groundAt(x, yHint, z, 16) : this.groundAt(x, CH - 2, z, CH);
    if (g === null) return null;
    const e = new Enemy(type, x, g, z, lvl, elite);
    this.enemies.push(e); this.scene.add(e.group); return e;
  }

  removeEnemy(e) { this.scene.remove(e.group); const i = this.enemies.indexOf(e); if (i >= 0) this.enemies.splice(i, 1); }

  underground(p) {
    const { h } = this.world.column(Math.floor(p.x), Math.floor(p.z));
    if (p.y > h - 5) return false;
    for (let y = Math.floor(p.y) + 2; y < Math.floor(p.y) + 12; y++) if (this.world.isSolid(Math.floor(p.x), y, Math.floor(p.z))) return true;
    return false;
  }

  trySpawn(p) {
    const ug = this.underground(p);
    const a = Math.random() * 6.28, r = ug ? 7 + Math.random() * 8 : 20 + Math.random() * 25;
    const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
    const type = this.ecologyType(x, z, ug);
    if (!type) return;
    const lvl = this.levelAt(x, z), far = Math.hypot(x, z) > 450;
    const elite = far && Math.random() < 0.2;
    const lead = this.spawn(type, x, z, elite ? lvl + 2 : lvl, ug ? p.y + 3 : undefined, elite);
    if (lead && !ug && Math.random() < 0.4) this.spawn(type, x + 1.5, z + 1, lvl);
  }

  /** Sleeping bosses live under their giant glowcaps. */
  updateBoss(p) {
    const st = sitesNear(this.world, 'boss', p.x, p.z, 60).find((b) => !this.s.bosses.includes(b.id));
    if (!st) return;
    let boss = this.enemies.find((e) => e.site === st);
    const lvl = 6 + Math.floor(Math.hypot(st.x, st.z) / 300);
    if (!boss) {
      boss = this.spawn('mycelord', st.x + 0.5, st.z + 6.5, lvl, st.y + 4); // search from below the cap, not from the sky
      if (!boss) return;
      boss.maxHp = boss.hp = 90 + lvl * 22; boss.def = 2 + Math.floor(lvl / 3); boss.atk = 6 + lvl;
      boss.site = st; boss.asleep = true; boss.yaw = 0;
    }
    const d = Math.hypot(p.x - boss.pos.x, p.z - boss.pos.z);
    if (d < 28 && !this.warned.has(boss)) {
      this.warned.add(boss);
      this.chat('', lvl > this.s.lvl + 2
        ? `👑 Something enormous sleeps beneath the glowcap. (Lv ${lvl}) You feel very small… maybe come back stronger.`
        : `👑 The Mycelord slumbers beneath its glowcap (Lv ${lvl}). Punch it to wake it — if you dare.`);
    }
    if (boss.asleep && Math.random() < 0.02) this.popText('Z z z', boss.pos.clone().add(V(0, 5.5, 0)), 'item');
  }

  update(dt) {
    this.clock += dt;
    this.runTweens(dt);
    this.updatePops(dt);
    if (this.star > 0 && (this.star -= dt) <= 0) document.body.classList.remove('starman');
    if (this.inBattle) { this.animateEnemies(dt); return; }
    const p = this.player.pos;
    if (this.enabled && (this.spawnTimer -= dt) <= 0) {
      this.spawnTimer = 4;
      if (this.enemies.filter((e) => !e.T.boss).length < 7) this.trySpawn(p);
      this.updateBoss(p);
    }
    for (const e of [...this.enemies]) {
      const d = e.pos.distanceTo(p);
      if (d > 100 || !this.enabled) { this.removeEnemy(e); continue; }
      e.stun = Math.max(0, e.stun - dt);
      const scared = this.s.lvl >= e.lvl + 5 && !e.elite && !e.T.boss;
      if (!e.asleep) {
        const chase = d < 11 && !e.stun;
        if (chase) e.yaw = Math.atan2(-(p.x - e.pos.x), -(p.z - e.pos.z)) + (scared || this.star > 0 ? Math.PI : 0);
        else if ((e.think -= dt) <= 0) { e.think = 1 + Math.random() * 3; e.walk = Math.random() < 0.6; e.yaw += (Math.random() - 0.5) * 3; }
        const sp = chase ? e.T.speed * (scared ? 1.3 : 1) : e.walk ? e.T.speed * 0.4 : 0;
        const nx = e.pos.x - Math.sin(e.yaw) * sp * dt, nz = e.pos.z - Math.cos(e.yaw) * sp * dt;
        const g = this.groundAt(nx, e.pos.y + 1, nz);
        if (g !== null && g <= e.pos.y + 1.1) { e.pos.x = nx; e.pos.z = nz; e.pos.y += (g - e.pos.y) * Math.min(1, dt * 10); }
        else e.think = 0;
        if (d < 12 && e.lvl >= this.s.lvl + 3 && !this.warned.has(e)) { this.warned.add(e); this.chat('', `⚠ A Lv ${e.lvl} ${e.name}. That looks dangerous.`); }
      }
      const R = e.T.radius || 0.9, dy = p.y - (e.pos.y + e.lift);
      if (Math.hypot(p.x - e.pos.x, p.z - e.pos.z) < R && dy > -1.6 && dy < (e.T.boss ? 5 : 1.3) && !e.stun) {
        if (this.star > 0 && !e.T.boss) { this.starDefeat(e); continue; }
        this.startBattle(e, this.player.vel.y < -1 && dy > 0.4 ? 'stomp' : false);
        return;
      }
    }
    this.animateEnemies(dt);
  }

  starDefeat(e) {
    this.burst(e.pos.x - 0.5, e.pos.y, e.pos.z - 0.5, B.QBLOCK);
    const xp = Math.ceil(e.T.xp * e.lvl * 0.5), c = rand(...e.T.coins);
    this.s.xp += xp; this.s.coins += c; this.tally(e);
    this.popText(`★ +${xp} XP`, e.pos.clone().add(V(0, 1.5, 0)), 'crit');
    this.removeEnemy(e); this.levelUps(); this.renderHud();
  }

  /** Ray vs enemy boxes (punching an enemy starts a fight with the first hit). */
  raycast(o, dir, maxDist) {
    let best = null;
    for (const e of this.enemies) {
      const R = e.T.radius ? e.T.radius * 0.8 : 0.5, H = e.T.boss ? 5 : 1.2;
      const min = [e.pos.x - R, e.pos.y + e.lift, e.pos.z - R], max = [e.pos.x + R, e.pos.y + e.lift + H, e.pos.z + R];
      const oo = [o.x, o.y, o.z], dd = [dir.x, dir.y, dir.z];
      let t0 = 0, t1 = maxDist;
      for (let i = 0; i < 3 && t0 <= t1; i++) {
        const inv = 1 / dd[i]; let a = (min[i] - oo[i]) * inv, b = (max[i] - oo[i]) * inv;
        if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      }
      if (t0 <= t1 && (!best || t0 < best.dist)) best = { enemy: e, dist: t0 };
    }
    return best;
  }

  /** TNT goes off in the overworld: enemies caught in it get hurt — traps work. */
  blast(c, r) {
    for (const e of [...this.enemies]) {
      const d = e.pos.distanceTo(c);
      if (e.T.boss) { if (d < r * 3 && e.asleep) { e.asleep = false; this.chat('', '👑 The explosion wakes the Mycelord. It is furious.'); } continue; }
      if (d > r * 1.8) continue;
      e.hp -= Math.round((1 - d / (r * 1.8)) * 45);
      if (e.hp <= 0) this.starDefeat(e); else e.stun = 2;
    }
  }

  /** Called from the overworld (Shell Dash / Spore Slam impacts). */
  engage(e, how) { if (!this.inBattle) this.startBattle(e, how); }

  animateEnemies(dt) {
    for (const e of this.enemies) {
      e.t += dt;
      if (!this.inBattle) { e.group.position.copy(e.pos); e.group.rotation.y = e.yaw; }
      const bob = e.asleep ? Math.sin(e.t * 1.5) * 0.05 : e.T.fly ? Math.sin(e.t * 3) * 0.15 : Math.abs(Math.sin(e.t * 7)) * 0.08;
      e.inner.position.y = e.lift + bob;
      e.inner.scale.y = e.curled ? 0.7 : 1;
      if (e.curled) e.inner.rotation.y += dt * 8; else if (!this.inBattle) e.inner.rotation.y = 0;
      e.feet?.forEach((f, i) => { f.position.z = -0.04 + Math.sin(e.t * 9 + i * Math.PI) * 0.08; });
      e.wings?.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * Math.sin(e.t * 40) * 0.6; });
    }
  }

  updatePops(dt) {
    const cam = this.camera, v = V();
    for (const pp of [...this.popups]) {
      pp.t += dt; pp.pos.y += dt * 1.2;
      v.copy(pp.pos).project(cam);
      const vis = v.z < 1;
      pp.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.3 - pp.t)})`;
      pp.el.style.opacity = vis ? Math.max(0, 1.4 - pp.t) : 0;
      if (pp.t > 1.4) { pp.el.remove(); this.popups.splice(this.popups.indexOf(pp), 1); }
    }
  }

  // ---- battle: input & timing ----------------------------------------------------------------------------------
  bindBattleInput() {
    const press = () => { if (this.timing && this.timing.pressed === null) this.timing.pressed = this.timing.t; };
    $('battle').addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) press(); });
    document.addEventListener('keydown', (e) => {
      if (!this.inBattle) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); press(); }
      const map = { KeyA: 'attack', KeyX: 'special', KeyY: 'item', KeyB: 'defend', KeyR: 'run', KeyT: 'terrain' };
      if (map[e.code] && this.menuResolve) this.menuResolve({ kind: map[e.code] });
    });
  }

  /** A timing window: returns 'perfect', 'good' or 'miss'. */
  async timed(dur, a, b, target, guard = false) {
    const ring = $('ring'), c = (a + b) / 2, half = (b - a) / 2;
    const widen = 1 + (this.has('timing') ? 0.4 : 0) + (guard && this.echo('hover') ? 0.25 : 0);
    const A = c - half * widen, Bw = c + half * widen;
    this.timing = { t: 0, pressed: null };
    ring.hidden = false;
    await this.tween(dur, (k) => {
      const t = k * dur; this.timing.t = t;
      const v = target.clone().project(this.camera);
      ring.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%)`;
      ring.style.width = ring.style.height = `${30 + Math.max(0, c - t) * 260}px`;
      ring.classList.toggle('now', t >= A && t <= Bw);
      ring.classList.toggle('guard', guard);
    });
    ring.hidden = true;
    const pr = this.timing.pressed; this.timing = null;
    if (pr === null || pr < A || pr > Bw) return 'miss';
    return Math.abs(pr - c) <= half * 0.35 ? 'perfect' : 'good';
  }

  // ---- battle: setup ---------------------------------------------------------------------------------------------
  startBattle(first, how) {
    if (this.inBattle || !first) return;
    this.inBattle = true;
    first.asleep = false;
    const p = this.player.pos;
    const foes = first.T.boss ? [first] : [first, ...this.enemies.filter((e) => e !== first && !e.T.boss && e.pos.distanceTo(first.pos) < 6)].slice(0, 3);
    this.foes = foes; this.scars = new Set(); this.usedTerrain = new Set();
    const axis = V(first.pos.x - p.x, 0, first.pos.z - p.z);
    if (axis.lengthSq() < 0.01) axis.set(0, 0, -1);
    axis.normalize();
    const perp = V(-axis.z, 0, axis.x);
    const sun = this.getSun?.();
    if (sun && perp.x * sun.x + perp.z * sun.z < 0) perp.negate();
    const center = first.pos.clone();
    const gy = (x, z, fb) => this.groundAt(x, fb + 3, z) ?? fb;
    const back = first.T.boss ? 7 : 3.5;
    const hx = center.x - axis.x * back, hz = center.z - axis.z * back;
    this.heroHome = V(hx, gy(hx, hz, center.y), hz);
    this.axis = axis; this.perp = perp; this.center = center;
    foes.forEach((e, i) => this.placeFoe(e, i, foes.length));
    this.heroYaw = Math.atan2(-axis.x, -axis.z);
    this.hero = new Avatar(7, 'You');
    this.hero.tag.visible = false;
    this.hero.setState([this.heroHome.x, this.heroHome.y, this.heroHome.z], [this.heroYaw, 0]);
    this.hero.group.position.copy(this.heroHome);
    this.scene.add(this.hero.group);

    // camera: isometric-ish, pulled in if the battle is underground or against a cliff
    const mid = this.heroHome.clone().lerp(center, 0.5); mid.y += 0.9;
    this.savedCam = { fov: this.camera.fov, pos: this.camera.position.clone(), rot: this.camera.rotation.clone() };
    this.camera.fov = 45; this.camera.updateProjectionMatrix();
    const far = (innerWidth < innerHeight ? 1.7 : 1) * (first.T.boss ? 1.6 : 1);
    const want = mid.clone().addScaledVector(perp, 8.5 * far).addScaledVector(axis, -2.5); want.y += 5.5 * far;
    const camPos = mid.clone(), step = want.clone().sub(mid).divideScalar(40);
    for (let i = 0; i < 40; i++) {
      camPos.add(step);
      if (this.world.isSolid(Math.floor(camPos.x), Math.floor(camPos.y), Math.floor(camPos.z))) { camPos.sub(step).sub(step); break; }
    }
    const from = this.camera.position.clone();
    this.tween(0.6, (k) => { this.camera.position.lerpVectors(from, camPos, k * k * (3 - 2 * k)); this.camera.lookAt(mid); });
    this.onBattle(true);
    $('battle').hidden = false;
    this.battleLoop(how).catch((e) => console.error(e));
  }

  placeFoe(e, i, n) {
    const { center, axis, perp } = this;
    const off = (i - (n - 1) / 2) * (e.T.boss ? 0 : 1.8);
    const ex = center.x + perp.x * off + axis.x * (i % 2) * 0.8, ez = center.z + perp.z * off + axis.z * (i % 2) * 0.8;
    e.home = V(ex, this.groundAt(ex, center.y + 3, ez) ?? center.y, ez);
    e.pos.copy(e.home); e.group.position.copy(e.home);
    e.group.rotation.y = Math.atan2(axis.x, axis.z);
  }

  /** Read the real terrain around the fight. */
  scanTerrain() {
    const w = this.world, c = this.center, t = { tnt: [], ores: [], crystals: [], water: 0, leaves: 0, sand: 0, caps: 0 };
    const cx = Math.floor(c.x), cy = Math.floor(c.y), cz = Math.floor(c.z);
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) for (let dy = -4; dy <= 5; dy++) {
      const x = cx + dx, y = cy + dy, z = cz + dz, id = w.get(x, y, z);
      if (id === B.AIR) continue;
      if (id === B.TNT) t.tnt.push([x, y, z]);
      else if (id === B.CRYSTAL) t.crystals.push([x, y, z]);
      else if (ORE_VALUE[id]) t.ores.push([x, y, z, id]);
      else if (id === B.WATER) t.water++;
      else if (id === B.LEAVES) t.leaves++;
      else if (id === B.SAND) t.sand++;
      else if (BLOCKS[id].bouncy) t.caps++;
    }
    t.ores.sort((a, b) => ORE_VALUE[b[3]] - ORE_VALUE[a[3]]);
    t.high = this.heroHome.y >= Math.max(...this.foes.map((e) => e.home.y)) + 1.5;
    // a foe near a drop of 4+ blocks can be shoved off
    t.cliff = this.foes.filter((e) => !e.T.boss && !e.T.fly && e.hp > 0).find((e) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => {
      const g = this.groundAt(e.home.x + dx * 1.6, e.home.y + 1, e.home.z + dz * 1.6, 12);
      return g === null ? w.get(Math.floor(e.home.x + dx * 1.6), Math.floor(e.home.y) - 1, Math.floor(e.home.z + dz * 1.6)) === B.AIR : g < e.home.y - 3.5;
    }));
    return t;
  }

  terrainOptions() {
    const t = this.terrain = this.scanTerrain(), o = [], alive = this.foes.filter((e) => e.hp > 0);
    if (t.tnt.length) o.push({ id: 'tnt', label: `💣 Detonate TNT (${t.tnt.length} nearby) — huge blast, real crater` });
    if (t.ores.length) { const [,,, id] = t.ores[0]; o.push({ id: 'ore', label: `⛏ Rip out ${BLOCKS[id].name} and hurl it (${ORE_VALUE[id]} dmg)` }); }
    if (t.crystals.length) o.push({ id: 'crystal', label: '🔮 Shatter a crystal — restore all FP' });
    if (t.cliff) o.push({ id: 'cliff', label: `⛰ Shove ${t.cliff.name} off the ledge` });
    if (t.water >= 6) o.push({ id: 'water', label: '🌊 Splash — soaked foes may lose a turn' });
    if (t.leaves >= 8) o.push({ id: 'tree', label: '🌳 Shake the tree — who knows what falls out' });
    if (t.sand >= 6) o.push({ id: 'sand', label: '🏜 Kick sand — blind foes for 2 turns' });
    if (!o.length) o.push({ id: 'none', label: '…nothing here to use. Fight near TNT, ore, water, trees or cliffs!', disabled: true });
    return { o, alive };
  }

  // ---- battle: flow ---------------------------------------------------------------------------------------------
  heroTo(target, dur, arc = 0) {
    const from = this.hero.group.position.clone();
    return this.tween(dur, (k) => {
      const q = k * k * (3 - 2 * k);
      this.hero.group.position.lerpVectors(from, target, q);
      this.hero.group.position.y += Math.sin(k * Math.PI) * arc;
      this.hero.target.copy(this.hero.group.position);
    });
  }

  damage(e, amount, grade) {
    e.hp = Math.max(0, e.hp - amount);
    const at = e.group.position.clone(); at.y += 1.4 + e.lift + (e.T.boss ? 3 : 0);
    this.popText(String(amount), at, grade ? 'crit' : 'dmg');
    if (grade) this.popText(grade === 'perfect' ? 'Excellent!' : 'Nice!', at.clone().add(V(0, 0.6, 0)), 'nice');
    const g = e.inner; this.tween(0.25, (k) => { g.rotation.z = Math.sin(k * Math.PI * 4) * 0.3 * (1 - k); });
    this.renderFoes();
  }

  renderFoes() {
    const sense = this.echo('sense');
    $('b-foes').innerHTML = this.foes.map((e) => {
      const st = [e.skip ? '💤' : '', e.blind ? '🙈' : '', e.curled ? '🌀' : '', e.charged ? '⚡' : ''].join('');
      const intent = e.hp ? `<small class="intent">${sense || e.T.boss ? '▶ ' + MOVES[e.nextMove].name : '▶ ?'}</small>` : '';
      return `<div class="foe ${e.hp ? '' : 'dead'} ${e.elite ? 'elite' : ''}"><b>${e.name}</b> <small>Lv${e.lvl}</small> ${st}
        <span class="bar hp"><i style="width:${(e.hp / e.maxHp) * 100}%"></i></span>${intent}</div>`;
    }).join('');
    const s = this.s, tags = [];
    if (this.terrain?.high) tags.push('⛰ High ground +25% ATK');
    if (this.terrain?.caps) tags.push('🍄 Bouncy caps: Super Jump ×1.5');
    if (this.hooks.isNight()) tags.push('🌙 Night');
    $('b-hero').innerHTML = `<b>You</b> Lv${s.lvl}<span class="bar hp"><i style="width:${(s.hp / s.maxHp) * 100}%"></i><b>❤ ${s.hp}/${s.maxHp}</b></span>
      <span class="bar fp"><i style="width:${(s.fp / s.maxFp) * 100}%"></i><b>✦ ${s.fp}/${s.maxFp}</b></span>${tags.map((t) => `<small class="tag">${t}</small>`).join('')}`;
  }

  setMsg(t) { $('b-msg').textContent = t; }

  menu() {
    const m = $('b-menu');
    m.hidden = false;
    m.innerHTML = `
      <button class="dm y" data-k="item">🍄<span>Item</span></button>
      <button class="dm x" data-k="special">✨<span>Special</span></button>
      <button class="dm t" data-k="terrain">🌍<span>Terrain</span></button>
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

  async pickTarget(filter = () => true) {
    const alive = this.foes.filter((e) => e.hp > 0 && filter(e));
    if (!alive.length) return null;
    if (alive.length === 1) return alive[0];
    const i = await this.choose(alive.map((e) => ({ label: `🎯 ${e.name} (${e.hp} HP)` })));
    return i < 0 ? null : alive[i];
  }

  async battleLoop(how) {
    const s = this.s;
    this.terrain = this.scanTerrain();
    this.renderFoes();
    await this.wait(0.6);
    const first = this.foes[0];
    if (first.T.boss) { this.setMsg('The Mycelord awakens! The whole grove trembles.'); await this.wait(1.2); }
    if (how === 'stomp' || how === 'dash' || how === 'slam' || how === 'punch') {
      this.setMsg(how === 'dash' ? 'Shell Dash — First Strike!' : how === 'slam' ? 'Spore Slam — First Strike! It is stunned.' : 'First Strike!');
      if (how === 'stomp' && first.T.spiky) { this.hurtHero(3); this.setMsg('Ouch! Never stomp a Spikey.'); }
      else { this.damage(first, Math.max(2, Math.round((s.atk - (how === 'dash' ? 0 : first.def)) * 1.5)), 'good'); if (how === 'slam') first.skip = 1; }
      await this.wait(0.8); await this.defeatCheck(first);
    }
    let result = null;
    while (!result) {
      if (this.foes.every((e) => e.hp <= 0)) { result = 'win'; break; }
      this.defending = false;
      this.setMsg(this.isMobile ? 'Your move! Tap as the ring turns gold — dead centre is Excellent.' : 'Your move! A attack · X special · Y item · B defend · T terrain — Space as the ring turns gold.');
      const act = await this.menu();
      const acted = await this.heroAction(act);
      if (acted === 'run') { result = 'run'; break; }
      this.renderHud(); this.renderFoes();
      if (!acted) continue;
      if (this.foes.every((e) => e.hp <= 0)) { result = 'win'; break; }
      for (const e of this.foes) {
        if (e.hp <= 0) continue;
        await this.enemyTurn(e);
        if (s.hp <= 0) { result = 'lose'; break; }
      }
      for (const e of this.foes) { e.blind = Math.max(0, e.blind - 1); }
    }
    await this.endBattle(result);
  }

  async heroAction(act) {
    const s = this.s;
    if (act.kind === 'attack') { const t = await this.pickTarget(); if (!t) return false; await this.attack(t); return true; }
    if (act.kind === 'special') {
      const opts = [
        { k: 'jump', label: `🦘 Super Jump — 3 FP · chain timed landings`, cost: 3 },
        { k: 'fire', label: `🔥 Fire Burst — ${this.has('ember') ? 2 : 4} FP · all foes, scorches the land`, cost: this.has('ember') ? 2 : 4 },
      ];
      if (this.echo('dash')) opts.push({ k: 'dash', label: '💨 Shell Dash — 3 FP · all grounded foes, ignores defense', cost: 3 });
      if (this.echo('slam')) opts.push({ k: 'slam', label: '💥 Spore Slam — 4 FP · heavy hit + stun', cost: 4 });
      const i = await this.choose(opts.map((o) => ({ label: o.label, disabled: s.fp < o.cost })));
      if (i < 0) return false;
      const o = opts[i];
      if (o.k === 'jump' || o.k === 'slam') { const t = await this.pickTarget(); if (!t) return false; s.fp -= o.cost; o.k === 'jump' ? await this.superJump(t) : await this.sporeSlam(t); }
      else { s.fp -= o.cost; o.k === 'fire' ? await this.fireBurst() : await this.shellDash(); }
      return true;
    }
    if (act.kind === 'item') {
      const keys = Object.keys(ITEMS);
      const i = await this.choose(keys.map((k) => ({ label: `${ITEMS[k].icon} ${ITEMS[k].name} ×${s.items[k]} — ${ITEMS[k].desc}`, disabled: !s.items[k] })));
      if (i < 0) return false;
      const k = keys[i];
      if (k === 'shard') { const t = await this.pickTarget(); if (!t) return false; s.items.shard--; await this.hurl(this.hero.group.position.clone().add(V(0, 1.5, 0)), t, 0xc9a6ff); this.damage(t, 18, 'good'); await this.defeatCheck(t); return true; }
      s.items[k]--;
      const at = this.hero.group.position.clone(); at.y += 2.2;
      if (k === 'mushroom') { const h = Math.min(25, s.maxHp - s.hp); s.hp += h; this.popText(`+${h} HP`, at, 'heal'); }
      else if (k === 'syrup') { const f = Math.min(10, s.maxFp - s.fp); s.fp += f; this.popText(`+${f} FP`, at, 'heal'); }
      else if (k === 'spore') { for (const e of this.foes) if (e.hp > 0 && !e.T.boss) e.skip = 1; this.setMsg('A cloud of glowing spores… the foes doze off.'); }
      await this.heroTo(this.heroHome.clone(), 0.4, 0.8);
      return true;
    }
    if (act.kind === 'terrain') return this.terrainAction();
    if (act.kind === 'defend') { this.defending = true; this.setMsg('Defending — incoming damage halved.'); await this.wait(0.5); return true; }
    if (act.kind === 'run') {
      if (this.foes.some((e) => e.T.boss)) { this.setMsg("You can't run from this!"); await this.wait(0.8); return false; }
      if (Math.random() < 0.65) { this.setMsg('Got away safely!'); await this.wait(0.4); return 'run'; }
      this.setMsg("Couldn't escape!"); await this.wait(0.8); return true;
    }
    return false;
  }

  atkPower() { return Math.round(this.s.atk * (this.terrain?.high ? 1.25 : 1)); }

  async hurl(from, e, color) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 }));
    m.position.copy(from); this.scene.add(m);
    const to = e.group.position.clone(); to.y += 0.8 + e.lift;
    await this.tween(0.55, (k) => { m.position.lerpVectors(from, to, k); m.position.y += Math.sin(k * Math.PI) * 2.5; m.rotation.x += 0.3; m.rotation.y += 0.2; });
    this.scene.remove(m); m.geometry.dispose();
  }

  recoil(e) {
    if (!e.curled) return false;
    this.hurtHero(3); this.setMsg(`${e.name} is curled up — spikes everywhere! Try fire, a slam, or wait it out.`);
    return true;
  }

  async attack(e) {
    const s = this.s, home = this.heroHome.clone();
    this.setMsg('Press as the ring turns gold — dead centre for Excellent!');
    const front = e.group.position.clone().lerp(home, 1.1 / home.distanceTo(e.group.position));
    await this.heroTo(front, 0.45);
    const hitAt = e.group.position.clone(); hitAt.y += 0.8 + e.lift;
    const swing = this.timed(0.7, 0.42, 0.62, hitAt);
    this.tween(0.5, (k) => { this.hero.armR.rotation.x = -Math.sin(k * Math.PI) * 2.2; });
    const r = await swing;
    let dmg = Math.max(1, this.atkPower() - e.def + rand(-1, 1));
    if (r !== 'miss') dmg = Math.round(dmg * (r === 'perfect' ? 2.5 : 2));
    if (e.curled) dmg = Math.max(1, Math.floor(dmg / 3));
    this.damage(e, dmg, r !== 'miss' && r);
    this.recoil(e);
    await this.wait(0.3);
    await this.defeatCheck(e);
    await this.heroTo(home, 0.45);
  }

  async superJump(e) {
    const s = this.s, home = this.heroHome.clone(), bouncy = this.terrain?.caps > 0;
    this.setMsg(bouncy ? 'Super Jump off the bouncy caps! Keep timing each landing!' : 'Super Jump! Keep timing each landing to chain hits!');
    const top = e.group.position.clone(); top.y += 1.1 + e.lift + (e.T.boss ? 3.5 : 0);
    await this.heroTo(top, 0.6, 3);
    let hits = 0;
    while (e.hp > 0 && hits < 8) {
      const r = await this.timed(0.55, 0.32, 0.5, top);
      await this.heroTo(top.clone().add(V(0, 2.2, 0)), 0.001);
      let dmg = Math.max(1, s.mag + 1 - Math.floor(e.def / 2) + hits);
      if (bouncy) dmg = Math.round(dmg * 1.5);
      if (e.curled) { dmg = 1; this.recoil(e); }
      this.damage(e, dmg, r !== 'miss' && hits > 0 && r);
      hits++;
      if (r === 'miss' || e.curled) break;
      this.popText(`${hits} hit${hits > 1 ? 's' : ''}!`, top.clone().add(V(0, 1.4, 0)), 'nice');
      this.heroTo(top, 0.5, 1.5);
    }
    await this.wait(0.5);
    await this.heroTo(home, 0.6, 2.5);
    await this.defeatCheck(e);
  }

  async fireBurst() {
    const s = this.s, ember = this.has('ember');
    this.setMsg('Fire Burst! Press at the flash for extra power!');
    const center = this.foes.find((e) => e.hp > 0).group.position.clone(); center.y += 1;
    const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.8 }));
    const from = this.hero.group.position.clone(); from.y += 1.2;
    fire.position.copy(from); this.scene.add(fire);
    const timing = this.timed(0.8, 0.5, 0.7, center);
    await this.tween(0.8, (k) => { fire.position.lerpVectors(from, center, k); fire.scale.setScalar(0.3 + k * 1.6); });
    const r = await timing;
    this.scene.remove(fire); fire.geometry.dispose();
    for (const e of this.foes) if (e.hp > 0) {
      let d = Math.max(1, Math.round((s.mag + 2) * (r === 'perfect' ? 1.9 : r === 'good' ? 1.6 : 1) * (ember ? 1.3 : 1)) - Math.floor(e.def / 2));
      if (e.type === 'glowshroom' || e.T.boss) d *= 2; // fungi burn
      if (e.curled) { e.curled = 0; this.popText('Uncurled!', e.group.position.clone().add(V(0, 2, 0)), 'nice'); }
      this.damage(e, d, r !== 'miss' && r);
      this.burst(e.group.position.x - 0.5, e.group.position.y, e.group.position.z - 0.5, B.FLOWER);
    }
    this.scars.add(ember ? 'fire+' : 'fire');
    await this.wait(0.5);
    for (const e of this.foes) await this.defeatCheck(e);
  }

  async shellDash() {
    const s = this.s, home = this.heroHome.clone();
    this.setMsg('Shell Dash! Time it to hit harder.');
    const targets = this.foes.filter((e) => e.hp > 0 && !e.T.fly);
    const far = this.center.clone().addScaledVector(this.axis, 3); far.y = home.y;
    const r = await this.timed(0.5, 0.25, 0.42, this.center.clone().add(V(0, 1, 0)));
    this.hero.group.rotation.x = -1.2;
    await this.heroTo(far, 0.35);
    for (const e of targets) this.damage(e, Math.max(2, Math.round((s.atk + 2) * (r === 'perfect' ? 2 : r === 'good' ? 1.6 : 1))), r !== 'miss' && r);
    if (this.foes.some((e) => e.hp > 0 && e.T.fly)) this.setMsg('The Buzzbee just floats over your shell…');
    await this.heroTo(home, 0.5, 1.5);
    this.hero.group.rotation.x = 0;
    for (const e of targets) await this.defeatCheck(e);
  }

  async sporeSlam(e) {
    const s = this.s, home = this.heroHome.clone();
    this.setMsg('Spore Slam! Press on impact.');
    const top = e.group.position.clone(); top.y += 5;
    await this.heroTo(top, 0.5, 1);
    const impact = e.group.position.clone(); impact.y += 0.8;
    const t = this.timed(0.5, 0.28, 0.45, impact);
    await this.heroTo(impact, 0.35);
    const r = await t;
    let dmg = Math.max(2, Math.round((s.mag + s.atk * 0.6) * (r === 'perfect' ? 2 : r === 'good' ? 1.6 : 1)));
    if (e.T.weakSlam) { dmg *= 2; this.popText('Crushed!', impact.clone().add(V(0, 1.5, 0)), 'nice'); }
    this.damage(e, dmg, r !== 'miss' && r);
    if (!e.T.boss || r === 'perfect') { e.skip = 1; e.curled = 0; this.popText('Stunned!', impact.clone().add(V(0, 2.2, 0)), 'nice'); }
    this.scars.add('slam');
    await this.heroTo(home, 0.5, 2);
    await this.defeatCheck(e);
  }

  async terrainAction() {
    const { o } = this.terrainOptions();
    const i = await this.choose(o);
    if (i < 0 || o[i].disabled) return false;
    const t = this.terrain, id = o[i].id, s = this.s;
    const hurt = (e, d) => { this.damage(e, d, 'good'); };
    if (id === 'tnt') {
      const [x, y, z] = t.tnt.sort((a, b) => Math.hypot(a[0] - this.center.x, a[2] - this.center.z) - Math.hypot(b[0] - this.center.x, b[2] - this.center.z))[0];
      this.setMsg('You light the fuse… and dive for cover!');
      await this.heroTo(this.heroHome.clone().addScaledVector(this.axis, -1.5), 0.4, 0.6);
      await this.wait(0.6);
      this.hooks.setBlocks([[x, y, z, B.AIR]]);
      this.hooks.explode(x + 0.5, y + 0.5, z + 0.5, 4);
      const at = V(x + 0.5, y + 0.5, z + 0.5);
      for (const e of this.foes) if (e.hp > 0) { const d = e.group.position.distanceTo(at); if (d < 7) hurt(e, Math.round(34 - d * 4)); }
      if (this.hero.group.position.distanceTo(at) < 4.5) this.hurtHero(8);
      this.popText('KA-BOOM!', at.clone().add(V(0, 2, 0)), 'lvl');
      await this.wait(0.6);
    } else if (id === 'ore') {
      const [x, y, z, oid] = t.ores[0], target = await this.pickTarget();
      if (!target) return false;
      this.setMsg(`You wrench the ${BLOCKS[oid].name} out of the ground!`);
      this.hooks.setBlocks([[x, y, z, B.AIR]]);
      await this.hurl(V(x + 0.5, y + 0.5, z + 0.5), target, { [B.COAL_ORE]: 0x222222, [B.IRON_ORE]: 0xd8a888, [B.GOLD_ORE]: 0xffd23a, [B.DIAMOND_ORE]: 0x66fff0 }[oid] ?? 0xffffff);
      hurt(target, ORE_VALUE[oid]);
    } else if (id === 'crystal') {
      const [x, y, z] = t.crystals[0];
      this.hooks.setBlocks([[x, y, z, B.AIR]]);
      this.burst(x, y, z, B.CRYSTAL);
      s.fp = s.maxFp; this.popText('FP restored!', this.hero.group.position.clone().add(V(0, 2.2, 0)), 'heal');
      this.setMsg('The crystal sings as it shatters.');
      await this.wait(0.6);
    } else if (id === 'cliff') {
      const e = t.cliff;
      this.setMsg(`Shove ${e.name} — time it!`);
      const front = e.group.position.clone().lerp(this.heroHome, 1.1 / this.heroHome.distanceTo(e.group.position));
      await this.heroTo(front, 0.4);
      const r = await this.timed(0.6, 0.35, 0.52, e.group.position.clone().add(V(0, 1, 0)));
      if (r === 'miss') { this.setMsg(`${e.name} digs in its heels.`); hurt(e, 2); }
      else {
        const g = e.group, from = g.position.clone(), dir = e.group.position.clone().sub(this.heroHome).setY(0).normalize();
        await this.tween(0.8, (k) => { g.position.copy(from).addScaledVector(dir, k * 3); g.position.y -= k * k * 8; g.rotation.x = k * 4; });
        e.hp = 0; e.pushed = true; g.visible = false;
        this.popText('Over the edge!', from.clone().add(V(0, 2, 0)), 'lvl');
      }
      await this.heroTo(this.heroHome.clone(), 0.4);
    } else if (id === 'water') {
      this.setMsg('SPLASH!');
      for (const e of this.foes) if (e.hp > 0) {
        if (e.T.fly || Math.random() < 0.6) { e.skip = 1; this.popText('Soaked!', e.group.position.clone().add(V(0, 2, 0)), 'nice'); }
        if (e.T.fly) hurt(e, 5);
        this.burst(e.group.position.x - 0.5, e.group.position.y + 0.5, e.group.position.z - 0.5, B.GLASS);
      }
      await this.wait(0.6);
    } else if (id === 'tree') {
      this.setMsg('You shake the tree…');
      await this.wait(0.7);
      const r = Math.random();
      if (r < 0.45) { const h = Math.min(12, s.maxHp - s.hp); s.hp += h; this.popText(`🍎 +${h} HP`, this.hero.group.position.clone().add(V(0, 2.2, 0)), 'heal'); this.setMsg('An apple falls. Crunchy.'); }
      else if (r < 0.75) { const c = rand(5, 12); s.coins += c; this.coinFountain(this.hero.group.position.clone().add(V(0, 3, 0)), c); this.setMsg(`Someone hid ${c} coins up there!`); }
      else if (this.foes.length < 4) {
        const bee = new Enemy('buzzbee', this.center.x, this.center.y, this.center.z, Math.max(1, s.lvl - 1));
        this.enemies.push(bee); this.scene.add(bee.group); this.foes.push(bee);
        this.placeFoe(bee, this.foes.length - 1, this.foes.length);
        this.setMsg('…a hive falls out. A very angry Buzzbee joins the fight!');
      }
      await this.wait(0.6);
    } else if (id === 'sand') {
      this.setMsg('A faceful of sand!');
      for (const e of this.foes) if (e.hp > 0) { e.blind = 2; this.popText('Blinded!', e.group.position.clone().add(V(0, 2, 0)), 'nice'); }
      await this.wait(0.6);
    }
    this.renderFoes();
    for (const e of this.foes) await this.defeatCheck(e);
    return true;
  }

  async defeatCheck(e) {
    if (e.hp > 0 || e.dying) return;
    e.dying = true;
    const g = e.group, y0 = g.position.y;
    if (!e.pushed) await this.tween(0.5, (k) => { g.rotation.y += 0.4; g.position.y = y0 + k * 1.5; g.scale.setScalar(1 - k); });
    g.visible = false;
  }

  // ---- enemy turns ------------------------------------------------------------------------------------------------
  async enemyTurn(e) {
    const s = this.s, mv = MOVES[e.nextMove];
    e.moveIdx++;
    if (e.skip) { e.skip--; this.setMsg(`${e.name} is out of it and loses its turn.`); await this.wait(0.7); this.renderFoes(); return; }
    e.curled = 0;
    if (mv.curl) { e.curled = 1; this.setMsg(`${e.name} curls into a spiky ball! Physical attacks will hurt you.`); await this.wait(0.8); this.renderFoes(); return; }
    if (mv.charge) { e.charged = true; this.setMsg(`${e.name} is charging something big… get ready to guard!`); await this.wait(0.8); this.renderFoes(); return; }
    if (mv.summon) {
      const alive = this.foes.filter((f) => f.hp > 0).length;
      if (alive < 3) {
        const type = this.hooks.isNight() ? 'glowshroom' : 'shroomba';
        const minion = new Enemy(type, this.center.x, this.center.y, this.center.z, Math.max(1, e.lvl - 3));
        this.enemies.push(minion); this.scene.add(minion.group); this.foes.push(minion);
        const n = this.foes.length;
        minion.home = e.home.clone().addScaledVector(this.perp, (n % 2 ? 1 : -1) * 3.2).addScaledVector(this.axis, -1);
        minion.home.y = this.groundAt(minion.home.x, minion.home.y + 3, minion.home.z) ?? minion.home.y;
        minion.pos.copy(minion.home); minion.group.position.copy(minion.home); minion.group.rotation.y = Math.atan2(this.axis.x, this.axis.z);
        this.setMsg(`${e.name} calls the grove — a ${minion.name} pops out of the ground!`);
      } else this.setMsg(`${e.name} rumbles, but the grove has nothing left to send.`);
      await this.wait(0.9); this.renderFoes(); return;
    }
    this.setMsg(`${e.name} uses ${mv.name}! Guard as it hits${mv.hits.length > 1 ? ' — every hit!' : '!'}`);
    const home = e.home.clone(), heroPos = this.hero.group.position.clone(), g = e.group;
    const near = heroPos.clone().lerp(home, e.T.boss ? 0.55 : 0.25);
    await this.tween(0.3, (k) => { g.position.lerpVectors(home, home.clone().lerp(near, 0.3), k); });
    for (const [power, wind] of mv.hits) {
      const hitAt = heroPos.clone(); hitAt.y += 1;
      const guard = this.timed(wind + 0.12, wind * 0.72, wind, hitAt, true);
      const from = g.position.clone();
      await this.tween(wind, (k) => { g.position.lerpVectors(from, near, k * k); g.position.y += Math.sin(k * Math.PI) * (e.T.boss ? 2.5 : 1.2); });
      const r = await guard;
      let dmg = Math.max(1, Math.round((e.atk - s.def + rand(-1, 1)) * power * (e.charged ? 1.3 : 1)));
      if (e.blind && Math.random() < 0.5) { this.popText('Miss!', hitAt.clone().add(V(0, 1.2, 0)), 'nice'); dmg = 0; }
      else if (r === 'perfect') { dmg = 0; this.popText('Perfect guard!', hitAt.clone().add(V(0, 1.2, 0)), 'lvl'); this.damage(e, 2 + Math.floor(s.lvl / 2), false); }
      else if (r === 'good') { dmg = Math.floor(dmg / 2); this.popText('Guard!', hitAt.clone().add(V(0, 0.8, 0)), 'nice'); }
      if (this.defending) dmg = Math.floor(dmg / 2);
      if (dmg || r !== 'perfect') this.hurtHero(dmg);
      if (e.T.boss) this.hooks.shake?.(0.5);
      if (s.hp <= 0) break;
      await this.tween(0.12, (k) => { g.position.lerpVectors(near, home.clone().lerp(near, 0.6), k); });
    }
    e.charged = false;
    const back = g.position.clone();
    await this.tween(0.35, (k) => { g.position.lerpVectors(back, home, k); g.position.y += Math.sin(k * Math.PI) * 0.8; });
    await this.defeatCheck(e);
    this.renderFoes();
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

  // ---- progression -------------------------------------------------------------------------------------------------
  tally(e) {
    const s = this.s, echoKey = e.T.echo;
    s.kills[e.type] = (s.kills[e.type] || 0) + 1;
    if (!echoKey || s.echoes[echoKey]) return;
    const n = Object.entries(s.kills).filter(([t]) => ENEMIES[t]?.echo === echoKey).reduce((a, [, v]) => a + v, 0);
    if (n >= 3) this.learnEcho(echoKey);
    else if (n === 2) this.chat('', `Something about the way the ${e.T.name} moved stays with you…`);
  }

  learnEcho(k) {
    this.s.echoes[k] = true;
    const E = ECHOES[k];
    this.banner(`Echo learned: ${E.name}`, `From the ${E.from}. ${E.how} In battle: ${E.battle}`, E.icon);
    this.chat('', `${E.icon} Echo learned: ${E.name}. Maybe there are places you couldn't reach before…`);
    this.renderHud();
  }

  levelUps() {
    const s = this.s;
    while (s.xp >= xpNeeded(s.lvl)) {
      s.xp -= xpNeeded(s.lvl); s.lvl++;
      s.maxHp += 5; s.maxFp += 2; s.atk += 2; s.def += 1; s.mag += 2;
      s.hp = s.maxHp; s.fp = s.maxFp;
      this.popText(`LEVEL UP! Lv ${s.lvl}`, this.player.pos.clone().add(V(0, 2.4, 0)), 'lvl');
    }
  }

  async endBattle(result) {
    const s = this.s;
    let msg = '';
    if (result === 'win') {
      const xp = this.foes.reduce((a, e) => a + Math.ceil(e.T.xp * e.lvl * (e.elite ? 2 : 1) * (e.pushed ? 0.5 : 1)), 0);
      const coins = Math.round(this.foes.reduce((a, e) => a + rand(...e.T.coins) * e.lvl * (e.elite ? 3 : 1), 0) * (this.has('magnet') ? 1.5 : 1));
      s.xp += xp; s.coins += coins;
      this.coinFountain(this.center.clone().add(V(0, 1, 0)), coins);
      msg = `Victory! +${xp} XP, +${coins} coins`;
      for (const e of this.foes) {
        this.tally(e);
        if (e.T.drop && Math.random() < e.T.drop[1]) { s.items[e.T.drop[0]]++; msg += ` · ${ITEMS[e.T.drop[0]].icon} ${ITEMS[e.T.drop[0]].name}`; }
        if (e.elite && Math.random() < 0.35) {
          const r = Object.keys(RELICS).filter((k) => !this.has(k) && k !== 'feather' && !SKY_POOL.includes(k));
          if (r.length) { const k = pick(r); s.relics.push(k); this.banner(`Relic: ${RELICS[k].name}`, RELICS[k].desc, RELICS[k].icon); msg += ` · ${RELICS[k].icon} relic!`; }
        }
      }
      const lv = s.lvl; this.levelUps();
      if (s.lvl > lv) msg += ` · LEVEL UP! Lv ${s.lvl}`;
      const boss = this.foes.find((e) => e.T.boss);
      if (boss) {
        s.bosses.push(boss.site.id);
        const firstCrown = !s.crown; s.crown = true;
        this.hooks.onBossDefeated(boss.site);
        this.banner('The Mycelord falls', firstCrown
          ? 'Its glowcap turns to gold and the grove falls quiet. You take the Spore Crown. Starstones everywhere seem to hum when you are near…'
          : 'Another grove is freed. Its glowcap turns to gold.', '👑');
      }
      for (const e of this.foes) this.removeEnemy(e);
    } else if (result === 'lose') {
      const lost = Math.floor(s.coins / 2);
      s.coins -= lost; s.hp = s.maxHp; s.fp = s.maxFp;
      msg = `You were defeated… lost ${lost} coins.${s.home ? ' You wake up at home.' : ''}`;
      for (const e of this.foes) { e.stun = 5; e.hp = e.maxHp; e.skip = e.blind = e.curled = 0; e.dying = false; e.group.visible = true; e.group.scale.setScalar(1); e.asleep = !!e.T.boss; }
      if (s.home) this.hooks.teleport(...s.home);
    } else {
      for (const e of this.foes) e.stun = 4;
    }
    // the land remembers the fight
    const scars = [];
    if (this.scars.has('fire') || this.scars.has('fire+')) {
      const R = this.scars.has('fire+') ? 5 : 3.5, c = this.center, w = this.world;
      for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) for (let dy = -3; dy <= 6; dy++) {
        if (Math.hypot(dx, dz, dy * 0.7) > R + Math.random()) continue;
        const x = Math.floor(c.x) + dx, y = Math.floor(c.y) + dy, z = Math.floor(c.z) + dz, id = w.get(x, y, z);
        const to = id === B.GRASS || id === B.MYCEL ? B.DIRT : id === B.TALLGRASS || id === B.FLOWER || id === B.LEAVES ? B.AIR : id === B.SNOW ? B.WATER : -1;
        if (to >= 0) scars.push([x, y, z, to]);
      }
    }
    if (this.scars.has('slam')) {
      const c = this.center, w = this.world;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const x = Math.floor(c.x) + dx, z = Math.floor(c.z) + dz, y = Math.floor(c.y) - 1;
        const id = w.get(x, y, z);
        if (id === B.STONE || id === B.GRASS || id === B.DIRT) scars.push([x, y, z, B.COBBLE]);
      }
    }
    if (scars.length && result !== 'lose') { this.hooks.setBlocks(scars); msg += ' · The fight left its mark on the land.'; }
    this.setMsg(msg || 'Escaped!');
    this.renderHud(); this.renderFoes();
    await this.wait(result === 'win' ? 1.6 : 0.9);
    this.scene.remove(this.hero.group); this.hero.dispose();
    $('battle').hidden = true;
    this.camera.fov = this.savedCam.fov; this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.savedCam.pos); this.camera.rotation.copy(this.savedCam.rot);
    this.inBattle = false; this.terrain = null;
    this.chat('', msg || 'Escaped!');
    this.onBattle(false, result);
  }

  update3DHero(dt) { if (this.inBattle && this.hero) { this.hero.yaw = this.heroYaw; this.hero.update(dt); } }
}

export { ECHOES, ITEMS };
