import * as THREE from 'three';
import { loadAssets, makeSoldier, playState, updateMixers } from './assets.js';
import { Game } from './game.js';
import { HEROES, HERO_KEYS, SAVE_KEY } from './data.js';

const $ = (id) => document.getElementById(id);
const HERO_TINT = {
  aurora: { body: '#b9c8e6', accent: '#8ef2e7', glow: 2.2 },
  boris: { body: '#756d61', accent: '#f0b55e', glow: 1.4 },
  alice: { body: '#4c5965', accent: '#f08fb5', glow: 2.4 }
};
const HERO_CAMERA = {
  aurora: { x: 2.0, y: 1.35, z: 0 },
  boris: { x: 4.2, y: 1.35, z: 0 },
  alice: { x: 6.4, y: 1.35, z: 0 }
};

let selected = 'aurora';
let game = null;
let starting = false;
let menuRenderer = null;
let menuScene = null;
let menuCamera = null;
let menuHeroes = {};
let menuClock = null;
let menuFrame = 0;
let menuAlive = true;

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function setHero(key) {
  if (!HEROES[key]) return;
  selected = key;
  document.querySelectorAll('.hero-card').forEach((card) => {
    const active = card.dataset.hero === key;
    card.classList.toggle('selected', active);
    card.setAttribute('aria-checked', active ? 'true' : 'false');
  });
  for (const k of HERO_KEYS) {
    const h = menuHeroes[k];
    if (!h) continue;
    const active = k === key;
    h.userData.target = active ? 1 : 0;
  }
  if (menuCamera) {
    const target = HERO_CAMERA[key];
    menuCamera.userData.target.set(target.x, target.y, target.z);
  }

}

function drawPortrait(canvas, key) {
  const def = HEROES[key];
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, def.color);
  grad.addColorStop(0.55, '#141f2a');
  grad.addColorStop(1, '#071017');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * 0.7, h * 0.24, 4, w * 0.7, h * 0.24, w * 0.75);
  glow.addColorStop(0, `${def.accent}cc`);
  glow.addColorStop(0.4, `${def.accent}33`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = i % 2 ? def.accent : '#dbe9f4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.2 + i * 16);
    ctx.lineTo(w, h * 0.05 + i * 19);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(4, 11, 16, 0.42)';
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.fillStyle = '#f2f8fb';
  ctx.font = '600 15px "Trebuchet MS", sans-serif';
  ctx.fillText(def.first.toUpperCase(), 12, h - 32);
  ctx.fillStyle = def.accent;
  ctx.font = '500 9px "Trebuchet MS", sans-serif';
  ctx.fillText(def.role.toUpperCase(), 12, h - 16);
  const ring = ctx.createLinearGradient(0, 0, w, 0);
  ring.addColorStop(0, def.accent);
  ring.addColorStop(1, 'transparent');
  ctx.strokeStyle = ring;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}

function setupMenu() {
  const canvas = $('menu-canvas');
  menuRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  menuRenderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  menuRenderer.outputColorSpace = THREE.SRGBColorSpace;
  menuRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  menuRenderer.toneMappingExposure = 1.2;
  menuRenderer.shadowMap.enabled = true;
  menuRenderer.shadowMap.type = THREE.PCFShadowMap;

  menuScene = new THREE.Scene();
  menuScene.background = new THREE.Color('#07131c');
  menuScene.fog = new THREE.FogExp2('#08141d', 0.035);
  menuCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
  menuCamera.position.set(1, 2.15, 14.5);
  menuCamera.userData.target = new THREE.Vector3(2, 1.3, 0);
  menuCamera.lookAt(menuCamera.userData.target);

  menuScene.add(new THREE.HemisphereLight('#bfe8ef', '#17130f', 1.5));
  const key = new THREE.DirectionalLight('#ffe5c0', 4);
  key.position.set(-3, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  menuScene.add(key);
  const rim = new THREE.PointLight('#63e7df', 18, 14);
  rim.position.set(4, 3, 1);
  menuScene.add(rim);
  const pink = new THREE.PointLight('#f08fb5', 12, 12);
  pink.position.set(-4, 2, 2);
  menuScene.add(pink);

  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 5.8, 0.25, 64),
    new THREE.MeshStandardMaterial({ color: '#0c1b22', metalness: 0.7, roughness: 0.36 })
  );
  floor.position.y = -0.15;
  floor.receiveShadow = true;
  menuScene.add(floor);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.8, 0.018, 8, 120),
    new THREE.MeshBasicMaterial({ color: '#67efe1', transparent: true, opacity: 0.65 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.01;
  menuScene.add(ring);
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.01, 8, 100),
    new THREE.MeshBasicMaterial({ color: '#e9bd70', transparent: true, opacity: 0.4 })
  );
  inner.rotation.x = Math.PI / 2;
  inner.position.y = 0.015;
  menuScene.add(inner);

  const motes = [];
  for (let i = 0; i < 260; i++) {
    const r = 1.8 + Math.random() * 7;
    const a = Math.random() * Math.PI * 2;
    motes.push(Math.cos(a) * r, Math.random() * 7, Math.sin(a) * r - 2);
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.Float32BufferAttribute(motes, 3));
  const points = new THREE.Points(mg, new THREE.PointsMaterial({ color: '#9ae9de', size: 0.035, transparent: true, opacity: 0.55, depthWrite: false }));
  menuScene.add(points);

  const platformMat = new THREE.MeshStandardMaterial({ color: '#101f27', metalness: 0.8, roughness: 0.3 });
  const accentMat = new THREE.MeshStandardMaterial({ color: '#d8b26a', metalness: 0.9, roughness: 0.25, emissive: '#8f6326', emissiveIntensity: 0.4 });
  HERO_KEYS.forEach((k, i) => {
    const root = new THREE.Group();
    const model = makeSoldier(HERO_TINT[k]);
    model.scale.setScalar(1.15);
    root.add(model);
    root.position.set(2.0 + i * 2.2, 0, 0);
    root.rotation.y = (i - 1) * -0.2;
    root.userData = { target: k === selected ? 1 : 0, model, phase: i * 2.1 };
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.28, 32), platformMat);
    pedestal.position.y = 0.14;
    pedestal.receiveShadow = true;
    pedestal.castShadow = true;
    root.add(pedestal);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.77, 0.035, 8, 40), accentMat);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.29;
    root.add(trim);
    menuHeroes[k] = root;
    menuScene.add(root);
  });

  const stone = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 3.6, 5),
    new THREE.MeshStandardMaterial({ color: '#182b32', metalness: 0.35, roughness: 0.75 })
  );
  stone.position.set(3.5, 1.1, -7);
  stone.scale.set(0.55, 0.55, 0.55);
  menuScene.add(stone);
  const stone2 = stone.clone();
  stone2.position.set(9.5, 0.8, -8.5);
  stone2.scale.set(0.38, 0.38, 0.38);
  menuScene.add(stone2);

  menuClock = new THREE.Clock();
  resizeMenu();
  addEventListener('resize', resizeMenu);
  menuLoop();
}

function resizeMenu() {
  if (!menuRenderer || !menuCamera) return;
  const w = innerWidth, h = innerHeight;
  menuRenderer.setSize(w, h, false);
  menuCamera.aspect = w / h;
  menuCamera.updateProjectionMatrix();
}

function menuLoop() {
  if (!menuAlive) return;
  menuFrame = requestAnimationFrame(menuLoop);
  const dt = Math.min(0.05, menuClock.getDelta());
  const t = menuClock.elapsedTime;
  if (menuCamera) {
    const target = menuCamera.userData.target;
    const shift = (selected === 'aurora' ? -1 : selected === 'alice' ? 1 : 0) * 0.18;
    menuCamera.position.x += (1 + shift - menuCamera.position.x) * 0.04;
    menuCamera.position.y = 2.15 + Math.sin(t * 0.35) * 0.04;
    menuCamera.lookAt(target.x * 0.3, target.y, target.z);
  }
  for (const k of HERO_KEYS) {
    const h = menuHeroes[k];
    if (!h) continue;
    h.rotation.y = (k === 'aurora' ? 0.28 : k === 'alice' ? -0.28 : 0) + Math.sin(t * 0.22 + h.userData.phase) * 0.06;
    h.position.y = Math.sin(t * 0.7 + h.userData.phase) * 0.018;
    updateMixers(h.userData.model, dt);
    playState(h.userData.model, 'Idle', 0.75 + h.userData.target * 0.25);
  }
  menuRenderer.render(menuScene, menuCamera);
}

function disposeMenu() {
  menuAlive = false;
  cancelAnimationFrame(menuFrame);
  removeEventListener('resize', resizeMenu);
  menuRenderer?.dispose();
  menuRenderer = null;
}

function showOverlay(id) {
  const el = $(id);
  if (el) el.hidden = false;
}

function hideOverlay(id) {
  const el = $(id);
  if (el) el.hidden = true;
}

function startGame(opts) {
  if (starting || game) return;
  starting = true;
  const loading = $('menu-loading');
  if (loading) loading.hidden = false;
  const menu = $('menu');
  try {
    disposeMenu();
    if (menu) menu.hidden = true;
    hideOverlay('coop-overlay');
    hideOverlay('help-overlay');
    game = new Game(opts);
    window.__abaGame = game;
  } catch (err) {
    console.error(err);
    starting = false;
    if (menu) menu.hidden = false;
    if (loading) loading.hidden = true;
    const note = $('menu-error');
    if (note) {
      note.hidden = false;
      note.textContent = `The valley failed to load: ${err.message}`;
    }
  }
}

function wireMenu() {
  document.querySelectorAll('.hero-card').forEach((card) => {
    card.addEventListener('click', () => setHero(card.dataset.hero));
    card.addEventListener('mouseenter', () => setHero(card.dataset.hero));
  });

  $('btn-solo')?.addEventListener('click', () => startGame({ mode: 'solo', heroKey: selected, loadSave: false }));
  $('btn-continue')?.addEventListener('click', () => startGame({ mode: 'solo', heroKey: selected, loadSave: true }));
  $('btn-coop')?.addEventListener('click', () => {
    const code = roomCode();
    $('host-room-code').textContent = code;
    showOverlay('coop-overlay');
  });
  $('btn-help')?.addEventListener('click', () => showOverlay('help-overlay'));
  $('btn-copy-link')?.addEventListener('click', async () => {
    const code = $('host-room-code')?.textContent || '';
    const url = new URL(location.href);
    url.searchParams.set('room', code);
    try {
      await navigator.clipboard.writeText(url.toString());
      $('btn-copy-link').textContent = 'Copied';
    } catch {
      $('btn-copy-link').textContent = code;
    }
  });
  $('btn-host-start')?.addEventListener('click', () => {
    const name = $('host-name')?.value.trim() || HEROES[selected].first;
    startGame({ mode: 'host', room: $('host-room-code').textContent, heroKey: selected, name });
  });
  $('btn-join-start')?.addEventListener('click', () => {
    const room = $('join-room')?.value.trim().toUpperCase();
    const heroKey = $('join-hero')?.value || selected;
    const name = $('join-name')?.value.trim() || HEROES[heroKey].first;
    if (room.length !== 4) {
      $('join-room').focus();
      $('join-room').classList.add('invalid');
      setTimeout(() => $('join-room')?.classList.remove('invalid'), 900);
      return;
    }
    startGame({ mode: 'guest', room, heroKey, name });
  });
  document.querySelectorAll('.coop-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.coop-tab').forEach((t) => t.classList.toggle('active', t === tab));
      $('coop-host').hidden = tab.dataset.tab !== 'host';
      $('coop-join').hidden = tab.dataset.tab !== 'join';
    });
  });
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => hideOverlay(`${btn.dataset.close}-overlay`));
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || game) return;
    hideOverlay('help-overlay');
    hideOverlay('coop-overlay');
  });
}

function restoreSaveState() {
  let save = null;
  try { save = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { save = null; }
  const continueBtn = $('btn-continue');
  if (!save || !continueBtn) return;
  continueBtn.hidden = false;
  const hero = HEROES[save.heroKey] || HEROES.aurora;
  const detail = $('continue-detail');
  if (detail) detail.textContent = `${hero.first} · Lv ${save.level || 1} · ${save.gold ?? 0}g`;
  setHero(save.heroKey || 'aurora');
}

async function boot() {
  const loading = $('menu-loading');
  const bar = $('menu-load-bar');
  const status = $('menu-load-status');
  try {
    await loadAssets((p, key) => {
      if (bar) bar.style.width = `${Math.round(p * 100)}%`;
      if (status) status.textContent = `Summoning ${key}…`;
    });
    if (status) status.textContent = 'Lighting the lanterns…';
    setupMenu();
    HERO_KEYS.forEach((k) => {
      const canvas = document.querySelector(`.hero-card[data-hero="${k}"] .portrait`);
      if (canvas) drawPortrait(canvas, k);
    });
    wireMenu();
    restoreSaveState();
    if (loading) loading.hidden = true;
    const actions = document.querySelector('.menu-actions');
    if (actions) actions.classList.add('ready');
  } catch (err) {
    console.error(err);
    if (status) status.textContent = `Could not load models: ${err.message}`;
    if (loading) loading.classList.add('failed');
  }
}

boot();
