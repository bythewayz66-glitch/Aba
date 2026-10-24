import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
export const assets = {};

function fitModel(root, targetHeight) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scale = targetHeight / Math.max(0.0001, size.y);
  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) {
        o.material = o.material.clone();
        if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
        o.material.roughness = Math.min(1, (o.material.roughness ?? 0.7) + 0.08);
        o.material.envMapIntensity = 0.9;
      }
    }
  });
  return root;
}

export async function loadAssets(onProgress = () => {}) {
  const names = [
    ['soldier', '/models/Soldier.glb', 1.9],
    ['fox', '/models/Fox.glb', 0.75],
    ['horse', '/models/Horse.glb', 2.2],
    ['knight', '/models/Knight.glb', 2.1]
  ];
  let done = 0;
  await Promise.all(names.map(async ([key, url, height]) => {
    const gltf = await loader.loadAsync(url);
    const scene = fitModel(gltf.scene, height);
    const box = new THREE.Box3().setFromObject(scene);
    assets[key] = {
      scene, clips: gltf.animations || [], height,
      radius: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.35
    };
    done++;
    onProgress(done / names.length, key);
  }));
  return assets;
}

function tintModel(root, opts = {}) {
  const body = new THREE.Color(opts.body || '#8fa4b5');
  const accent = new THREE.Color(opts.accent || '#6fe7dd');
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.material = mats.map((m) => {
      const c = m.clone();
      if (/body|mat|fox/i.test(m.name || '') || !/visor/i.test(m.name || '')) {
        c.color.copy(body);
      }
      if (/visor|eye/i.test(m.name || '')) {
        c.color.copy(accent);
        c.emissive = accent.clone();
        c.emissiveIntensity = opts.glow ?? 1.8;
      }
      c.metalness = opts.metalness ?? 0.45;
      c.roughness = opts.roughness ?? 0.52;
      if (opts.transparent) { c.transparent = true; c.opacity = opts.transparent; }
      return c;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
}

export function makeSoldier(opts = {}) {
  const root = cloneSkeleton(assets.soldier.scene);
  tintModel(root, opts);
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const clip of assets.soldier.clips) {
    const action = mixer.clipAction(clip);
    actions[clip.name] = action;
  }
  if (actions.Idle) actions.Idle.play();
  root.userData = { mixer, actions, current: 'Idle' };
  return root;
}

export function makeFox(opts = {}) {
  const root = cloneSkeleton(assets.fox.scene);
  if (opts.body || opts.accent) tintModel(root, opts);
  if (opts.scale) root.scale.multiplyScalar(opts.scale);
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const clip of assets.fox.clips) actions[clip.name] = mixer.clipAction(clip);
  if (actions.Survey) actions.Survey.play();
  root.userData = { mixer, actions, current: 'Survey' };
  return root;
}

export function makeHorse(opts = {}) {
  const root = cloneSkeleton(assets.horse.scene);
  tintModel(root, { body: opts.body || '#d8d3c2', accent: opts.accent || '#63e2d7', metalness: 0.7, roughness: 0.32, ...opts });
  if (opts.scale) root.scale.multiplyScalar(opts.scale);
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const clip of assets.horse.clips) actions[clip.name] = mixer.clipAction(clip);
  const first = Object.values(actions)[0];
  if (first) first.play();
  root.userData = { mixer, actions };
  return root;
}

export function makeKnight(opts = {}) {
  const root = cloneSkeleton(assets.knight.scene);
  tintModel(root, { body: opts.body || '#3e4b52', accent: opts.accent || '#78f4e7', metalness: 0.85, roughness: 0.28, glow: 2.4, ...opts });
  if (opts.scale) root.scale.multiplyScalar(opts.scale);
  const mixer = new THREE.AnimationMixer(root);
  root.userData = { mixer, actions: {} };
  return root;
}

export function playState(root, state, timeScale = 1) {
  const u = root.userData;
  if (!u || !u.actions) return;
  const next = u.actions[state] ? state : (state === 'Run' && u.actions.Walk ? 'Walk' : 'Idle');
  if (!u.actions[next]) return;
  if (u.current !== next) {
    const prev = u.actions[u.current];
    const action = u.actions[next];
    action.reset().setEffectiveWeight(1).fadeIn(0.2).play();
    if (prev) prev.fadeOut(0.18);
    u.current = next;
  }
  u.actions[next].timeScale = timeScale;
}

export function updateMixers(root, dt) {
  if (root.userData?.mixer) root.userData.mixer.update(dt);
}

export function makeHoverboard(color = '#5ef0e0') {
  const group = new THREE.Group();
  const deckMat = new THREE.MeshStandardMaterial({ color: '#171d26', metalness: 0.8, roughness: 0.24 });
  const glowMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 3.5, metalness: 0.6, roughness: 0.3 });
  const deck = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.15, 4, 12), deckMat);
  deck.rotation.z = Math.PI / 2;
  deck.scale.z = 0.45;
  deck.position.y = 0.22;
  deck.castShadow = true;
  group.add(deck);
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 0.06), glowMat);
    strip.position.set(0, 0.18, s * 0.26);
    group.add(strip);
  }
  const under = new THREE.PointLight(color, 2.2, 6);
  under.position.y = 0.05;
  group.add(under);
  return group;
}

export function makeScooter() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#d8ded9', metalness: 0.9, roughness: 0.23 });
  const teal = new THREE.MeshStandardMaterial({ color: '#2dd4c9', metalness: 0.65, roughness: 0.3, emissive: '#1c9f99', emissiveIntensity: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: '#161b20', metalness: 0.4, roughness: 0.55 });
  const deck = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.1, 3, 8), teal);
  deck.rotation.x = Math.PI / 2;
  deck.position.y = 0.2;
  group.add(deck);
  for (const z of [-0.62, 0.62]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 6, 12), dark);
    wheel.position.set(0, 0.2, z);
    wheel.rotation.y = Math.PI / 2;
    group.add(wheel);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.25, 8), metal);
  stem.position.set(0, 0.82, -0.58);
  stem.rotation.x = -0.18;
  group.add(stem);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.72, 8), metal);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 1.4, -0.7);
  group.add(bar);
  for (const s of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 6), teal);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(s * 0.3, 1.4, -0.7);
    group.add(grip);
  }
  const light = new THREE.PointLight('#45e5d8', 1.6, 5);
  light.position.y = 0.1;
  group.add(light);
  return group;
}

export function makeMount(type) {
  return type === 'scooter' ? makeScooter() : makeHoverboard(type === 'skateboard' ? '#eab95e' : '#62eee1');
}

export function disposeObject(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
      else o.material?.dispose?.();
    }
  });
}
