// Other worlds live in the same voxel space, far away: the Primeval Realm is offset along +X, the Dragon Isles
// along +Z. Streaming, multiplayer edits and saves work unchanged; portals simply translate you.
export const REALM_OFF = 400000;

export const REALMS = {
  over: { name: 'The Overworld', dx: 0, dz: 0, lvl: 0, fog: null },
  primeval: { name: 'The Primeval Realm', dx: REALM_OFF, dz: 0, lvl: 3, fog: 0x9cbf7e, icon: '🦖',
    blurb: 'Steaming jungle, smoking volcanoes, and things with very big teeth.' },
  dragon: { name: 'The Dragon Isles', dx: 0, dz: REALM_OFF, lvl: 6, fog: 0xa392d4, icon: '🐉',
    blurb: 'Islands adrift over an endless sea. Something enormous circles the spires.' },
};

export function realmAt(x, z) {
  if (x > REALM_OFF / 2) return 'primeval';
  if (z > REALM_OFF / 2) return 'dragon';
  return 'over';
}

/** Realm-local coordinates (distance from *that* realm's origin matters for difficulty and weirdness). */
export function toLocal(x, z) {
  const r = realmAt(x, z);
  return [x - REALMS[r].dx, z - REALMS[r].dz, r];
}
