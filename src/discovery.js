// Discovery: noticing landmarks, remembering them on the compass, lore from Starstones, rumors, and the journal.
import { LANDMARKS, sitesNear, nearestSite } from './landmarks.js';
import { RELICS, ECHOES, ITEMS } from './rpg.js';

const $ = (id) => document.getElementById(id);
// how close you must get to notice each kind of landmark (the giant glowcap is visible from far away)
const NOTICE = { boss: 120, obelisk: 75, island: 85, vault: 30, geode: 9 };
const FIRST_TIME = {
  boss: 'A colossal glowing mushroom on the horizon. Something sleeps beneath it.',
  obelisk: 'A Starstone. Its altar stone hums — try touching it.',
  vault: 'An old ruin, sealed with cracked stone. Fists won\'t do. Something with more force might.',
  geode: 'A hollow crystal geode, wrapped in a shell too tough to punch. Crystals attract things that skitter.',
  island: 'Land, floating in the sky. There must be a way up there.',
};
const LORE = [
  'Before the stars fell, the mushrooms were small.',
  'The bees remember how to stand on air. Watch them long enough and you will too.',
  'Where the ground is cracked, something wanted to stay hidden.',
  'The shells of the desert do not break walls. They are walls, rolling.',
  'Crystals grow where the earth holds its breath. What lives there hates to share.',
  'The Mycelord dreams the grove. Wake it, and the grove wakes with it.',
  'Wear the crown, and every starstone becomes a door.',
  'Islands drift where the wind forgot to put them down.',
  'A peddler walks between the stones. He never finds the same thing twice.',
  'Fire leaves scars. So does everything else.',
  'When the sky sings at night, look up.',
  'Stand high, strike hard. The land is a weapon to those who read it.',
];
const RINGS = [250, 500, 800, 1200, 1800];
const RING_TEXT = [
  'Beyond here the land grows stranger. Enemies are tougher; groves are more common.',
  'Uncharted lands. Golden elites roam here, and they carry relics.',
  'The far wilds. Peddlers out here sell things you will not find near home.',
  'Very few would walk this far. The world keeps going.',
  'You are further from home than anyone should be.',
];
const dirName = (dx, dz) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];

export class Discovery {
  constructor({ world, player, rpg, chat, controls, teleport }) {
    Object.assign(this, { world, player, rpg, chat, controls, teleport });
    this.key = `vx-disc-${world.seed}`;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(this.key)); } catch { /* ignore */ }
    this.d = { sites: {}, lore: [], rings: 0, ...saved };
    this.timer = 0;
    this.compass = $('compass');
    $('journal-btn').addEventListener('click', () => this.openJournal());
    $('journal').addEventListener('click', (e) => { if (e.target.id === 'journal' || e.target.closest('.jr-x')) this.closeJournal(); });
    for (const ev of ['mousedown', 'touchstart', 'keydown', 'wheel']) $('journal').addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }

  save() { try { localStorage.setItem(this.key, JSON.stringify(this.d)); } catch { /* ignore */ } }

  mark(st, state) {
    const cur = this.d.sites[st.id];
    if (cur && (cur.state === 'found' || state === 'rumor')) return false;
    this.d.sites[st.id] = { type: st.type, x: st.x, y: st.y, z: st.z, state };
    this.save();
    return true;
  }

  update(dt, yaw) {
    const p = this.player.pos;
    if ((this.timer -= dt) <= 0) {
      this.timer = 0.5;
      for (const type of Object.keys(NOTICE)) {
        for (const st of sitesNear(this.world, type, p.x, p.z, NOTICE[type])) {
          if (type === 'geode' && Math.hypot(st.x - p.x, st.y - p.y, st.z - p.z) > NOTICE.geode) continue;
          const wasRumor = this.d.sites[st.id]?.state === 'rumor';
          if (!this.mark(st, 'found')) continue;
          const firstOfKind = Object.values(this.d.sites).filter((s) => s.type === type && s.state === 'found').length === 1;
          const xp = 3 + this.rpg.s.lvl;
          this.rpg.s.xp += xp; this.rpg.levelUps(); this.rpg.renderHud();
          const L = LANDMARKS[type];
          if (firstOfKind) this.rpg.banner(`Discovered: ${L.name}`, `${FIRST_TIME[type]} (+${xp} XP for exploring)`, L.icon);
          else this.chat('', `${L.icon} Discovered a ${L.name}${wasRumor ? ' — the rumor was true!' : ''} (+${xp} XP)`);
        }
      }
      const dist = Math.hypot(p.x, p.z);
      while (this.d.rings < RINGS.length && dist > RINGS[this.d.rings]) {
        const i = this.d.rings++;
        const c = 20 * (i + 1); this.rpg.s.coins += c; this.rpg.renderHud();
        this.rpg.banner(`Frontier ${i + 1}: ${RINGS[i]} blocks from spawn`, `${RING_TEXT[i]} (+${c} coins)`, '🧭');
        this.save();
      }
    }
    this.renderCompass(yaw);
  }

  renderCompass(yaw) {
    const p = this.player.pos, marks = [], span = Math.PI * 0.6, used = [];
    const place = (x, z, html, cls = '', label = '') => {
      const ang = Math.atan2(-(x - p.x), -(z - p.z));
      let rel = ang - yaw; rel = ((rel + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      if (Math.abs(rel) > span) return;
      const left = 50 - (rel / span) * 50;
      // markers are placed nearest-first; a crowded spot only shows the nearest distance
      const crowded = used.some((u) => Math.abs(u - left) < 5);
      if (label) used.push(left);
      marks.push(`<span class="cm ${cls}${crowded ? ' far' : ''}" style="left:${left}%">${html}${label && !crowded ? `<small>${label}</small>` : ''}</span>`);
    };
    for (const [n, x, z] of [['N', 0, -1e6], ['E', 1e6, 0], ['S', 0, 1e6], ['W', -1e6, 0]]) place(p.x + x, p.z + z, n, 'cardinal');
    const list = Object.entries(this.d.sites).map(([id, s]) => ({ ...s, id, dist: Math.hypot(s.x - p.x, s.z - p.z) }))
      .filter((s) => s.dist > 6 && s.dist < 1500).sort((a, b) => a.dist - b.dist).slice(0, 10);
    for (const s of list) {
      const done = s.type === 'boss' && this.rpg.s.bosses.includes(s.id);
      place(s.x, s.z, s.state === 'rumor' ? `❔${LANDMARKS[s.type].icon}` : LANDMARKS[s.type].icon, `${s.state}${done ? ' done' : ''}`, Math.round(s.dist));
    }
    const h = this.rpg.s.home;
    if (h && Math.hypot(h[0] - p.x, h[2] - p.z) > 6) place(h[0], h[2], '🏠', 'home', Math.round(Math.hypot(h[0] - p.x, h[2] - p.z)));
    this.compass.innerHTML = marks.join('');
  }

  /** Punching a Starstone's altar. */
  touchStarstone(x, y, z) {
    const st = nearestSite(this.world, 'obelisk', x, z, 6);
    if (!st) { this.chat('', 'The starstone is silent.'); return; }
    this.mark(st, 'found');
    if (this.rpg.s.crown) { this.warpMenu(st); return; }
    const i = Math.floor(st.seed * LORE.length);
    if (!this.d.lore.includes(i)) { this.d.lore.push(i); this.save(); }
    let hint = '';
    const boss = nearestSite(this.world, 'boss', st.x, st.z, 1600, (b) => this.rpg.s.bosses.includes(b.id));
    if (boss) {
      this.mark(boss, 'rumor');
      hint = ` The runes lean ${dirName(boss.x - st.x, boss.z - st.z)}, toward something ${Math.round(Math.hypot(boss.x - st.x, boss.z - st.z))} blocks away. (Marked on your compass.)`;
    }
    this.rpg.banner('The Starstone speaks', `“${LORE[i]}”${hint}`, '🗼');
  }

  warpMenu(here) {
    const stones = Object.entries(this.d.sites).filter(([id, s]) => s.type === 'obelisk' && s.state === 'found' && id !== here.id);
    const el = $('journal');
    el.hidden = false; this.controls.enabled = false; document.exitPointerLock?.();
    el.innerHTML = `<div class="jr-card"><div class="jr-head"><b>🗼 Starstone waystone</b><button class="jr-x">✕</button></div>
      <p>The Spore Crown resonates. Choose a starstone to travel to:</p>
      <div class="jr-list">${stones.length ? stones.map(([id, s]) => `<button data-id="${id}">🗼 ${dirName(s.x - here.x, s.z - here.z)} · ${Math.round(Math.hypot(s.x - here.x, s.z - here.z))} blocks · (${s.x}, ${s.z})</button>`).join('') : '<p>You have not found any other starstones yet. Find more and they will link up.</p>'}</div></div>`;
    el.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => {
      const s = this.d.sites[b.dataset.id];
      this.closeJournal();
      this.teleport(s.x + 0.5, s.y + 1, s.z + 2.5);
      this.chat('', '🗼 The world folds, and you step out beside another starstone.');
    }));
  }

  /** A rumor from a peddler: mark the nearest unknown interesting landmark. */
  rumor() {
    const p = this.player.pos;
    for (const type of ['island', 'vault', 'boss', 'geode', 'obelisk'].sort(() => Math.random() - 0.5)) {
      const st = nearestSite(this.world, type, p.x, p.z, 900, (s) => this.d.sites[s.id]);
      if (st) {
        this.mark(st, 'rumor');
        const d = Math.round(Math.hypot(st.x - p.x, st.z - p.z));
        return `There's a ${LANDMARKS[type].name} about ${d} blocks ${dirName(st.x - p.x, st.z - p.z)}${type === 'geode' ? ', deep underground' : ''}. I've marked it for you.`;
      }
    }
    return "Hm. I don't know anything you don't already know. Impressive.";
  }

  closeJournal() { $('journal').hidden = true; this.controls.enabled = true; }

  openJournal() {
    const r = this.rpg.s, el = $('journal');
    this.controls.enabled = false; document.exitPointerLock?.();
    const counts = {};
    for (const s of Object.values(this.d.sites)) if (s.state === 'found') counts[s.type] = (counts[s.type] || 0) + 1;
    const rumors = Object.values(this.d.sites).filter((s) => s.state === 'rumor').length;
    const kills = Object.entries(r.kills).map(([t, n]) => `<span>${t} ×${n}</span>`).join('') || '<i>No battles yet.</i>';
    const echoes = Object.keys(ECHOES).map((k) => {
      const E = ECHOES[k], got = this.rpg.echo(k);
      return `<div class="jr-row ${got ? '' : 'locked'}"><b>${E.icon} ${got ? E.name : '???'}</b><p>${got ? `${E.how}<br><i>${E.battle}</i>` : `Something about the ${E.from} seems worth studying. (Defeat 3)`}</p></div>`;
    }).join('');
    const relics = r.relics.map((k) => `<div class="jr-row"><b>${RELICS[k].icon} ${RELICS[k].name}</b><p>${RELICS[k].desc}</p></div>`).join('') || '<i>None yet. Sealed vaults, sky islands and golden elites keep them.</i>';
    const lore = this.d.lore.map((i) => `<p class="lore">“${LORE[i]}”</p>`).join('') || '<i>Starstones have things to say.</i>';
    const items = Object.entries(ITEMS).map(([k, it]) => `${it.icon}×${r.items[k] ?? 0}`).join(' ');
    el.innerHTML = `<div class="jr-card"><div class="jr-head"><b>📖 Journal</b><button class="jr-x">✕</button></div>
      <div class="jr-grid">
        <section><h4>Echoes</h4>${echoes}</section>
        <section><h4>Relics</h4>${relics}</section>
        <section><h4>Discoveries</h4><div class="jr-counts">${Object.keys(LANDMARKS).map((t) => `<span>${LANDMARKS[t].icon} ${LANDMARKS[t].name}: ${counts[t] || 0}</span>`).join('')}
          <span>❔ Rumors: ${rumors}</span><span>👑 Groves freed: ${r.bosses.length}</span><span>🧭 Frontiers: ${this.d.rings}</span></div>
          <h4>Bestiary</h4><div class="jr-counts">${kills}</div><h4>Pack</h4><p>${items} · 🪙 ${r.coins}</p></section>
        <section><h4>Starstone lore</h4>${lore}</section>
      </div></div>`;
    el.hidden = false;
  }
}
