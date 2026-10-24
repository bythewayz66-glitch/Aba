import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World, WATER_LEVEL } from './world.js';
import { makeSoldier, makeFox, makeHorse, makeKnight, makeMount, playState, updateMixers } from './assets.js';
import { AudioEngine } from './audio.js';
import { clamp, damp, seedFromString } from './util.js';
import {
  HERO_KEYS, SAVE_KEY, WORLD_SEED, HEROES, PASSIVES, ITEMS, RECIPES, PETS,
  ENEMIES, MOUNTS, QUESTS, freshQuests
} from './data.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);

export class Game {
  constructor(opts = {}) {
    this.opts = opts;
    this.mode = opts.mode || 'solo';
    this.room = (opts.room || '').toUpperCase();
    this.playerId = Math.random().toString(36).slice(2, 10);
    this.playerName = opts.name || HEROES[opts.heroKey || 'aurora'].first;
    this.heroKey = opts.heroKey || 'aurora';
    this.seed = WORLD_SEED;
    this.time = 0;
    this.gameMinutes = 8 * 60 + 20;
    this.keys = {};
    this.touch = { x: 0, y: 0 };
    this.touchSmooth = { x: 0, z: 0 };
    this.camYaw = 0;
    this.camPitch = 0.3;
    this.camDist = 10;
    this.camTarget = new THREE.Vector3();
    this.dragging = false;
    this.projectiles = [];
    this.effects = [];
    this.remote = new Map();
    this.remoteEnemies = new Map();
    this.remotePets = new Map();
    this.snapTimer = 0;
    this.inputTimer = 0;
    this.uiTimer = 0;
    this.mapTimer = 0;
    this.saveTimer = 0;
    this.audio = new AudioEngine();
    this.petMesh = null;
    this.fishing = null;
    this.paused = false;
    this.uiOpen = null;
    this.victory = false;
    this.selectedPet = 'fox';
    this.initState(opts.loadSave);
    this.setupRenderer();
    this.setupScene();
    this.world = new World(this.scene, this.seed);
    this.replaceNpcs();
    this.setupLights();
    this.setupSky();
    this.createHeroes();
    this.createPet();
    this.spawnEnemies();
    this.bind();
    this.resize();
    this.setupNet();
    this.updateHud(true);
    this.last = performance.now();
    this.running = true;
    requestAnimationFrame((t) => this.loop(t));
  }

  initState(load) {
    this.level = 1; this.xp = 0; this.gold = 80; this.skillPoints = 1;
    this.stamina = 100; this.buff = 0; this.mounted = false; this.mount = 'skateboard';
    this.items = { tonic: 3, seed: 6 };
    this.equipment = { weapon: null, armor: null, outfit: null, shoes: 'sneakers', trinket: null };
    this.ownedMounts = ['skateboard'];
    this.skillRanks = {}; for (const k of HERO_KEYS) this.skillRanks[k] = {};
    this.passiveRanks = { might: 0, vitality: 0, fleet: 0, focus: 0 };
    this.ownedPets = ['fox']; this.pets = { fox: { level: 1, xp: 0, hp: PETS.fox.hp, trinket: null } };
    this.activePet = 'fox'; this.petCd = 0;
    this.quests = freshQuests();
    this.respawn = { x: 0, z: 12 }; this.kills = 0; this.fishCaught = 0; this.crops = 0;
    this.played = 0; this.victory = false;
    if (!load) return;
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d) return;
      Object.assign(this, {
        heroKey: d.heroKey || this.heroKey, level: d.level || 1, xp: d.xp || 0, gold: d.gold ?? 80,
        skillPoints: d.skillPoints || 0, items: d.items || this.items, equipment: { ...this.equipment, ...d.equipment },
        ownedMounts: d.ownedMounts || this.ownedMounts, mount: d.mount || this.mount,
        skillRanks: d.skillRanks || this.skillRanks, passiveRanks: d.passiveRanks || this.passiveRanks,
        ownedPets: d.ownedPets || this.ownedPets, pets: d.pets || this.pets, activePet: d.activePet || 'fox',
        quests: { ...freshQuests(), ...(d.quests || {}) }, respawn: d.respawn || this.respawn,
        kills: d.kills || 0, fishCaught: d.fishCaught || 0, crops: d.crops || 0, played: d.played || 0,
        victory: !!d.victory, savedPos: d.pos || null, savedTime: d.gameMinutes, savedFarm: d.farm || null
      });
      this.gameMinutes = this.savedTime || this.gameMinutes;
    } catch (e) { console.warn(e); }
  }

  setupRenderer() {
    this.canvas = $('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 320);
    $('menu').hidden = true; $('hud').hidden = false;
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#93c3cf');
    this.scene.fog = new THREE.FogExp2('#a8cfd4', 0.006);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.48, 0.6, 0.88);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  replaceNpcs() {
    for (const npc of this.world.npcs) {
      const mesh = npc.mesh;
      mesh.clear();
      const model = makeSoldier({ body: npc.color, accent: '#ffe6a1', glow: 0.7, metalness: 0.25, roughness: 0.7 });
      model.scale.setScalar(0.92);
      mesh.add(model);
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.26), new THREE.MeshBasicMaterial({ color: '#ffd66e' }));
      marker.position.y = 3.05; marker.userData.marker = true; mesh.add(marker);
      mesh.userData.model = model; mesh.userData.marker = marker;
    }
  }

  setupLights() {
    this.hemi = new THREE.HemisphereLight('#c8ebf4', '#4f6547', 1.15);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffe7c4', 2.5);
    this.sun.position.set(-34, 58, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 1, far: 150 });
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun);
    this.sun.target = new THREE.Object3D(); this.scene.add(this.sun.target);
    this.rim = new THREE.DirectionalLight('#6ca9d6', 0.55);
    this.rim.position.set(30, 18, -35); this.scene.add(this.rim);
  }

  setupSky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color('#4fa8c8') }, bottom: { value: new THREE.Color('#f4d7b1') } },
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h=normalize(vP).y; vec3 c=mix(bottom,top,smoothstep(-0.1,0.7,h)); gl_FragColor=vec4(c,1.0); }'
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(240, 24, 16), this.skyMat);
    this.scene.add(this.sky);
    const stars = [];
    for (let i = 0; i < 600; i++) {
      const a = rand(0, Math.PI * 2), y = rand(0.15, 0.95), r = Math.sqrt(1 - y * y) * 220;
      stars.push(Math.cos(a) * r, y * 220, Math.sin(a) * r);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffe9bc', size: 1.3, transparent: true, opacity: 0 }));
    this.scene.add(this.stars);
  }

  stats(key = this.heroKey) {
    const def = HEROES[key];
    let hp = def.hp + (this.level - 1) * 9 + this.passiveRanks.vitality * 10;
    let power = def.power + (this.level - 1) * 2 + this.passiveRanks.might * def.power * 0.06;
    let speed = def.speed * (1 + this.passiveRanks.fleet * 0.025);
    for (const slot of ['weapon', 'armor', 'outfit', 'shoes', 'trinket']) {
      const it = ITEMS[this.equipment[slot]];
      if (!it) continue;
      hp += it.hp || 0; power += it.atk || 0; speed += def.speed * (it.speed || 0);
    }
    if (this.buff > 0) power *= 1.15;
    return { maxHp: Math.round(hp), power: Math.round(power), speed, cdr: Math.min(0.35, this.passiveRanks.focus * 0.03) };
  }

  createHeroes() {
    this.heroes = {};
    const spawn = [{ x: 0, z: 18 }, { x: -3.2, z: 20 }, { x: 3.2, z: 20 }];
    HERO_KEYS.forEach((key, i) => {
      const def = HEROES[key];
      const root = new THREE.Group();
      const model = makeSoldier({ body: def.tint, accent: def.accent, glow: 1.6, metalness: 0.5, roughness: 0.42 });
      root.add(model);
      const st = this.stats(key);
      const pos = (this.savedPos && key === this.heroKey) ? this.savedPos : spawn[i];
      const hero = {
        key, def, root, model, x: pos.x, z: pos.z, y: this.world.heightAt(pos.x, pos.z), yaw: Math.PI,
        hp: st.maxHp, maxHp: st.maxHp, power: st.power, owner: key === this.heroKey ? 'local' : 'ai',
        moving: false, dead: false, cooldowns: {}, attackAnim: 0, invuln: 0, mounted: false, level: this.level,
        shield: 0, revive: 0, targetX: null, targetZ: null, gear: null, petType: key === this.heroKey ? this.activePet : null
      };
      root.position.set(hero.x, hero.y, hero.z);
      root.rotation.y = hero.yaw;
      this.scene.add(root);
      const mount = makeMount(MOUNTS[this.mount].model);
      mount.visible = false; root.add(mount); hero.mount = mount;
      const label = this.makeLabel(def.first, key === this.heroKey ? '#ffe7aa' : '#e3edf1');
      label.position.y = 2.55; root.add(label); hero.label = label;
      this.heroes[key] = hero;
      if (key === this.heroKey) this.localHero = hero;
    });
    if (this.savedPos) {
      this.localHero.x = this.savedPos.x; this.localHero.z = this.savedPos.z;
      this.localHero.y = this.world.heightAt(this.localHero.x, this.localHero.z);
      this.localHero.root.position.set(this.localHero.x, this.localHero.y, this.localHero.z);
    }
    if (this.savedFarm) {
      for (const f of this.savedFarm) {
        const p = this.world.farmPlots.find((x) => x.id === f.id);
        if (p) { p.crop = f.crop; p.plantedAt = f.plantedAt; }
      }
    }
  }

  makeLabel(text, color) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d');
    c.font = 'bold 28px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(5,12,16,0.62)'; c.fillRect(34, 12, 188, 40);
    c.strokeStyle = 'rgba(255,224,150,0.45)'; c.lineWidth = 2; c.strokeRect(34, 12, 188, 40);
    c.fillStyle = color; c.fillText(text, 128, 33);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(2.1, 0.52, 1); return sp;
  }

  makeBar(color = '#7ce39a') {
    const g = new THREE.Group();
    const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#101820', transparent: true, opacity: 0.8, depthWrite: false }));
    bg.scale.set(1.25, 0.1, 1); g.add(bg);
    const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color, transparent: true, depthWrite: false }));
    fill.scale.set(1.2, 0.065, 1); fill.position.z = 0.01; g.add(fill);
    g.userData.fill = fill; return g;
  }

  createPet() {
    if (this.petMesh) { this.scene.remove(this.petMesh); this.petMesh = null; }
    const pet = this.pets[this.activePet];
    if (!pet) return;
    this.petMesh = makeFox({ body: PETS[this.activePet].color });
    this.petMesh.scale.setScalar(0.9);
    this.petPos = { x: this.localHero.x - 1.2, z: this.localHero.z + 1.2 };
    this.petMesh.position.set(this.petPos.x, this.world.heightAt(this.petPos.x, this.petPos.z), this.petPos.z);
    this.scene.add(this.petMesh);
    const label = this.makeLabel(PETS[this.activePet].name, '#ffd9a0');
    label.position.y = 1.05; label.scale.set(1.2, 0.3, 1); this.petMesh.add(label);
    this.petMaxHp = PETS[this.activePet].hp + (pet.level - 1) * 14;
    pet.hp = Math.min(pet.hp ?? this.petMaxHp, this.petMaxHp);
  }

  spawnEnemies() {
    this.enemies = [];
    let n = 0;
    for (const zone of this.world.spawnZones) {
      const count = Math.min(zone.count, zone.type === 'deer' ? 4 : 5);
      for (let i = 0; i < count; i++) {
        const p = this.world.randomPointInZone(zone);
        this.enemies.push(this.makeEnemy(zone.type, p.x, p.z, zone, `${zone.id}-${i}`));
        n++;
      }
    }
    this.boss = this.makeEnemy('boss', this.world.boss.x, this.world.boss.z, { id: 'boss', respawn: 999 }, 'boss', true);
    this.enemies.push(this.boss);
  }

  makeEnemy(type, x, z, zone, id, boss = false) {
    const def = ENEMIES[type];
    const root = new THREE.Group();
    let model;
    if (def.kind === 'soldier') model = makeSoldier({ body: def.tint, accent: def.accent || '#ffb15e', glow: 1, metalness: 0.4, roughness: 0.55 });
    else if (def.kind === 'fox') model = makeFox({ body: def.tint || '#5f6872' });
    else if (def.kind === 'horse') model = makeHorse({ body: def.tint, accent: '#b8d8cf' });
    else model = makeKnight({ body: def.tint, accent: def.accent || '#7befe4', glow: 2.2 });
    if (def.scale) model.scale.multiplyScalar(def.scale);
    root.add(model);
    const bar = this.makeBar(boss ? '#f0b35e' : '#7de39a');
    bar.position.y = boss ? 4.4 : def.kind === 'fox' ? 1.2 : 2.25;
    bar.visible = false; root.add(bar);
    root.position.set(x, this.world.heightAt(x, z), z);
    this.scene.add(root);
    return {
      id, type, def, root, model, bar, x, z, hp: def.hp, maxHp: def.hp, dead: false, deadTimer: 0,
      attackCd: 0, specialCd: 4, wander: rand(1, 5), wdir: rand(0, 6.28), moving: false, yaw: 0,
      boss, zone, remote: false, scale: def.scale || 1
    };
  }

  setupNet() {
    this.netReady = this.mode !== 'guest';
    if (this.mode !== 'host' && this.mode !== 'guest') { $('room-badge').textContent = 'Solo'; return; }
    if (!('BroadcastChannel' in window)) { $('room-badge').textContent = 'Solo'; return; }
    this.net = new BroadcastChannel(`aba-aurora-${this.room}`);
    this.net.onmessage = (e) => this.onNet(e.data);
    $('room-badge').textContent = `Room ${this.room}`;
    if (this.mode === 'host') this.toast(`Room ${this.room} ready. Another tab can join.`, 'quest');
    else { this.sendJoin(); this.joinTimer = setInterval(() => { if (!this.netReady) this.sendJoin(); }, 1200); this.showSync(); }
    addEventListener('beforeunload', () => this.net?.postMessage({ type: 'leave', from: this.playerId }));
  }

  showSync() {
    $('sync-overlay').hidden = false;
    $('sync-title').textContent = 'Joining the party…';
    $('sync-text').textContent = `Searching for host room ${this.room} in this browser.`;
  }

  sendJoin() { this.net?.postMessage({ type: 'join', from: this.playerId, name: this.playerName, hero: this.heroKey }); }

  onNet(msg) {
    if (!msg || msg.from === this.playerId) return;
    if (this.mode === 'host') this.hostNet(msg); else this.guestNet(msg);
  }

  hostNet(msg) {
    if (msg.type === 'join') {
      const taken = new Set([this.localHero.key, ...[...this.remote.values()].map((p) => p.heroKey)]);
      const key = msg.hero && !taken.has(msg.hero) ? msg.hero : HERO_KEYS.find((k) => !taken.has(k));
      if (!key) return;
      const hero = this.heroes[key];
      hero.owner = msg.from; hero.name = msg.name;
      this.remote.set(msg.from, { id: msg.from, name: msg.name, heroKey: key, x: hero.x, z: hero.z });
      this.net.postMessage({ type: 'welcome', to: msg.from, from: this.playerId, heroKey: key, host: this.playerName });
      this.toast(`${msg.name} joined as ${HEROES[key].first}.`, 'quest');
    } else if (msg.type === 'input') {
      const h = this.heroes[msg.heroKey];
      if (!h || h.owner !== msg.from) return;
      h.x = clamp(msg.x, -145, 145); h.z = clamp(msg.z, -145, 145); h.y = this.world.heightAt(h.x, h.z);
      h.yaw = msg.yaw; h.moving = !!msg.moving; h.mounted = !!msg.mounted; h.hp = Math.min(msg.hp, msg.maxHp); h.maxHp = msg.maxHp;
      h.petType = msg.petType; h.root.position.set(h.x, h.y, h.z); h.root.rotation.y = h.yaw;
      h.mount.visible = h.mounted;
    } else if (msg.type === 'action') {
      const h = this.heroes[msg.heroKey]; if (!h || h.owner !== msg.from) return;
      if (msg.action === 'basic') this.basic(h, msg.tx, msg.tz, msg.power);
      else if (msg.action === 'skill') this.skill(h, msg.slot, msg.tx, msg.tz, msg.power);
      else if (msg.action === 'pet') this.petSkill(h);
    } else if (msg.type === 'chat') this.chat(`${msg.name}: ${msg.text}`);
    else if (msg.type === 'leave') {
      const p = this.remote.get(msg.from); if (!p) return;
      this.heroes[p.heroKey].owner = 'ai'; this.remote.delete(msg.from); this.toast(`${p.name} left.`, 'warn');
    }
  }

  guestNet(msg) {
    if (msg.to && msg.to !== this.playerId) return;
    if (msg.type === 'welcome') {
      this.netReady = true; this.assigned = msg.heroKey; clearInterval(this.joinTimer);
      this.setLocalHero(msg.heroKey); $('sync-overlay').hidden = true;
      this.toast(`Joined ${msg.host}'s party as ${HEROES[msg.heroKey].first}.`, 'quest');
    } else if (msg.type === 'snapshot') this.applySnapshot(msg);
    else if (msg.type === 'kill') this.onRemoteKill(msg);
    else if (msg.type === 'chat') this.chat(`${msg.name}: ${msg.text}`);
  }

  setLocalHero(key) {
    const old = this.localHero; if (old) old.owner = 'ai';
    this.localHero = this.heroes[key]; this.localHero.owner = 'local'; this.heroKey = key;
    for (const k of HERO_KEYS) if (k !== key) this.heroes[k].owner = this.mode === 'guest' ? 'remote' : 'ai';
    this.createPet();
  }

  applySnapshot(m) {
    for (const d of m.heroes || []) {
      const h = this.heroes[d.key]; if (!h) continue;
      if (h === this.localHero) {
        h.hp = d.hp; h.maxHp = d.maxHp; h.dead = d.dead;
        if (Math.hypot(h.x - d.x, h.z - d.z) > 3) { h.x = d.x; h.z = d.z; }
      } else {
        h.targetX = d.x; h.targetZ = d.z; h.tyaw = d.yaw; h.moving = d.moving; h.hp = d.hp; h.maxHp = d.maxHp;
        h.dead = d.dead; h.mounted = d.mounted; h.petType = d.petType; h.gear = d.gear;
      }
    }
    for (const d of m.enemies || []) {
      let e = this.remoteEnemies.get(d.id);
      if (!e) { e = this.makeEnemy(d.type, d.x, d.z, { id: 'remote' }, d.id, d.boss); e.remote = true; this.remoteEnemies.set(d.id, e); this.enemies.push(e); }
      e.root.position.set(d.x, this.world.heightAt(d.x, d.z), d.z);
      e.x = d.x; e.z = d.z; e.hp = d.hp; e.maxHp = d.maxHp; e.moving = d.moving; e.boss = d.boss;
      if (d.hp <= 0 && !e.dead) { e.dead = true; e.root.visible = false; }
    }
    if (m.gameMinutes) this.gameMinutes = m.gameMinutes;
  }

  sendSnapshot() {
    if (!this.net || this.mode !== 'host' || this.remote.size === 0) return;
    this.net.postMessage({
      type: 'snapshot', from: this.playerId, gameMinutes: this.gameMinutes,
      heroes: Object.values(this.heroes).map((h) => ({ key: h.key, x: h.x, z: h.z, yaw: h.yaw, moving: h.moving, hp: h.hp, maxHp: h.maxHp, dead: h.dead, mounted: h.mounted, petType: h.petType, gear: h === this.localHero ? this.equipment : null })),
      enemies: this.enemies.filter((e) => !e.remote && !e.dead).map((e) => ({ id: e.id, type: e.type, x: e.x, z: e.z, hp: e.hp, maxHp: e.maxHp, moving: e.moving, boss: e.boss }))
    });
  }

  bind() {
    addEventListener('resize', () => this.resize());
    addEventListener('keydown', (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName)) return;
      this.keys[e.code] = true;
      if (e.code === 'Tab') { e.preventDefault(); this.cycleHero(); }
      if (e.code === 'Escape') { e.preventDefault(); this.escape(); }
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyQ') this.useSkill(1);
      if (e.code === 'KeyR') this.useSkill(2);
      if (e.code === 'KeyF') this.useSkill(3);
      if (e.code === 'KeyG') this.usePetSkill();
      if (e.code === 'KeyV') this.toggleMount();
      if (e.code === 'KeyH') this.useTonic();
      if (e.code === 'KeyI') this.toggle('inventory');
      if (e.code === 'KeyK') this.toggle('skills');
      if (e.code === 'KeyC') this.toggle('craft');
      if (e.code === 'KeyP') this.toggle('pets');
      if (e.code === 'KeyM') this.toggle('map');
      if (e.code === 'KeyT') { e.preventDefault(); this.openChat(); }
      if (e.code === 'Space' && !this.uiOpen) { e.preventDefault(); this.jump(); }
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2 || (e.pointerType === 'touch' && e.clientX < innerWidth * 0.55)) {
        this.dragging = true; this.dx = e.clientX; this.dy = e.clientY;
        this.canvas.setPointerCapture(e.pointerId);
      } else if (e.button === 0) this.userAttack();
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.camYaw -= (e.clientX - this.dx) * 0.005;
      this.camPitch = clamp(this.camPitch + (e.clientY - this.dy) * 0.0035, 0.05, 0.72);
      this.dx = e.clientX; this.dy = e.clientY;
    });
    addEventListener('pointerup', () => { this.dragging = false; });
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.camDist = clamp(this.camDist + Math.sign(e.deltaY) * 0.8, 5.5, 16); }, { passive: false });
    const click = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', (e) => { e.preventDefault(); fn(); }); };
    for (const id of ['btn-inventory', 'btn-inventory2']) click(id, () => this.toggle('inventory'));
    for (const id of ['btn-skills', 'btn-skills2']) click(id, () => this.toggle('skills'));
    for (const id of ['btn-craft', 'btn-craft2']) click(id, () => this.toggle('craft'));
    for (const id of ['btn-pets', 'btn-pets2']) click(id, () => this.toggle('pets'));
    click('btn-map', () => this.toggle('map'));
    click('btn-pause', () => this.toggle('pause'));
    click('btn-resume', () => this.close());
    click('btn-open-help', () => { this.close(); this.open('help'); });
    click('btn-save', () => { this.save(); this.toast('Journey saved.', 'quest'); });
    click('btn-quit', () => { this.save(); location.reload(); });
    click('btn-sound', () => { this.audioOn = !this.audioOn; this.audio.setMuted(!this.audioOn); $('btn-sound').textContent = this.audioOn ? 'Sound' : 'Muted'; });
    click('btn-respawn', () => this.respawnLocal());
    click('btn-victory-continue', () => { $('victory-overlay').hidden = true; this.victory = false; });
    click('btn-victory-title', () => { this.save(); location.reload(); });
    click('btn-reel', () => this.reel());
    click('btn-sync-retry', () => location.reload());
    click('btn-sync-cancel', () => location.reload());
    for (const el of document.querySelectorAll('[data-close]')) el.addEventListener('click', () => this.close());
    for (const el of document.querySelectorAll('[data-action]')) el.addEventListener('click', () => {
      const a = el.dataset.action;
      if (a === 'attack') this.userAttack();
      if (a === 'skill1') this.useSkill(1);
      if (a === 'skill2') this.useSkill(2);
      if (a === 'ultimate') this.useSkill(3);
      if (a === 'petskill') this.usePetSkill();
      if (a === 'mount') this.toggleMount();
      if (a === 'potion') this.useTonic();
    });
    $('dialog-options').addEventListener('click', (e) => {
      const b = e.target.closest('[data-opt]'); if (!b) return;
      const fn = this.dialogOpts?.[+b.dataset.opt]; if (fn) fn();
    });
    $('shop-list').addEventListener('click', (e) => { const b = e.target.closest('[data-buy]'); if (b) this.buy(b.dataset.buy); });
    $('owned-list').addEventListener('click', (e) => { const b = e.target.closest('[data-item]'); if (b) this.useItem(b.dataset.item); });
    $('equipped-list').addEventListener('click', (e) => { const b = e.target.closest('[data-unequip]'); if (b) this.unequip(b.dataset.unequip); });
    $('skills-grid').addEventListener('click', (e) => {
      const s = e.target.closest('[data-skill]'); if (s) this.upgradeSkill(s.dataset.skill);
      const p = e.target.closest('[data-passive]'); if (p) this.upgradePassive(p.dataset.passive);
    });
    $('craft-list').addEventListener('click', (e) => { const b = e.target.closest('[data-craft]'); if (b) this.craft(b.dataset.craft); });
    $('pet-list').addEventListener('click', (e) => { const b = e.target.closest('[data-pet]'); if (b) { this.selectedPet = b.dataset.pet; this.renderPets(); } });
    $('pet-detail').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pet-action]'); if (!b) return;
      if (b.dataset.petAction === 'activate') this.activatePet(b.dataset.pet);
      if (b.dataset.petAction === 'feed') this.feedPet();
      if (b.dataset.petAction === 'trinket') this.petTrinket();
    });
    $('chat-form').addEventListener('submit', (e) => {
      e.preventDefault(); const t = $('chat-input').value.trim();
      if (t && this.net) { this.net.postMessage({ type: 'chat', from: this.playerId, name: this.playerName, text: t }); this.chat(`${this.playerName}: ${t}`); }
      $('chat-input').value = ''; this.closeChat();
    });
    $('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); this.closeChat(); } e.stopPropagation(); });
    this.bindMobile();
    if (innerWidth < 860) $('mobile-controls').hidden = false;
  }

  bindMobile() {
    const joy = $('joystick'), stick = $('stick'); let active = false;
    const move = (e) => {
      if (!active) return;
      const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let x = (e.clientX - cx) / (r.width * 0.5), y = (e.clientY - cy) / (r.height * 0.5);
      let l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; l = 1; }
      const dead = 0.14;
      if (l < dead) { x = 0; y = 0; }
      else {
        const strength = Math.pow((l - dead) / (1 - dead), 1.65);
        x = (x / l) * strength; y = (y / l) * strength;
      }
      this.touch.x = x; this.touch.y = y;
      stick.style.transform = `translate(${x * 26}px,${y * 26}px)`;
    };
    joy?.addEventListener('pointerdown', (e) => { active = true; joy.setPointerCapture(e.pointerId); move(e); });
    joy?.addEventListener('pointermove', move);
    const end = () => { active = false; this.touch.x = this.touch.y = 0; if (stick) stick.style.transform = ''; };
    joy?.addEventListener('pointerup', end); joy?.addEventListener('pointercancel', end);
    const b = (id, fn) => { const el = $(id); if (el) el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); }); };
    b('mob-attack', () => this.userAttack()); b('mob-ability', () => this.useSkill(1));
    b('mob-interact', () => this.interact()); b('mob-pet', () => this.usePetSkill());
    b('mob-mount', () => this.toggleMount());
  }

  resize() {
    this.w = innerWidth; this.h = innerHeight;
    this.renderer.setSize(this.w, this.h, false);
    this.composer?.setSize(this.w, this.h);
    this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix();
    if (this.el?.mobile) this.el.mobile.hidden = !(this.w < 860 || matchMedia('(pointer: coarse)').matches);
    if ($('mobile-controls')) $('mobile-controls').hidden = !(this.w < 860 || matchMedia('(pointer: coarse)').matches);
  }

  loop(now) {
    if (!this.running) return;
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.update(dt);
    this.composer.render();
  }

  update(dt) {
    this.time += dt; this.played += dt;
    if (this.uiOpen !== 'pause' && !this.fishing) this.gameMinutes += dt * 0.55;
    this.dayNight();
    if (!this.uiOpen && !this.fishing) this.updatePlayer(dt);
    if (this.mode === 'guest') this.updateRemotes(dt);
    else { this.updateAI(dt); this.updateEnemies(dt); this.updatePet(dt); }
    this.updateProjectiles(dt); this.updateEffects(dt); this.updateFarm(dt); this.updateCamera(dt);
    this.updateInteract(); this.updateQuestMarkers(); this.updateHud(false); this.updateFishing(dt);
    if (this.victory && this.uiOpen !== 'victory') this.showVictory();
    if (this.net) {
      this.inputTimer += dt;
      if (this.inputTimer > 0.09) { this.inputTimer = 0; if (this.mode === 'guest' && this.netReady) this.sendInput(); }
      this.snapTimer += dt;
      if (this.snapTimer > 0.16) { this.snapTimer = 0; if (this.mode === 'host') this.sendSnapshot(); }
    }
    this.mapTimer += dt;
    if (this.mapTimer > 0.12) { this.mapTimer = 0; this.drawMinimap(); }
    this.saveTimer += dt;
    if (this.saveTimer > 15) { this.saveTimer = 0; if (this.mode === 'solo') this.save(); }
  }

  dayNight() {
    const h = (this.gameMinutes % 1440) / 60;
    const daylight = clamp((Math.sin(((h - 6) / 24) * Math.PI * 2) + 0.25) * 1.3, 0.08, 1);
    this.sun.intensity = 0.35 + daylight * 2.2;
    this.hemi.intensity = 0.32 + daylight * 0.9;
    this.rim.intensity = 0.15 + daylight * 0.4;
    this.skyMat.uniforms.top.value.set('#0b1835').lerp(new THREE.Color('#4fa8c8'), daylight);
    this.skyMat.uniforms.bottom.value.set('#24344f').lerp(new THREE.Color('#f4d7b1'), daylight);
    this.scene.fog.color.set('#24344f').lerp(new THREE.Color('#a8cfd4'), daylight);
    this.stars.material.opacity = Math.max(0, (1 - daylight) - 0.35) * 1.4;
    this.sky.position.copy(this.camera.position); this.stars.position.copy(this.camera.position);
    if (this.world.water) this.world.water.material.uniforms.uTime.value = this.time;
  }

  updatePlayer(dt) {
    const h = this.localHero;
    if (!h || h.dead) return;
    let x = (this.keys.KeyD || this.keys.ArrowRight ? 1 : 0) - (this.keys.KeyA || this.keys.ArrowLeft ? 1 : 0);
    let z = (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0) - (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0);
    if (this.touch.x || this.touch.y) {
      this.touchSmooth.x = damp(this.touchSmooth.x, this.touch.x, 14, dt);
      this.touchSmooth.z = damp(this.touchSmooth.z, this.touch.y, 14, dt);
      x = this.touchSmooth.x; z = this.touchSmooth.z;
    } else {
      this.touchSmooth.x = damp(this.touchSmooth.x, 0, 18, dt);
      this.touchSmooth.z = damp(this.touchSmooth.z, 0, 18, dt);
    }
    const len = Math.hypot(x, z); if (len > 1) { x /= len; z /= len; }
    const st = this.stats();
    const sprint = (this.keys.ShiftLeft || this.keys.ShiftRight) && len > 0 && !this.mounted && this.stamina > 2;
    this.stamina = clamp(this.stamina + (sprint ? -30 : 18) * dt, 0, 100);
    let speed = st.speed * (sprint ? 1.35 : 1) * (this.mounted ? MOUNTS[this.mount].speed : 1);
    if (h.buff > 0) speed *= 1.25;
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw), rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    const mx = (fx * -z + rx * x), mz = (fz * -z + rz * x);
    const moved = this.world.move(h, mx * speed * dt, mz * speed * dt, 0.55);
    h.moving = moved && len > 0.05;
    if (h.moving) {
      const target = Math.atan2(mx, mz); let d = target - h.yaw;
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      h.yaw += d * Math.min(1, dt * 12);
    }
    h.y = this.world.heightAt(h.x, h.z);
    h.root.position.set(h.x, h.y, h.z); h.root.rotation.y = h.yaw;
    h.invuln = Math.max(0, h.invuln - dt); h.attackAnim = Math.max(0, h.attackAnim - dt * 3.2);
    for (const k in h.cooldowns) h.cooldowns[k] = Math.max(0, h.cooldowns[k] - dt);
    playState(h.model, h.moving ? 'Run' : 'Idle', sprint ? 1.3 : 1);
    updateMixers(h.model, dt);
    h.mount.visible = this.mounted;
    h.mount.rotation.y = Math.sin(this.time * 3) * 0.02;
    if (this.petMesh) {
      const targetX = h.x - Math.cos(h.yaw) * 1.7, targetZ = h.z + Math.sin(h.yaw) * 1.7;
      this.petPos.x = damp(this.petPos.x, targetX, 5, dt); this.petPos.z = damp(this.petPos.z, targetZ, 5, dt);
      const py = this.world.heightAt(this.petPos.x, this.petPos.z);
      this.petMesh.position.set(this.petPos.x, py, this.petPos.z);
      this.petMesh.rotation.y = h.yaw + Math.PI / 2;
      playState(this.petMesh, h.moving ? 'Run' : 'Survey', 1);
      updateMixers(this.petMesh, dt);
    }
    const target = new THREE.Vector3(h.x, h.y + 1.45, h.z);
    this.camTarget.lerp(target, 1 - Math.exp(-12 * dt));
    this.sun.target.position.copy(new THREE.Vector3(h.x, h.y, h.z));
    this.sun.position.set(h.x - 34, h.y + 58, h.z + 30);
  }

  updateCamera(dt) {
    const t = this.camTarget.lengthSq() ? this.camTarget : new THREE.Vector3(this.localHero.x, this.localHero.y + 1.4, this.localHero.z);
    const off = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist,
      Math.sin(this.camPitch) * this.camDist + 1.6,
      Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist
    );
    const desired = t.clone().add(off);
    let clearance = this.world.heightAt(desired.x, desired.z) + 1.15;
    for (let i = 2; i <= 10; i++) {
      const k = i / 10;
      const sx = t.x + (desired.x - t.x) * k;
      const sz = t.z + (desired.z - t.z) * k;
      clearance = Math.max(clearance, this.world.heightAt(sx, sz) + 1.15);
    }
    if (desired.y < clearance) desired.y = clearance;
    this.camera.position.lerp(desired, 1 - Math.exp(-8 * dt));
    this.camera.lookAt(t.x, t.y + 0.3, t.z);
  }

  cycleHero() {
    if (this.mode === 'guest') return;
    const idx = HERO_KEYS.indexOf(this.localHero.key);
    const next = HERO_KEYS[(idx + 1) % 3];
    if (this.heroes[next].owner !== 'ai') return;
    this.setLocalHero(next); this.toast(`Now controlling ${HEROES[next].first}.`, 'info');
  }

  updateAI(dt) {
    for (const h of Object.values(this.heroes)) {
      if (h.owner !== 'ai') continue;
      if (h.dead) { h.revive -= dt; if (h.revive <= 0) { h.dead = false; h.hp = h.maxHp * 0.5; h.root.visible = true; } continue; }
      const target = this.nearestEnemy(h.x, h.z, 11);
      let mx = 0, mz = 0;
      if (target) {
        const d = Math.hypot(target.x - h.x, target.z - h.z);
        if (d > 2.4) { mx = (target.x - h.x) / d; mz = (target.z - h.z) / d; }
        h.atkCd = (h.atkCd || 0) - dt;
        if (d < 3.5 && h.atkCd <= 0) { h.atkCd = 1.1; this.attackEnemy(target, h.power * 0.75, h); h.attackAnim = 1; }
      } else {
        const tx = this.localHero.x + (h.key === 'boris' ? -2.4 : 2.4), tz = this.localHero.z + 1.4;
        const d = Math.hypot(tx - h.x, tz - h.z);
        if (d > 3.2) { mx = (tx - h.x) / d; mz = (tz - h.z) / d; }
      }
      if (mx || mz) {
        const moved = this.world.move(h, mx * h.def.speed * 0.8 * dt, mz * h.def.speed * 0.8 * dt, 0.5);
        h.moving = moved;
        if (moved) { const y = Math.atan2(mx, mz); let d = y - h.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; h.yaw += d * Math.min(1, dt * 9); }
      } else h.moving = false;
      h.y = this.world.heightAt(h.x, h.z); h.root.position.set(h.x, h.y, h.z); h.root.rotation.y = h.yaw;
      h.attackAnim = Math.max(0, h.attackAnim - dt * 3);
      playState(h.model, h.moving ? 'Run' : 'Idle'); updateMixers(h.model, dt);
    }
  }

  updateRemotes(dt) {
    for (const k of HERO_KEYS) {
      const h = this.heroes[k]; if (h === this.localHero) continue;
      if (h.targetX != null) {
        h.x = damp(h.x, h.targetX, 9, dt); h.z = damp(h.z, h.targetZ, 9, dt);
        let d = (h.tyaw || 0) - h.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        h.yaw += d * Math.min(1, dt * 8);
      }
      h.y = this.world.heightAt(h.x, h.z); h.root.position.set(h.x, h.y, h.z); h.root.rotation.y = h.yaw; h.root.visible = !h.dead;
      h.mount.visible = h.mounted;
      playState(h.model, h.moving ? 'Run' : 'Idle'); updateMixers(h.model, dt);
      if (h.petType) {
        let p = this.remotePets.get(k);
        if (!p) { p = makeFox({ body: PETS[h.petType]?.color || '#c58a52' }); p.scale.setScalar(0.9); this.scene.add(p); this.remotePets.set(k, p); }
        const px = h.x - Math.cos(h.yaw) * 1.5, pz = h.z + Math.sin(h.yaw) * 1.5;
        p.position.set(px, this.world.heightAt(px, pz), pz); playState(p, h.moving ? 'Run' : 'Survey'); updateMixers(p, dt);
      }
    }
  }

  updateEnemies(dt) {
    const heroes = Object.values(this.heroes).filter((h) => !h.dead);
    for (const e of this.enemies) {
      if (e.remote || e.dead) { e.deadTimer = (e.deadTimer || 0) + dt; if (e.dead && e.deadTimer > 22 && e.zone?.respawn) { this.respawnEnemy(e); } continue; }
      if (e.hp <= 0) { this.killEnemy(e); continue; }
      e.attackCd = Math.max(0, e.attackCd - dt); e.specialCd = Math.max(0, e.specialCd - dt);
      let near = null, nd = e.boss ? 60 : 18;
      for (const h of heroes) { const d = Math.hypot(h.x - e.x, h.z - e.z); if (d < nd) { nd = d; near = h; } }
      let mx = 0, mz = 0;
      if (near && nd < e.def.aggro + 10) {
        if (nd > e.def.range) { mx = (near.x - e.x) / nd; mz = (near.z - e.z) / nd; e.moving = true; }
        else {
          e.moving = false;
          if (e.attackCd <= 0) { e.attackCd = e.boss ? 1.1 : 1.5; this.damageHero(near, e.def.power, e); }
        }
        e.yaw = Math.atan2(near.x - e.x, near.z - e.z);
        if (e.boss && e.specialCd <= 0) {
          e.specialCd = 6;
          this.telegraph(near.x, near.z, 5.5, 0.9, '#ff7b58', () => {
            for (const h of heroes) if (Math.hypot(h.x - near.x, h.z - near.z) < 5.5) this.damageHero(h, e.def.power * 1.2, e);
          });
        }
      } else if (e.def.passive) {
        e.wander -= dt; if (e.wander <= 0) { e.wander = 3; e.wdir = rand(0, 6.28); }
        mx = Math.sin(e.wdir); mz = Math.cos(e.wdir); e.moving = true;
      } else {
        e.wander -= dt; if (e.wander <= 0) { e.wander = 3; e.wdir = rand(0, 6.28); }
        mx = Math.sin(e.wdir) * 0.3; mz = Math.cos(e.wdir) * 0.3; e.moving = true;
      }
      if (mx || mz) this.world.move(e, mx * e.def.speed * dt, mz * e.def.speed * dt, 0.5);
      e.y = this.world.heightAt(e.x, e.z); e.root.position.set(e.x, e.y, e.z); e.root.rotation.y = e.yaw;
      const model = e.model.userData?.mixer ? e.model : e.model.children?.[0];
      if (e.model.userData?.actions) { playState(e.model, e.moving ? 'Run' : 'Idle'); updateMixers(e.model, dt); }
      else updateMixers(e.model, dt);
      if (e.hp < e.maxHp) { e.bar.visible = true; e.bar.userData.fill.scale.x = 1.2 * e.hp / e.maxHp; }
      if (e.boss) {
        $('boss-bar').hidden = Math.hypot(this.localHero.x - e.x, this.localHero.z - e.z) > 55;
        if (!$('boss-bar').hidden) { $('boss-name').textContent = 'The Clockwork Colossus'; $('boss-fill').style.width = `${(e.hp / e.maxHp) * 100}%`; $('boss-hp-text').textContent = `${Math.max(0, Math.round(e.hp))} / ${e.maxHp}`; }
      }
    }
  }

  respawnEnemy(e) {
    const p = this.world.randomPointInZone(e.zone);
    e.x = p.x; e.z = p.z; e.hp = e.maxHp; e.dead = false; e.deadTimer = 0; e.root.visible = true;
    e.root.position.set(e.x, this.world.heightAt(e.x, e.z), e.z);
  }

  nearestEnemy(x, z, max) {
    let best = null, bd = max;
    for (const e of this.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - x, e.z - z); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  userAttack() {
    if (this.uiOpen || this.localHero.dead) return;
    const h = this.localHero;
    const target = this.nearestEnemy(h.x, h.z, h.def.basicRange + 4);
    const tx = target?.x ?? h.x + Math.sin(h.yaw) * 4;
    const tz = target?.z ?? h.z + Math.cos(h.yaw) * 4;
    if (h.cooldowns.basic > 0) return;
    h.cooldowns.basic = h.def.basicCd;
    h.attackAnim = 1;
    this.audio.sword();
    if (this.net && this.mode === 'guest' && this.netReady) {
      this.net.postMessage({ type: 'action', from: this.playerId, heroKey: h.key, action: 'basic', tx, tz, power: this.stats().power });
    } else this.basic(h, tx, tz, this.stats().power);
  }

  basic(h, tx, tz, power) {
    const dist = Math.hypot(tx - h.x, tz - h.z);
    const yaw = Math.atan2(tx - h.x, tz - h.z);
    h.yaw = yaw;
    if (h.def.weapon === 'bow' || h.key === 'aurora') {
      this.spawnProjectile(h, yaw, power, 24);
      this.audio.bow();
    } else {
      this.slash(h.x, h.z, yaw, h.def.weapon === 'hammer' ? 4.2 : 3.2, h.def.weapon === 'hammer' ? '#ffd47c' : '#a8ffe3');
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - h.x, e.z - h.z);
        if (d < h.def.basicRange + 1.4) {
          const a = Math.atan2(e.x - h.x, e.z - h.z);
          let diff = Math.abs(a - yaw); if (diff > Math.PI) diff = Math.PI * 2 - diff;
          if (diff < 1.1) this.attackEnemy(e, power, h);
        }
      }
      this.audio.sword();
    }
  }

  spawnProjectile(h, yaw, power, speed) {
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffe49a', emissive: '#ffb85c', emissiveIntensity: 3, metalness: 0.4, roughness: 0.3 });
    const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), mat);
    arrow.rotation.z = Math.PI / 2; root.add(arrow);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), mat); tip.rotation.z = -Math.PI / 2; tip.position.x = 0.5; root.add(tip);
    root.position.set(h.x + Math.sin(yaw) * 0.8, h.y + 1.35, h.z + Math.cos(yaw) * 0.8);
    root.rotation.y = yaw;
    this.scene.add(root);
    this.projectiles.push({ root, x: root.position.x, z: root.position.z, yaw, speed, power, life: 1.6, owner: h, type: 'arrow' });
  }

  performSkillVisual(h, kind) {
    this.audio.ability();
  }

  useSkill(slot) {
    if (this.uiOpen || this.localHero.dead) return;
    const h = this.localHero; const s = h.def.skills[slot - 1]; if (!s) return;
    const cdKey = s.id; const rank = this.skillRanks[h.key]?.[cdKey] || 1;
    if ((h.cooldowns[cdKey] || 0) > 0) return;
    h.cooldowns[cdKey] = s.cd * (1 - this.stats().cdr);
    const target = this.nearestEnemy(h.x, h.z, s.radius ? 18 : 28);
    const tx = target?.x ?? h.x + Math.sin(h.yaw) * 6, tz = target?.z ?? h.z + Math.cos(h.yaw) * 6;
    h.attackAnim = 1;
    if (this.net && this.mode === 'guest' && this.netReady) {
      this.net.postMessage({ type: 'action', from: this.playerId, heroKey: h.key, action: 'skill', slot, tx, tz, power: this.stats().power });
    } else this.skill(h, slot, tx, tz, this.stats().power);
    this.flashSkill(slot, s);
  }

  flashSkill(slot, s) {
    const el = $(`cd-skill${slot}`); if (el) { el.style.transition = 'none'; el.style.height = '100%'; requestAnimationFrame(() => { el.style.transition = 'height 0.6s linear'; el.style.height = '0%'; }); }
  }

  skill(h, slot, tx, tz, power) {
    const s = h.def.skills[slot - 1]; if (!s) return;
    const rank = this.skillRanks[h.key]?.[s.id] || 1;
    const mult = 1 + (rank - 1) * 0.3;
    if (s.type === 'aoe') {
      this.telegraph(tx, tz, s.radius, 0.35, '#7de9ff', () => {
        this.burst(tx, tz, '#7de9ff', 30);
        for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - tx, e.z - tz) < s.radius) this.attackEnemy(e, power * mult * (s.power / 30), h);
      });
      this.audio.ability();
    } else if (s.type === 'volley') {
      const base = Math.atan2(tx - h.x, tz - h.z);
      for (let i = 0; i < 5; i++) this.spawnProjectile(h, base + (i - 2) * 0.13, power * mult * 0.8, 26);
      this.audio.bow();
    } else if (s.type === 'blink') {
      const d = 7; const nx = h.x + Math.sin(h.yaw) * d, nz = h.z + Math.cos(h.yaw) * d;
      if (!this.world.blocked(nx, nz, 0.6)) { h.x = nx; h.z = nz; }
      this.burst(h.x, h.z, '#ff9bdc', 24);
      for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - h.x, e.z - h.z) < 3.5) this.attackEnemy(e, power * mult * 0.8, h);
      this.audio.ability();
    } else if (s.type === 'shield') {
      h.hp = Math.min(h.maxHp, h.hp + 60 * mult); h.shield = 60 * mult; this.burst(h.x, h.z, '#8ff5e9', 20); this.audio.quest();
    } else if (s.type === 'dash') {
      const nx = h.x + Math.sin(h.yaw) * 5, nz = h.z + Math.cos(h.yaw) * 5;
      if (!this.world.blocked(nx, nz, 0.6)) { h.x = nx; h.z = nz; }
      this.slash(h.x, h.z, h.yaw, 3, '#9dffe2');
      for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - h.x, e.z - h.z) < 3.6) this.attackEnemy(e, power * mult * 0.9, h);
    } else if (s.type === 'cone') {
      this.slash(h.x, h.z, h.yaw, 6, '#f7df8a');
      for (const e of this.enemies) {
        if (e.dead) continue; const d = Math.hypot(e.x - h.x, e.z - h.z);
        if (d < s.radius) { let a = Math.atan2(e.x - h.x, e.z - h.z); let diff = Math.abs(a - h.yaw); if (diff > Math.PI) diff = Math.PI * 2 - diff; if (diff < 1.1) this.attackEnemy(e, power * mult, h); }
      }
    }
    this.flashSkill(slot, s);
  }

  attackEnemy(e, power, src) {
    if (!e || e.dead) return;
    e.hp -= power; e.bar.visible = true; e.bar.userData.fill.scale.x = 1.2 * Math.max(0, e.hp / e.maxHp);
    this.burst(e.x, e.z, '#ffd78a', 7);
    this.audio.hit();
    if (e.hp <= 0 && !e.dead) this.killEnemy(e, src);
  }

  killEnemy(e, src) {
    if (e.dead) return;
    e.dead = true; e.deadTimer = 0; e.root.visible = false;
    if (!e.remote) {
      const def = e.def; const gold = Math.floor(rand(def.gold[0], def.gold[1] + 1));
      this.gold += gold; this.xp += def.xp; this.kills++;
      this.addPetXp(Math.round(def.xp * 0.55));
      for (const [m, q] of Object.entries(def.mats)) this.addItem(m, q);
      this.burst(e.x, e.z, '#ffcf6e', 24); this.audio.coin();
      if (this.xp >= this.xpNext()) this.levelUp();
      this.questProgress('kill', e.type, 1);
      if (e.boss) this.bossDefeated();
      if (this.mode === 'host' && this.net) this.net.postMessage({ type: 'kill', from: this.playerId, enemy: e.type, boss: e.boss });
      this.toast(`${e.boss ? 'Clockwork Colossus' : e.type[0].toUpperCase() + e.type.slice(1)} defeated · +${def.xp} XP · +${gold} gold`, 'loot');
    }
  }

  onRemoteKill(msg) {
    const def = ENEMIES[msg.enemy]; if (!def) return;
    this.xp += def.xp; this.gold += Math.floor(rand(def.gold[0], def.gold[1] + 1)); this.addPetXp(Math.round(def.xp * 0.55));
    for (const [m, q] of Object.entries(def.mats)) this.addItem(m, q);
    this.questProgress('kill', msg.enemy, 1);
    if (msg.boss) this.bossDefeated();
    if (this.xp >= this.xpNext()) this.levelUp();
  }

  bossDefeated() {
    if (this.quests.boss.state === 'done') return;
    this.quests.boss.state = 'done';
    this.quests.boss.progress = 1;
    if (!this.ownedPets.includes('whelp')) { this.ownedPets.push('whelp'); this.pets.whelp = { level: 1, xp: 0, hp: PETS.whelp.hp, trinket: null }; }
    this.addItem('dragoncore', 1); this.gold += 300; this.levelUp();
    this.showVictory();
  }

  xpNext() { return 70 + this.level * 55; }
  levelUp() {
    let levels = 0;
    while (this.xp >= this.xpNext()) { this.xp -= this.xpNext(); this.level++; this.skillPoints++; levels++; }
    if (levels) {
      for (const h of Object.values(this.heroes)) { const st = this.stats(h.key); h.maxHp = st.maxHp; h.hp = st.maxHp; h.level = this.level; }
      this.toast(`Level ${this.level}! +1 skill point.`, 'quest'); this.audio.level(); this.burst(this.localHero.x, this.localHero.z, '#ffe27c', 40);
    }
  }

  addPetXp(n) {
    const pet = this.pets[this.activePet]; if (!pet) return;
    pet.xp += n;
    while (pet.xp >= 60 + pet.level * 30) { pet.xp -= 60 + pet.level * 30; pet.level++; this.petMaxHp += 14; pet.hp = this.petMaxHp; this.toast(`${PETS[this.activePet].name} reached level ${pet.level}.`, 'quest'); }
  }

  updatePet(dt) {
    if (!this.petMesh) return;
    const pet = this.pets[this.activePet]; if (!pet) return;
    this.petCd = Math.max(0, this.petCd - dt);
    const target = this.nearestEnemy(this.petMesh.position.x, this.petMesh.position.z, 7);
    if (target) {
      this.petAtk = (this.petAtk || 0) - dt;
      if (this.petAtk <= 0) { this.petAtk = 1.5; this.attackEnemy(target, PETS[this.activePet].power + pet.level * 2, this.localHero); this.burst(target.x, target.z, '#ffb06a', 6); }
    }
  }

  usePetSkill() {
    if (this.uiOpen || this.localHero.dead) return;
    if (this.petCd > 0) return;
    const def = PETS[this.activePet]; if (!def) return;
    this.petCd = def.skill.cd;
    if (this.net && this.mode === 'guest' && this.netReady) this.net.postMessage({ type: 'action', from: this.playerId, heroKey: this.localHero.key, action: 'pet' });
    else this.petSkill(this.localHero);
    this.flashSkill(4, {});
  }

  petSkill(h) {
    const def = PETS[this.activePet]; if (!def) return;
    const pet = this.pets[this.activePet];
    const x = h.x, z = h.z, r = def.skill.radius;
    this.telegraph(x, z, r, 0.3, '#ffbc6c', () => {
      this.burst(x, z, '#ffc873', 32);
      for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - x, e.z - z) < r) this.attackEnemy(e, def.skill.power + pet.level * 3, h);
    });
    this.audio.ability();
  }

  damageHero(h, power, src) {
    if (h.dead || h.invuln > 0) return;
    h.invuln = 0.6;
    const dmg = h.shield > 0 ? Math.max(0, power - h.shield) : power;
    if (h.shield > 0) h.shield = Math.max(0, h.shield - power);
    h.hp -= dmg;
    this.burst(h.x, h.z, '#ff6b6b', 10); this.audio.hurt();
    if (h === this.localHero) this.camShake = 0.3;
    if (h.hp <= 0) {
      h.hp = 0; h.dead = true; h.root.visible = false;
      if (h.owner === 'ai') h.revive = 12;
      if (h === this.localHero) $('death-overlay').hidden = false;
    }
  }

  telegraph(x, z, r, delay, color, cb) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(r * 0.86, r, 40), mat);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, this.world.heightAt(x, z) + 0.12, z);
    this.scene.add(mesh);
    this.effects.push({ mesh, life: delay, max: delay, kind: 'telegraph', cb });
  }

  slash(x, z, yaw, r, color) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(r * 0.45, r, 24, 1, yaw - 0.9, 1.8), mat);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, this.world.heightAt(x, z) + 0.3, z);
    this.scene.add(mesh);
    this.effects.push({ mesh, life: 0.28, max: 0.28, kind: 'fade' });
  }

  burst(x, z, color, count) {
    const pos = [], vel = [];
    for (let i = 0; i < count; i++) {
      pos.push(x, this.world.heightAt(x, z) + 0.8, z);
      const a = rand(0, 6.28), s = rand(1.5, 6);
      vel.push(Math.cos(a) * s, rand(1.5, 5), Math.sin(a) * s);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.18, transparent: true, opacity: 0.95, depthWrite: false });
    const pts = new THREE.Points(geo, mat); this.scene.add(pts);
    this.effects.push({ mesh: pts, life: 0.55, max: 0.55, kind: 'burst', vel });
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]; e.life -= dt;
      if (e.kind === 'tele') {
        if (e.life <= 0) { e.cb?.(); e.mesh.material.opacity = 0; }
        else e.mesh.scale.setScalar(1 + (e.max - e.life) * 0.06);
      }
      if (e.kind === 'burst') {
        const p = e.mesh.geometry.attributes.position;
        for (let j = 0; j < p.count; j++) {
          e.vel[j * 3 + 1] -= 9 * dt;
          p.setXYZ(j, p.getX(j) + e.vel[j * 3] * dt, p.getY(j) + e.vel[j * 3 + 1] * dt, p.getZ(j) + e.vel[j * 3 + 2] * dt);
        }
        p.needsUpdate = true; e.mesh.material.opacity = e.life / e.max;
      }
      if (e.kind === 'fade') e.mesh.material.opacity = Math.max(0, e.life / e.max) * 0.75;
      if (e.life <= 0) {
        if (e.kind === 'telegraph') e.cb?.();
        this.scene.remove(e.mesh); e.mesh.geometry?.dispose(); e.mesh.material?.dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  spawnProjectile2() {}
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.life -= dt;
      p.x += Math.sin(p.yaw) * p.speed * dt; p.z += Math.cos(p.yaw) * p.speed * dt;
      p.root.position.set(p.x, this.world.heightAt(p.x, p.z) + 1.35, p.z);
      let hit = null;
      for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.z - p.z) < (e.boss ? 2.6 : 1.2)) { hit = e; break; }
      if (hit) { this.attackEnemy(hit, p.power, p.owner); p.life = 0; this.burst(p.x, p.z, '#ffe49a', 10); }
      if (p.life <= 0) {
        this.scene.remove(p.root); p.root.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
        this.projectiles.splice(i, 1);
      }
    }
  }

  updateFarm(dt) {
    this.plotTick = (this.plotTick || 0) + dt;
    if (this.plotTick < 1) return; this.plotTick = 0;
    for (const plot of this.world.farmPlots) {
      if (!plot.crop) continue;
      const elapsed = (Date.now() - plot.plantedAt) / 1000;
      const grow = plot.crop === 'moonherb' ? 55 : 40;
      if (!plot.meshReady && elapsed >= grow) {
        plot.meshReady = true;
        let marker = plot.readyMarker;
        if (!marker) { marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: '#ffe07a' })); marker.position.set(plot.x, this.world.heightAt(plot.x, plot.z) + 1.2, plot.z); this.scene.add(marker); plot.readyMarker = marker; }
        marker.visible = true;
      }
    }
  }

  updateInteract() {
    const it = this.world.nearestInteractable(this.localHero.x, this.localHero.z, 3.6);
    this.nearInteract = it;
    const p = $('interaction-prompt');
    if (it && !this.uiOpen) { p.hidden = false; $('interaction-text').textContent = it.kind === 'fishing' ? 'Cast a line' : it.name; }
    else p.hidden = true;
    if (this.nearInteract?.kind === 'npc' && this.heroes) {
      const q = this.quests;
      for (const h of Object.values(this.heroes)) {
        // markers are handled below
      }
    }
  }

  interact() {
    if (this.uiOpen || this.localHero.dead) return;
    const it = this.nearInteract || this.world.nearestInteractable(this.localHero.x, this.localHero.z, 3.6);
    if (!it) return;
    if (it.kind === 'npc') this.talk(it.id);
    else if (it.kind === 'farm') this.farm(it);
    else if (it.kind === 'fishing') this.startFishing(it);
    else if (it.kind === 'shrine') { this.respawn = { x: it.x, z: it.z + 1.5 }; this.localHero.hp = Math.min(this.localHero.maxHp, this.localHero.hp + this.localHero.maxHp * 0.4); this.toast(`${it.name} attuned. Respawn point set.`, 'quest'); this.burst(it.x, it.z, '#78ece4', 20); }
    else if (it.kind === 'bossgate') this.dialog('The Sunken Keep', 'The gate is torn open. Something enormous moves in the courtyard.', [{ label: 'Steel yourself', action: () => this.close() }]);
  }

  talk(id) {
    const npc = this.world.npcs.find((n) => n.id === id); if (!npc) return;
    if (id === 'mayor') {
      if (this.quests.welcome.state === 'active') {
        this.dialog('Mayor Elowen', 'The wards are failing and clockwork stirs beneath the Sunken Keep. Take this coin. Talk to Zippy. Hunt the wolves. Come back stronger.', [
          { label: 'Accept the quest', action: () => { this.completeQuest('welcome'); this.toast('Quest complete: A New Dawn', 'quest'); this.close(); } }
        ]);
      } else this.dialog('Mayor Elowen', this.quests.boss.state === 'done' ? 'The valley breathes again. You three have earned a very modern statue.' : 'Wolfwood first. Then the Keep. And do visit Zippy — heroes should not fight evil in sensible shoes.', [{ label: 'Leave', action: () => this.close() }]);
    } else if (id === 'zippy') this.openShop();
    else if (id === 'hilda') this.dialog('Hilda the Smith', 'Bring me scrap and fangs. I can turn a wolf into a weapon and a rumor into armor.', [{ label: 'Open crafting', action: () => { this.close(); this.open('craft'); } }, { label: 'Leave', action: () => this.close() }]);
    else if (id === 'mira') this.dialog('Mira the Innkeeper', 'A bed, a bath, and a bowl of stew. Ten gold and you will feel heroic again.', [
      { label: 'Rest (20 gold)', action: () => { if (this.gold >= 20) { this.gold -= 20; for (const h of Object.values(this.heroes)) h.hp = h.maxHp; this.toast('The party is fully rested.', 'quest'); } else this.toast('Not enough gold.', 'warn'); this.close(); } },
      { label: 'Leave', action: () => this.close() }
    ]);
    else this.dialog(npc.name, npc.id === 'pip' ? 'A ballad for Aurora! A dirge for Boris! A very fast song for Alice!' : 'The road east is dangerous. The road west has better snacks.', [{ label: 'Leave', action: () => this.close() }]);
  }

  farm(spot) {
    const plot = this.world.farmPlots.find((p) => p.id === spot.id) || spot;
    const grow = plot.crop === 'moonherb' ? 55 : 40;
    const elapsed = plot.crop ? (Date.now() - plot.plantedAt) / 1000 : 0;
    if (!plot.crop) {
      this.dialog('Emberfall Farm Plot', 'The soil is dark and ready. What will you plant?', [
        { label: 'Plant Sunwheat (1 seed)', action: () => { if (this.items.seed > 0) { this.items.seed--; plot.crop = 'sunwheat'; plot.plantedAt = Date.now(); plot.meshReady = false; this.toast('Sunwheat planted. Ripens in 40 seconds.', 'quest'); } else this.toast('You need seeds.', 'warn'); this.close(); } },
        { label: 'Plant Moonherb (1 seed)', action: () => { if (this.items.seed > 0) { this.items.seed--; plot.crop = 'moonherb'; plot.plantedAt = Date.now(); plot.meshReady = false; this.toast('Moonherb planted. Ripens in 55 seconds.', 'quest'); } else this.toast('You need seeds.', 'warn'); this.close(); } },
        { label: 'Leave', action: () => this.close() }
      ]);
    } else if (elapsed < grow) {
      this.dialog('Emberfall Farm Plot', `${plot.crop === 'moonherb' ? 'Moonherb' : 'Sunwheat'} is growing. ${Math.ceil(grow - elapsed)} seconds left.`, [{ label: 'Leave', action: () => this.close() }]);
    } else {
      const crop = plot.crop;
      const n = Math.floor(rand(2, 5)); this.addItem(crop, n); this.addItem('seed', Math.floor(rand(1, 3)));
      this.crops += n; this.questProgress('harvest', crop, n);
      plot.crop = null; plot.meshReady = false; if (plot.readyMarker) plot.readyMarker.visible = false;
      this.toast(`Harvested ${n} ${crop}.`, 'loot'); this.audio.coin(); this.close();
    }
  }

  startFishing(spot) {
    if (this.fishing) return;
    this.fishing = { phase: 'wait', t: 0, bite: rand(2.2, 4.6), marker: 0, dir: 1, zone: rand(0.28, 0.58), spot };
    $('fishing-overlay').hidden = false;
    $('fishing-text').textContent = 'Wait for the bite…';
    $('fishing-marker').style.left = '0%';
    $('fishing-target').style.left = `${this.fishing.zone * 100}%`;
    $('btn-reel').textContent = 'Wait…';
  }

  updateFishing(dt) {
    if (!this.fishing) return;
    const f = this.fishing; f.t += dt;
    if (f.phase === 'wait' && f.t >= f.bite) {
      f.phase = 'bite'; f.t = 0; $('fishing-text').textContent = 'A bite! Reel in while the marker is in the glow!'; $('btn-reel').textContent = 'Reel in!'; this.audio.quest();
    }
    if (f.phase === 'bite') {
      f.marker += f.dir * dt * 0.9; if (f.marker > 1) { f.marker = 1; f.dir = -1; } if (f.marker < 0) { f.marker = 0; f.dir = 1; }
      $('fishing-marker').style.left = `${f.marker * 100}%`;
      if (f.t > 2.4) this.finishFishing(false);
    }
  }

  reel() {
    if (!this.fishing || this.fishing.phase !== 'bite') return;
    const success = Math.abs(this.fishing.marker - this.fishing.zone) < 0.11;
    this.finishFishing(success);
  }

  finishFishing(success) {
    const f = this.fishing; if (!f) return;
    if (success) {
      const n = Math.floor(rand(1, 3)); this.addItem('fish', n); this.fishCaught += n; this.questProgress('fish', 'fish', n);
      $('fishing-text').textContent = `Caught ${n} Moonfin!`; this.audio.coin();
    } else { $('fishing-text').textContent = 'It slipped away…'; }
    $('btn-reel').textContent = 'Close';
    this.fishing = null;
    setTimeout(() => { $('fishing-overlay').hidden = true; }, 900);
  }

  questProgress(type, key, amount) {
    if (type === 'kill') {
      if ((key === 'wolf') && this.quests.wolves.state === 'active') this.bump('wolves', amount);
      if ((key === 'deer' || key === 'boar') && this.quests.hunting.state === 'active') this.bump('hunting', amount);
      if (key === 'boss' && this.quests.boss.state === 'active') this.bump('boss', 1);
    }
    if (type === 'fish') this.bump('fishing', amount);
    if (type === 'harvest') this.bump('farming', amount);
    if (type === 'feed') this.bump('bond', amount);
    if (type === 'craft') this.completeQuest('craft');
  }

  bump(id, n) {
    const q = this.quests[id]; if (!q || q.state !== 'active') return;
    q.progress += n;
    if (q.progress >= (q.goal || 1)) this.completeQuest(id);
    else this.toast(`${q.title}: ${q.progress}/${q.goal}`, 'info');
  }

  completeQuest(id) {
    const q = this.quests[id]; if (!q || q.state === 'done') return;
    q.state = 'done'; q.progress = q.goal || 1;
    const rewards = {
      welcome: { gold: 40, xp: 30, skills: 1 }, wolves: { gold: 80, xp: 120, pet: 'wolfpup' },
      threads: { gold: 60, xp: 50 }, craft: { gold: 45, xp: 40 }, boss: { gold: 300, xp: 300 },
      fishing: { gold: 35, xp: 40 }, farming: { gold: 35, xp: 40 }, hunting: { gold: 35, xp: 45 }, bond: { gold: 25, xp: 30 }
    }[id] || {};
    this.gold += rewards.gold || 0; this.xp += rewards.xp || 0; this.skillPoints += rewards.skills || 0;
    if (rewards.pet && !this.ownedPets.includes(rewards.pet)) { this.ownedPets.push(rewards.pet); this.pets[rewards.pet] = { level: 1, xp: 0, hp: PETS[rewards.pet].hp, trinket: null }; this.toast(`${PETS[rewards.pet].name} joined your party!`, 'quest'); }
    if (this.xp >= this.xpNext()) this.levelUp();
    this.audio.quest();
    this.toast(`Quest complete: ${q.title}`, 'quest');
    if (id === 'welcome') { for (const k of ['wolves', 'threads', 'craft', 'fishing', 'farming', 'hunting', 'bond']) if (this.quests[k].state === 'locked') this.quests[k].state = 'active'; }
    if (id === 'wolves') { if (this.quests.boss.state === 'locked') this.quests.boss.state = 'active'; }
  }

  updateQuestMarkers() {
    const target = this.trackedQuest();
    for (const npc of this.world.npcs) {
      const marker = npc.mesh?.userData?.marker;
      if (marker) {
        marker.visible = target && target.target === npc.id;
        marker.rotation.y += 0.02; marker.position.y = 3.05 + Math.sin(this.time * 2) * 0.08;
      }
    }
  }

  trackedQuest() {
    const order = ['welcome', 'wolves', 'threads', 'craft', 'boss', 'fishing', 'farming', 'hunting', 'bond'];
    for (const id of order) if (this.quests[id].state === 'active') return { ...this.quests[id], id };
    return null;
  }

  updateHud(force) {
    this.uiTimer += 0.016;
    if (this.uiTimer < 0.1 && !force) return;
    this.uiTimer = 0;
    const h = this.localHero;
    const party = $('party-panel');
    if (party) {
      party.innerHTML = HERO_KEYS.map((k) => {
        const hh = this.heroes[k]; const st = this.stats(k);
        const active = hh === h;
        const owner = hh.owner === 'ai' ? 'AI' : hh.owner === 'local' ? 'YOU' : 'PARTY';
        return `<div class="party-row ${active ? 'active' : ''} ${hh.dead ? 'down' : ''}">
          <span class="party-mark" style="--c:${HEROES[k].color}">${HEROES[k].first[0]}</span>
          <div class="party-info"><div><b>${HEROES[k].first}</b><small>Lv ${this.level} ${owner}</small></div>
          <div class="hp-track"><i style="width:${Math.max(0, hh.hp / hh.maxHp) * 100}%"></i></div></div>
        </div>`;
      }).join('');
    }
    $('gold-value').textContent = this.gold;
    $('potion-value').textContent = this.items.tonic || 0;
    $('level-label').textContent = `Lv ${this.level}`;
    $('xp-fill').style.width = `${clamp(this.xp / this.xpNext(), 0, 1) * 100}%`;
    $('stamina-fill').style.width = `${this.stamina}%`;
    const pet = this.pets[this.activePet]; const petDef = PETS[this.activePet];
    if (pet && petDef) {
      $('pet-mini-name').textContent = petDef.name;
      $('pet-mini-lv').textContent = `${petDef.species} · Lv ${pet.level}`;
      $('pet-mini-hp').style.width = `${clamp((pet.hp || 0) / (this.petMaxHp || 1), 0, 1) * 100}%`;
    }
    const q = this.trackedQuest();
    if (q) {
      $('quest-title').textContent = q.title;
      $('quest-objective').textContent = `${q.objective}${q.goal ? ` (${q.progress}/${q.goal})` : ''}`;
      const target = this.questTargetPos(q);
      const d = target ? Math.hypot(target.x - h.x, target.z - h.z) : 0;
      $('quest-distance').textContent = target ? `${Math.round(d)}m` : '—';
      $('quest-count').textContent = `${Object.values(this.quests).filter((x) => x.state === 'active').length} active`;
    } else {
      $('quest-title').textContent = 'Valley at peace';
      $('quest-objective').textContent = 'Explore, craft, fish, farm, and raise your pets.';
      $('quest-distance').textContent = '—'; $('quest-count').textContent = 'All done';
    }
    const clock = `${String(Math.floor(this.gameMinutes / 60) % 24).padStart(2, '0')}:${String(Math.floor(this.gameMinutes % 60)).padStart(2, '0')}`;
    $('world-clock').textContent = clock;
    const zone = this.world.landmarks.reduce((b, l) => {
      const d = Math.hypot(l.x - h.x, l.z - h.z); return d < b.d ? { d, l } : b;
    }, { d: 1e9, l: { name: 'Emberfall Valley' } }).l.name;
    $('zone-name').textContent = zone;
    const st = this.stats();
    const skills = h.def.skills;
    for (let i = 0; i < 3; i++) {
      $(`skill${i + 1}-glyph`).textContent = h.def.skillGlyphs[i];
      $(`skill${i + 1}-name`).textContent = `${skills[i].name}${(this.skillRanks[h.key]?.[skills[i].id] || 1) > 1 ? ' ' + this.skillRanks[h.key][skills[i].id] : ''}`;
      const cd = h.cooldowns[skills[i].id] || 0;
      const el = $(`cd-skill${i + 1}`); if (el) el.style.height = `${clamp(cd / skills[i].cd, 0, 1) * 100}%`;
    }
    $('petskill-name').textContent = petDef?.skill.name || 'Pet skill';
    $('mount-name').textContent = MOUNTS[this.mount].name;
    $('cd-pet').style.height = `${clamp(this.petCd / (PET_DEF_CD[this.activePet] || 12), 0, 1) * 100}%`;
    $('cd-attack').style.height = `${clamp((h.cooldowns.basic || 0) / h.def.basicCd, 0, 1) * 100}%`;
    if (!this.victory) $('boss-bar').hidden = true;
  }

  questTargetPos(q) {
    const map = { mayor: 'mayor', zippy: 'zippy' };
    if (q.target === 'boss') return { x: this.world.boss.x, z: this.world.boss.z };
    if (q.target === 'wolfwood') return { x: -90, z: 92 };
    if (q.target === 'farm') return { x: -30, z: 38 };
    if (q.target === 'fish') return this.world.fishingSpots[0];
    if (q.target === 'hunt') return { x: 30, z: 68 };
    if (q.target === 'self') return { x: this.localHero.x, z: this.localHero.z };
    const npc = this.world.npcs.find((n) => n.id === map[q.target]);
    return npc ? { x: npc.x, z: npc.z } : null;
  }

  drawMinimap() {
    const cv = $('minimap-canvas'); if (!cv || !this.world.minimap) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(this.world.minimap, 0, 0, cv.width, cv.height);
    const px = (x) => ((x + 150) / 300) * cv.width;
    const pz = (z) => ((z + 150) / 300) * cv.height;
    ctx.fillStyle = '#ffd36c';
    for (const l of this.world.landmarks) {
      if (l.kind === 'zone') { ctx.globalAlpha = 0.6; ctx.fillRect(px(l.x) - 2, pz(l.z) - 2, 4, 4); ctx.globalAlpha = 1; }
    }
    const q = this.trackedQuest(); const tp = q ? this.questTargetPos(q) : null;
    if (tp) { ctx.fillStyle = '#ffe072'; ctx.beginPath(); ctx.arc(px(tp.x), pz(tp.z), 4, 0, 6.28); ctx.fill(); }
    const h = this.localHero;
    ctx.fillStyle = '#8ff7e6'; ctx.strokeStyle = '#071418'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px(h.x), pz(h.z), 5, 0, 6.28); ctx.fill(); ctx.stroke();
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.boss) { ctx.fillStyle = '#ff8466'; ctx.beginPath(); ctx.arc(px(e.x), pz(e.z), 4, 0, 6.28); ctx.fill(); }
    }
  }

  open(name) {
    this.close();
    const map = { inventory: 'inventory-overlay', skills: 'skills-overlay', craft: 'craft-overlay', pets: 'pets-overlay', map: 'map-overlay', help: 'help-overlay', pause: 'pause-overlay', shop: 'shop-overlay', victory: 'victory-overlay', dialog: 'dialog-overlay' };
    const el = $(map[name]); if (!el) return;
    this.uiOpen = name; el.hidden = false;
    if (name === 'inventory') this.renderInventory();
    if (name === 'skills') this.renderSkills();
    if (name === 'craft') this.renderCraft();
    if (name === 'pets') this.renderPets();
    if (name === 'map') this.renderMap();
    if (name === 'pause') $('pause-room').textContent = this.net ? `Room code: ${this.room}` : 'Solo journey';
  }

  close() {
    for (const id of ['inventory-overlay', 'skills-overlay', 'craft-overlay', 'pets-overlay', 'map-overlay', 'help-overlay', 'pause-overlay', 'shop-overlay', 'dialog-overlay', 'fishing-overlay']) {
      const el = $(id); if (el) el.hidden = true;
    }
    this.uiOpen = null;
  }

  escape() {
    if (this.fishing) { this.fishing = null; $('fishing-overlay').hidden = true; return; }
    if (this.uiOpen) this.close(); else this.open('pause');
  }

  toggle(name) { if (this.uiOpen === name) this.close(); else this.open(name); }

  openChat() { this.chatForm = true; $('chat-form').hidden = false; $('chat-input').focus(); }
  closeChat() { $('chat-form').hidden = true; $('chat-input').blur(); }
  chat(text, system = false) {
    const log = $('chat-log'); const d = document.createElement('div'); d.textContent = text;
    if (system) d.className = 'system'; log.appendChild(d);
    while (log.children.length > 6) log.firstChild.remove();
    setTimeout(() => d.classList.add('fade'), 6000);
  }

  toast(text, kind = 'info') {
    const stack = $('toast-stack'); if (!stack) return;
    const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text;
    stack.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3800);
  }

  dialog(title, text, options = [{ label: 'Close', action: () => this.close() }]) {
    this.open('dialog');
    $('dialog-title').textContent = title;
    $('dialog-role').textContent = 'Emberfall';
    $('dialog-text').textContent = text;
    $('dialog-portrait').textContent = title[0];
    this.dialogOpts = options.map((o) => o.action);
    $('dialog-options').innerHTML = options.map((o, i) => `<button class="btn ${i === 0 ? 'btn-primary' : ''}" data-opt="${i}">${o.label}</button>`).join('');
  }

  openShop() {
    this.open('shop');
    const goods = ['hoodie', 'bomber', 'shades', 'sneakers', 'scooter', 'hoverboard', 'tonic'];
    $('shop-list').innerHTML = goods.map((id) => {
      const it = ITEMS[id];
      const owned = ['hoodie', 'bomber', 'shades', 'sneakers', 'scooter', 'hoverboard'].includes(id) && (this.items[id] || this.ownedMounts.includes(it.mount));
      return `<div class="shop-item ${it.modern ? 'modern' : ''}"><span class="item-icon">${it.icon}</span><div><b>${it.name}</b><small>${it.desc}</small></div><span class="price">${owned ? 'Owned' : it.price + 'g'}</span><button class="btn btn-small" data-buy="${id}" ${owned || !it.price ? 'disabled' : ''}>${owned ? 'Owned' : 'Buy'}</button></div>`;
    }).join('');
  }

  buy(id) {
    const it = ITEMS[id]; if (!it || !it.price) return;
    if (this.gold < it.price) return this.toast('Not enough gold.', 'warn');
    if (it.type === 'mount') { if (this.ownedMounts.includes(it.mount)) return; this.ownedMounts.push(it.mount); this.mount = it.mount; this.toast(`${it.name} unlocked and equipped.`, 'loot'); }
    else { this.addItem(id, 1); if (it.type === 'outfit' || it.type === 'shoes' || it.type === 'trinket') this.equip(id); this.toast(`${it.name} purchased.`, 'loot'); }
    this.gold -= it.price;
    if (it.modern && this.quests.threads.state === 'active') this.completeQuest('threads');
    this.audio.coin(); this.openShop(); this.updateHud(true);
  }

  addItem(id, n = 1) { this.items[id] = (this.items[id] || 0) + n; }
  hasItem(id, n = 1) { return (this.items[id] || 0) >= n; }
  removeItem(id, n = 1) { this.items[id] = Math.max(0, (this.items[id] || 0) - n); if (!this.items[id]) delete this.items[id]; }

  useItem(id) {
    const it = ITEMS[id]; if (!it) return;
    if (it.type === 'consumable') {
      if (id === 'petfeast') { this.useOnPet(); return; }
      if (!this.hasItem(id)) return;
      this.removeItem(id); this.localHero.hp = Math.min(this.localHero.maxHp, this.localHero.hp + (it.heal || 0));
      if (it.buff) { this.buff = 30; }
      this.toast(`Used ${it.name}.`, 'loot'); this.audio.coin(); this.renderInventory();
    } else if (['weapon', 'armor', 'outfit', 'shoes', 'trinket'].includes(it.type)) this.equip(id);
    else if (it.type === 'mount') { if (this.ownedMounts.includes(it.mount)) { this.mount = it.mount; this.toast(`${it.name} equipped.`, 'loot'); } }
  }

  equip(id) {
    const it = ITEMS[id]; if (!it) return;
    const slot = it.type;
    this.equipment[slot] = id;
    this.localHero.petType = this.activePet;
    this.recalcHeroes();
    this.toast(`${it.name} equipped.`, 'loot');
    this.renderInventory(); this.updateHud(true);
  }

  unequip(slot) {
    if (!this.equipment[slot]) return;
    this.equipment[slot] = null; this.recalcHeroes(); this.renderInventory(); this.updateHud(true);
  }

  recalcHeroes() {
    for (const h of Object.values(this.heroes)) {
      const st = this.stats(h.key); h.maxHp = st.maxHp; h.hp = Math.min(h.hp, h.maxHp); h.power = st.power;
    }
  }

  renderInventory() {
    const eq = this.equipment;
    const slotNames = { weapon: 'Weapon', armor: 'Armor', outfit: 'Outfit', shoes: 'Shoes', trinket: 'Trinket' };
    $('equipped-list').innerHTML = Object.entries(slotNames).map(([slot, label]) => {
      const it = ITEMS[eq[slot]];
      return `<div class="equip-row"><span class="slot-label">${label}</span><span class="item-icon ${it ? '' : 'empty'}">${it ? it.icon : '—'}</span><div><b>${it ? it.name : 'Empty'}</b><small>${it ? it.desc : 'Nothing equipped'}</small></div>${it ? `<button class="mini-btn" data-unequip="${slot}">Remove</button>` : ''}</div>`;
    }).join('');
    const entries = Object.entries(this.items).filter(([id]) => ITEMS[id]);
    $('owned-list').innerHTML = entries.length ? entries.map(([id, n]) => {
      const it = ITEMS[id];
      const equipped = Object.values(eq).includes(id);
      return `<button class="bag-item ${equipped ? 'equipped' : ''}" data-item="${id}"><span class="item-icon">${it.icon}</span><b>${it.name}</b><small>${it.type}${n > 1 ? ` ×${n}` : ''}</small></button>`;
    }).join('') : '<p class="muted">Your pack is empty. Loot, craft, or shop.</p>';
    const s = this.stats();
    $('journey-stats').innerHTML = `<div><span>Level</span><b>${this.level}</b></div><div><span>Health</span><b>${Math.round(this.localHero.hp)} / ${this.localHero.maxHp}</b></div><div><span>Attack</span><b>${s.power}</b></div><div><span>Speed</span><b>${s.speed.toFixed(1)}</b></div><div><span>Gold</span><b>${this.gold}</b></div><div><span>Kills</span><b>${this.kills}</b></div><div><span>Fish</span><b>${this.fishCaught}</b></div><div><span>Crops</span><b>${this.crops}</b></div><div><span>Pets</span><b>${this.ownedPets.length}</b></div>`;
  }

  renderSkills() {
    const h = this.localHero, def = h.def;
    $('skill-points').textContent = this.skillPoints;
    $('skills-hero').textContent = `${def.name} · ${def.role}`;
    const skills = def.skills.map((s, i) => {
      const rank = this.skillRanks[h.key]?.[s.id] || 1;
      return `<div class="skill-card"><span class="skill-key">${['Q', 'R', 'F'][i]}</span><span class="skill-glyph">${def.skillGlyphs[i]}</span><div><b>${s.name} <small>Rank ${rank}</small></b><p>${s.type === 'aoe' ? 'Area damage' : s.type === 'volley' ? 'Fan of projectiles' : s.type === 'shield' ? 'Shield and heal' : s.type === 'blink' ? 'Blink and burst' : s.type === 'dash' ? 'Dash and cut' : 'Cone damage'} · ${s.power} power</p></div><button class="btn btn-small" data-skill="${s.id}" ${this.skillPoints <= 0 || rank >= 5 ? 'disabled' : ''}>${rank >= 5 ? 'Max' : 'Rank +1'}</button></div>`;
    }).join('');
    const passives = PASSIVES.map((p) => {
      const rank = this.passiveRanks[p.id] || 0;
      return `<div class="skill-card passive"><span class="skill-glyph">${p.icon}</span><div><b>${p.name} <small>Rank ${rank}/5</small></b><p>${p.desc}</p></div><button class="btn btn-small" data-passive="${p.id}" ${this.skillPoints <= 0 || rank >= 5 ? 'disabled' : ''}>${rank >= 5 ? 'Max' : 'Rank +1'}</button></div>`;
    }).join('');
    $('skills-grid').innerHTML = `<h3>Active skills</h3>${skills}<h3>Passives</h3>${passives}`;
  }

  upgradeSkill(id) {
    if (this.skillPoints <= 0) return;
    const key = this.localHero.key;
    this.skillRanks[key] = this.skillRanks[key] || {};
    const cur = this.skillRanks[key][id] || 1;
    if (cur >= 5) return;
    this.skillRanks[key][id] = cur + 1; this.skillPoints--; this.renderSkills(); this.toast('Skill ranked up.', 'quest'); this.save();
  }

  upgradePassive(id) {
    if (this.skillPoints <= 0) return;
    const cur = this.passiveRanks[id] || 0; if (cur >= 5) return;
    this.passiveRanks[id] = cur + 1; this.skillPoints--; this.recalcHeroes(); this.renderSkills(); this.toast('Passive ranked up.', 'quest'); this.save();
  }

  renderCraft() {
    const mats = Object.entries(this.items).filter(([id]) => ITEMS[id]?.type === 'material');
    $('craft-materials').innerHTML = mats.length ? mats.map(([id, n]) => `<span class="mat" title="${ITEMS[id].name}"><i>${ITEMS[id].icon}</i>${n}</span>`).join('') : '<span class="muted">No materials yet.</span>';
    $('craft-list').innerHTML = RECIPES.map((r) => {
      const can = Object.entries(r.cost).every(([id, n]) => this.hasItem(id, n));
      const cost = Object.entries(r.cost).map(([id, n]) => `${ITEMS[id].icon} ${n}`).join(' · ');
      return `<div class="recipe ${can ? 'can' : ''}"><span class="item-icon">${r.icon}</span><div><b>${r.name}</b><small>${r.desc}</small><em>${cost}</em></div><button class="btn btn-small" data-craft="${r.id}" ${can ? '' : 'disabled'}>Craft</button></div>`;
    }).join('');
  }

  craft(id) {
    const r = RECIPES.find((x) => x.id === id); if (!r) return;
    if (!Object.entries(r.cost).every(([k, n]) => this.hasItem(k, n))) return this.toast('Missing materials.', 'warn');
    for (const [k, n] of Object.entries(r.cost)) this.removeItem(k, n);
    if (r.pet) {
      if (!this.ownedPets.includes(r.pet)) { this.ownedPets.push(r.pet); this.pets[r.pet] = { level: 1, xp: 0, hp: PETS[r.pet].hp, trinket: null }; this.toast(`${PETS[r.pet].name} awakened!`, 'quest'); }
    } else { this.addItem(r.id, 1); }
    this.questProgress('craft', id, 1); this.audio.quest(); this.toast(`Crafted ${r.name}.`, 'loot');
    this.renderCraft(); this.updateHud(true); this.save();
  }

  renderPets() {
    $('pet-list').innerHTML = this.ownedPets.map((id) => {
      const def = PETS[id], p = this.pets[id];
      return `<button class="pet-card ${id === this.activePet ? 'active' : ''} ${id === this.selectedPet ? 'selected' : ''}" data-pet="${id}"><span class="pet-icon" style="--c:${def.color}">${def.name[0]}</span><div><b>${def.name}</b><small>${def.species} · Lv ${p.level}</small></div>${id === this.activePet ? '<em>ACTIVE</em>' : ''}</button>`;
    }).join('');
    const id = this.ownedPets.includes(this.selectedPet) ? this.selectedPet : this.activePet;
    const def = PETS[id], p = this.pets[id];
    const trinket = p.trinket ? ITEMS[p.trinket] : null;
    const hp = Math.round(p.hp);
    $('pet-detail').innerHTML = `<div class="pet-hero"><span class="pet-big" style="--c:${def.color}">${def.name[0]}</span><div><small>${def.species}</small><h3>${def.name}</h3><p>${def.desc}</p></div></div>
      <div class="pet-stats"><div class="pet-stat"><span>Level</span><b>${p.level}</b></div>
      <div class="pet-stat"><span>Bond XP</span><b>${p.xp} / ${60 + p.level * 30}</b></div>
      <div class="pet-stat"><span>Health</span><b>${hp} / ${this.petMaxHp}</b></div>
      <div class="pet-stat"><span>Attack</span><b>${def.power + (p.level - 1) * 3}</b></div></div>
      <div class="pet-skill"><small>PET SKILL · G</small><b>${def.skill.name}</b><p>${def.skill.power} area power · ${def.skill.cd}s cooldown</p></div>
      <div class="pet-skill"><small>TRINKET</small><b>${trinket ? trinket.name : 'No trinket'}</b><p>${trinket ? trinket.desc : 'Craft a Copper Collar or Clockwork Charm.'}</p></div>
      <div class="pet-actions"><button class="btn ${id === this.activePet ? '' : 'btn-primary'}" data-pet-action="activate" data-pet="${id}" ${id === this.activePet ? 'disabled' : ''}>${id === this.activePet ? 'Active pet' : 'Set active'}</button>
      <button class="btn" data-pet-action="feed" data-pet="${id}">Feed (${this.items.petfeast || 0})</button>
      <button class="btn" data-pet-action="trinket" data-pet="${id}">${trinket ? 'Unequip trinket' : 'Equip pet trinket'}</button></div>`;
  }

  activatePet(id) { if (!this.ownedPets.includes(id)) return; this.activePet = id; this.selectedPet = id; this.createPet(); this.renderPets(); this.toast(`${PETS[id].name} is now your active pet.`, 'quest'); this.save(); }
  feedPet() {
    if (!this.hasItem('petfeast')) return this.toast('Craft a Pet Feast first.', 'warn');
    this.removeItem('petfeast'); this.addPetXp(35); this.questProgress('feed', 'pet', 1); this.renderPets(); this.toast('Your pet enjoyed the feast.', 'loot');
  }
  petTrinket() {
    const p = this.pets[this.selectedPet]; if (!p) return;
    if (p.trinket) { this.addItem(p.trinket); p.trinket = null; }
    else if (this.hasItem('collar')) { this.removeItem('collar'); p.trinket = 'collar'; }
    else if (this.hasItem('gearcharm')) { this.removeItem('gearcharm'); p.trinket = 'gearcharm'; }
    else return this.toast('Craft a Copper Collar or keep a Clockwork Charm.', 'warn');
    this.createPet(); this.renderPets(); this.updateHud(true);
  }

  renderMap() {
    const cv = $('map-canvas'); if (!cv || !this.world.minimap) return;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.world.minimap, 0, 0, cv.width, cv.height);
    const px = (x) => ((x + 150) / 300) * cv.width, pz = (z) => ((z + 150) / 300) * cv.height;
    ctx.font = 'bold 16px Georgia, serif'; ctx.textAlign = 'center';
    for (const l of this.world.landmarks) {
      if (l.kind === 'zone') { ctx.fillStyle = 'rgba(10,20,20,0.5)'; ctx.fillRect(px(l.x) - 3, pz(l.z) - 3, 6, 6); }
      ctx.fillStyle = l.kind === 'boss' ? '#ff8d6b' : l.kind === 'town' ? '#ffe6a1' : '#d9efe9';
      ctx.fillText(l.name, px(l.x), pz(l.z) - 8);
    }
    const q = this.trackedQuest(); const tp = q ? this.questTargetPos(q) : null;
    if (tp) { ctx.strokeStyle = '#ffe072'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(px(tp.x), pz(tp.z), 9, 0, 6.28); ctx.stroke(); }
    ctx.fillStyle = '#8ff7e6'; ctx.strokeStyle = '#071418'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px(this.localHero.x), pz(this.localHero.z), 8, 0, 6.28); ctx.fill(); ctx.stroke();
  }

  jump() {
    // Grounded jump is visual-only; keep movement responsive.
    this.localHero.root.position.y += 0.01;
  }

  toggleMount() {
    if (!this.ownedMounts.length) return;
    this.mounted = !this.mounted;
    if (this.mounted) this.audio.mount();
    this.toast(this.mounted ? `${MOUNTS[this.mount].name} deployed.` : 'Dismounted.', 'info');
  }

  useTonic() {
    if (!this.hasItem('tonic')) return this.toast('No tonics left. Craft or buy more.', 'warn');
    if (this.localHero.hp >= this.localHero.maxHp) return this.toast('Already at full health.', 'info');
    this.removeItem('tonic'); this.localHero.hp = Math.min(this.localHero.maxHp, this.localHero.hp + 60);
    this.audio.coin(); this.toast('Tonic used. +60 health.', 'loot'); this.updateHud(true);
  }

  respawnLocal() {
    const h = this.localHero; h.dead = false; h.hp = h.maxHp * 0.5; h.root.visible = true;
    h.x = this.respawn.x; h.z = this.respawn.z; h.y = this.world.heightAt(h.x, h.z);
    h.root.position.set(h.x, h.y, h.z); $('death-overlay').hidden = true; this.toast('Returned to the shrine.', 'quest');
  }

  showVictory() {
    this.victory = true; this.open('victory');
    $('victory-stats').innerHTML = `<div><b>${this.level}</b><span>Level</span></div><div><b>${this.kills}</b><span>Foes</span></div><div><b>${this.ownedPets.length}</b><span>Pets</span></div><div><b>${this.gold}</b><span>Gold</span></div>`;
    this.audio.quest(); this.save();
  }

  save() {
    if (this.mode !== 'solo') return;
    const data = {
      heroKey: this.heroKey, level: this.level, xp: this.xp, gold: this.gold, skillPoints: this.skillPoints,
      items: this.items, equipment: this.equipment, ownedMounts: this.ownedMounts, mount: this.mount,
      respawn: this.respawn, skillRanks: this.skillRanks, passiveRanks: this.passiveRanks,
      ownedPets: this.ownedPets, pets: this.pets, activePet: this.activePet, quests: this.quests,
      kills: this.kills, fishCaught: this.fishCaught, crops: this.crops, played: this.played,
      victory: this.victory, pos: { x: this.localHero.x, z: this.localHero.z },
      gameMinutes: this.gameMinutes, farm: this.world.farmPlots.filter((p) => p.crop).map((p) => ({ id: p.id, crop: p.crop, plantedAt: p.plantedAt }))
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { console.warn(e); }
  }
}
const PET_DEF_CD = { fox: 12, wolfpup: 15, owl: 14, whelp: 18 };
