export const HERO_KEYS = ['aurora', 'boris', 'alice'];
export const SAVE_KEY = 'aba-aurora-save-v2';
export const WORLD_SEED = 1337;

export const HEROES = {
  aurora: {
    name: 'Aurora Vale', first: 'Aurora', role: 'Star Archer', color: '#e58ab8', tint: '#c6b9df', accent: '#ff7cc8',
    hp: 125, speed: 7.6, power: 15, weapon: 'bow', basicRange: 20, basicCd: 0.6,
    basic: 'Starlit Shot', skillGlyphs: ['STAR', 'VOLLEY', 'MOON'],
    skills: [
      { id: 'starfall', name: 'Starfall', cd: 6, radius: 4.5, power: 36, type: 'aoe' },
      { id: 'volley', name: 'Ranger Volley', cd: 9, power: 17, type: 'volley' },
      { id: 'moonstep', name: 'Moonstep', cd: 18, power: 26, type: 'blink' }
    ],
    passives: ['Sharpened Stars: +6% damage per rank', 'Moonlit Vitality: +10 health per rank', 'Fleetfoot: +2.5% speed per rank', 'Focus: -3% cooldowns per rank']
  },
  boris: {
    name: 'Boris Stone', first: 'Boris', role: 'Iron Vanguard', color: '#7fa9d8', tint: '#7c92aa', accent: '#67e6de',
    hp: 190, speed: 6.3, power: 24, weapon: 'hammer', basicRange: 3.4, basicCd: 0.78,
    basic: 'Quake Hammer', skillGlyphs: ['WAVE', 'GUARD', 'THUNDER'],
    skills: [
      { id: 'shockwave', name: 'Shockwave', cd: 7, radius: 5.2, power: 42, type: 'aoe' },
      { id: 'guard', name: 'Iron Guard', cd: 11, power: 65, type: 'shield' },
      { id: 'thunderfall', name: 'Thunderfall', cd: 20, radius: 8.5, power: 78, type: 'aoe' }
    ],
    passives: ['Heavy Hand: +6% damage per rank', 'Stalwart: +10 health per rank', 'Fleetfoot: +2.5% speed per rank', 'Focus: -3% cooldowns per rank']
  },
  alice: {
    name: 'Alice Quill', first: 'Alice', role: 'Gearblade', color: '#7fd0a4', tint: '#79b79b', accent: '#f0d36c',
    hp: 140, speed: 8.2, power: 13, weapon: 'daggers', basicRange: 3, basicCd: 0.34,
    basic: 'Twin Cut', skillGlyphs: ['DASH', 'FAN', 'STORM'],
    skills: [
      { id: 'dashslash', name: 'Dash Slash', cd: 5, power: 28, type: 'dash' },
      { id: 'knives', name: 'Fan of Knives', cd: 8, radius: 7, power: 25, type: 'cone' },
      { id: 'shadowstorm', name: 'Shadowstorm', cd: 17, radius: 6.5, power: 62, type: 'aoe' }
    ],
    passives: ['Killer Instinct: +6% damage per rank', 'Quick Blood: +10 health per rank', 'Fleetfoot: +2.5% speed per rank', 'Focus: -3% cooldowns per rank']
  }
};

export const PASSIVES = [
  { id: 'might', name: 'Might', icon: 'MGT', desc: '+6% damage per rank.' },
  { id: 'vitality', name: 'Vitality', icon: 'VIT', desc: '+10 max health per rank.' },
  { id: 'fleet', name: 'Fleet', icon: 'FLT', desc: '+2.5% movement speed per rank.' },
  { id: 'focus', name: 'Focus', icon: 'FCS', desc: '-3% skill cooldowns per rank.' }
];

export const ITEMS = {
  tonic: { name: 'Aurora Tonic', type: 'consumable', icon: 'TON', price: 25, desc: 'Restore 60 health.', heal: 60 },
  petfeast: { name: 'Pet Feast', type: 'consumable', icon: 'FST', desc: 'Feed a pet for 35 pet XP.', petXp: 35 },
  fishstew: { name: 'Moonfin Stew', type: 'consumable', icon: 'STW', desc: 'Heal 45. Gain +15% damage for 30s.', heal: 45, buff: true },
  sunbread: { name: 'Sunwheat Bread', type: 'consumable', icon: 'BRD', desc: 'Restore 35 health.', heal: 35 },
  seed: { name: 'Sunwheat Seed', type: 'material', icon: 'SED', desc: 'Plant in a farm plot.' },
  sunwheat: { name: 'Sunwheat', type: 'material', icon: 'WHT', desc: 'Golden grain from your farm.' },
  moonherb: { name: 'Moonherb', type: 'material', icon: 'HRB', desc: 'A fragrant herb used in tonics.' },
  fish: { name: 'Moonfin', type: 'material', icon: 'FSH', desc: 'A shimmering lake fish.' },
  meat: { name: 'Game Meat', type: 'material', icon: 'MEAT', desc: 'Fresh meat from the hunt.' },
  leather: { name: 'Rough Leather', type: 'material', icon: 'LTH', desc: 'Useful for armor and collars.' },
  fang: { name: 'Wolf Fang', type: 'material', icon: 'FNG', desc: 'A sharp trophy from Wolfwood.' },
  gel: { name: 'Slime Gel', type: 'material', icon: 'GEL', desc: 'Squishy alchemical goo.' },
  bone: { name: 'Bone Shard', type: 'material', icon: 'BON', desc: 'Old, but still useful.' },
  scrap: { name: 'Gear Scrap', type: 'material', icon: 'SCR', desc: 'Clockwork salvage.' },
  essence: { name: 'Star Essence', type: 'material', icon: 'ESS', desc: 'A mote of old magic.' },
  dragoncore: { name: 'Colossus Core', type: 'material', icon: 'CRX', desc: 'The heart of the Clockwork Colossus.' },
  fangblade: { name: 'Fangbite Blade', type: 'weapon', icon: 'BLD', desc: '+10 attack.', atk: 10 },
  starcloak: { name: 'Starweave Cloak', type: 'armor', icon: 'CLK', desc: '+35 health, +3 defense.', hp: 35 },
  roguevest: { name: 'Gearhide Vest', type: 'armor', icon: 'VST', desc: '+20 health, +6% speed.', hp: 20, speed: 0.06 },
  gearcharm: { name: 'Clockwork Charm', type: 'trinket', icon: 'CHM', desc: '+7 attack, +8 health.', atk: 7, hp: 8 },
  collar: { name: 'Copper Collar', type: 'trinket', icon: 'COL', desc: 'Pet trinket: +40 pet health.', petHp: 40 },
  hoodie: { name: 'Skyline Hoodie', type: 'outfit', icon: 'HOD', price: 120, desc: 'Modern hoodie. +12 health, +4% speed.', hp: 12, speed: 0.04, modern: true, color: '#37c9bd' },
  bomber: { name: 'Midnight Bomber', type: 'outfit', icon: 'BMB', price: 180, desc: 'Modern jacket. +28 health.', hp: 28, modern: true, color: '#d75683' },
  shades: { name: 'Mirrored Shades', type: 'trinket', icon: 'SHD', price: 90, desc: 'Modern shades. +5 attack.', atk: 5, modern: true },
  sneakers: { name: 'Cloudstep Sneakers', type: 'shoes', icon: 'SNK', price: 140, desc: 'Modern sneakers. +9% speed.', speed: 0.09, modern: true },
  scooter: { name: 'Volt Scooter', type: 'mount', icon: 'SCT', price: 260, desc: 'A modern mount. Very fast.', mount: 'scooter' },
  hoverboard: { name: 'Nova Hoverboard', type: 'mount', icon: 'HOV', price: 480, desc: 'A glowing modern mount.', mount: 'hoverboard' }
};

export const RECIPES = [
  { id: 'tonic', name: 'Aurora Tonic', icon: 'TON', cost: { moonherb: 2 }, desc: 'Restore 60 health.' },
  { id: 'petfeast', name: 'Pet Feast', icon: 'FST', cost: { meat: 2, sunwheat: 1 }, desc: 'A hearty meal for a pet.' },
  { id: 'sunbread', name: 'Sunwheat Bread', icon: 'BRD', cost: { sunwheat: 2 }, desc: 'Warm bread. Restores 35 health.' },
  { id: 'fishstew', name: 'Moonfin Stew', icon: 'STW', cost: { fish: 1, sunwheat: 1 }, desc: 'A damage-boosting meal.' },
  { id: 'fangblade', name: 'Fangbite Blade', icon: 'BLD', cost: { fang: 4, scrap: 2 }, desc: 'A wicked blade made of wolf fangs.' },
  { id: 'starcloak', name: 'Starweave Cloak', icon: 'CLK', cost: { leather: 3, essence: 2 }, desc: 'Armor woven with starlight.' },
  { id: 'roguevest', name: 'Gearhide Vest', icon: 'VST', cost: { leather: 2, scrap: 3 }, desc: 'Light, fast, and modern.' },
  { id: 'gearcharm', name: 'Clockwork Charm', icon: 'CHM', cost: { scrap: 3, essence: 1 }, desc: 'A trinket that hums with power.' },
  { id: 'collar', name: 'Copper Collar', icon: 'COL', cost: { scrap: 2, leather: 1 }, desc: 'A pet trinket. +40 pet health.' },
  { id: 'owl', name: 'Clockwork Owl', icon: 'OWL', cost: { scrap: 4, essence: 3 }, desc: 'Build and awaken a clockwork pet.', pet: 'owl' }
];

export const PETS = {
  fox: { name: 'Ember', species: 'Ember Fox', color: '#d8723a', hp: 80, power: 8, skill: { name: 'Cinder Dash', cd: 12, radius: 4.2, power: 24 }, desc: 'A quick fox with a burning heart.' },
  wolfpup: { name: 'Moss', species: 'Moss Pup', color: '#7a8494', hp: 115, power: 11, skill: { name: 'Pack Howl', cd: 15, radius: 5.5, power: 34 }, desc: 'Raised in Wolfwood. Loyal and loud.' },
  owl: { name: 'Tick', species: 'Clockwork Owl', color: '#9aa2aa', hp: 95, power: 13, skill: { name: 'Gear Storm', cd: 14, radius: 5.5, power: 40 }, desc: 'Built from gears and midnight.' },
  whelp: { name: 'Cinderwing', species: 'Clockwork Whelp', color: '#7c9ba4', hp: 150, power: 18, skill: { name: 'Ember Roar', cd: 18, radius: 7, power: 62 }, desc: 'A tiny dragon with a big roar.' }
};

export const ENEMIES = {
  slime: { hp: 65, power: 6, speed: 2.2, range: 1.7, aggro: 12, xp: 14, gold: [1, 4], mats: { gel: 1 }, kind: 'fox', tint: '#69cfa2', scale: 1.15, bar: 1.5 },
  wolf: { hp: 90, power: 9, speed: 3.6, range: 1.9, aggro: 16, xp: 20, gold: [2, 6], mats: { fang: 1, leather: 1 }, kind: 'fox', scale: 1.4, bar: 1.8 },
  bandit: { hp: 125, power: 12, speed: 2.7, range: 2.2, aggro: 15, xp: 30, gold: [6, 12], mats: { leather: 1, scrap: 1 }, kind: 'soldier', tint: '#8f3b3b', scale: 1, bar: 2 },
  skeleton: { hp: 155, power: 16, speed: 2.4, range: 2.2, aggro: 16, xp: 44, gold: [8, 16], mats: { bone: 1, essence: 1 }, kind: 'soldier', tint: '#d8d4c2', accent: '#6ff4e8', scale: 1.05, bar: 2 },
  deer: { hp: 70, power: 0, speed: 4.5, range: 1.5, aggro: 0, xp: 16, gold: [0, 0], mats: { meat: 1, leather: 1 }, kind: 'horse', tint: '#a97b4f', passive: true, scale: 0.9, bar: 1.6 },
  boar: { hp: 115, power: 10, speed: 3.2, range: 1.8, aggro: 9, xp: 26, gold: [2, 5], mats: { meat: 2, leather: 1 }, kind: 'horse', tint: '#5c4538', scale: 0.72, bar: 1.7 },
  golem: { hp: 280, power: 20, speed: 1.7, range: 2.6, aggro: 14, xp: 85, gold: [15, 25], mats: { scrap: 2, essence: 1 }, kind: 'knight', tint: '#5d6d72', scale: 1.25, bar: 2.3 },
  boss: { hp: 2600, power: 30, speed: 2.5, range: 4.4, aggro: 48, xp: 700, gold: [320, 420], mats: { dragoncore: 1, scrap: 5, essence: 4 }, kind: 'knight', tint: '#47565c', accent: '#83f6e6', scale: 2.2, bar: 5, elite: true }
};

export const MOUNTS = {
  skateboard: { name: 'Nova Board', speed: 1.55, model: 'skateboard' },
  scooter: { name: 'Volt Scooter', speed: 1.9, model: 'scooter' },
  hoverboard: { name: 'Nova Hoverboard', speed: 2.25, model: 'hoverboard' }
};

export const QUESTS = {
  welcome: { main: true, title: 'A New Dawn', objective: 'Speak with Mayor Elowen in Emberfall.', target: 'mayor', type: 'talk' },
  wolves: { main: true, title: 'Fangs in Wolfwood', objective: 'Hunt 5 dire wolves in Wolfwood.', target: 'wolfwood', type: 'kill', goal: 5 },
  threads: { main: true, title: 'Threads of Tomorrow', objective: 'Buy modern gear from Zippy.', target: 'zippy', type: 'buy' },
  craft: { main: true, title: 'Made by Hand', objective: 'Craft any item with the field kit.', target: 'self', type: 'craft' },
  boss: { main: true, title: 'The Clockwork Crown', objective: 'Defeat the Clockwork Colossus at the Sunken Keep.', target: 'boss', type: 'kill', goal: 1 },
  fishing: { main: false, title: 'A Quiet Cast', objective: 'Catch 3 fish at Mirror Lake or the river.', target: 'fish', type: 'fish', goal: 3 },
  farming: { main: false, title: 'Green Thumb', objective: 'Harvest 4 crops from the Emberfall plots.', target: 'farm', type: 'harvest', goal: 4 },
  hunting: { main: false, title: "Hunter's Errand", objective: 'Hunt 3 deer or boars in the meadow.', target: 'hunt', type: 'hunt', goal: 3 },
  bond: { main: false, title: "A Companion's Bond", objective: 'Feed your active pet 2 times.', target: 'self', type: 'feed', goal: 2 }
};

export function freshQuests() {
  const q = {};
  for (const [id, def] of Object.entries(QUESTS)) {
    q[id] = { ...def, state: id === 'welcome' ? 'active' : 'locked', progress: 0 };
  }
  return q;
}
