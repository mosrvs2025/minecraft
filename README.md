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
| Inventory | I | 🎒 |
| Ride / dismount a vehicle | R | 🚗 |
| Fire ranged weapon (TNT Blaster) | G | 🎯 |

## Worlds, creatures, weapons & vehicles

### Three realms
Walk through an **Ancient Portal** (two are always within ~350 blocks of spawn; the compass shows them once found):

| Realm | How to get in | What's there |
| --- | --- | --- |
| 🌍 Overworld | — | Everything below, plus volcanoes, fossil sites, coral reefs with fish, sharks in deep water |
| 🦖 Primeval Realm | Bone portal (needs **3 fossils**) | Jungle with giant trees, frequent volcanoes, raptor packs, T-Rexes, pterodactyl flocks, rideable brontosaurus herds |
| 🐉 Dragon Isles | Obsidian portal (needs the **Spore Crown** or **Lv 8**) | Floating islands over an endless sea, crystal veins, wyrmlings, and **Elder Dragons** sleeping on obsidian spires |

Realms are far-off regions of the same world, so multiplayer, block edits and saving work everywhere. Each has its own
fog colour and difficulty.

### Volcanoes, fossils, oceans
- **Volcanoes**: basalt cones with lava craters and lava rivers. They smoke constantly and erupt every so often: lava bombs
  land as magma (and hurt). Lava and magma burn you; running out of HP sends you home.
- **Fossil sites**: dinosaur skeletons half-buried in the ground. Mining bone or fossil stone gives **fossils**: 3
  open the bone portal, and 6 become the **Fossil Club**.
- **Oceans**: coral reefs, schools of fish that scatter when you swim through, and **sharks** that hunt swimmers.

### Creatures
| Creature | Where | |
| --- | --- | --- |
| Raptor | Primeval | Hunts in packs of 3 (battle) |
| T-Rex | Primeval | Huge; ROARs, then Mega Chomps, so guard it! Drops fossils |
| Brontosaurus | Primeval | Peaceful herds. Walk up and press R to ride one |
| Pterodactyl | Primeval sky | Ambient flocks |
| Shark | Deep ocean | Battles you in the water |
| Fish | Reefs | Ambient schools |
| Wyrmling | Dragon Isles | Flying fire-spitters |
| Elder Dragon | Dragon spires | Boss: Flamestorm (4 guards), Wing Buffet, summons wyrmlings. Beat it to **ride it** and get the Dragon Blade |
| Distant dragon | Far overworld skies | A glimpse of the Dragon Isles |

### Weapons (Inventory → Weapons)
Wooden Sword (+3), Iron Sword (+7), Diamond Sword (+12, Excellents are more frequent), Fossil Club (+9, 30% stun),
Dragon Blade (+18, burning hits, Fire Burst costs 1 FP), and the **TNT Blaster** (G fires TNT that explodes on impact).
Your weapon is visible in your hand. Pip sells iron, diamond and the blaster; the club and blade are earned.

### Vehicles (Inventory → Vehicles, then R to ride)
Go-kart (fast, Shift for turbo, hops single blocks), Boat (water), Brontosaurus (Primeval), and the Elder Dragon (flies
where you look; jump climbs, C dives). Ramming an enemy at speed starts a battle with a First Strike.

### Inventory & building
The **🎒 inventory (I)** shows every placeable block: 50+ including lava, water, magma, basalt, ice (slippery!), coral,
lanterns, wool, gold and diamond blocks, mushroom caps (bouncy!) and home beacons. Click one to put it in the selected hotbar slot. Your hotbar is saved.

## Echoes & consequences: how the systems connect

Voxelia's design rule: **everything you do in one system matters in another.**

### The battlefield is the world
Battles happen on the real terrain where they start. The 🌍 **Terrain** command (center of the battle diamond, key T)
reads the blocks around the fight:

| Nearby | Battle option | Consequence in the world |
| --- | --- | --- |
| TNT (placed earlier) | 💣 Detonate: heavy area damage, can hurt you | A real crater; nearby TNT chain-reacts |
| Ore / crystal | ⛏ Rip it out and hurl it (diamond hits hardest) / 🔮 shatter for full FP | The ore is gone from the world |
| A ledge 4+ blocks down | ⛰ Shove a foe off (timed) | It's out of the fight (half XP) |
| Water | 🌊 Splash: foes may lose a turn | |
| Trees | 🌳 Shake: apple, coins… or a Buzzbee drops in against you | |
| Sand | 🏜 Blind foes for 2 turns | |

Standing higher than your foes gives **+25% attack**; bouncy mushroom caps nearby power up **Super Jump**.
**Fire Burst scorches the land** (grass → dirt, leaves burn, snow melts) and **Spore Slam cracks the ground**.
TNT going off in the overworld hurts roaming enemies too, so **traps work**.

### Echoes: what you learn in battle becomes how you move
Defeat 3 of a kind and you learn its Echo, which works both in battle and in the world:

| Echo | From | In the world | In battle |
| --- | --- | --- | --- |
| 🪽 Hover | Buzzbee | Double jump; hold jump while falling to glide | Wider guard windows |
| 💨 Shell Dash (E) | Spikey | Dash through dirt, sand, leaves, **cracked ruins**; ramming an enemy = First Strike | Hits all grounded foes, ignores defense |
| 💥 Spore Slam (Q, mid-air) | Shroomba | Ground pound that cracks **geodes** and ruins, lights TNT; slam onto a **mushroom cap** for a huge bounce | Heavy hit + stun |
| 👁 Echo Sense (V) | Gem Mite | The ground turns transparent around you for a few seconds | See every enemy's next move |

### A world worth reading
- **Glowcap Groves**: violet biomes of giant bouncy mushrooms that glow at night. Each grove around a **giant
  glowcap** has a sleeping boss, the **Mycelord**. It is visible from far away.
- **Starstones**: tall obelisks topped with glowing runes. Touch the altar for lore, and a hint pointing to the nearest boss.
- **Ruin Vaults**: sealed with cracked stone (Shell Dash, Spore Slam or TNT, or build your way in) and holding relics.
- **Geodes**: hollow crystal spheres deep underground. Mining crystal or diamond can attract Gem Mites.
- **Sky Islands**: floating islands with rich ore and sky vaults (Cloud Boots, Star Shard). You can reach them with
  Hover, a beanstalk, a mountain glide, or by building.
- **Frontiers**: every ring of distance from spawn (250, 500, 800…) is stranger: more groves, golden **elites**
  carrying relics, and better peddler goods.

### Discovery chain
Starstone lore → hint toward a Mycelord → wake it (punch it, or blow it up) → **boss battle** (Spore Storm, Earthshaker,
summons minions; weak to fire) → its glowcap **turns gold** and Shroombas stop spawning there (synced as world edits) → you get
the **Spore Crown** → **every Starstone becomes a waystone** for fast travel between the ones you've found → a
**trophy** appears beside your home beacon.

### Ecology
Enemies depend on where you are: Buzzbees by day on flowery plains, Spikeys in deserts and snow, Shroombas in forests
(**Glowshrooms** at night), **Gem Mites** in caves, and golden elites far from spawn. Enemies 5+ levels below you
run away from you.

### Wandering things
- **Pip the Peddler** sometimes camps at landmarks. His stock depends on distance from spawn: healing, crystal
  shards, a beanstalk seed, a bottled Starman, the Feather Charm relic (far lands only) and **rumors** that mark an
  undiscovered landmark on your compass.
- A **sky whale** sometimes crosses the night sky. Get close to it (fly, glide, climb a beanstalk) and it raises your max FP.

### Home, compass & journal
Place a **Home beacon** (hotbar slot 9): punch it to rest, and you respawn there if defeated. The **compass** shows
landmarks you've found or heard about. The **journal** (J / 📖) lists echoes, relics, discoveries, bestiary and lore.

### Perfect timing
Every timing ring has a dead-centre **Excellent / Perfect guard** zone: Excellent attacks deal ×2.5, and a perfect guard blocks all
damage and counters. Enemies follow move patterns (Spikey **curls** so physical hits hurt you; Gem Mites **charge** a
huge spike) that you can read with Echo Sense.

## RPG mode (Super Mario RPG style)

- **Enemies** roam the world: Shroomba, Spikey and Buzzbee. Their level rises with yours and with distance from spawn.
  Walk into one to start a **turn-based battle**; up to 3 nearby enemies join. Landing on one from above gives a
  **First Strike**, but don't jump on Spikey.
- **Battle menu** (diamond buttons, or keys A / X / Y / B / R): ⚔️ Attack, ✨ Special (🦘 Super Jump: keep your timing
  to chain up to 8 hits; 🔥 Fire Burst: hits every enemy), 🍄 Items (Mushroom, Honey Syrup), 🛡 Defend, 🏃 Run.
- **Timed hits:** press Space / click / tap when the ring turns gold. On your attacks it doubles damage ("Nice!"); on enemy attacks it halves the damage you take ("Guard!").
- **Progression:** XP, level-ups (+HP, FP, attack, defense, magic), coins, and items. Progress is saved in your browser.
- **Floating ? blocks:** punch them for coins, items, a Starman (touching enemies defeats them), a beanstalk to the sky… or an ambush.
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
src/world.js       seeded terrain (biomes incl. Glowcap Groves, caves, trees, giant mushrooms), chunk storage, edits, raycast
src/landmarks.js   deterministic landmarks (starstones, vaults, geodes, sky islands, boss glowcaps) for generation and queries
src/rpg.js         enemies & ecology, terrain-aware battles, echoes, relics, items, bosses, progression
src/discovery.js   landmark discovery, compass, starstone lore/waystones, rumors, frontiers, journal
src/wonders.js     Pip the Peddler and the sky whale
src/realms.js      realm offsets (Primeval, Dragon Isles) and local coordinates
src/fauna.js       fish, pterodactyls, distant dragons, volcano smoke and eruptions
src/vehicles.js    go-kart, boat, brontosaurus and dragon riding with a chase camera
src/inventory.js   block palette, items, weapons, vehicles
src/mesher.js      chunk meshing: face culling, AO, plants, water
src/textures.js    procedural texture + normal atlas, hotbar icons, water normals
src/controls.js    desktop + touch input
src/avatar.js      remote player model with interpolation and name tag
src/net.js         WebSocket client
```

Chunks are 16×16×128. They are generated and meshed around the player within a fixed time budget per frame,
and chunks that move out of range are unloaded. Edits are stored per chunk, so a reloaded chunk keeps its changes.
