export const CS = 16;   // chunk size (x/z)
export const CH = 128;  // chunk height
export const SEA = 36;  // sea level

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7,
  PLANKS: 8, GLASS: 9, COBBLE: 10, SNOW: 11, TALLGRASS: 12, FLOWER: 13, BRICK: 14,
};

export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4, LOG_SIDE: 5, LOG_TOP: 6, LEAVES: 7,
  PLANKS: 8, GLASS: 9, COBBLE: 10, SNOW: 11, SNOW_SIDE: 12, TALLGRASS: 13, FLOWER: 14, BRICK: 15,
};

// kind: 'air' | 'cube' | 'water' | 'plant'
// opaque: hides neighbouring faces; solid: collides; ao: casts ambient occlusion
const cube = (name, top, bottom, side, o = {}) =>
  ({ name, tiles: [top, bottom, side], kind: 'cube', solid: true, opaque: true, ao: true, wind: 0, ...o });

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

export const HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.BRICK, B.GLASS, B.LEAVES];
