// "Hacks" menu: toggles and one-shot actions, rendered into #hacks.
const TOGGLES = [
  ['fly', '✈️', 'Fly', 'F'],
  ['speed', '⚡', 'Speed ×3', ''],
  ['jump', '🦘', 'Super jump', ''],
  ['moon', '🌙', 'Moon gravity', ''],
  ['noclip', '👻', 'Noclip', 'N'],
  ['xray', '💎', 'X-ray', 'X'],
  ['fullbright', '💡', 'Fullbright', ''],
  ['nuker', '☢️', 'Nuker', ''],
  ['boom', '💥', 'Explosive punch', ''],
  ['brush', '🧱', 'Big brush 3×3', ''],
  ['freeze', '⏸️', 'Freeze time', ''],
  ['mobs', '🐷', 'Animals spawn', ''],
];
const ACTIONS = [
  ['tntRain', '🧨', 'TNT rain'],
  ['animalRain', '🐔', 'Animal rain'],
  ['launch', '🚀', 'Launch me'],
];

export class Hacks {
  constructor({ onToggle, onAction, onTime, onClose }) {
    this.state = Object.fromEntries(TOGGLES.map(([k]) => [k, false]));
    this.state.mobs = true;
    this.cb = { onToggle, onAction, onTime, onClose };
    const el = this.el = document.getElementById('hacks');
    el.innerHTML = `
      <div class="hk-card">
        <div class="hk-head"><b>Hacks</b><button class="hk-x" aria-label="Close">✕</button></div>
        <div class="hk-grid">${TOGGLES.map(([k, i, n, key]) => `<button class="hk" data-k="${k}"><span>${i}</span>${n}${key ? `<kbd>${key}</kbd>` : ''}</button>`).join('')}</div>
        <label class="hk-time">Time of day <input type="range" min="0" max="1440" step="10" /></label>
        <div class="hk-grid hk-act">${ACTIONS.map(([k, i, n]) => `<button class="hk" data-a="${k}"><span>${i}</span>${n}</button>`).join('')}</div>
        <p class="hk-tip">Punch TNT to light it. Hit animals to knock them flying.</p>
      </div>`;
    const stop = (e) => e.stopPropagation();
    for (const ev of ['mousedown', 'touchstart', 'touchmove', 'wheel', 'click', 'keydown']) el.addEventListener(ev, stop, { passive: true });
    el.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => this.toggle(b.dataset.k)));
    el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => this.cb.onAction(b.dataset.a)));
    el.querySelector('.hk-x').addEventListener('click', () => this.close());
    el.addEventListener('click', (e) => { if (e.target === el) this.close(); });
    this.slider = el.querySelector('input');
    this.slider.addEventListener('input', () => this.cb.onTime(Number(this.slider.value)));
    this.render();
  }

  get open() { return !this.el.hidden; }

  show(minutes) { this.slider.value = minutes; this.el.hidden = false; }

  close() { this.el.hidden = true; this.cb.onClose(); }

  set(k, v) { this.state[k] = v; this.render(); this.cb.onToggle(k, v); }

  toggle(k) { this.set(k, !this.state[k]); }

  render() {
    this.el.querySelectorAll('[data-k]').forEach((b) => b.classList.toggle('on', this.state[b.dataset.k]));
    const active = TOGGLES.filter(([k]) => this.state[k] && k !== 'mobs').map(([, i]) => i).join(' ');
    document.getElementById('active-hacks').textContent = active;
  }
}
