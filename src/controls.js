// Unified desktop (pointer lock + keyboard) and mobile (joystick + touch look + buttons) input.
export class Controls {
  constructor(canvas, { mobile, onBreak, onPlace, onSelect, onFlyToggle, onChat, onKey }) {
    this.canvas = canvas; this.mobile = mobile;
    this.yaw = 0; this.pitch = 0;
    this.move = { f: 0, r: 0 }; this.jump = false; this.down = false; this.sprint = false;
    this.cb = { onBreak, onPlace, onSelect, onFlyToggle, onChat, onKey };
    this.breakHeld = false; this.placeHeld = false; this.repeat = 0;
    this.enabled = true; this.sens = 1;
    this.keys = new Set();
    mobile ? this.initTouch() : this.initDesktop();
  }

  get locked() { return document.pointerLockElement === this.canvas; }

  initDesktop() {
    const c = this.canvas;
    c.addEventListener('click', () => { if (this.enabled && !this.locked) c.requestPointerLock?.(); });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022 * this.sens;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - e.movementY * 0.0022 * this.sens));
    });
    c.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.breakHeld = true; this.cb.onBreak(); this.repeat = 0.3; }
      if (e.button === 2) { this.placeHeld = true; this.cb.onPlace(); this.repeat = 0.3; }
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) this.breakHeld = false; if (e.button === 2) this.placeHeld = false; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('wheel', (e) => { if (this.locked) this.cb.onSelect(Math.sign(e.deltaY), true); }, { passive: true });
    let lastSpace = 0;
    document.addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.tagName === 'INPUT') return;
      if (e.code === 'Space' && !e.repeat) {
        const now = performance.now();
        if (now - lastSpace < 280) this.cb.onFlyToggle();
        lastSpace = now;
      }
      if (e.code === 'KeyF' && !e.repeat) this.cb.onFlyToggle();
      if (['KeyH', 'KeyN', 'KeyX', 'KeyE', 'KeyQ', 'KeyV', 'KeyJ'].includes(e.code) && !e.repeat) this.cb.onKey?.(e.code);
      if ((e.code === 'KeyT' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); this.cb.onChat(); return; }
      if (/^Digit[1-9]$/.test(e.code)) this.cb.onSelect(Number(e.code.slice(5)) - 1, false);
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.breakHeld = this.placeHeld = false; });
  }

  initTouch() {
    const ui = document.getElementById('touch');
    ui.hidden = false;
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    let stickId = null, stickOrigin = null, lookId = null, last = null, tap = null, holdTimer = null;
    const R = 56;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };

    const btn = (id, down, up) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); down(); }, { passive: false });
      const end = (e) => { e.preventDefault(); el.classList.remove('on'); up?.(); };
      el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
    };
    let lastJump = 0;
    btn('b-jump', () => {
      const now = performance.now(); if (now - lastJump < 300) this.cb.onFlyToggle(); lastJump = now; this.jump = true;
    }, () => { this.jump = false; });
    btn('b-down', () => { this.down = true; }, () => { this.down = false; });
    btn('b-break', () => { this.breakHeld = true; this.cb.onBreak(); this.repeat = 0.3; }, () => { this.breakHeld = false; });
    btn('b-place', () => { this.cb.onPlace(); });

    const surface = this.canvas;
    surface.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.4 && stickId === null) {
          stickId = t.identifier; stickOrigin = [t.clientX, t.clientY];
          stick.style.left = `${t.clientX - 70}px`; stick.style.top = `${t.clientY - 70}px`; stick.classList.add('on');
        } else if (lookId === null) {
          lookId = t.identifier; last = [t.clientX, t.clientY];
          tap = { x: t.clientX, y: t.clientY, t: performance.now(), moved: false };
          clearTimeout(holdTimer);
          holdTimer = setTimeout(() => { if (tap && !tap.moved) { tap.hold = true; this.breakHeld = true; this.cb.onBreak(); this.repeat = 0.3; } }, 350);
        }
      }
    }, { passive: false });
    surface.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          let dx = t.clientX - stickOrigin[0], dy = t.clientY - stickOrigin[1];
          const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
          setKnob(dx, dy);
          this.move.r = dx / R; this.move.f = -dy / R;
          this.sprint = l > R * 0.95 && -dy / R > 0.8;
        } else if (t.identifier === lookId) {
          const dx = t.clientX - last[0], dy = t.clientY - last[1]; last = [t.clientX, t.clientY];
          this.yaw -= dx * 0.0055 * this.sens;
          this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * 0.0055 * this.sens));
          if (tap && Math.hypot(t.clientX - tap.x, t.clientY - tap.y) > 12) tap.moved = true;
        }
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null; this.move.f = this.move.r = 0; this.sprint = false; setKnob(0, 0); stick.classList.remove('on');
        } else if (t.identifier === lookId) {
          lookId = null; clearTimeout(holdTimer);
          if (tap && !tap.moved && !tap.hold && performance.now() - tap.t < 300) this.cb.onPlace();
          if (tap?.hold) this.breakHeld = false;
          tap = null;
        }
      }
    };
    surface.addEventListener('touchend', end); surface.addEventListener('touchcancel', end);
  }

  update(dt) {
    if (!this.mobile) {
      const k = this.keys, on = this.enabled && this.locked;
      this.move.f = on ? (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) : 0;
      this.move.r = on ? (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) : 0;
      this.jump = on && k.has('Space');
      this.down = on && (k.has('KeyC') || k.has('ControlLeft'));
      this.sprint = on && (k.has('ShiftLeft') || k.has('ShiftRight'));
    }
    if (this.breakHeld || this.placeHeld) {
      this.repeat -= dt;
      if (this.repeat <= 0) { this.repeat = 0.22; this.breakHeld ? this.cb.onBreak() : this.cb.onPlace(); }
    }
  }
}
