import { defineRecipes, type Recipe, type Tab } from './defs';

export const TABS: { id: Tab; name: string; icon: string }[] = [
  { id: 'tools', name: 'Tools', icon: 'axe' },
  { id: 'light', name: 'Light', icon: 'torch' },
  { id: 'survival', name: 'Survival', icon: 'backpack' },
  { id: 'food', name: 'Food', icon: 'cookpot' },
  { id: 'science', name: 'Science', icon: 'tinkers_bench' },
  { id: 'fight', name: 'Fight', icon: 'spear' },
  { id: 'structures', name: 'Structures', icon: 'chest' },
  { id: 'refine', name: 'Refine', icon: 'rope' },
  { id: 'dress', name: 'Dress', icon: 'strawhat' },
];

export const TECH_NAMES = ['by hand', "a Tinker's Bench", 'an Alembic Engine'];

const R: Recipe[] = [
  // Tools
  { id: 'axe', tab: 'tools', tech: 0, ingredients: [['twigs', 1], ['flint', 1]], item: 'axe', desc: 'Chop down trees.' },
  { id: 'pickaxe', tab: 'tools', tech: 0, ingredients: [['twigs', 2], ['flint', 2]], item: 'pickaxe', desc: 'Break boulders apart.' },
  { id: 'shovel', tab: 'tools', tech: 1, ingredients: [['twigs', 2], ['flint', 2]], item: 'shovel', desc: 'Dig up stumps, plants and graves.' },
  { id: 'hammer', tab: 'tools', tech: 1, ingredients: [['twigs', 3], ['rocks', 3], ['cutgrass', 6]], item: 'hammer', desc: 'Knock down structures.' },
  { id: 'razor', tab: 'tools', tech: 1, ingredients: [['twigs', 2], ['flint', 2]], item: 'razor', desc: 'Shave sleeping shagbeasts.' },

  // Light
  { id: 'campfire', tab: 'light', tech: 0, ingredients: [['cutgrass', 3], ['log', 2]], place: 'campfire', desc: 'Light and warmth. Burns out for good.' },
  { id: 'firepit', tab: 'light', tech: 0, ingredients: [['log', 2], ['rocks', 12]], place: 'firepit', desc: 'A safe, refuelable fire.' },
  { id: 'torch', tab: 'light', tech: 0, ingredients: [['cutgrass', 2], ['twigs', 2]], item: 'torch', desc: 'Portable light. Burns quickly.' },

  // Survival
  { id: 'trap', tab: 'survival', tech: 0, ingredients: [['twigs', 2], ['cutgrass', 6]], item: 'trap_item', desc: 'Catches small creatures.' },
  { id: 'backpack', tab: 'survival', tech: 1, ingredients: [['cutgrass', 4], ['twigs', 4]], item: 'backpack', desc: 'Carry 8 more things.' },
  { id: 'salve', tab: 'survival', tech: 1, ingredients: [['ash', 2], ['rocks', 1], ['spidergland', 1]], item: 'salve', desc: 'Heals 20 health.' },
  { id: 'strawroll', tab: 'survival', tech: 1, ingredients: [['cutgrass', 6], ['rope', 1]], item: 'strawroll', desc: 'Sleep through the night. Hungry work.' },
  { id: 'umbrella', tab: 'survival', tech: 1, ingredients: [['twigs', 6], ['hogskin', 1], ['silk', 2]], item: 'umbrella', desc: 'Stay dry and shaded.' },
  { id: 'thermalstone', tab: 'survival', tech: 2, ingredients: [['rocks', 10], ['flint', 3]], item: 'thermalstone', desc: 'Stores heat or cold. Carry it.' },
  { id: 'tent', tab: 'survival', tech: 2, ingredients: [['silk', 6], ['twigs', 4], ['rope', 3]], place: 'tent', desc: 'Sleep and recover sanity.' },

  // Food
  { id: 'cookpot', tab: 'food', tech: 1, ingredients: [['cutstone', 3], ['charcoal', 6], ['twigs', 3]], place: 'cookpot', desc: 'Combine 4 ingredients into a dish.' },
  { id: 'drying_rack', tab: 'food', tech: 1, ingredients: [['twigs', 3], ['charcoal', 2], ['rope', 3]], place: 'drying_rack', desc: 'Turn meat into long-lasting jerky.' },
  { id: 'farm_plot', tab: 'food', tech: 1, ingredients: [['cutgrass', 8], ['manure', 4], ['log', 4]], place: 'farm_plot', desc: 'Plant seeds, grow vegetables.' },
  { id: 'icebox', tab: 'food', tech: 2, ingredients: [['gold', 2], ['cutstone', 2], ['boards', 2]], place: 'icebox', desc: 'Food spoils at half speed.' },

  // Science
  { id: 'tinkers_bench', tab: 'science', tech: 0, ingredients: [['gold', 1], ['log', 4], ['rocks', 4]], place: 'tinkers_bench', desc: 'Unlocks new recipes nearby.' },
  { id: 'alembic', tab: 'science', tech: 1, ingredients: [['boards', 4], ['cutstone', 2], ['gold', 6]], place: 'alembic', desc: 'Unlocks even more recipes.' },

  // Fight
  { id: 'spear', tab: 'fight', tech: 1, ingredients: [['twigs', 2], ['rope', 1], ['flint', 1]], item: 'spear', desc: '34 damage. Stab stab.' },
  { id: 'logsuit', tab: 'fight', tech: 1, ingredients: [['log', 8], ['rope', 2]], item: 'logsuit', desc: 'Absorbs 80% of damage.' },
  { id: 'hoghelm', tab: 'fight', tech: 1, ingredients: [['hogskin', 1], ['rope', 1]], item: 'hoghelm', desc: 'Absorbs 80% of damage.' },

  // Structures
  { id: 'chest', tab: 'structures', tech: 1, ingredients: [['boards', 3]], place: 'chest', desc: 'Store 9 stacks.' },
  { id: 'wall_wood', tab: 'structures', tech: 1, ingredients: [['boards', 2], ['rope', 1]], item: 'wall_wood_item', n: 6, desc: 'Six segments of wooden wall.' },
  { id: 'wall_stone', tab: 'structures', tech: 2, ingredients: [['cutstone', 2]], item: 'wall_stone_item', n: 6, desc: 'Six segments of stone wall.' },
  { id: 'hog_house', tab: 'structures', tech: 1, ingredients: [['boards', 4], ['cutstone', 3], ['hogskin', 4]], place: 'hog_house', desc: 'Home for a hogfolk neighbor.' },

  // Refine
  { id: 'rope', tab: 'refine', tech: 1, ingredients: [['cutgrass', 3]], item: 'rope', desc: 'Grass, twisted with intent.' },
  { id: 'boards', tab: 'refine', tech: 1, ingredients: [['log', 4]], item: 'boards', desc: 'Planks for building.' },
  { id: 'cutstone', tab: 'refine', tech: 1, ingredients: [['rocks', 3]], item: 'cutstone', desc: 'Blocks for building.' },

  // Dress
  { id: 'garland', tab: 'dress', tech: 0, ingredients: [['petals', 12]], item: 'garland', desc: 'Restores sanity while worn.' },
  { id: 'strawhat', tab: 'dress', tech: 1, ingredients: [['cutgrass', 12]], item: 'strawhat', desc: 'Keeps you cool in summer.' },
  { id: 'earmuffs', tab: 'dress', tech: 1, ingredients: [['rabbit', 2], ['twigs', 1]], item: 'earmuffs', desc: 'A little warmth for winter.' },
  { id: 'woolcap', tab: 'dress', tech: 1, ingredients: [['wool', 4], ['silk', 4]], item: 'woolcap', desc: 'Warm and comforting.' },
  { id: 'tophat', tab: 'dress', tech: 1, ingredients: [['silk', 6]], item: 'tophat', desc: 'Very dapper. Restores sanity.' },
  { id: 'shagcoat', tab: 'dress', tech: 2, ingredients: [['wool', 8], ['silk', 4], ['rope', 2]], item: 'shagcoat', desc: 'Serious winter insulation.' },
];

defineRecipes(R);
