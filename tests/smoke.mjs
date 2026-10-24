import { readFileSync, statSync } from 'node:fs';
import { HEROES, HERO_KEYS, ITEMS, RECIPES, PETS, ENEMIES, QUESTS } from '../src/data.js';

let checks = 0;
function ok(cond, message) {
  if (!cond) throw new Error(`FAIL: ${message}`);
  checks++;
}

ok(HERO_KEYS.length === 3, 'three heroes are defined');
for (const key of HERO_KEYS) {
  const hero = HEROES[key];
  ok(hero?.name && hero.skills?.length === 3, `${key} has identity and three skills`);
  ok(hero.hp > 0 && hero.power > 0 && hero.speed > 0, `${key} has combat stats`);
}
ok(Object.keys(ENEMIES).length >= 7, 'enemy roster includes hunting, dungeon, and boss variants');
for (const [id, enemy] of Object.entries(ENEMIES)) {
  ok(enemy.hp > 0 && enemy.kind, `${id} has health and a model kind`);
}
ok(Object.keys(PETS).length >= 4, 'pet roster has multiple species');
for (const [id, pet] of Object.entries(PETS)) {
  ok(pet.skill?.name && pet.hp > 0, `${id} has a skill and health`);
}
for (const recipe of RECIPES) {
  for (const id of Object.keys(recipe.cost)) ok(ITEMS[id], `${recipe.id} material ${id} exists`);
  if (recipe.pet) ok(PETS[recipe.pet], `${recipe.id} pet ${recipe.pet} exists`);
}
for (const id of ['welcome', 'wolves', 'threads', 'craft', 'boss', 'fishing', 'farming', 'hunting', 'bond']) {
  ok(QUESTS[id], `quest ${id} exists`);
}

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
for (const id of [
  'game-canvas', 'hud', 'menu', 'inventory-overlay', 'skills-overlay', 'craft-overlay',
  'pets-overlay', 'map-overlay', 'fishing-overlay', 'coop-overlay', 'help-overlay',
  'pause-overlay', 'dialog-overlay', 'shop-overlay', 'victory-overlay', 'toast-stack'
]) ok(html.includes(`id="${id}"`), `index contains #${id}`);

const game = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
for (const feature of [
  'save()', 'craft(', 'farm(', 'reel(', 'petSkill(', 'questProgress(', 'buy(', 'equip(',
  'BroadcastChannel', 'renderInventory', 'renderSkills', 'renderPets', 'startFishing'
]) ok(game.includes(feature), `game implements ${feature}`);

for (const file of ['Soldier.glb', 'Fox.glb', 'Horse.glb', 'Knight.glb']) {
  const path = new URL(`../public/models/${file}`, import.meta.url);
  ok(statSync(path).size > 1000, `${file} asset is present`);
}

console.log(`smoke: ${checks} checks passed`);
