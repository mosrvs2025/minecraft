export const CS = 16;   // chunk size (x/z)
export const CH = 128;  // chunk height
export const SEA = 36;  // sea level

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7,
  PLANKS: 8, GLASS: 9, COBBLE: 10, SNOW: 11, TALLGRASS: 12, FLOWER: 13, BRICK: 14,
  COAL_ORE: 15, IRON_ORE: 16, GOLD_ORE: 17, DIAMOND_ORE: 18, TNT: 19, QBLOCK: 20, USED: 21,
  MYCEL: 22, STEM: 23, CAP_RED: 24, CAP_GLOW: 25, CAP_GOLD: 26, OBSIDIAN: 27, STARSTONE: 28, CRACKED: 29,
  GEODE: 30, CRYSTAL: 31, VAULT: 32, BEACON: 33, TROPHY: 34,
  BASALT: 35, MAGMA: 36, LAVA: 37, ICE: 38, CORAL_RED: 39, CORAL_BLUE: 40, FOSSIL: 41, BONE: 42, LANTERN: 43,
  WOOL_RED: 44, WOOL_BLUE: 45, WOOL_YELLOW: 46, WOOL_WHITE: 47, GOLD_BLOCK: 48, DIAMOND_BLOCK: 49, PORTAL: 50, MOSS: 51,
};

export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4, LOG_SIDE: 5, LOG_TOP: 6, LEAVES: 7,
  PLANKS: 8, GLASS: 9, COBBLE: 10, SNOW: 11, SNOW_SIDE: 12, TALLGRASS: 13, FLOWER: 14, BRICK: 15,
  COAL: 16, IRON: 17, GOLD: 18, DIAMOND: 19, TNT_SIDE: 20, TNT_TOP: 21, QBLOCK: 22, USED: 23,
  MYCEL_TOP: 24, MYCEL_SIDE: 25, STEM: 26, CAP_RED: 27, CAP_GLOW: 28, CAP_GOLD: 29, OBSIDIAN: 30, STARSTONE: 31,
  CRACKED: 32, GEODE: 33, CRYSTAL: 34, VAULT_SIDE: 35, VAULT_TOP: 36, BEACON: 37, TROPHY: 38,
  BASALT: 39, MAGMA: 40, LAVA: 41, ICE: 42, CORAL_RED: 43, CORAL_BLUE: 44, FOSSIL: 45, BONE_SIDE: 46, BONE_TOP: 47,
  LANTERN: 48, WOOL_RED: 49, WOOL_BLUE: 50, WOOL_YELLOW: 51, WOOL_WHITE: 52, GOLD_BLOCK: 53, DIAMOND_BLOCK: 54,
  PORTAL: 55, MOSS_TOP: 56, MOSS_SIDE: 57,
};

// kind: 'air' | 'cube' | 'water' | 'plant'
// opaque: hides neighbouring faces; solid: collides; ao: casts ambient occlusion; glow: self-illumination
// tough: fists can't break it (needs Shell Dash, Spore Slam or an explosion); resist: only hacks break it
// bouncy: springs you upward on landing; use: punching it triggers an interaction instead of mining
// liquid: walk-through, faces between identical liquids are hidden; hot: burns; slippery: low friction
const cube = (name, top, bottom, side, o = {}) =>
  ({ name, tiles: [top, bottom, side], kind: 'cube', solid: true, opaque: true, ao: true, wind: 0, glow: 0, ...o });

export const BLOCKS = [];
BLOCKS[B.AIR] = { name: 'Air', kind: 'air', solid: false, opaque: false, ao: false };
BLOCKS[B.GRASS] = cube('Grass', TILE.GRASS_TOP, TILE.DIRT, TILE.GRASS_SIDE);
BLOCKS[B.DIRT] = cube('Dirt', TILE.DIRT, TILE.DIRT, TILE.DIRT);
BLOCKS[B.STONE] = cube('Stone', TILE.STONE, TILE.STONE, TILE.STONE);
BLOCKS[B.SAND] = cube('Sand', TILE.SAND, TILE.SAND, TILE.SAND);
BLOCKS[B.WATER] = { name: 'Water', kind: 'water', solid: false, opaque: false, ao: false };
BLOCKS[B.LOG] = cube('Log', TILE.LOG_TOP, TILE.LOG_TOP, TILE.LOG_SIDE);
BLOCKS[B.LEAVES] = cube('Leaves', TILE.LEAVES, TILE.LEAVES, TILE.LEAVES, { opaque: false, wind: 0.35 });
BLOCKS[B.PLANKS] = cube('Planks', TILE.PLANKS, TILE.PLANKS, TILE.PLANKS);
BLOCKS[B.GLASS] = cube('Glass', TILE.GLASS, TILE.GLASS, TILE.GLASS, { opaque: false, ao: false });
BLOCKS[B.COBBLE] = cube('Cobblestone', TILE.COBBLE, TILE.COBBLE, TILE.COBBLE);
BLOCKS[B.SNOW] = cube('Snow', TILE.SNOW, TILE.DIRT, TILE.SNOW_SIDE);
BLOCKS[B.TALLGRASS] = { name: 'Tall grass', kind: 'plant', tile: TILE.TALLGRASS, solid: false, opaque: false, ao: false };
BLOCKS[B.FLOWER] = { name: 'Poppy', kind: 'plant', tile: TILE.FLOWER, solid: false, opaque: false, ao: false };
BLOCKS[B.BRICK] = cube('Bricks', TILE.BRICK, TILE.BRICK, TILE.BRICK);

BLOCKS[B.COAL_ORE] = cube('Coal ore', TILE.COAL, TILE.COAL, TILE.COAL);
BLOCKS[B.IRON_ORE] = cube('Iron ore', TILE.IRON, TILE.IRON, TILE.IRON);
BLOCKS[B.GOLD_ORE] = cube('Gold ore', TILE.GOLD, TILE.GOLD, TILE.GOLD);
BLOCKS[B.DIAMOND_ORE] = cube('Diamond ore', TILE.DIAMOND, TILE.DIAMOND, TILE.DIAMOND);
BLOCKS[B.TNT] = cube('TNT', TILE.TNT_TOP, TILE.TNT_TOP, TILE.TNT_SIDE);
BLOCKS[B.QBLOCK] = cube('? Block', TILE.QBLOCK, TILE.QBLOCK, TILE.QBLOCK, { glow: 0.12, use: true });
BLOCKS[B.USED] = cube('Empty block', TILE.USED, TILE.USED, TILE.USED);

BLOCKS[B.MYCEL] = cube('Mycelium', TILE.MYCEL_TOP, TILE.DIRT, TILE.MYCEL_SIDE);
BLOCKS[B.STEM] = cube('Mushroom stem', TILE.STEM, TILE.STEM, TILE.STEM);
BLOCKS[B.CAP_RED] = cube('Red cap', TILE.CAP_RED, TILE.STEM, TILE.CAP_RED, { bouncy: true });
BLOCKS[B.CAP_GLOW] = cube('Glowcap', TILE.CAP_GLOW, TILE.STEM, TILE.CAP_GLOW, { bouncy: true, glow: 0.55 });
BLOCKS[B.CAP_GOLD] = cube('Golden cap', TILE.CAP_GOLD, TILE.STEM, TILE.CAP_GOLD, { bouncy: true, glow: 0.35 });
BLOCKS[B.OBSIDIAN] = cube('Starstone pillar', TILE.OBSIDIAN, TILE.OBSIDIAN, TILE.OBSIDIAN, { resist: true });
BLOCKS[B.STARSTONE] = cube('Starstone', TILE.STARSTONE, TILE.STARSTONE, TILE.STARSTONE, { resist: true, glow: 1, use: true });
BLOCKS[B.CRACKED] = cube('Cracked ruin', TILE.CRACKED, TILE.CRACKED, TILE.CRACKED, { tough: true });
BLOCKS[B.GEODE] = cube('Geode shell', TILE.GEODE, TILE.GEODE, TILE.GEODE, { tough: true });
BLOCKS[B.CRYSTAL] = cube('Crystal', TILE.CRYSTAL, TILE.CRYSTAL, TILE.CRYSTAL, { glow: 0.9 });
BLOCKS[B.VAULT] = cube('Ancient vault', TILE.VAULT_TOP, TILE.VAULT_SIDE, TILE.VAULT_SIDE, { resist: true, use: true, glow: 0.15 });
BLOCKS[B.BEACON] = cube('Home beacon', TILE.BEACON, TILE.BEACON, TILE.BEACON, { glow: 0.8, use: true });
BLOCKS[B.TROPHY] = cube('Mycelord trophy', TILE.CAP_GOLD, TILE.STEM, TILE.TROPHY, { glow: 0.4 });

BLOCKS[B.BASALT] = cube('Basalt', TILE.BASALT, TILE.BASALT, TILE.BASALT);
BLOCKS[B.MAGMA] = cube('Magma', TILE.MAGMA, TILE.MAGMA, TILE.MAGMA, { glow: 0.7, hot: true });
BLOCKS[B.LAVA] = cube('Lava', TILE.LAVA, TILE.LAVA, TILE.LAVA, { glow: 1.4, solid: false, opaque: false, ao: false, liquid: true, hot: true });
BLOCKS[B.ICE] = cube('Ice', TILE.ICE, TILE.ICE, TILE.ICE, { slippery: true });
BLOCKS[B.CORAL_RED] = { name: 'Fire coral', kind: 'plant', tile: TILE.CORAL_RED, solid: false, opaque: false, ao: false };
BLOCKS[B.CORAL_BLUE] = { name: 'Tube coral', kind: 'plant', tile: TILE.CORAL_BLUE, solid: false, opaque: false, ao: false };
BLOCKS[B.FOSSIL] = cube('Fossil stone', TILE.FOSSIL, TILE.FOSSIL, TILE.FOSSIL);
BLOCKS[B.BONE] = cube('Ancient bone', TILE.BONE_TOP, TILE.BONE_TOP, TILE.BONE_SIDE);
BLOCKS[B.LANTERN] = cube('Lantern', TILE.LANTERN, TILE.LANTERN, TILE.LANTERN, { glow: 1.1 });
BLOCKS[B.WOOL_RED] = cube('Red wool', TILE.WOOL_RED, TILE.WOOL_RED, TILE.WOOL_RED);
BLOCKS[B.WOOL_BLUE] = cube('Blue wool', TILE.WOOL_BLUE, TILE.WOOL_BLUE, TILE.WOOL_BLUE);
BLOCKS[B.WOOL_YELLOW] = cube('Yellow wool', TILE.WOOL_YELLOW, TILE.WOOL_YELLOW, TILE.WOOL_YELLOW);
BLOCKS[B.WOOL_WHITE] = cube('White wool', TILE.WOOL_WHITE, TILE.WOOL_WHITE, TILE.WOOL_WHITE);
BLOCKS[B.GOLD_BLOCK] = cube('Gold block', TILE.GOLD_BLOCK, TILE.GOLD_BLOCK, TILE.GOLD_BLOCK, { glow: 0.1 });
BLOCKS[B.DIAMOND_BLOCK] = cube('Diamond block', TILE.DIAMOND_BLOCK, TILE.DIAMOND_BLOCK, TILE.DIAMOND_BLOCK, { glow: 0.15 });
BLOCKS[B.PORTAL] = cube('Portal', TILE.PORTAL, TILE.PORTAL, TILE.PORTAL, { glow: 1.3, solid: false, opaque: false, ao: false, liquid: true, resist: true });
BLOCKS[B.MOSS] = cube('Jungle moss', TILE.MOSS_TOP, TILE.DIRT, TILE.MOSS_SIDE);

// everything the inventory lets you place (loot blocks and portals are found, not placed)
export const PLACEABLE = BLOCKS.map((b, id) => id).filter((id) => id && ![B.QBLOCK, B.USED, B.VAULT, B.STARSTONE, B.PORTAL, B.TROPHY].includes(id));

export const HOTBAR = [B.GRASS, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.BRICK, B.GLASS, B.TNT, B.BEACON];

// blocks still drawn while X-ray is on
export const XRAY_SHOW = new Set([B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.TNT, B.QBLOCK, B.CRYSTAL, B.VAULT, B.STARSTONE, B.FOSSIL, B.BONE, B.PORTAL, B.LAVA]);
