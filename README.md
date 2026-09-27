# Voxelia

A voxel sandbox game in the style of Minecraft, built with **Three.js**. It aims for a more atmospheric look than
vanilla Minecraft, runs on **desktop and mobile**, and has **real-time multiplayer**.
The full design brief is in [`PROMPT.md`](PROMPT.md).

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000 – game server + Vite hot reload
```

Production:

```bash
npm run build
npm start              # serves dist/ and the WebSocket endpoint on $PORT (default 3000)
```

To play with friends, open the same URL from other devices (e.g. `http://<your-LAN-IP>:3000`). The world
seed, time of day and every block edit are shared. Edits are saved to `world.json`. If the page is served without
the Node server (plain static hosting), the game switches to single player.

## Deploying to Vercel

Vercel hosts the game client as a static site. It can't run the multiplayer server, because Vercel functions can't
keep WebSocket connections open.

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new). `vercel.json` already configures the Vite
   build and the `dist` output, so keep the defaults and click **Deploy**.
   Or from a terminal: `npx vercel` for a preview, then `npx vercel --prod`.
2. With no other setup, the Vercel site runs in **single-player** mode.
3. **For multiplayer**, host `server.js` on a service that supports WebSockets. For example, on
   [Render](https://render.com), create a new *Blueprint* from this repo; `render.yaml` sets up the server.
   Railway and Fly.io also work (build `npm install && npm run build`, start `npm start`).
   Then, in the Vercel project, open **Settings → Environment Variables**, add
   `VITE_WS_URL = wss://<your-server-host>/ws`, and redeploy.
   The server also serves the game itself, so its own URL works without Vercel.

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move | WASD / arrows | Left-side virtual joystick (push fully forward to sprint) |
| Look | Mouse (click to capture) | Drag on the right side |
| Jump / swim up | Space | ▲ |
| Fly | Double-tap Space or F | Double-tap ▲ |
| Fly down | C / Ctrl | ▼ |
| Sprint | Shift | Push the joystick all the way |
| Break | Left click (hold to repeat) | Long-press or ⛏ |
| Place | Right click | Tap or ▣ |
| Select block | 1–9 / mouse wheel | Tap the hotbar |
| Chat | T / Enter | 💬 |
| Hacks menu | H (N = noclip, X = X-ray) | ⚡ Hacks |

## RPG mode (Super Mario RPG style)

- **Enemies** roam the world: Shroomba, Spikey and Buzzbee. Their level rises with yours and with distance from spawn.
  Walk into one to start a **turn-based battle**; up to 3 nearby enemies join. Landing on one from above gives a
  **First Strike**, but don't jump on Spikey.
- **Battle menu** (diamond buttons, or keys A / X / Y / B / R): ⚔️ Attack, ✨ Special (🦘 Super Jump: keep your timing
  to chain up to 8 hits; 🔥 Fire Burst: hits every enemy), 🍄 Items (Mushroom, Honey Syrup), 🛡 Defend, 🏃 Run.
- **Timed hits:** press Space / click / tap when the ring turns gold. On your attacks it doubles damage ("Nice!"); on enemy attacks it halves the damage you take ("Guard!").
- **Progression:** XP, level-ups (+HP, FP, attack, defense, magic), coins, and items. Progress is saved in your browser.
- **Floating ? blocks:** punch them for coins, Mushrooms or Honey Syrup.
- Enemies can be switched off in the hacks menu ("Enemies & battles").

## Hacks and animals

Open the **Hacks** menu with H or the ⚡ button:

- **Movement:** Fly (✈️ button on mobile), Speed ×3, Super jump, Moon gravity, Noclip (fly through walls)
- **Vision:** X-ray (only ores and TNT are drawn), Fullbright, a time-of-day slider, Freeze time
- **Destruction:** Nuker (breaks a 3-block radius), Explosive punch, **TNT rain**. Punch a TNT block to light it; explosions set off nearby TNT, knock back you and the animals, and shake the camera
- **Building:** Big brush places 3×3×3 blocks at once
- **Fun:** Animal rain, Launch me

Pigs, cows, sheep and chickens spawn in herds on grass. They wander, hop up ledges, swim, and panic when hit;
chickens flutter down slowly. Explosions and big edits are synced in multiplayer, but animals and lit TNT only exist on
your own screen.

## Graphics

- PBR materials, ACES tone mapping, and procedural 64px textures with generated **normal maps**
- Smooth per-vertex **ambient occlusion**, with quads flipped to avoid AO artifacts
- Physical **sky** with volumetric-looking clouds, a day/night cycle (15 min), sun, moon and stars, plus image-based lighting regenerated from the sky
- Sun **shadow maps** that follow the player
- Translucent, reflective **water** with two scrolling normal layers and vertex waves; underwater fog
- **Wind-swayed** leaves, grass and flowers; block-break particles; head bob; sprint FOV
- Coal, iron, gold and diamond ores underground
- Quality presets: **Low** (phones), **Medium** (larger shadow map, longer view distance), **High** (longer view distance + GTAO)

## Architecture

```
server.js          Express + ws: static files / Vite middleware, seed, edits, player relay, chat, persistence
src/main.js        renderer, sky/lighting, chunk streaming, player physics, interaction, HUD, networking glue
src/world.js       seeded terrain (biomes, caves, trees), chunk storage, edits, voxel raycast
src/mesher.js      chunk meshing: face culling, AO, plants, water
src/textures.js    procedural texture + normal atlas, hotbar icons, water normals
src/controls.js    desktop + touch input
src/avatar.js      remote player model with interpolation and name tag
src/net.js         WebSocket client
```

Chunks are 16×16×128. They are generated and meshed around the player within a fixed time budget per frame,
and chunks that move out of range are unloaded. Edits are stored per chunk, so a reloaded chunk keeps its changes.
