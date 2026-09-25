/** Ground tile types. Stored in a Uint8Array grid (1 tile = 4 world units). */
export const TILE = {
  OCEAN: 0,
  MEADOW: 1,
  PINEWOOD: 2,
  PLAINS: 3,
  ROCKY: 4,
  MARSH: 5,
  GRAVE: 6,
  SHALLOW: 7,
  ROAD: 8,
} as const;

export type TileId = (typeof TILE)[keyof typeof TILE];

export interface TileInfo {
  name: string;
  walkable: boolean;
  /** base color and detail colors for the ground renderer */
  color: string;
  dark: string;
  light: string;
  /** draw order: higher overlaps lower at borders */
  priority: number;
  speed?: number;
}

export const TILE_INFO: Record<number, TileInfo> = {
  [TILE.OCEAN]: { name: 'Ocean', walkable: false, color: '#27414b', dark: '#1d323b', light: '#3d5e69', priority: 0 },
  [TILE.SHALLOW]: { name: 'Shallows', walkable: false, color: '#3b6470', dark: '#2f5460', light: '#5b8790', priority: 1 },
  [TILE.MEADOW]: { name: 'Meadow', walkable: true, color: '#8f9a4f', dark: '#77843f', light: '#a8b263', priority: 4 },
  [TILE.PINEWOOD]: { name: 'Pinewood', walkable: true, color: '#4f5a36', dark: '#3f482b', light: '#63703f', priority: 5 },
  [TILE.PLAINS]: { name: 'Plains', walkable: true, color: '#b39a55', dark: '#9a8347', light: '#c9b26a', priority: 3 },
  [TILE.ROCKY]: { name: 'Rocklands', walkable: true, color: '#8a8171', dark: '#736b5d', light: '#a19886', priority: 6 },
  [TILE.MARSH]: { name: 'Marsh', walkable: true, color: '#3f4a3e', dark: '#323b31', light: '#556152', priority: 7, speed: 0.85 },
  [TILE.GRAVE]: { name: 'Hollow Glade', walkable: true, color: '#5c5448', dark: '#4a433a', light: '#716757', priority: 8 },
  [TILE.ROAD]: { name: 'Old Road', walkable: true, color: '#7a6a52', dark: '#665842', light: '#8c7c62', priority: 9, speed: 1.3 },
};
