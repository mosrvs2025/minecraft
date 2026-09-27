import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { B, BLOCKS, HOTBAR, TILE, CS, CH, SEA } from './blocks.js';
import { World, chunkKey } from './world.js';
import { meshChunk } from './mesher.js';
import { buildAtlas, makeIcon, makeWaterNormal, tileUV } from './textures.js';
import { Controls } from './controls.js';
import { Net } from './net.js';
import { Avatar } from './avatar.js';
import { Mobs } from './mobs.js';
import { Hacks } from './hacks.js';
import { Rpg } from './rpg.js';
import { Discovery } from './discovery.js';
import { Wonders } from './wonders.js';
import { sitesNear } from './landmarks.js';

const $ = (id) => document.getElementById(id);
const MOBILE = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const QUALITY = {
  low: { rd: 4, dpr: 1, shadow: 1024, ao: false, post: false },
  medium: { rd: 6, dpr: 1.5, shadow: 2048, ao: false, post: false },
  high: { rd: 9, dpr: 2, shadow: 4096, ao: true, post: true },
};
const DAY = 900; // seconds per full day

// ---- start menu -----------------------------------------------------------------
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
$('name').value = store.get('vx-name') || `Crafter${Math.floor(Math.random() * 900 + 100)}`;
$('quality').value = store.get('vx-quality') || (MOBILE ? 'low' : 'medium');
$('play').addEventListener('click', () => {
  const name = $('name').value.trim().slice(0, 16) || 'Crafter';
  store.set('vx-name', name); store.set('vx-quality', $('quality').value);
  $('menu').hidden = true;
  if (MOBILE) document.documentElement.requestFullscreen?.().catch(() => {});
  start(name, QUALITY[$('quality').value]).catch((e) => { console.error(e); $('loading').textContent = 'Error: ' + e.message; });
});
$('status').textContent = MOBILE ? 'Touch controls enabled' : 'WASD move · Mouse look · Click to break/place';

async function start(name, Q) {
  $('loading').hidden = false;
  const net = new Net();
  const welcome = await net.connect();
  const seed = welcome?.seed ?? Math.floor(Math.random() * 2 ** 31);
  const world = new World(seed);
  if (welcome) for (const [x, y, z, b] of welcome.edits) world.set(x, y, z, b);
  net.send({ t: 'hello', name });

  // ---- renderer ------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: !Q.post, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.dpr));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.55;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  $('app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 1400);
  camera.rotation.order = 'YXZ';
  scene.fog = new THREE.Fog(0xaaccee, 10, Q.rd * CS);

  // ---- sky, sun, moon, stars, clouds -------------------------------------------------
  const sky = new Sky(); sky.scale.setScalar(1200);
  const su = sky.material.uniforms;
  su.turbidity.value = 2.2; su.rayleigh.value = 1.3; su.mieCoefficient.value = 0.003; su.mieDirectionalG.value = 0.85;
  su.cloudCoverage.value = 0.42; su.cloudDensity.value = 0.55; su.cloudElevation.value = 0.55;
  scene.add(sky);
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(sky.geometry, sky.material); envSky.scale.setScalar(500); envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null, envTimer = 0;

  const starGeo = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 2500; i++) {
    const v = new THREE.Vector3().randomDirection(); if (v.y < -0.1) v.y = -v.y;
    sp.push(v.x * 1000, v.y * 1000, v.z * 1000);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
  scene.add(stars);

  const moon = new THREE.Mesh(new THREE.CircleGeometry(28, 32), new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false, transparent: true }));
  scene.add(moon);


  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  const sc = sun.shadow.camera, SR = Q.rd >= 8 ? 80 : 55;
  sc.left = -SR; sc.right = SR; sc.top = SR; sc.bottom = -SR; sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x5a4a38, 0.5);
  scene.add(hemi);

  // ---- materials -------------------------------------------------------------------
  const atlas = buildAtlas(renderer.capabilities.getMaxAnisotropy());
  const uTime = { value: 0 };
  const windify = (mat) => {
    mat.onBeforeCompile = (s) => {
      s.uniforms.uTime = uTime;
      s.vertexShader = 'attribute float wind;\nattribute float glow;\nvarying float vGlow;\nuniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vGlow = glow;
        vec4 wW = modelMatrix * vec4(transformed, 1.0);
        float sw = sin(uTime * 1.8 + wW.x * 0.55 + wW.z * 0.35) * 0.6 + sin(uTime * 3.3 + wW.x * 1.7 + wW.z) * 0.25;
        transformed.x += sw * wind * 0.11;
        transformed.z += cos(uTime * 1.4 + wW.z * 0.6) * wind * 0.07;`);
      // glowing blocks (crystals, starstones, glowcaps) light themselves, which reads best at night
      s.fragmentShader = 'varying float vGlow;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vGlow * 1.6;');
    };
    return mat;
  };
  const solidMat = windify(new THREE.MeshStandardMaterial({
    map: atlas.map, normalMap: atlas.normalMap, normalScale: new THREE.Vector2(0.9, 0.9),
    vertexColors: true, alphaTest: 0.5, roughness: 0.88, metalness: 0,
  }));
  const plantMat = windify(new THREE.MeshStandardMaterial({
    map: atlas.map, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9,
  }));
  const waterNormal = makeWaterNormal();
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1d5a78, transparent: true, opacity: 0.78, roughness: 0.04, metalness: 0.15,
    normalMap: waterNormal, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.6,
  });
  waterMat.onBeforeCompile = (s) => {
    s.uniforms.uTime = uTime;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wW = modelMatrix * vec4(transformed, 1.0);
      if (normal.y > 0.5) transformed.y += (sin(uTime * 1.6 + wW.x * 0.8) + cos(uTime * 1.3 + wW.z * 0.7)) * 0.035 - 0.07;`);
    s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_maps>', `
      vec3 mapN = texture2D(normalMap, vNormalMapUv + vec2(uTime * 0.02, uTime * 0.013)).xyz * 2.0 - 1.0;
      vec3 mapN2 = texture2D(normalMap, vNormalMapUv * 0.47 - vec2(uTime * 0.011, -uTime * 0.017)).xyz * 2.0 - 1.0;
      mapN = normalize(vec3((mapN.xy + mapN2.xy) * normalScale, mapN.z * mapN2.z));
      normal = normalize(tbn * mapN);`).replace('void main() {', 'uniform float uTime;\nvoid main() {');
  };

  // ---- post-processing ---------------------------------------------------------------
  let composer = null;
  if (Q.post) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    if (Q.ao) {
      const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
      ao.blendIntensity = 0.8;
      composer.addPass(ao);
    }
    composer.addPass(new OutputPass());
  }
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); composer?.setSize(innerWidth, innerHeight);
  });

  // ---- chunk streaming ---------------------------------------------------------------------
  const offsets = (r) => {
    const o = [];
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= (r + 0.5) ** 2) o.push([dx, dz, dx * dx + dz * dz]);
    return o.sort((a, b) => a[2] - b[2]);
  };
  const genOffsets = offsets(Q.rd + 1), meshOffsets = offsets(Q.rd);

  function remesh(c) {
    for (const m of c.meshes) { scene.remove(m); m.geometry.dispose(); }
    c.meshes = [];
    const g = meshChunk(world, c);
    const add = (geo, mat, cast) => {
      if (!geo) return;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(c.cx * CS, 0, c.cz * CS);
      m.castShadow = cast; m.receiveShadow = true;
      m.matrixAutoUpdate = false; m.updateMatrix();
      scene.add(m); c.meshes.push(m);
    };
    add(g.solid, solidMat, true); add(g.plant, plantMat, true); add(g.water, waterMat, false);
    c.dirty = false; c.meshed = true;
  }
  const neighborsReady = (cx, cz) => world.getChunk(cx + 1, cz) && world.getChunk(cx - 1, cz) && world.getChunk(cx, cz + 1) && world.getChunk(cx, cz - 1)
    && world.getChunk(cx + 1, cz + 1) && world.getChunk(cx - 1, cz - 1) && world.getChunk(cx - 1, cz + 1) && world.getChunk(cx + 1, cz - 1);

  let unloadTimer = 0;
  function streamChunks(px, pz, dt, budgetMs) {
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS), t0 = performance.now();
    for (const [dx, dz] of genOffsets) {
      if (performance.now() - t0 > budgetMs) break;
      if (!world.getChunk(pcx + dx, pcz + dz)) world.generateChunk(pcx + dx, pcz + dz);
    }
    for (const [dx, dz] of meshOffsets) {
      if (performance.now() - t0 > budgetMs * 1.6) break;
      const c = world.getChunk(pcx + dx, pcz + dz);
      if (c && c.dirty && neighborsReady(c.cx, c.cz)) remesh(c);
    }
    if ((unloadTimer -= dt) < 0) {
      unloadTimer = 2;
      const lim = (Q.rd + 3) ** 2;
      for (const [k, c] of world.chunks) {
        if ((c.cx - pcx) ** 2 + (c.cz - pcz) ** 2 > lim) {
          for (const m of c.meshes) { scene.remove(m); m.geometry.dispose(); }
          world.chunks.delete(k);
        }
      }
    }
  }

  // ---- player ------------------------------------------------------------------------------
  let spawn = [8.5, 0, 8.5];
  for (let r = 0; r < 400; r += 8) {
    const a = r * 0.37, x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
    const { h } = world.column(x, z);
    if (h > SEA + 1) { spawn = [x + 0.5, h + 2, z + 0.5]; break; }
  }
  const player = { pos: new THREE.Vector3(...spawn), vel: new THREE.Vector3(), onGround: false, fly: false, inWater: false, bob: 0 };
  const PW = 0.3, PH = 1.8, EYE = 1.62;

  function collides(p) {
    for (let x = Math.floor(p.x - PW); x <= Math.floor(p.x + PW); x++)
      for (let y = Math.floor(p.y); y <= Math.floor(p.y + PH); y++)
        for (let z = Math.floor(p.z - PW); z <= Math.floor(p.z + PW); z++)
          if (world.isSolid(x, y, z)) return true;
    return false;
  }
  function moveAxis(axis, d) {
    if (hacks.state.noclip) { player.pos[axis] += d; return false; }
    const p = player.pos, steps = Math.ceil(Math.abs(d) / 0.4) || 1, s = d / steps;
    for (let i = 0; i < steps; i++) {
      p[axis] += s;
      if (!collides(p)) continue;
      if (axis === 'y') p.y = s < 0 ? Math.floor(p.y) + 1 : Math.floor(p.y + PH) - PH - 1e-3;
      else p[axis] = s > 0 ? Math.floor(p[axis] + PW) - PW - 1e-3 : Math.floor(p[axis] - PW) + 1 + PW + 1e-3;
      return true;
    }
    return false;
  }

  // ---- HUD, hotbar ---------------------------------------------------------------------------
  let sel = 0;
  const hotbar = $('hotbar');
  HOTBAR.forEach((id, i) => {
    const slot = document.createElement('div'); slot.className = 'slot';
    slot.innerHTML = `<img src="${makeIcon(atlas.canvas, id)}" alt=""><span>${i + 1}</span>`;
    slot.title = BLOCKS[id].name;
    const pick = (e) => { e.preventDefault(); e.stopPropagation(); select(i, false); };
    slot.addEventListener('touchstart', pick, { passive: false }); slot.addEventListener('mousedown', pick);
    hotbar.appendChild(slot);
  });
  let nameTimer;
  function select(v, rel) {
    sel = rel ? (sel + v + HOTBAR.length) % HOTBAR.length : v;
    [...hotbar.children].forEach((s, i) => s.classList.toggle('sel', i === sel));
    const nm = $('blockname'); nm.textContent = BLOCKS[HOTBAR[sel]].name; nm.classList.add('show');
    clearTimeout(nameTimer); nameTimer = setTimeout(() => nm.classList.remove('show'), 1200);
  }
  select(0, false);

  // ---- particles --------------------------------------------------------------------------------
  const PN = 300;
  const parts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), new THREE.MeshStandardMaterial({ roughness: 0.9 }), PN);
  parts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); parts.frustumCulled = false; parts.castShadow = true;
  const pdata = Array.from({ length: PN }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3() }));
  let pNext = 0; const tmpM = new THREE.Matrix4(), tmpC = new THREE.Color();
  for (let i = 0; i < PN; i++) { parts.setMatrixAt(i, tmpM.makeScale(0, 0, 0)); parts.setColorAt(i, tmpC.set(0xffffff)); }
  scene.add(parts);
  function burst(x, y, z, id) {
    const b = BLOCKS[id], tile = b.kind === 'cube' ? b.tiles[2] : b.tile, [r, g, bl] = atlas.avg[tile];
    for (let i = 0; i < 18; i++) {
      const d = pdata[pNext];
      d.life = 0.6 + Math.random() * 0.5;
      d.p.set(x + Math.random(), y + Math.random(), z + Math.random());
      d.v.set((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4);
      const k = 0.75 + Math.random() * 0.4;
      parts.setColorAt(pNext, tmpC.setRGB(r * k, g * k, bl * k, THREE.SRGBColorSpace));
      pNext = (pNext + 1) % PN;
    }
    parts.instanceColor.needsUpdate = true;
  }
  function updateParticles(dt) {
    for (let i = 0; i < PN; i++) {
      const d = pdata[i];
      if (d.life <= 0) continue;
      d.life -= dt; d.v.y -= 16 * dt; d.p.addScaledVector(d.v, dt);
      if (world.isSolid(Math.floor(d.p.x), Math.floor(d.p.y), Math.floor(d.p.z))) { d.v.multiplyScalar(0.3); d.p.y = Math.floor(d.p.y) + 1; }
      const s = Math.max(0, Math.min(1, d.life * 3));
      parts.setMatrixAt(i, tmpM.makeScale(s, s, s).setPosition(d.p));
    }
    parts.instanceMatrix.needsUpdate = true;
  }

  // ---- block interaction -----------------------------------------------------------------------
  const highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
  scene.add(highlight);
  let target = null;
  const lookDir = new THREE.Vector3();
  const remeshNow = (chunks) => { for (const c of chunks) if (c.meshed || neighborsReady(c.cx, c.cz)) remesh(c); };

  function setBlock(x, y, z, id, local) {
    remeshNow(world.set(x, y, z, id));
    if (local) net.send({ t: 'block', x, y, z, b: id });
  }
  function doBreak() {
    const reach = MOBILE ? 5.5 : 6;
    const mh = mobs.raycast(camera.position, lookDir, reach);
    const blockDist = target ? camera.position.distanceTo(tmpV.set(target.hit[0] + 0.5, target.hit[1] + 0.5, target.hit[2] + 0.5)) - 0.5 : Infinity;
    const pipD = wonders.hitPip(camera.position, lookDir, reach);
    if (pipD !== null && pipD < blockDist) { wonders.openShop(); return; }
    const eh = rpg.raycast(camera.position, lookDir, reach);
    if (eh && eh.dist < blockDist && (!mh || eh.dist < mh.dist) && !hacks.state.boom) { swing = 1; rpg.engage(eh.enemy, 'punch'); return; }
    if (mh && mh.dist < blockDist) {
      swing = 1;
      if (hacks.state.boom) { explode(mh.mob.pos.x, mh.mob.pos.y + 0.5, mh.mob.pos.z, 3.5); return; }
      const m = mh.mob;
      if (mobs.hit(m, lookDir, hacks.state.speed ? 25 : 9)) { mobPoof(m); }
      return;
    }
    if (!target) return;
    const [x, y, z] = target.hit;
    swing = 1;
    if (target.id === B.QBLOCK) { burst(x, y, z, B.QBLOCK); setBlock(x, y, z, rpg.openQBlock(x, y, z), true); return; }
    const tb = BLOCKS[target.id];
    if (!hacks.state.nuker && !hacks.state.boom && !controls.down) {
      if (target.id === B.STARSTONE) { burst(x, y, z, B.STARSTONE); discovery.touchStarstone(x, y, z); return; }
      if (target.id === B.VAULT) { burst(x, y, z, B.VAULT); setBlock(x, y, z, rpg.openVault(x, y, z), true); return; }
      if (target.id === B.BEACON) { rpg.rest(); return; }
      if (tb.resist) { hint('The stone hums. Nothing you have can break it.'); return; }
      if (tb.tough) { burst(x, y, z, target.id); hint(rpg.echo('dash') || rpg.echo('slam') ? 'Too sturdy for fists. Try a Shell Dash, a Spore Slam… or TNT.' : 'Too sturdy for bare fists. Something with more force might crack it… or TNT.'); return; }
    }
    if (hacks.state.boom) { explode(x + 0.5, y + 0.5, z + 0.5, 3.5); return; }
    if (hacks.state.nuker) {
      const list = [];
      for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
        if (dx * dx + dy * dy + dz * dz > 10) continue;
        const id = world.get(x + dx, y + dy, z + dz);
        if (id === B.AIR || id === B.WATER) continue;
        if (Math.random() < 0.15) burst(x + dx, y + dy, z + dz, id);
        list.push([x + dx, y + dy, z + dz, B.AIR]);
      }
      applyBatch(list, null, true);
      return;
    }
    if (target.id === B.TNT) { setBlock(x, y, z, B.AIR, true); primeTNT(x + 0.5, y, z + 0.5, 3); return; }
    burst(x, y, z, target.id);
    setBlock(x, y, z, B.AIR, true);
    if (BLOCKS[world.get(x, y + 1, z)].kind === 'plant') setBlock(x, y + 1, z, B.AIR, true);
    rpg.onMined(target.id, x, y, z);
    swing = 1;
  }
  let hintAt = 0;
  function hint(t) { const now = performance.now(); if (now - hintAt > 2500) { hintAt = now; chatLine('', t); } }
  function doPlace() {
    if (!target) return;
    const [x, y, z] = BLOCKS[target.id].kind === 'plant' ? target.hit : target.prev;
    const cur = world.get(x, y, z);
    if (cur !== B.AIR && cur !== B.WATER && BLOCKS[cur].kind !== 'plant') return;
    const p = player.pos;
    if (x + 1 > p.x - PW && x < p.x + PW && y + 1 > p.y && y < p.y + PH && z + 1 > p.z - PW && z < p.z + PW) return;
    swing = 1;
    if (hacks.state.brush) {
      const list = [];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const bx = x + dx, by = y + dy, bz = z + dz, c = world.get(bx, by, bz);
        if (c !== B.AIR && c !== B.WATER && BLOCKS[c].kind !== 'plant') continue;
        if (bx + 1 > p.x - PW && bx < p.x + PW && by + 1 > p.y && by < p.y + PH && bz + 1 > p.z - PW && bz < p.z + PW) continue;
        list.push([bx, by, bz, HOTBAR[sel]]);
      }
      applyBatch(list, null, true);
      return;
    }
    setBlock(x, y, z, HOTBAR[sel], true);
    if (HOTBAR[sel] === B.BEACON) rpg.setHome(x, y, z);
  }

  function applyBatch(list, fx, local) {
    const dirty = new Set();
    for (const [x, y, z, b] of list) for (const c of world.set(x, y, z, b)) dirty.add(c);
    remeshNow(dirty);
    if (local && list.length) {
      for (let i = 0; i < list.length; i += 4000) net.send({ t: 'blocks', list: list.slice(i, i + 4000), fx: i === 0 && fx ? fx : undefined });
    }
  }

  // ---- TNT & explosions -------------------------------------------------------------------------------
  const tntTex = (tile) => { const t = atlas.map.clone(); const [u0, v0, u1, v1] = tileUV(tile); t.offset.set(u0, v0); t.repeat.set(u1 - u0, v1 - v0); t.needsUpdate = true; return t; };
  const sideT = tntTex(TILE.TNT_SIDE), topT = tntTex(TILE.TNT_TOP);
  const tntGeo = new THREE.BoxGeometry(0.98, 0.98, 0.98);
  const tnts = [];
  function primeTNT(x, y, z, fuse, vel) {
    const ms = [sideT, sideT, topT, topT, sideT, sideT].map((map) => new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveIntensity: 0 }));
    const mesh = new THREE.Mesh(tntGeo, ms); mesh.castShadow = true;
    const t = { mesh, pos: new THREE.Vector3(x, y, z), vel: vel ?? new THREE.Vector3(0, 4, 0), fuse };
    mesh.position.copy(t.pos).y += 0.49; scene.add(mesh); tnts.push(t);
  }
  function updateTNT(dt) {
    for (const t of [...tnts]) {
      t.fuse -= dt;
      t.vel.y = Math.max(-40, t.vel.y - 26 * dt);
      t.pos.addScaledVector(t.vel, dt);
      if (world.isSolid(Math.floor(t.pos.x), Math.floor(t.pos.y), Math.floor(t.pos.z))) { t.pos.y = Math.floor(t.pos.y) + 1; t.vel.set(0, 0, 0); }
      t.mesh.position.copy(t.pos).y += 0.49;
      const flash = Math.floor(t.fuse * 5) % 2 === 0 ? 0.9 : 0;
      for (const m of t.mesh.material) m.emissiveIntensity = flash;
      t.mesh.scale.setScalar(1 + (t.fuse < 0.5 ? (0.5 - t.fuse) * 0.4 : 0));
      if (t.fuse <= 0) {
        scene.remove(t.mesh); t.mesh.material.forEach((m) => m.dispose()); tnts.splice(tnts.indexOf(t), 1);
        explode(t.pos.x, t.pos.y + 0.5, t.pos.z, 4);
      }
    }
  }

  const fxList = [];
  const fireGeo = new THREE.IcosahedronGeometry(1, 2);
  const boomLight = new THREE.PointLight(0xffa040, 0, 40, 1.5); scene.add(boomLight);
  let shake = 0;
  function explosionFx(x, y, z, r) {
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(fireGeo, new THREE.MeshBasicMaterial({ color: i ? 0x666058 : 0xffb347, transparent: true, depthWrite: false, fog: false }));
      m.position.set(x + (Math.random() - 0.5) * r * 0.5, y + (Math.random() - 0.5) * r * 0.5, z + (Math.random() - 0.5) * r * 0.5);
      scene.add(m); fxList.push({ m, t: 0, dur: i ? 1.2 : 0.45, r: r * (i ? 1.1 : 1.4) });
    }
    boomLight.position.set(x, y + 1, z); boomLight.intensity = 400;
    const d = camera.position.distanceTo(tmpV.set(x, y, z));
    shake = Math.max(shake, Math.max(0, 1 - d / (r * 8)));
  }
  function updateFx(dt) {
    for (const f of [...fxList]) {
      f.t += dt; const k = f.t / f.dur;
      f.m.scale.setScalar(f.r * (0.3 + Math.sqrt(k) * 0.9));
      f.m.material.opacity = Math.max(0, 1 - k) * 0.85;
      if (f.dur > 1) f.m.position.y += dt * 2;
      if (k >= 1) { scene.remove(f.m); f.m.material.dispose(); fxList.splice(fxList.indexOf(f), 1); }
    }
    boomLight.intensity *= Math.exp(-dt * 10);
    shake = Math.max(0, shake - dt * 1.8);
  }
  function explode(x, y, z, r) {
    const list = [], cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z), R = Math.ceil(r);
    let bursts = 0;
    for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) > r - Math.random() * 1.2) continue;
      const bx = cx + dx, by = cy + dy, bz = cz + dz, id = world.get(bx, by, bz);
      if (id === B.AIR || id === B.WATER || by < 1 || BLOCKS[id].resist) continue;
      if (id === B.TNT) {
        const v = new THREE.Vector3(dx, 2, dz).normalize().multiplyScalar(7);
        primeTNT(bx + 0.5, by, bz + 0.5, 0.4 + Math.random() * 0.8, v);
      } else if (bursts < 10 && Math.random() < 0.2) { burst(bx, by, bz, id); bursts++; }
      list.push([bx, by, bz, B.AIR]);
    }
    applyBatch(list, [x, y, z, r], true);
    explosionFx(x, y, z, r);
    mobs.blast(tmpV.set(x, y, z), r);
    rpg.blast(new THREE.Vector3(x, y, z), r);
    const d = player.pos.clone().add(new THREE.Vector3(0, 0.9, 0)).sub(new THREE.Vector3(x, y, z));
    const dist = d.length();
    if (dist < r * 2.5 && !hacks.state.noclip) {
      const k = (1 - dist / (r * 2.5)) * 28;
      player.vel.addScaledVector(d.normalize(), k); player.vel.y += k * 0.4;
    }
  }
  function mobPoof(m) {
    for (let i = 0; i < 3; i++) burst(m.pos.x - 0.5, m.pos.y + i * 0.3, m.pos.z - 0.5, B.FLOWER);
    mobs.remove(m);
  }

  // ---- chat -----------------------------------------------------------------------------------------
  const chatLog = $('chatlog'), chatIn = $('chatin');
  function chatLine(from, text) {
    const d = document.createElement('div');
    d.textContent = from ? `${from}: ${text}` : text;
    if (!from) d.className = 'sys';
    chatLog.appendChild(d);
    while (chatLog.children.length > 8) chatLog.firstChild.remove();
    setTimeout(() => d.classList.add('old'), 9000);
  }
  function openChat() {
    if (!net.online) { chatLine('', 'Chat needs a multiplayer server.'); return; }
    controls.enabled = false; document.exitPointerLock?.();
    chatIn.hidden = false; chatIn.value = ''; chatIn.focus();
  }
  chatIn.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { const t = chatIn.value.trim(); if (t) { net.send({ t: 'chat', text: t }); chatLine(name, t); } }
    if (e.key === 'Enter' || e.key === 'Escape') { chatIn.hidden = true; chatIn.blur(); controls.enabled = true; if (!MOBILE) renderer.domElement.requestPointerLock?.(); }
  });
  $('b-chat')?.addEventListener('touchstart', (e) => { e.preventDefault(); openChat(); }, { passive: false });

  const controls = new Controls(renderer.domElement, {
    mobile: MOBILE, onBreak: doBreak, onPlace: doPlace, onSelect: select, onChat: openChat,
    onFlyToggle: () => hacks.toggle('fly'),
    onKey: (code) => {
      if (code === 'KeyH') hacks.open ? hacks.close() : openHacks();
      if (code === 'KeyN') hacks.toggle('noclip');
      if (code === 'KeyX') hacks.toggle('xray');
      if (code === 'KeyE') startDash();
      if (code === 'KeyQ') startSlam();
      if (code === 'KeyV') startSense();
      if (code === 'KeyJ') $('journal').hidden ? discovery.openJournal() : discovery.closeJournal();
    },
  });

  const mobs = new Mobs(scene, world);
  const hacks = new Hacks({
    onToggle: (k, v) => {
      if (k === 'fly') { player.fly = v; player.vel.y = 0; $('b-down').hidden = !v; }
      if (k === 'noclip' && v && !hacks.state.fly) hacks.set('fly', true);
      if (k === 'fly' && !v && hacks.state.noclip) hacks.set('noclip', false);
      if (k === 'xray') { world.xray = v; world.xrayCenter = null; senseT = 0; for (const c of world.chunks.values()) c.dirty = true; }
      if (k === 'enemies') rpg.enabled = v;
      const names = { enemies: 'Enemies', fly: 'Flying', speed: 'Speed', jump: 'Super jump', moon: 'Moon gravity', noclip: 'Noclip', xray: 'X-ray', fullbright: 'Fullbright', nuker: 'Nuker', boom: 'Explosive punch', brush: 'Big brush', freeze: 'Time freeze', mobs: 'Animal spawning' };
      chatLine('', `${names[k]} ${v ? 'ON' : 'OFF'}`);
    },
    onAction: (a) => {
      const p = player.pos;
      if (a === 'tntRain') for (let i = 0; i < 12; i++) primeTNT(p.x + (Math.random() - 0.5) * 30, p.y + 25 + Math.random() * 15, p.z + (Math.random() - 0.5) * 30, 2.5 + Math.random() * 2.5, new THREE.Vector3());
      if (a === 'animalRain') mobs.rain(p);
      if (a === 'launch') { if (hacks.state.fly) hacks.set('fly', false); player.vel.y = hacks.state.moon ? 25 : 45; }
      hacks.close();
    },
    onTime: (min) => { timeOfDay = ((min - 360) / 1440) * DAY; },
    onClose: () => { controls.enabled = true; if (!MOBILE && !controls.locked) renderer.domElement.requestPointerLock?.(); },
  });
  const rpg = new Rpg({
    scene, camera, world, player, controls, burst, chat: chatLine, isMobile: MOBILE, getSun: () => sunDir,
    onBattle: (on) => {
      controls.enabled = !on; controls.breakHeld = controls.placeHeld = false;
      if (on) document.exitPointerLock?.();
      player.vel.set(0, 0, 0); dashT = 0; slamming = false;
      document.body.classList.toggle('in-battle', on);
    },
    hooks: {
      setBlocks: (list) => applyBatch(list, null, true),
      explode: (x, y, z, r) => explode(x, y, z, r),
      isNight: () => sunDir.y < -0.05,
      beanstalk: (x, y, z) => beanstalk(x, y, z),
      onBossDefeated: (site) => bossDefeated(site),
      teleport: (x, y, z) => teleport(x, y, z),
      shake: (v) => { shake = Math.max(shake, v); },
      onEchoes: (r) => { $('b-dash').hidden = !r.echo('dash'); $('b-slam').hidden = !r.echo('slam'); $('b-sense').hidden = !r.echo('sense'); },
    },
  });
  const discovery = new Discovery({ world, player, rpg, chat: chatLine, controls, teleport: (x, y, z) => teleport(x, y, z) });
  const wonders = new Wonders({ scene, world, player, rpg, discovery, chat: chatLine, controls, hooks: { beanstalk: (x, y, z) => beanstalk(x, y, z) } });

  function teleport(x, y, z) { player.pos.set(x, y, z); player.vel.set(0, 0, 0); airJumps = 0; slamming = false; dashT = 0; }

  /** A ? block (or Pip) plants a spiral beanstalk that climbs toward the clouds — and the sky islands. */
  function beanstalk(x, y, z) {
    const top = Math.min(CH - 6, Math.max(y + 24, 100));
    let h = y + 1;
    const grow = () => {
      const list = [];
      for (let k = 0; k < 2 && h <= top; k++, h++) {
        list.push([x, h, z, B.LOG]);
        const a = h * (Math.PI / 4), sx = x + Math.round(Math.cos(a) * 2), sz = z + Math.round(Math.sin(a) * 2);
        if (world.get(sx, h, sz) === B.AIR) list.push([sx, h, sz, B.LEAVES]);
      }
      if (h > top) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (world.get(x + dx, top + 1, z + dz) === B.AIR) list.push([x + dx, top + 1, z + dz, B.LEAVES]);
      applyBatch(list, null, true);
      if (h <= top) setTimeout(grow, 90);
    };
    grow();
  }

  /** Defeating a Mycelord changes its grove for everyone: the glowcap turns gold, and a trophy appears at home. */
  function bossDefeated(site) {
    const list = [], top = site.y + 17;
    for (let dx = -12; dx <= 12; dx++) for (let dz = -12; dz <= 12; dz++) for (let dy = -4; dy <= 5; dy++)
      if (world.get(site.x + dx, top + dy, site.z + dz) === B.CAP_GLOW) list.push([site.x + dx, top + dy, site.z + dz, B.CAP_GOLD]);
    let spot = null;
    const hb = rpg.s.homeBlock;
    if (hb) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      if (world.get(hb[0] + dx, hb[1], hb[2] + dz) === B.AIR) { spot = [hb[0] + dx, hb[1], hb[2] + dz]; break; }
    }
    if (!spot) { const gy = rpg.groundAt(site.x + 0.5, site.y + 6, site.z + 8.5, 12) ?? site.y + 1; spot = [site.x, gy, site.z + 8]; }
    list.push([...spot, B.TROPHY]);
    applyBatch(list, null, true);
    chatLine('', hb ? '🏆 A golden trophy appears beside your home beacon.' : '🏆 A golden trophy rises where the Mycelord fell. (Set a home beacon and future trophies will go there.)');
  }
  function openHacks() {
    controls.enabled = false; document.exitPointerLock?.();
    controls.breakHeld = controls.placeHeld = false;
    const dayMin = (((timeOfDay / DAY) * 1440 + 360) % 1440 + 1440) % 1440;
    hacks.show(dayMin);
  }
  const tapBtn = (id, fn) => { const el = $(id); el.addEventListener('click', fn); el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false }); };
  tapBtn('hack-btn', openHacks);
  tapBtn('b-fly', () => hacks.toggle('fly'));
  tapBtn('b-dash', () => startDash());
  tapBtn('b-slam', () => startSlam());
  tapBtn('b-sense', () => startSense());

  // ---- echo movement: hover/glide, shell dash, spore slam, echo sense ------------------------------------------------
  let prevJump = false, airJumps = 0, dashT = 0, dashCd = 0, slamming = false, slamFrom = 0, senseT = 0, senseCd = 0;
  const dashDir = new THREE.Vector3();
  const SOFT = new Set([B.DIRT, B.GRASS, B.SAND, B.LEAVES, B.SNOW, B.TALLGRASS, B.FLOWER, B.CRACKED, B.GLASS, B.MYCEL, B.CAP_RED, B.CAP_GLOW]);
  const HARD = new Set([B.STONE, B.COBBLE, B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.BRICK, B.PLANKS, B.LOG, B.STEM]);
  const SLAMMABLE = new Set([B.GEODE, B.CRACKED, B.GLASS, B.LEAVES]);
  function startDash() {
    if (!rpg.echo('dash') || rpg.inBattle || dashCd > 0 || !controls.enabled) return;
    dashDir.set(-Math.sin(controls.yaw), 0, -Math.cos(controls.yaw));
    dashT = 0.32; dashCd = 0.9; shake = Math.max(shake, 0.15);
  }
  function startSlam() {
    if (!rpg.echo('slam') || rpg.inBattle || player.onGround || player.fly || slamming || !controls.enabled) return;
    slamming = true; slamFrom = player.pos.y; player.vel.x *= 0.3; player.vel.z *= 0.3;
  }
  function startSense() {
    if (!rpg.echo('sense') || senseCd > 0 || hacks.state.xray) return;
    const cx = Math.floor(player.pos.x / CS), cz = Math.floor(player.pos.z / CS);
    world.xray = true; world.xrayCenter = [cx, cz];
    for (const c of world.chunks.values()) if (Math.abs(c.cx - cx) <= 2 && Math.abs(c.cz - cz) <= 2) c.dirty = true;
    senseT = rpg.has('lantern') ? 8 : 4; senseCd = 18;
    chatLine('', '👁 The ground turns to glass around you…');
  }
  function endSense() {
    const [cx, cz] = world.xrayCenter ?? [0, 0];
    world.xray = hacks.state.xray; world.xrayCenter = null;
    for (const c of world.chunks.values()) if (Math.abs(c.cx - cx) <= 2 && Math.abs(c.cz - cz) <= 2) c.dirty = true;
  }
  function dashSmash(dt) {
    const p = player.pos, list = [];
    // look far enough ahead to cover this frame's travel (21 blocks/s) plus the body's half-width
    for (const ahead of [0.7, 0.7 + 21 * dt]) for (const dy of [0, 1]) for (const side of [-0.3, 0, 0.3]) {
      const bx = Math.floor(p.x + dashDir.x * ahead - dashDir.z * side), by = Math.floor(p.y + dy + 0.1), bz = Math.floor(p.z + dashDir.z * ahead + dashDir.x * side);
      const id = world.get(bx, by, bz);
      if (SOFT.has(id) || (rpg.has('shell') && HARD.has(id))) {
        if (!list.some((e) => e[0] === bx && e[1] === by && e[2] === bz)) { list.push([bx, by, bz, B.AIR]); burst(bx, by, bz, id); rpg.onMined(id, bx, by, bz); }
      }
    }
    if (list.length) { applyBatch(list, null, true); shake = Math.max(shake, 0.2); }
    const e = rpg.enemies.find((en) => en.pos.distanceTo(p) < (en.T.radius || 0) + 1.6);
    if (e) { dashT = 0; rpg.engage(e, 'dash'); }
    for (const m of mobs.list) if (m.pos.distanceTo(p) < 1.6) mobs.hit(m, dashDir, 16);
  }
  function slamImpact(under, fall) {
    const p = player.pos, bx = Math.floor(p.x), by = Math.floor(p.y - 0.1), bz = Math.floor(p.z);
    shake = Math.max(shake, Math.min(1, 0.3 + fall * 0.02));
    if (BLOCKS[under].bouncy) {
      player.vel.y = Math.min(44, 17 + fall * 0.9); player.onGround = false;
      rpg.popText('BOING!', p.clone().add(new THREE.Vector3(0, 2, 0)), 'nice');
      return;
    }
    const list = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy >= -1; dy--) {
      const id = world.get(bx + dx, by + dy, bz + dz);
      if (id === B.TNT) { list.push([bx + dx, by + dy, bz + dz, B.AIR]); primeTNT(bx + dx + 0.5, by + dy, bz + dz + 0.5, 1.5); }
      else if (SLAMMABLE.has(id)) { list.push([bx + dx, by + dy, bz + dz, B.AIR]); burst(bx + dx, by + dy, bz + dz, id); }
    }
    if (list.length) applyBatch(list, null, true);
    burst(bx, by, bz, under);
    mobs.blast(p.clone(), 1.5);
    const e = rpg.enemies.find((en) => en.pos.distanceTo(p) < (en.T.radius || 0) + 4.5);
    if (e) rpg.engage(e, 'slam');
  }
  $('b-down').hidden = true;
  document.addEventListener('pointerlockchange', () => { $('hint').hidden = controls.locked || MOBILE || !chatIn.hidden; });
  $('hint').hidden = MOBILE;

  // ---- multiplayer --------------------------------------------------------------------------------------
  const avatars = new Map();
  const addAvatar = (m) => {
    if (avatars.has(m.id)) return;
    const a = new Avatar(m.id, m.name); a.setState(m.p, m.r); a.group.position.copy(a.target);
    avatars.set(m.id, a); scene.add(a.group);
  };
  const updateCount = () => { $('players').textContent = net.online ? `● ${avatars.size + 1} online` : 'Offline · single player'; };
  if (welcome) welcome.players.forEach(addAvatar);
  net.on('join', (m) => { addAvatar(m); updateCount(); });
  net.on('leave', (m) => { const a = avatars.get(m.id); if (a) { scene.remove(a.group); a.dispose(); avatars.delete(m.id); } updateCount(); });
  net.on('move', (m) => { const a = avatars.get(m.id); if (a) { a.setState(m.p, m.r); if (m.a) a.swing = 1; } });
  net.on('block', (m) => {
    const old = world.get(m.x, m.y, m.z);
    if (m.b === B.AIR && old !== B.AIR && world.getChunk(Math.floor(m.x / CS), Math.floor(m.z / CS))) burst(m.x, m.y, m.z, old);
    setBlock(m.x, m.y, m.z, m.b, false);
  });
  net.on('blocks', (m) => {
    applyBatch(m.list, null, false);
    if (m.fx) { explosionFx(m.fx[0], m.fx[1], m.fx[2], m.fx[3]); mobs.blast(new THREE.Vector3(m.fx[0], m.fx[1], m.fx[2]), m.fx[3]); }
  });
  net.on('chat', (m) => chatLine(m.from, m.text));
  net.on('disconnect', () => { chatLine('', 'Disconnected from server.'); updateCount(); });
  updateCount();

  // ---- environment update --------------------------------------------------------------------------------
  const sunDir = new THREE.Vector3(), tmpV = new THREE.Vector3(), xrayBg = new THREE.Color(0x05060a);
  const cNight = new THREE.Color(0x05080f), cDay = new THREE.Color(0x8fb4d8), cSet = new THREE.Color(0xf2a36b), cWater = new THREE.Color(0x0d3550);
  const fogCol = new THREE.Color();
  let timeOfDay = (welcome?.time ?? 0) + DAY * 0.1;

  function updateEnvironment(dt, eye) {
    if (!hacks.state.freeze) timeOfDay += dt;
    const a = (timeOfDay / DAY) * Math.PI * 2;
    sunDir.set(Math.cos(a), Math.sin(a), 0.35).normalize();
    su.sunPosition.value.copy(sunDir);
    const day = THREE.MathUtils.smoothstep(sunDir.y, -0.12, 0.25);
    const sunset = Math.max(0, 1 - Math.abs(sunDir.y) / 0.28);
    const lightDir = sunDir.y > -0.05 ? sunDir : tmpV.copy(sunDir).negate();
    sun.position.copy(eye).addScaledVector(lightDir, 200);
    sun.target.position.copy(eye);
    const sunUp = THREE.MathUtils.smoothstep(sunDir.y, -0.02, 0.35);
    sun.intensity = sunDir.y > -0.05 ? 0.15 + sunUp * 2.4 : 0.35 * THREE.MathUtils.smoothstep(-sunDir.y, 0.05, 0.3);
    sun.color.setRGB(1, 0.55 + sunUp * 0.42, 0.3 + sunUp * 0.6);
    if (sunDir.y <= -0.05) sun.color.setRGB(0.55, 0.65, 1);
    hemi.intensity = 0.1 + day * 1.0;
    hemi.color.setRGB(0.35 + day * 0.4, 0.42 + day * 0.43, 0.6 + day * 0.4);
    scene.environmentIntensity = 0.06 + day * 0.7;
    renderer.toneMappingExposure = 0.36 + (1 - day) * 0.2;

    fogCol.copy(cNight).lerp(cDay, day).lerp(cSet, sunset * 0.55 * Math.max(day, 0.3));
    const underwater = world.get(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z)) === B.WATER;
    if (underwater) { scene.fog.color.copy(cWater).multiplyScalar(0.3 + day * 0.7); scene.fog.near = 0.5; scene.fog.far = 22; }
    else { scene.fog.color.copy(fogCol); scene.fog.near = Q.rd * CS * 0.45; scene.fog.far = Q.rd * CS * 0.98; }
    $('app').classList.toggle('underwater', underwater);
    if (hacks.state.fullbright || hacks.state.xray) {
      hemi.intensity = 1.1; hemi.color.setRGB(1, 1, 1); scene.environmentIntensity = 0.6; renderer.toneMappingExposure = 0.5;
    }
    if (hacks.state.xray) { scene.fog.color.setRGB(0.02, 0.02, 0.04); scene.fog.near = 20; scene.fog.far = Q.rd * CS * 1.2; }
    sky.visible = !hacks.state.xray; scene.background = hacks.state.xray ? xrayBg : null;

    sky.position.copy(eye); stars.position.copy(eye);
    stars.material.opacity = Math.max(0, 1 - day * 1.6);
    stars.rotation.x = a * 0.2;
    moon.position.copy(eye).addScaledVector(sunDir, -900); moon.lookAt(eye);
    moon.material.opacity = Math.max(0, 1 - day * 1.3);
    su.time.value = timeOfDay * 40;

    if ((envTimer -= dt) <= 0) {
      envTimer = MOBILE ? 12 : 4;
      envRT?.dispose();
      envRT = pmrem.fromScene(envScene, 0.02);
      scene.environment = envRT.texture;
    }
  }

  // ---- main loop -----------------------------------------------------------------------------------------------
  const clock = new THREE.Timer();
  let ready = false, netTimer = 0, swing = 0, fpsT = 0, frames = 0, walked = 0;

  function updatePlayer(dt) {
    const c = controls, p = player;
    if (!world.getChunk(Math.floor(p.pos.x / CS), Math.floor(p.pos.z / CS))?.meshed) { camera.position.set(p.pos.x, p.pos.y + EYE, p.pos.z); return; } // wait for the ground after a warp
    const fwd = tmpV.set(-Math.sin(c.yaw), 0, -Math.cos(c.yaw));
    const wx = fwd.x * c.move.f + Math.cos(c.yaw) * c.move.r, wz = fwd.z * c.move.f - Math.sin(c.yaw) * c.move.r;
    const wl = Math.hypot(wx, wz), nx = wl > 1 ? wx / wl : wx, nz = wl > 1 ? wz / wl : wz;
    p.inWater = world.get(Math.floor(p.pos.x), Math.floor(p.pos.y + 0.4), Math.floor(p.pos.z)) === B.WATER;
    dashCd -= dt; senseCd -= dt;
    if (senseT > 0 && (senseT -= dt) <= 0) endSense();
    const jumpEdge = c.jump && !prevJump; prevJump = c.jump;
    const hover = rpg.echo('hover'), glideOk = hover || rpg.has('feather');
    const maxAir = (hover ? 1 : 0) + (rpg.has('clouds') ? 1 : 0);
    const speed = (p.fly ? (c.sprint ? 22 : 11) : p.inWater ? 3.2 : c.sprint ? 6.4 : 4.4) * (hacks.state.speed ? 3 : 1) * (rpg.star > 0 ? 1.5 : 1);
    const grav = hacks.state.moon ? 6 : 28, jumpV = (hacks.state.jump ? 18 : 8.7) * (rpg.has('spring') ? 1.2 : 1);
    const gliding = glideOk && !p.fly && !p.inWater && !p.onGround && c.jump && p.vel.y < -2.5 && !slamming;
    const acc = 1 - Math.exp(-dt * (p.onGround || p.fly ? 14 : p.inWater ? 5 : gliding ? 6 : 3.5));
    p.vel.x += (nx * speed * (gliding ? 1.35 : 1) - p.vel.x) * acc; p.vel.z += (nz * speed * (gliding ? 1.35 : 1) - p.vel.z) * acc;
    if (p.fly) p.vel.y += (((c.jump ? 1 : 0) - (c.down ? 1 : 0)) * speed - p.vel.y) * acc;
    else if (p.inWater) { p.vel.y -= grav * 0.32 * dt; p.vel.y *= 1 - 2.5 * dt; if (c.jump) p.vel.y = Math.min(p.vel.y + 24 * dt, 3.5); }
    else {
      p.vel.y = Math.max(-55, p.vel.y - grav * dt);
      if (c.jump && p.onGround) p.vel.y = jumpV;
      else if (jumpEdge && !p.onGround && airJumps < maxAir) {
        p.vel.y = jumpV * 0.95; airJumps++;
        burst(p.pos.x - 0.5, p.pos.y - 0.6, p.pos.z - 0.5, B.GLASS);
      }
      if (gliding) p.vel.y = Math.max(p.vel.y, -2.4);
    }
    if (slamming) { p.vel.y = -38; p.vel.x *= 0.9; p.vel.z *= 0.9; }
    if (dashT > 0) { dashT -= dt; p.vel.x = dashDir.x * 21; p.vel.z = dashDir.z * 21; p.vel.y = Math.max(p.vel.y, 0.4); dashSmash(dt); }

    const hitX = moveAxis('x', p.vel.x * dt); if (hitX) { p.vel.x = 0; if (dashT > 0) dashT = 0; }
    const hitZ = moveAxis('z', p.vel.z * dt); if (hitZ) { p.vel.z = 0; if (dashT > 0) dashT = 0; }
    const falling = p.vel.y < 0, vyBefore = p.vel.y;
    const hitY = moveAxis('y', p.vel.y * dt);
    p.onGround = hitY && falling;
    if (hitY) p.vel.y = 0;
    if (p.onGround) {
      airJumps = 0;
      const under = world.get(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.1), Math.floor(p.pos.z));
      if (slamming) { slamming = false; slamImpact(under, slamFrom - p.pos.y); }
      else if (BLOCKS[under].bouncy && vyBefore < -5 && !c.down) { p.vel.y = Math.min(24, -vyBefore * 0.8 + 5); p.onGround = false; }
    }
    // mobile auto-jump when walking into a 1-block step
    if (MOBILE && (hitX || hitZ) && p.onGround && wl > 0.3) {
      const fx = Math.floor(p.pos.x + nx * 0.6), fz = Math.floor(p.pos.z + nz * 0.6), fy = Math.floor(p.pos.y);
      if (world.isSolid(fx, fy, fz) && !world.isSolid(fx, fy + 1, fz) && !world.isSolid(fx, fy + 2, fz)) p.vel.y = Math.max(jumpV, 8.7);
    }
    if (p.pos.y < -20) { p.pos.set(...spawn); p.vel.set(0, 0, 0); }

    const hs = Math.hypot(p.vel.x, p.vel.z);
    if (p.onGround && hs > 0.5) { p.bob += dt * hs * 1.9; walked += hs * dt; } else p.bob *= 1 - dt * 6;
    camera.position.set(p.pos.x, p.pos.y + EYE + Math.abs(Math.sin(p.bob)) * 0.06, p.pos.z);
    if (shake > 0) camera.position.add(tmpV.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake * 0.5));
    camera.rotation.set(c.pitch, c.yaw, Math.sin(p.bob) * 0.004);
    const fov = 72 + (c.sprint && hs > 5 ? 8 : 0) + (p.fly && hs > 12 ? 6 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 8)); camera.updateProjectionMatrix(); }
  }

  function frame() {
    clock.update(); const dt = Math.min(clock.getDelta(), 0.05);
    uTime.value += dt;
    controls.update(dt);
    const eye = camera.position;

    if (!ready) {
      streamChunks(player.pos.x, player.pos.z, dt, 40);
      const c = world.getChunk(Math.floor(player.pos.x / CS), Math.floor(player.pos.z / CS));
      let meshed = 0; for (const [dx, dz] of meshOffsets.slice(0, 13)) meshed += world.getChunk(Math.floor(player.pos.x / CS) + dx, Math.floor(player.pos.z / CS) + dz)?.meshed ? 1 : 0;
      $('loading').textContent = `Generating world… ${Math.round(meshed / 13 * 100)}%`;
      if (c?.meshed && meshed >= 13) {
        while (collides(player.pos)) player.pos.y += 1;
        ready = true; $('loading').hidden = true; $('hud').hidden = false;
      }
      camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
    } else {
      streamChunks(player.pos.x, player.pos.z, dt, MOBILE ? 5 : 7);
      if (!rpg.inBattle) updatePlayer(dt);
      camera.getWorldDirection(lookDir);
      target = world.raycast(eye, lookDir, MOBILE ? 5.5 : 6);
      if (rpg.inBattle) target = null;
      highlight.visible = !!target;
      if (target) {
        const [x, y, z] = target.hit;
        highlight.position.set(x + 0.5, y + 0.5, z + 0.5);
        const pl = BLOCKS[target.id].kind === 'plant';
        highlight.scale.set(pl ? 0.7 : 1, pl ? 0.8 : 1, pl ? 0.7 : 1);
        if (pl) highlight.position.y -= 0.1;
      }
      swing = Math.max(0, swing - dt * 5);
      if ((netTimer -= dt) <= 0) {
        netTimer = 0.1;
        const p = player.pos;
        net.send({ t: 'move', p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], r: [+controls.yaw.toFixed(3), +controls.pitch.toFixed(3)], a: swing > 0.5 });
      }
    }
    updateEnvironment(dt, eye);
    updateParticles(dt);
    if (ready) {
      mobs.update(dt, player.pos, hacks.state.mobs); updateTNT(dt); rpg.update(dt); rpg.update3DHero(dt);
      if (!rpg.inBattle) discovery.update(dt, controls.yaw);
      wonders.update(dt, sunDir.y < -0.05);
    }
    updateFx(dt);
    for (const a of avatars.values()) a.update(dt);

    composer ? composer.render(dt) : renderer.render(scene, camera);

    frames++; fpsT += dt;
    if (fpsT > 0.5) {
      const p = player.pos, dayMin = (((timeOfDay / DAY) * 1440 + 360) % 1440 + 1440) % 1440, hr = Math.floor(dayMin / 60), mn = Math.floor(dayMin % 60);
      $('stats').textContent = `${Math.round(frames / fpsT)} fps · ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)} · ${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}${player.fly ? ' · flying' : ''}`;
      frames = 0; fpsT = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__vx = { renderer, world, player, controls, camera, hacks, mobs, explode, rpg, discovery, wonders, teleport, beanstalk, sites: (t, r = 900) => sitesNear(world, t, player.pos.x, player.pos.z, r), get time() { return timeOfDay; }, set time(v) { timeOfDay = v; } };
}
