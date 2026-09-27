// Blocky player model for remote players, with interpolated movement and a name tag.
import * as THREE from 'three';

function nameTag(text) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = '600 30px system-ui, sans-serif';
  const w = Math.min(248, ctx.measureText(text).width + 28);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.roundRect((256 - w) / 2, 10, w, 44, 12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, fog: false }));
  s.scale.set(1.6, 0.4, 1);
  return s;
}

export class Avatar {
  constructor(id, name) {
    const hue = (id * 0.618) % 1;
    const shirt = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue, 0.55, 0.45), roughness: 0.8 });
    const pants = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((hue + 0.5) % 1, 0.35, 0.25), roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a27c, roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const box = (w, h, d, m, x, y, z, pivotTop = false) => {
      const g = new THREE.BoxGeometry(w, h, d);
      if (pivotTop) g.translate(0, -h / 2, 0);
      const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); mesh.castShadow = true; return mesh;
    };
    this.group = new THREE.Group();
    this.body = box(0.5, 0.7, 0.26, shirt, 0, 1.1, 0);
    this.head = new THREE.Group(); this.head.position.set(0, 1.45, 0);
    const skull = box(0.46, 0.46, 0.46, skin, 0, 0.23, 0);
    this.head.add(skull, box(0.08, 0.08, 0.02, dark, -0.1, 0.25, -0.235), box(0.08, 0.08, 0.02, dark, 0.1, 0.25, -0.235));
    this.armL = box(0.2, 0.7, 0.2, shirt, -0.36, 1.45, 0, true);
    this.armR = box(0.2, 0.7, 0.2, shirt, 0.36, 1.45, 0, true);
    this.legL = box(0.22, 0.75, 0.24, pants, -0.12, 0.75, 0, true);
    this.legR = box(0.22, 0.75, 0.24, pants, 0.12, 0.75, 0, true);
    this.tag = nameTag(name); this.tag.position.y = 2.2;
    this.group.add(this.body, this.head, this.armL, this.armR, this.legL, this.legR, this.tag);
    this.target = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.phase = 0; this.swing = 0;
  }

  setState(p, r) { this.target.set(p[0], p[1], p[2]); this.yaw = r[0]; this.pitch = r[1]; }

  update(dt) {
    const g = this.group;
    const before = g.position.clone();
    if (g.position.distanceToSquared(this.target) > 100) g.position.copy(this.target);
    else g.position.lerp(this.target, 1 - Math.exp(-dt * 12));
    const speed = Math.hypot(g.position.x - before.x, g.position.z - before.z) / Math.max(dt, 1e-3);
    g.rotation.y += (((this.yaw - g.rotation.y + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * (1 - Math.exp(-dt * 10));
    this.head.rotation.x = this.pitch;
    this.phase += dt * Math.min(speed, 8) * 1.6;
    const amp = Math.min(1, speed / 4) * 0.7;
    this.legL.rotation.x = Math.sin(this.phase) * amp; this.legR.rotation.x = -Math.sin(this.phase) * amp;
    this.armL.rotation.x = -Math.sin(this.phase) * amp;
    this.swing = Math.max(0, this.swing - dt * 4);
    this.armR.rotation.x = Math.sin(this.phase) * amp - Math.sin(this.swing * Math.PI) * 1.4;
  }

  dispose() {
    this.group.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
  }
}
