// Inventory: every placeable block (click to put it in your hotbar), items, weapons to equip, vehicles to deploy.
import { BLOCKS, PLACEABLE } from './blocks.js';
import { ITEMS, WEAPONS } from './rpg.js';
import { VEHICLES } from './vehicles.js';

const $ = (id) => document.getElementById(id);

export class Inventory {
  constructor({ rpg, vehicles, controls, hotbar, getSel, setSlot, iconFor, getYaw }) {
    Object.assign(this, { rpg, vehicles, controls, hotbar, getSel, setSlot, iconFor, getYaw });
    this.tab = 'blocks';
    this.el = $('inv');
    this.el.addEventListener('click', (e) => { if (e.target.id === 'inv' || e.target.closest('.jr-x')) this.close(); });
    for (const ev of ['mousedown', 'touchstart', 'keydown', 'wheel']) this.el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }

  get open() { return !this.el.hidden; }

  show() { this.controls.enabled = false; document.exitPointerLock?.(); this.el.hidden = false; this.render(); }

  close() { this.el.hidden = true; this.controls.enabled = true; }

  render() {
    const s = this.rpg.s, sel = this.getSel();
    const tabs = [['blocks', '🧱 Blocks'], ['items', '🎒 Items'], ['weapons', '⚔️ Weapons'], ['vehicles', '🚗 Vehicles']];
    let body = '';
    if (this.tab === 'blocks') {
      body = `<p class="small">Click a block to put it in hotbar slot <b>${sel + 1}</b> (select a slot with 1–9 first).</p>
        <div class="inv-grid">${PLACEABLE.map((id) => `<button class="inv-b ${this.hotbar[sel] === id ? 'sel' : ''}" data-b="${id}" title="${BLOCKS[id].name}"><img src="${this.iconFor(id)}" alt=""><span>${BLOCKS[id].name}</span></button>`).join('')}</div>`;
    } else if (this.tab === 'items') {
      body = `<div class="jr-list">${Object.entries(ITEMS).map(([k, it]) => `<div class="inv-row"><b>${it.icon} ${it.name} ×${s.items[k] ?? 0}</b><span>${it.desc}</span></div>`).join('')}
        <div class="inv-row"><b>🪙 Coins: ${s.coins}</b><span>Spend them with Pip the Peddler.</span></div></div>
        <p class="small">Battle items are used from the 🍄 Item button in battle. Fossils open bone portals (3) and become a club (6).</p>`;
    } else if (this.tab === 'weapons') {
      body = `<div class="jr-list">${Object.entries(WEAPONS).map(([k, W]) => {
        const own = s.weapons.includes(k);
        return `<div class="inv-row ${own ? '' : 'locked'}"><b>${W.icon} ${own ? W.name : '???'}</b><span>${own ? W.desc : hintFor(k)}</span>
          ${own ? `<button data-w="${k}" ${s.weapon === k ? 'disabled' : ''}>${s.weapon === k ? 'Equipped' : 'Equip'}</button>` : ''}</div>`;
      }).join('')}</div>`;
    } else {
      body = `<div class="jr-list">${Object.entries(VEHICLES).map(([k, V]) => {
        const own = s.vehicles.includes(k), wild = k === 'bronto';
        return `<div class="inv-row ${own || wild ? '' : 'locked'}"><b>${V.icon} ${own || wild ? V.name : '???'}</b><span>${own || wild ? V.desc : 'Some things must be earned from their elders.'}</span>
          ${own ? `<button data-v="${k}">${k === 'dragon' ? 'Summon' : 'Deploy'}</button>` : ''}</div>`;
      }).join('')}</div><p class="small">R (or 🚗) near a vehicle to ride · steer by looking · W/S drive · Shift turbo.</p>`;
    }
    this.el.innerHTML = `<div class="jr-card inv"><div class="jr-head"><b>Inventory</b><button class="jr-x">✕</button></div>
      <div class="inv-tabs">${tabs.map(([k, n]) => `<button data-t="${k}" class="${this.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>${body}</div>`;
    this.el.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.t; this.render(); }));
    this.el.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => { this.setSlot(this.getSel(), Number(b.dataset.b)); this.render(); }));
    this.el.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => { s.weapon = b.dataset.w; this.rpg.renderHud(); this.rpg.hooks.onWeapon?.(); this.render(); }));
    this.el.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { this.vehicles.deploy(b.dataset.v, this.getYaw()); this.close(); }));
  }
}

function hintFor(k) {
  return {
    iron: 'Pip sells these, farther from spawn.', diamond: 'Only the wealthiest peddlers carry one.', club: 'Dig up enough fossils…',
    dragon: 'Held by something that lives on a spire.', blaster: 'Pip has a loud one for sale.',
  }[k] || '';
}
