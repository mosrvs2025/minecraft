// Wandering things: Pip the Peddler, who turns up near landmarks, and the sky whale that crosses the night sky.
import * as THREE from 'three';
import { B, CS } from './blocks.js';
import { sitesNear } from './landmarks.js';
import { RELICS } from './rpg.js';

const $ = (id) => document.getElementById(id);
const geo = new THREE.BoxGeometry(1, 1, 1);
function box(g, w, h, d, color, x, y, z, o = {}) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }));
  m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
}
function tag(text) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = '600 28px system-ui'; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.roundRect(8, 10, 240, 44, 12); ctx.fill();
  ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); s.scale.set(2, 0.5, 1); return s;
}

// what Pip carries depends on how far from spawn you meet him
const STOCK = [
  { k: 'mushroom', label: '🍄 Mushroom', price: 6, tier: 0 },
  { k: 'syrup', label: '🍯 Honey Syrup', price: 8, tier: 0 },
  { k: 'rumor', label: '❔ A rumor — "I know a place…"', price: 15, tier: 0 },
  { k: 'shard', label: '🔮 Crystal Shard', price: 14, tier: 1 },
  { k: 'spore', label: '🌫 Glow Spore', price: 12, tier: 1 },
  { k: 'beanstalk', label: '🌱 Beanstalk Seed (plants right here)', price: 30, tier: 1 },
  { k: 'star', label: '⭐ Bottled Starman', price: 35, tier: 2 },
  { k: 'feather', label: '🪶 Feather Charm (relic — glide without Hover)', price: 80, tier: 2, relic: true },
];

export class Wonders {
  constructor({ scene, world, player, rpg, discovery, chat, controls, hooks }) {
    Object.assign(this, { scene, world, player, rpg, discovery, chat, controls, hooks });
    this.pip = null; this.visited = new Set(); this.timer = 2;
    this.whale = null; this.lastNight = false;
    $('shop').addEventListener('click', (e) => { if (e.target.id === 'shop' || e.target.closest('.jr-x')) this.closeShop(); });
    for (const ev of ['mousedown', 'touchstart', 'keydown', 'wheel']) $('shop').addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }

  // ---- Pip -------------------------------------------------------------------------------------------------------
  spawnPip(st) {
    const a = st.seed * 6.28, x = st.x + Math.cos(a) * 6, z = st.z + Math.sin(a) * 6;
    const gy = this.rpg.groundAt(x, 120, z, 120);
    if (gy === null) return;
    const g = new THREE.Group();
    box(g, 0.5, 0.8, 0.32, 0x6b4a8a, 0, 1.0, 0);                 // robe
    box(g, 0.44, 0.44, 0.44, 0xd9a27c, 0, 1.62, 0);             // head
    box(g, 0.52, 0.2, 0.52, 0x3d2a57, 0, 1.9, 0);               // hood
    box(g, 0.3, 0.12, 0.3, 0x3d2a57, 0, 2.05, 0.05);
    box(g, 0.08, 0.08, 0.02, 0x111111, -0.1, 1.66, -0.225); box(g, 0.08, 0.08, 0.02, 0x111111, 0.1, 1.66, -0.225);
    box(g, 0.6, 0.7, 0.4, 0x8a5a2b, 0, 1.15, 0.36);             // giant backpack
    box(g, 0.2, 0.3, 0.2, 0xffd23a, 0.18, 1.6, 0.4, { emissive: 0x664400 });
    for (const s of [-1, 1]) box(g, 0.18, 0.6, 0.2, 0x3d2a57, s * 0.13, 0.3, 0);
    const t = tag('Pip the Peddler 🎒'); t.position.y = 2.6; g.add(t);
    g.position.set(x, gy, z);
    this.scene.add(g);
    this.pip = { g, st, t: 0, x, z, y: gy, tier: Math.hypot(x, z) > 650 ? 2 : Math.hypot(x, z) > 300 ? 1 : 0 };
    this.chat('', '🎒 Someone is camped by the landmark. A traveling peddler?');
  }

  /** Ray vs Pip, for punching/tapping him. */
  hitPip(o, dir, maxDist) {
    if (!this.pip) return null;
    const c = this.pip.g.position, min = [c.x - 0.5, c.y, c.z - 0.5], max = [c.x + 0.5, c.y + 2.2, c.z + 0.5];
    const oo = [o.x, o.y, o.z], dd = [dir.x, dir.y, dir.z];
    let t0 = 0, t1 = maxDist;
    for (let i = 0; i < 3 && t0 <= t1; i++) {
      const inv = 1 / dd[i]; let a = (min[i] - oo[i]) * inv, b = (max[i] - oo[i]) * inv;
      if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    return t0 <= t1 ? t0 : null;
  }

  openShop() {
    const s = this.rpg.s, el = $('shop'), tier = this.pip.tier;
    this.controls.enabled = false; document.exitPointerLock?.();
    const rows = STOCK.filter((it) => it.tier <= tier && !(it.relic && this.rpg.has(it.k)));
    const greet = ['"Ah, a customer! Out here! Sit, sit."', '"You look like someone who pokes at things. I like that."', '"Everything\'s for sale. Except the backpack. Don\'t ask about the backpack."'][Math.floor(Math.random() * 3)];
    el.innerHTML = `<div class="jr-card shop"><div class="jr-head"><b>🎒 Pip the Peddler</b><button class="jr-x">✕</button></div>
      <p>${greet}</p><p class="small">You have 🪙 ${s.coins}.${tier < 2 ? ' <i>Pip hints he carries stranger goods when met farther from spawn.</i>' : ''}</p>
      <div class="jr-list">${rows.map((it, i) => `<button data-i="${i}" ${s.coins < it.price ? 'disabled' : ''}>${it.label}<span>🪙 ${it.price}</span></button>`).join('')}</div>
      <p class="say" id="pip-say"></p></div>`;
    el.hidden = false;
    el.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => this.buy(rows[Number(b.dataset.i)])));
  }

  buy(it) {
    const s = this.rpg.s;
    if (s.coins < it.price) return;
    s.coins -= it.price;
    let say = '"Pleasure doing business."';
    if (it.k === 'rumor') say = `"${this.discovery.rumor()}"`;
    else if (it.k === 'beanstalk') { const p = this.player.pos; this.hooks.beanstalk(Math.floor(p.x) + 2, Math.floor(p.y) - 1, Math.floor(p.z)); say = '"Stand back. It grows fast. Towards the clouds, usually."'; }
    else if (it.k === 'star') { this.rpg.startStar(); say = '"Drink it quick — it doesn\'t last!"'; }
    else if (it.k === 'feather') { s.relics.push('feather'); this.rpg.banner(`Relic: ${RELICS.feather.name}`, RELICS.feather.desc, RELICS.feather.icon); say = '"Found it on a sky island. Or it found me."'; }
    else s.items[it.k]++;
    this.rpg.renderHud();
    this.openShop();
    $('pip-say').textContent = say;
  }

  closeShop() { $('shop').hidden = true; this.controls.enabled = true; }

  // ---- sky whale ---------------------------------------------------------------------------------------------
  spawnWhale() {
    const p = this.player.pos, a = Math.random() * 6.28;
    const g = new THREE.Group(), o = { fog: false };
    const body = 0x3b5a8c, belly = 0xb9cbe6;
    box(g, 7, 6, 20, body, 0, 0, 0, o);
    box(g, 6.6, 2, 16, belly, 0, -3.2, 1, o);
    box(g, 5, 4, 6, body, 0, 0.5, 12, o);
    const tail = new THREE.Group(); tail.position.set(0, 0, 14); g.add(tail);
    box(tail, 10, 0.8, 3, body, 0, 0, 2, o);
    const fins = [-1, 1].map((s) => { const f = new THREE.Group(); f.position.set(s * 3.5, -1.5, -3); g.add(f); box(f, 7, 0.6, 3.5, body, s * 3.5, 0, 0, o); return f; });
    for (let i = 0; i < 14; i++) box(g, 0.6, 0.6, 0.6, 0x9ff7ff, (Math.random() < 0.5 ? -1 : 1) * 3.52, Math.random() * 4 - 1, Math.random() * 18 - 9, { ...o, emissive: 0x9ff7ff, emissiveIntensity: 2 });
    for (const s of [-1, 1]) box(g, 0.5, 0.8, 0.8, 0x111111, s * 3.55, 0.8, -7.5, o);
    const dir = new THREE.Vector3(Math.cos(a + Math.PI), 0, Math.sin(a + Math.PI));
    g.position.set(p.x + Math.cos(a) * 240, 118, p.z + Math.sin(a) * 240);
    g.rotation.y = Math.atan2(-dir.x, -dir.z);
    g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    this.scene.add(g);
    this.whale = { g, dir, tail, fins, t: 0, blessed: false };
    this.chat('', '🐋 Something enormous is moving across the night sky…');
  }

  update(dt, isNight) {
    const p = this.player.pos;
    // Pip turns up at landmarks you have found
    if ((this.timer -= dt) <= 0) {
      this.timer = 3;
      if (!this.pip) {
        for (const type of ['obelisk', 'vault']) for (const st of sitesNear(this.world, type, p.x, p.z, 60)) {
          if (this.visited.has(st.id)) continue;
          this.visited.add(st.id);
          if (this.world.getChunk(Math.floor(st.x / CS), Math.floor(st.z / CS)) && Math.random() < 0.5) this.spawnPip(st);
        }
      } else if (Math.hypot(this.pip.x - p.x, this.pip.z - p.z) > 90) { this.scene.remove(this.pip.g); this.pip = null; }
    }
    if (this.pip) { this.pip.t += dt; this.pip.g.rotation.y = Math.atan2(-(p.x - this.pip.x), -(p.z - this.pip.z)); this.pip.g.position.y = this.pip.y + Math.abs(Math.sin(this.pip.t * 2)) * 0.03; }

    // a sky whale may cross when night falls
    if (isNight && !this.lastNight && !this.whale && Math.random() < 0.4) this.spawnWhale();
    this.lastNight = isNight;
    const w = this.whale;
    if (w) {
      w.t += dt;
      w.g.position.addScaledVector(w.dir, dt * 9);
      w.tail.rotation.x = Math.sin(w.t * 1.2) * 0.25;
      w.fins.forEach((f, i) => { f.rotation.z = (i ? -1 : 1) * Math.sin(w.t * 1.2) * 0.3; });
      w.g.position.y = 118 + Math.sin(w.t * 0.3) * 4;
      if (!w.blessed && w.g.position.distanceTo(p) < 26) {
        w.blessed = true;
        const s = this.rpg.s; s.maxFp += 3; s.fp = s.maxFp; s.blessed++;
        this.rpg.renderHud();
        this.rpg.banner('The sky whale sings', 'A sound older than the stars passes through you. Max FP +3.', '🐋');
      }
      if (w.t > 60) { this.scene.remove(w.g); this.whale = null; }
    }
  }
}
