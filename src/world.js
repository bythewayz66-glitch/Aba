import * as THREE from 'three';
import { clamp, fbm, hash2, lerp, mulberry32, pointSegmentDistance } from './util.js';

export const WORLD_SIZE = 300;
export const WORLD_BOUND = 140;
export const WATER_LEVEL = 1.15;

const VILLAGE = { x: 0, z: 0, r: 42 };
const CASTLE = { x: 105, z: -86, r: 34 };
const LAKE = { x: 118, z: 88, rx: 36, rz: 28 };
const ROADS = [
  [[0, 10], [28, 32], [68, 34], [99, -38], [106, -68]],
  [[0, 12], [-36, 36], [-78, 62], [-92, 92]],
  [[0, 13], [48, 32], [76, 68], [103, 79]],
  [[-4, -8], [-18, -56], [-52, -80]]
];

function riverX(z) {
  return 46 + Math.sin(z * 0.028) * 9 + Math.sin(z * 0.011 + 2) * 5;
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function roadDistance(x, z) {
  let best = 1e9;
  for (const road of ROADS) {
    for (let i = 0; i < road.length - 1; i++) {
      const a = road[i];
      const b = road[i + 1];
      best = Math.min(best, pointSegmentDistance(x, z, a[0], a[1], b[0], b[1]));
    }
  }
  return best;
}

export function heightAt(x, z, seed = 1337) {
  let h = 3.9 + fbm(x * 0.012, z * 0.012, seed, 4) * 7.6 + (fbm(x * 0.045, z * 0.045, seed + 7, 2) - 0.5) * 1.3;

  const vd = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  if (vd < 58) h = lerp(h, 4.15, smoothstep(58, 28, vd));

  const cd = Math.hypot(x - CASTLE.x, z - CASTLE.z);
  if (cd < 46) h = lerp(h, 7.2, smoothstep(46, 26, cd));

  const rd = Math.abs(x - riverX(z));
  if (rd < 11) h -= smoothstep(11, 2.5, rd) * 6.2;

  const ld = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
  if (ld < 1.18) h -= smoothstep(1.18, 0.25, ld) * 6.6;

  const road = roadDistance(x, z);
  if (road < 5) h = lerp(h, 4.25, smoothstep(5, 2.2, road) * 0.55);

  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > 138) {
    const ridge = smoothstep(138, 150, edge);
    h += ridge * ridge * (24 + fbm(x * 0.035, z * 0.035, seed + 91, 2) * 12);
  }

  return Math.max(-1.5, h);
}

export class World {
  constructor(scene, seed = 1337) {
    this.scene = scene;
    this.seed = seed | 0;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.colliders = [];
    this.spatial = new Map();
    this.trees = [];
    this.npcs = [];
    this.interactables = [];
    this.spawnZones = [];
    this.farmPlots = [];
    this.fishingSpots = [];
    this.landmarks = [];
    this.animals = [];
    this.minimap = null;
    this.buildTerrain();
    this.buildWater();
    this.buildVegetation();
    this.buildVillage();
    this.buildCastle();
    this.buildProps();
    this.buildNpcs();
    this.buildZones();
    this.buildColliderGrid();
    this.buildMinimap();
  }

  heightAt(x, z) {
    return heightAt(x, z, this.seed);
  }

  isWater(x, z) {
    return this.heightAt(x, z) < WATER_LEVEL;
  }

  addCollider(kind, x, z, r, extra = {}) {
    this.colliders.push({ kind, x, z, r, ...extra });
  }

  addBoxCollider(kind, x, z, w, d) {
    this.colliders.push({ kind, x, z, w, d, box: true });
  }

  buildTerrain() {
    const seg = 220;
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this.heightAt(x, z);
      pos.setY(i, h);
      const slope = Math.abs(this.heightAt(x + 1.5, z) - h) + Math.abs(this.heightAt(x, z + 1.5) - h);
      const vd = Math.hypot(x, z);
      const a = Math.abs(x - riverX(z));
      const ld = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
      const road = roadDistance(x, z);
      const forest = fbm(x * 0.018, z * 0.018, this.seed + 33, 3);

      if (h < WATER_LEVEL + 0.32 || a < 8.5 || ld < 0.9) c.set('#b8a270');
      else if (road < 2.8 && (Math.hypot(x, z) < 60 || roadDistance(x, z) < 2.8)) c.set('#8e7957');
      else if (vd < 26) c.set(hash2(Math.round(x), Math.round(z), 5) > 0.6 ? '#8a877c' : '#7d7a70');
      else if (slope > 1.35 || h > 10.2) c.set('#777a70');
      else if (forest > 0.58) c.set(hash2(Math.round(x), Math.round(z), 8) > 0.5 ? '#3a6640' : '#345c39');
      else c.set(['#4f7b45', '#577f48', '#497442', '#5b8450'][Math.floor(hash2(Math.round(x), Math.round(z), 9) * 4)]);

      if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 27) c.set('#73746c');
      if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 15) c.set('#85847a');

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.94, metalness: 0.01, flatShading: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.terrain = mesh;
    this.root.add(mesh);
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE + 4, WORLD_SIZE + 4, 64, 64);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#2f6f82') } },
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorld;
        void main(){
          vec3 p = position;
          p.z += sin(p.x * 0.22 + uTime * 1.1) * 0.12 + cos(p.y * 0.3 + uTime) * 0.08;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec3 vWorld;
        void main(){
          float wave = sin(vWorld.x * 0.8 + uTime * 1.8) * 0.5 + 0.5;
          float wave2 = sin(vWorld.z * 1.2 - uTime * 1.3) * 0.5 + 0.5;
          vec3 col = mix(uColor, vec3(0.45, 0.78, 0.83), wave * 0.22 + wave2 * 0.12);
          float alpha = 0.82;
          gl_FragColor = vec4(col, alpha);
        }`
    });
    const water = new THREE.Mesh(geo, mat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER_LEVEL;
    this.water = water;
    this.root.add(water);
  }

  buildVegetation() {
    const rand = mulberry32(this.seed ^ 0x5f3759df);
    const treePositions = [];
    const rockPositions = [];
    const grass = [];
    for (let i = 0; i < 5200; i++) {
      const x = rand() * 286 - 143;
      const z = rand() * 286 - 143;
      const h = this.heightAt(x, z);
      if (h < WATER_LEVEL + 0.5) continue;
      if (Math.hypot(x, z) < 42) continue;
      if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 30) continue;
      const road = roadDistance(x, z);
      if (road < 3.4) continue;
      const forest = fbm(x * 0.018, z * 0.018, this.seed + 33, 3);
      if (forest > 0.55 && rand() < 0.62) {
        if (treePositions.length < 850) treePositions.push({ x, z, h, s: 0.75 + rand() * 0.75, autumn: rand() < 0.13 });
      } else if (rand() < 0.22) {
        grass.push({ x, z, h, s: 0.4 + rand() * 0.75 });
      }
      if (rand() < 0.035 && rockPositions.length < 160) rockPositions.push({ x, z, h, s: 0.4 + rand() * 1.6 });
    }

    this.trees = treePositions;
    for (const t of treePositions) this.addCollider('tree', t.x, t.z, 0.65 * t.s);

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5a3d2a', roughness: 1, flatShading: false });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
    const canopyGeo = new THREE.IcosahedronGeometry(1.75, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: false });
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treePositions.length * 2);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    treePositions.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, t.h + 1.5 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      trunks.setMatrixAt(i, m);
      const green = t.autumn ? new THREE.Color(['#b9632e', '#cc7838', '#d88a3e'][i % 3]) : new THREE.Color(['#2f683c', '#3b7a46', '#478a50'][i % 3]);
      m.compose(new THREE.Vector3(t.x, t.h + 3.7 * t.s, t.z), q, new THREE.Vector3(t.s, t.s * 0.9, t.s));
      canopies.setMatrixAt(i * 2, m);
      canopies.setColorAt(i * 2, green);
      m.compose(new THREE.Vector3(t.x + 0.7 * t.s, t.h + 4.2 * t.s, t.z - 0.2 * t.s), q, new THREE.Vector3(t.s * 0.62, t.s * 0.62, t.s * 0.62));
      canopies.setMatrixAt(i * 2 + 1, m);
      canopies.setColorAt(i * 2 + 1, green.clone().offsetHSL(0, 0, 0.05));
    });
    trunks.castShadow = true;
    canopies.castShadow = true;
    this.root.add(trunks, canopies);

    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: '#73786f', roughness: 0.95, flatShading: false });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockPositions.length);
    rockPositions.forEach((r, i) => {
      m.compose(new THREE.Vector3(r.x, r.h + 0.25 * r.s, r.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.s, r.s * 2, 0)), new THREE.Vector3(r.s, r.s * 0.65, r.s));
      rocks.setMatrixAt(i, m);
      this.addCollider('rock', r.x, r.z, r.s * 0.9);
    });
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    this.root.add(rocks);

    const grassGeo = new THREE.ConeGeometry(0.12, 0.6, 3);
    const grassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: false });
    const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grass.length);
    grass.forEach((g, i) => {
      m.compose(new THREE.Vector3(g.x, g.h + 0.3 * g.s, g.z), q, new THREE.Vector3(g.s, g.s, g.s));
      grassMesh.setMatrixAt(i, m);
      grassMesh.setColorAt(i, new THREE.Color(['#477a43', '#568a4b', '#3f703c'][i % 3]));
    });
    this.root.add(grassMesh);

    const flowerGeo = new THREE.SphereGeometry(0.09, 5, 4);
    const flowerMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, 650);
    for (let i = 0; i < 650; i++) {
      const a = rand() * Math.PI * 2;
      const r = 40 + rand() * 100;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = this.heightAt(x, z);
      m.compose(new THREE.Vector3(x, h + 0.32, z), q, new THREE.Vector3(1, 1, 1));
      flowers.setMatrixAt(i, m);
      flowers.setColorAt(i, new THREE.Color(['#f3c74f', '#ed8fae', '#9fc4f2', '#f3ead0'][i % 4]));
    }
    this.root.add(flowers);
  }

  makeBuilding(x, z, w, d, h, opts = {}) {
    const g = new THREE.Group();
    const y = this.heightAt(x, z);
    g.position.set(x, y, z);
    const wallColor = opts.wall || '#d8c6a0';
    const roofColor = opts.roof || '#8f4b3d';
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.88, flatShading: false });
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.85, flatShading: false });
    const trimMat = new THREE.MeshStandardMaterial({ color: '#5b4331', roughness: 0.9 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.6, d + 0.6), new THREE.MeshStandardMaterial({ color: '#817c70', roughness: 1 }));
    base.position.y = 0.3;
    base.receiveShadow = true;
    g.add(base);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    walls.position.y = h / 2 + 0.55;
    walls.castShadow = true;
    walls.receiveShadow = true;
    g.add(walls);

    if (opts.timber !== false) {
      for (let i = 0; i < 4; i++) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, h * 0.92, 0.16), trimMat);
        beam.position.set(-w / 2 + 0.2 + i * (w - 0.4) / 3, h / 2 + 0.55, d / 2 + 0.05);
        g.add(beam);
      }
      const cross = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.16, 0.14), trimMat);
      cross.position.set(0, h * 0.72, d / 2 + 0.06);
      g.add(cross);
    }

    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.62, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = h + 0.55 + h * 0.29;
    roof.castShadow = true;
    g.add(roof);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, Math.max(w, d) * 0.75), roofMat);
    ridge.position.y = h + 0.55 + h * 0.57;
    ridge.rotation.y = Math.PI / 4;
    g.add(ridge);

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.35, 0.16), new THREE.MeshStandardMaterial({ color: '#3d2b1e', roughness: 0.9 }));
    door.position.set(0, 1.72, d / 2 + 0.09);
    g.add(door);

    const winMat = new THREE.MeshStandardMaterial({ color: '#ffd27c', emissive: '#ffb24a', emissiveIntensity: 0.9, roughness: 0.5 });
    for (const sx of [-w * 0.29, w * 0.29]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.12), winMat);
      win.position.set(sx, h * 0.65 + 0.5, d / 2 + 0.1);
      win.userData.window = true;
      g.add(win);
    }

    if (opts.sign) {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 64;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = opts.signBg || '#182a2d';
      ctx.fillRect(0, 0, 256, 64);
      ctx.strokeStyle = opts.accent || '#4de0cf';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, 252, 60);
      ctx.fillStyle = opts.accent || '#4de0cf';
      ctx.font = 'bold 32px Trebuchet MS, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.sign, 128, 35);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.82), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      sign.position.set(0, h * 0.55 + 0.8, d / 2 + 0.22);
      g.add(sign);
    }

    if (opts.chimney) {
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.7), new THREE.MeshStandardMaterial({ color: '#6d675f' }));
      chimney.position.set(w * 0.3, h + 1.35, -d * 0.22);
      chimney.castShadow = true;
      g.add(chimney);
    }

    g.userData.kind = 'building';
    this.root.add(g);
    this.addBoxCollider('building', x, z, w * 0.55, d * 0.55);
    this.windows = this.windows || [];
    return g;
  }

  buildVillage() {
    this.makeBuilding(-16, -16, 11, 8, 4.6, { wall: '#deceb0', roof: '#7c3545', sign: 'EMBERFALL HALL', accent: '#e8bc62', chimney: true });
    this.makeBuilding(17, -16, 10, 7.5, 3.9, { wall: '#cfc2a4', roof: '#2b7c78', sign: "ZIPPY'S", accent: '#4de0cf' });
    this.makeBuilding(-20, 18, 12, 8.5, 4.3, { wall: '#d8c6a0', roof: '#9d5a35', sign: 'THE GILDED LADLE', accent: '#f0c96a', chimney: true });
    this.makeBuilding(20, 19, 9, 7, 3.7, { wall: '#bdb096', roof: '#514a45', sign: 'FORGE', accent: '#ff9a49', chimney: true });
    this.makeBuilding(-37, 4, 7, 6, 3.3, { wall: '#d8c8a4', roof: '#5e6f86' });
    this.makeBuilding(38, -3, 7, 6.5, 3.4, { wall: '#d4c29c', roof: '#6d4d6e' });
    this.makeBuilding(5, 33, 8, 6, 3.4, { wall: '#cec09f', roof: '#4c714c' });
    this.makeBuilding(-5, -40, 7, 6, 3.2, { wall: '#d8c8a4', roof: '#8a5a3d' });

    const fountain = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: '#8b8c83', roughness: 0.9 });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.9, 16), stone);
    basin.position.y = 0.45;
    basin.castShadow = true;
    basin.receiveShadow = true;
    fountain.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.25, 16), new THREE.MeshStandardMaterial({ color: '#54a7b3', transparent: true, opacity: 0.8, roughness: 0.15 }));
    water.position.y = 0.92;
    fountain.add(water);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.6, 8), stone);
    pillar.position.y = 2.2;
    fountain.add(pillar);
    fountain.position.set(0, this.heightAt(0, 8), 8);
    this.root.add(fountain);
    this.addCollider('fountain', 0, 8, 4.4);

    const lampPositions = [[-8, 0], [9, 2], [-10, 12], [12, 12], [-2, 22], [14, -2]];
    for (const [x, z] of lampPositions) {
      const lamp = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 3.6, 6), new THREE.MeshStandardMaterial({ color: '#3c342e' }));
      post.position.y = 1.8;
      lamp.add(post);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd88a' }));
      glow.position.y = 3.7;
      lamp.add(glow);
      lamp.position.set(x, this.heightAt(x, z), z);
      this.root.add(lamp);
      this.addCollider('lamp', x, z, 0.22);
    }

    const stallColors = ['#c94f6a', '#3d8e9c', '#d1a640'];
    [[-9, 5], [-6, -6], [8, 10]].forEach(([x, z], i) => {
      const stall = new THREE.Group();
      const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 1.6), new THREE.MeshStandardMaterial({ color: '#745332' }));
      table.position.y = 0.8;
      stall.add(table);
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 2.2), new THREE.MeshStandardMaterial({ color: stallColors[i] }));
      canopy.position.y = 2.7;
      stall.add(canopy);
      for (const sx of [-1.5, 1.5]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 5), new THREE.MeshStandardMaterial({ color: '#5b4331' }));
        pole.position.set(sx, 1.4, 0);
        stall.add(pole);
      }
      stall.position.set(x, this.heightAt(x, z), z);
      this.root.add(stall);
      this.addCollider('stall', x, z, 1.7);
    });

    this.addShrine(-44, 26, 'Emberfall Shrine');
    this.addShrine(74, 26, 'Wayfarer Shrine');
    this.addShrine(103, -40, 'Keep Shrine');

    this.farmPlots = [];
    for (let i = 0; i < 6; i++) {
      const x = -33 + (i % 3) * 4.4;
      const z = 36 + Math.floor(i / 3) * 4.4;
      const plot = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 3.4), new THREE.MeshStandardMaterial({ color: '#5b4028', roughness: 1 }));
      plot.position.set(x, this.heightAt(x, z) + 0.15, z);
      plot.receiveShadow = true;
      this.root.add(plot);
      const fenceMat = new THREE.MeshStandardMaterial({ color: '#6e5032' });
      for (const [ox, oz, w, d] of [[0, -1.8, 3.6, 0.16], [0, 1.8, 3.6, 0.16], [-1.8, 0, 0.16, 3.6], [1.8, 0, 0.16, 3.6]]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), fenceMat);
        f.position.set(x + ox, this.heightAt(x, z) + 0.5, z + oz);
        this.root.add(f);
      }
      this.farmPlots.push({ id: `plot${i}`, x, z, crop: null, growth: 0, mesh: plot });
      this.interactables.push({ kind: 'farm', id: `plot${i}`, x, z, name: 'Farm plot', radius: 2.6 });
    }

    this.interactables.push(
      { kind: 'npc', id: 'mayor', x: -16, z: -9, name: 'Mayor Elowen', radius: 3.4 },
      { kind: 'npc', id: 'zippy', x: 17, z: -10, name: 'Zippy', radius: 3.4 },
      { kind: 'npc', id: 'hilda', x: 20, z: 13, name: 'Hilda the Smith', radius: 3.4 },
      { kind: 'npc', id: 'mira', x: -20, z: 12, name: 'Mira the Innkeeper', radius: 3.4 },
      { kind: 'npc', id: 'pip', x: -3, z: 14, name: 'Pip the Bard', radius: 3.2 }
    );
    this.npcs.push(
      { id: 'mayor', name: 'Mayor Elowen', x: -16, z: -9, color: '#b79545', title: 'Keeper of Emberfall' },
      { id: 'zippy', name: 'Zippy', x: 17, z: -10, color: '#36c7bb', title: 'Purveyor of Tomorrow' },
      { id: 'hilda', name: 'Hilda', x: 20, z: 13, color: '#c9763e', title: 'Master Smith' },
      { id: 'mira', name: 'Mira', x: -20, z: 12, color: '#c98da8', title: 'Innkeeper' },
      { id: 'pip', name: 'Pip', x: -3, z: 14, color: '#8d6cc2', title: 'Bard of the Plaza' }
    );

    for (const [x, z] of [[0, 26], [26, 12], [-30, 8], [32, 22]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 5), new THREE.MeshStandardMaterial({ color: '#4a3828' }));
      post.position.set(x, this.heightAt(x, z) + 1.3, z);
      this.root.add(post);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshStandardMaterial({ color: '#8d3349', side: THREE.DoubleSide, roughness: 0.8 }));
      flag.position.set(x + 0.6, this.heightAt(x, z) + 2.2, z);
      this.root.add(flag);
    }
  }

  addShrine(x, z, name) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#8c948c', roughness: 0.85 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.5, 8), mat);
    base.position.y = 0.25;
    g.add(base);
    const archL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.2, 0.45), mat);
    archL.position.set(-1.05, 1.8, 0);
    g.add(archL);
    const archR = archL.clone();
    archR.position.x = 1.05;
    g.add(archR);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.42, 0.45), mat);
    top.position.y = 3.4;
    g.add(top);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: '#74e4de' }));
    orb.position.set(0, 2.9, 0);
    g.add(orb);
    g.position.set(x, this.heightAt(x, z), z);
    this.root.add(g);
    this.addCollider('shrine', x, z, 1.5);
    this.interactables.push({ kind: 'shrine', id: name, x, z, name, radius: 3 });
  }

  buildCastle() {
    const x = CASTLE.x;
    const z = CASTLE.z;
    const baseY = this.heightAt(x, z);
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: '#71746c', roughness: 0.95, flatShading: false });
    const dark = new THREE.MeshStandardMaterial({ color: '#4d5250', roughness: 0.95, flatShading: false });
    const keep = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 16), stone);
    keep.position.y = 6;
    keep.castShadow = true;
    keep.receiveShadow = true;
    g.add(keep);
    for (const [ox, oz] of [[-11, -8], [11, -8], [-11, 8], [11, 8]]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.2, 17, 8), stone);
      tower.position.set(ox, 8.5, oz);
      tower.castShadow = true;
      g.add(tower);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(3.3, 3.2, 8), new THREE.MeshStandardMaterial({ color: '#3b4650', roughness: 0.8, flatShading: false }));
      cap.position.set(ox, 18.4, oz);
      g.add(cap);
    }
    for (let i = 0; i < 7; i++) {
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.2), dark);
      merlon.position.set(-9 + i * 3, 12.8, -8.2);
      g.add(merlon);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5, 0.5), new THREE.MeshStandardMaterial({ color: '#26211d', roughness: 0.9 }));
    door.position.set(0, 2.5, 8.1);
    g.add(door);
    for (const ox of [-6, 0, 6]) {
      const glow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.2), new THREE.MeshStandardMaterial({ color: '#7fe6e2', emissive: '#3fb9b2', emissiveIntensity: 1.6 }));
      glow.position.set(ox, 8.6, 8.12);
      g.add(glow);
    }
    for (let i = 0; i < 8; i++) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(4 + (i % 3) * 2, 3 + (i % 2), 0.9), stone);
      const wx = x - 27 + (i % 4) * 15;
      const wz = z + 20 + Math.floor(i / 4) * 8;
      wall.position.set(wx - x, 1.4, wz - z);
      wall.rotation.y = i * 1.7;
      wall.castShadow = true;
      g.add(wall);
    }
    g.position.set(x, baseY, z);
    this.root.add(g);
    this.addBoxCollider('castle', x, z, 12, 8.5);
    this.landmarks.push({ name: 'Sunken Keep', x, z, kind: 'boss' });
    this.interactables.push({ kind: 'bossgate', id: 'keep', x, z: z + 14, name: 'Sunken Keep', radius: 4 });
  }

  buildProps() {
    const crateMat = new THREE.MeshStandardMaterial({ color: '#7b5a37', roughness: 0.95 });
    for (const [x, z] of [[13, 5], [-27, -7], [30, 17], [-15, 29], [43, 6]]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), crateMat);
      crate.position.set(x, this.heightAt(x, z) + 0.55, z);
      crate.castShadow = true;
      this.root.add(crate);
      this.addCollider('crate', x, z, 0.75);
    }

    this.addDock(102, 72, -0.6);
    for (let i = 0; i < 5; i++) {
      const x = 86 + i * 4.2;
      const z = 58 + i * 2.4;
      this.fishingSpots.push({ id: `fish${i}`, x, z, name: 'Fishing spot' });
      this.interactables.push({ kind: 'fishing', id: `fish${i}`, x, z, name: 'Cast a line', radius: 4 });
    }
    this.fishingSpots.push({ id: 'fish5', x: 38, z: 82, name: 'River fishing spot' });

    const camp = new THREE.Group();
    const tentMat = new THREE.MeshStandardMaterial({ color: '#8d4e45', roughness: 0.95, flatShading: false });
    for (let i = 0; i < 3; i++) {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(2.7, 3.2, 4), tentMat);
      tent.position.set(-4 + i * 5, 1.6, 2 + (i % 2) * 3);
      tent.rotation.y = Math.PI / 4;
      tent.castShadow = true;
      camp.add(tent);
    }
    camp.position.set(80, this.heightAt(80, 92), 92);
    this.root.add(camp);
    this.addCollider('tent', 80, 92, 3);

    this.landmarks.push(
      { name: 'Emberfall', x: 0, z: 0, kind: 'town' },
      { name: 'Mirror Lake', x: LAKE.x, z: LAKE.z, kind: 'zone' },
      { name: 'Wolfwood', x: -90, z: 92, kind: 'zone' },
      { name: 'Red Camp', x: 80, z: 92, kind: 'zone' },
      { name: 'Sunken Keep', x: CASTLE.x, z: CASTLE.z, kind: 'boss' },
      { name: 'Meadow', x: 25, z: 70, kind: 'zone' }
    );
  }

  addDock(x, z, rot) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#6d4e30', roughness: 0.95 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.24, 12), wood);
    deck.position.y = 0.15;
    deck.castShadow = true;
    g.add(deck);
    for (const oz of [-4, 0, 4]) {
      for (const ox of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.4, 5), wood);
        post.position.set(ox, -0.8, oz);
        g.add(post);
      }
    }
    g.position.set(x, WATER_LEVEL + 0.6, z);
    g.rotation.y = rot;
    this.root.add(g);
  }

  buildNpcs() {
    for (const npc of this.npcs) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.45, 1.2, 7), new THREE.MeshStandardMaterial({ color: npc.color, roughness: 0.9 }));
      body.position.y = 1.25;
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshStandardMaterial({ color: '#e4bb8f', roughness: 0.8 }));
      head.position.y = 2.08;
      head.castShadow = true;
      g.add(head);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.31, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4a342a' }));
      hair.position.y = 2.16;
      g.add(hair);
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), new THREE.MeshBasicMaterial({ color: '#ffd66e' }));
      marker.position.y = 3.1;
      marker.userData.marker = true;
      g.add(marker);
      g.position.set(npc.x, this.heightAt(npc.x, npc.z), npc.z);
      g.userData = { npc, marker };
      this.root.add(g);
      npc.mesh = g;
      this.addCollider('npc', npc.x, npc.z, 0.5);
    }
  }

  buildZones() {
    this.spawnZones = [
      { id: 'meadow', type: 'slime', x: 35, z: 62, r: 25, count: 5, respawn: 24 },
      { id: 'wolfwood', type: 'wolf', x: -91, z: 90, r: 26, count: 6, respawn: 26 },
      { id: 'redcamp', type: 'bandit', x: 84, z: 94, r: 22, count: 6, respawn: 30 },
      { id: 'keepyard', type: 'skeleton', x: 102, z: -61, r: 17, count: 5, respawn: 32 },
      { id: 'meadow2', type: 'deer', x: 28, z: 66, r: 30, count: 5, respawn: 30 },
      { id: 'boar', type: 'boar', x: -62, z: 4, r: 24, count: 4, respawn: 34 },
      { id: 'golem', type: 'golem', x: 82, z: -18, r: 18, count: 2, respawn: 60 }
    ];
    this.boss = { type: 'boss', x: CASTLE.x, z: CASTLE.z + 9, name: 'The Clockwork Dragon' };
  }

  buildColliderGrid() {
    const cell = 8;
    for (const c of this.colliders) {
      const x0 = Math.floor((c.x - (c.w || c.r)) / cell);
      const x1 = Math.floor((c.x + (c.w || c.r)) / cell);
      const z0 = Math.floor((c.z - (c.d || c.r)) / cell);
      const z1 = Math.floor((c.z + (c.d || c.r)) / cell);
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const k = `${x},${z}`;
          if (!this.spatial.has(k)) this.spatial.set(k, []);
          this.spatial.get(k).push(c);
        }
      }
    }
  }

  blocked(x, z, radius = 0.5) {
    if (Math.abs(x) > WORLD_BOUND - radius || Math.abs(z) > WORLD_BOUND - radius) return true;
    if (this.heightAt(x, z) < WATER_LEVEL + 0.15) return true;
    const cell = 8;
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    for (let gz = cz - 1; gz <= cz + 1; gz++) {
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        const list = this.spatial.get(`${gx},${gz}`);
        if (!list) continue;
        for (const c of list) {
          if (c.box) {
            if (Math.abs(x - c.x) < c.w + radius && Math.abs(z - c.z) < c.d + radius) return true;
          } else {
            const rr = c.r + radius;
            if ((x - c.x) ** 2 + (z - c.z) ** 2 < rr * rr) return true;
          }
        }
      }
    }
    return false;
  }

  move(entity, dx, dz, radius = 0.5) {
    let moved = false;
    if (dx && !this.blocked(entity.x + dx, entity.z, radius)) { entity.x += dx; moved = true; }
    if (dz && !this.blocked(entity.x, entity.z + dz, radius)) { entity.z += dz; moved = true; }
    return moved;
  }

  nearestInteractable(x, z, radius = 3.4) {
    let best = null;
    let bd = radius;
    for (const it of this.interactables) {
      const d = Math.hypot(x - it.x, z - it.z);
      if (d < Math.min(bd, it.radius)) { bd = d; best = it; }
    }
    return best;
  }

  randomPointInZone(zone, rand = Math.random) {
    for (let i = 0; i < 24; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * zone.r;
      const x = clamp(zone.x + Math.cos(a) * r, -WORLD_BOUND + 2, WORLD_BOUND - 2);
      const z = clamp(zone.z + Math.sin(a) * r, -WORLD_BOUND + 2, WORLD_BOUND - 2);
      if (!this.blocked(x, z, 0.8)) return { x, z };
    }
    return { x: zone.x, z: zone.z };
  }

  buildMinimap() {
    const cv = document.createElement('canvas');
    cv.width = 300; cv.height = 240;
    const ctx = cv.getContext('2d');
    const sx = cv.width / WORLD_SIZE;
    const sz = cv.height / WORLD_SIZE;
    for (let py = 0; py < cv.height; py++) {
      for (let px = 0; px < cv.width; px++) {
        const x = px / sx - WORLD_SIZE / 2;
        const z = py / sz - WORLD_SIZE / 2;
        const h = this.heightAt(x, z);
        const road = roadDistance(x, z);
        let c = '#4f7b45';
        if (h < WATER_LEVEL) c = '#2f6f82';
        else if (h < WATER_LEVEL + 0.5) c = '#b8a270';
        else if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 20) c = '#7a7a71';
        else if (Math.hypot(x, z) < 32) c = '#8b887d';
        else if (road < 2.6) c = '#9a8360';
        else if (fbm(x * 0.018, z * 0.018, this.seed + 33, 3) > 0.55) c = '#355d3b';
        ctx.fillStyle = c;
        ctx.fillRect(px, py, 1.3, 1.3);
      }
    }
    this.minimap = cv;
  }
}
