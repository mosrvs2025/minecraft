# Improved prompt

> Build **"Voxelia"**, a browser voxel sandbox in the spirit of Minecraft, using **Three.js**, with a strong focus on
> **visual fidelity**: it should look noticeably richer and more atmospheric than vanilla Minecraft while keeping
> the readable blocky art style and running smoothly on phones and desktops.

## Visuals (the priority)
- Physically based rendering (`MeshStandardMaterial`), ACES filmic tone mapping, sRGB output.
- Procedurally generated high‑resolution (64px) block textures **with matching normal maps** so surfaces have relief.
- Per‑vertex **ambient occlusion** baked into the chunk meshes (smooth, with correct quad flipping).
- **Dynamic day/night cycle**: physical sky (Rayleigh/Mie scattering), sun & moon, stars, sunset colours,
  fog that matches the horizon colour, image‑based lighting regenerated from the sky.
- Real‑time **shadow mapping** from the sun that follows the player.
- **Water** that is translucent, reflects the sky, has animated normals and gentle waves.
- Foliage: see‑through leaves, cross‑quad grass and flowers, **wind sway** in the vertex shader.
- Volumetric-looking drifting **clouds**, block‑break particles, subtle head bob and sprint FOV kick.
- Post‑processing: bloom, optional ground‑truth AO (GTAO). **Quality presets** (Low/Medium/High) so mobile stays at 60fps.

## World
- Infinite, seeded procedural terrain in 16×16×128 chunks: plains, forests, deserts, beaches, oceans, snowy mountains,
  spaghetti caves, trees with rounded canopies.
- Chunk streaming around the player with a per‑frame generation/meshing budget and unloading of far chunks.

## Gameplay
- First‑person movement with AABB collision, jumping, sprinting, swimming, and a fly mode.
- Break / place blocks via voxel raycast with a highlighted target; 9‑slot hotbar with 3D block icons.

## Platforms & input
- **Desktop**: pointer lock, WASD, mouse look, left/right click, wheel / 1–9 hotbar, Shift sprint, F / double‑space fly, T chat.
- **Mobile**: virtual joystick, drag‑to‑look, jump/fly/down buttons, tap = place, long‑press = break, tappable hotbar.

## Multiplayer
- Node.js server (Express + `ws`) that serves the game, shares the world seed, day time and all block edits,
  relays player movement and chat, and persists edits to disk.
- Other players are shown as animated blocky avatars with name tags; movement is interpolated.
- The client falls back to single‑player automatically if no server is reachable.

## Deliverables
- `npm run dev` (single command, server + Vite HMR), `npm run build && npm start` for production.
- A README explaining controls, architecture, and deployment.
