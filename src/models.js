import * as THREE from 'three';

const cache = new Map();

function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshStandardMaterial({
      color, roughness: 0.82, metalness: 0.05, flatShading: true, ...opts
    }));
  }
  return cache.get(key);
}

function mesh(geo, material, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  m.receiveShadow = false;
  return m;
}

export function createHumanoid(opts = {}) {
  const g = new THREE.Group();
  const skin = opts.skin || '#e8bb91';
  const hair = opts.hair || '#4a3126';
  const primary = opts.primary || '#7a4e8f';
  const secondary = opts.secondary || '#3d2e55';
  const accent = opts.accent || '#e7c66a';

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(-0.16, 0.94, 0);
  legR.position.set(0.16, 0.94, 0);
  const legGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.9, 6);
  const footGeo = new THREE.BoxGeometry(0.2, 0.13, 0.34);
  for (const [leg, sx] of [[legL, -1], [legR, 1]]) {
    const l = mesh(legGeo, mat(secondary));
    l.position.y = -0.45;
    leg.add(l);
    const boot = mesh(footGeo, mat(opts.shoes || '#3a2c24'));
    boot.position.set(0, -0.88, 0.06);
    boot.userData.shoe = true;
    boot.userData.base = opts.shoes || '#3a2c24';
    leg.add(boot);
    leg.userData.boot = boot;
    g.add(leg);
  }

  const torso = mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.92, 7), mat(primary));
  torso.position.y = 1.42;
  g.add(torso);
  const belt = mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.12, 7), mat(accent));
  belt.position.y = 1.02;
  g.add(belt);

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(-0.45, 1.72, 0);
  armR.position.set(0.45, 1.72, 0);
  const armGeo = new THREE.CylinderGeometry(0.085, 0.075, 0.78, 6);
  const handGeo = new THREE.SphereGeometry(0.1, 6, 5);
  for (const arm of [armL, armR]) {
    const a = mesh(armGeo, mat(primary));
    a.position.y = -0.36;
    arm.add(a);
    const hand = mesh(handGeo, mat(skin));
    hand.position.y = -0.78;
    arm.add(hand);
    g.add(arm);
  }

  const head = new THREE.Group();
  head.position.y = 2.14;
  const skull = mesh(new THREE.SphereGeometry(0.28, 10, 8), mat(skin));
  head.add(skull);
  const hairMesh = mesh(new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(hair));
  hairMesh.position.y = 0.06;
  head.add(hairMesh);
  if (opts.hairStyle === 'long') {
    const pony = mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.75, 6), mat(hair));
    pony.position.set(0, -0.16, -0.28);
    pony.rotation.x = 0.14;
    head.add(pony);
  } else if (opts.hairStyle === 'bun') {
    const bun = mesh(new THREE.SphereGeometry(0.14, 7, 6), mat(hair));
    bun.position.set(0, 0.21, -0.24);
    head.add(bun);
  }
  g.add(head);

  const eyes = mesh(new THREE.BoxGeometry(0.2, 0.035, 0.02), mat('#2b211d'), false);
  eyes.position.set(0, 0.05, 0.27);
  head.add(eyes);
  const shades = mesh(new THREE.BoxGeometry(0.34, 0.11, 0.04), mat('#14181d', { metalness: 0.6, roughness: 0.2 }), false);
  shades.position.set(0, 0.07, 0.29);
  shades.visible = false;
  head.add(shades);

  const cape = mesh(new THREE.PlaneGeometry(0.9, 1.25), new THREE.MeshStandardMaterial({ color: accent, side: THREE.DoubleSide, roughness: 0.9 }));
  cape.position.set(0, 1.35, -0.36);
  cape.rotation.x = 0.12;
  cape.castShadow = true;
  g.add(cape);

  const hood = mesh(new THREE.TorusGeometry(0.36, 0.13, 6, 10, Math.PI * 1.45), mat(opts.hoodie || '#43c5bb'));
  hood.position.set(0, 1.82, -0.05);
  hood.rotation.x = Math.PI / 2;
  hood.visible = false;
  g.add(hood);

  const jacket = mesh(new THREE.CylinderGeometry(0.39, 0.47, 0.72, 7), mat(opts.jacket || '#dd5a7c'));
  jacket.position.y = 1.47;
  jacket.visible = false;
  g.add(jacket);

  const weapon = new THREE.Group();
  weapon.position.set(0.45, 1.0, 0.15);
  buildWeapon(weapon, opts.weapon || 'bow');
  g.add(weapon);

  g.userData = {
    legL, legR, armL, armR, head, torso, cape, weapon, shades, hood, jacket, eyes,
    walk: 0, basePrimary: primary
  };
  return g;
}

function buildWeapon(group, type) {
  const metal = mat('#c8d1d2', { metalness: 0.75, roughness: 0.3 });
  const wood = mat('#6a4628');
  if (type === 'bow') {
    const arc = mesh(new THREE.TorusGeometry(0.55, 0.035, 5, 14, Math.PI * 1.2), metal);
    arc.rotation.z = Math.PI * 0.4;
    group.add(arc);
    const string = mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.08, 3), mat('#e8dfc7'), false);
    string.rotation.z = 0.3;
    string.position.x = -0.06;
    group.add(string);
  } else if (type === 'hammer') {
    const handle = mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.5, 6), wood);
    handle.rotation.z = Math.PI / 2;
    group.add(handle);
    const head = mesh(new THREE.BoxGeometry(0.62, 0.34, 0.34), metal);
    head.position.x = 0.75;
    group.add(head);
    const rune = mesh(new THREE.BoxGeometry(0.1, 0.36, 0.36), mat('#6fd6ce', { emissive: '#3fb9b2', emissiveIntensity: 0.8 }));
    rune.position.x = 0.75;
    group.add(rune);
  } else {
    for (const s of [-1, 1]) {
      const handle = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 5), wood);
      handle.position.set(s * 0.18, 0.15, 0);
      handle.rotation.z = s * 0.5;
      group.add(handle);
      const blade = mesh(new THREE.ConeGeometry(0.08, 0.8, 4), metal);
      blade.position.set(s * 0.32, 0.55, 0);
      blade.rotation.z = s * 0.52;
      group.add(blade);
    }
  }
}

export function createMount(type) {
  const g = new THREE.Group();
  if (type === 'skateboard') {
    const deck = mesh(new THREE.BoxGeometry(0.72, 0.11, 2.2), mat('#7a3f50'));
    deck.position.y = 0.15;
    g.add(deck);
    for (const z of [-0.72, 0.72]) {
      for (const x of [-0.28, 0.28]) {
        const wheel = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.13, 8), mat('#d8d2b4'));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.16, z);
        g.add(wheel);
      }
    }
  } else if (type === 'scooter') {
    const deck = mesh(new THREE.BoxGeometry(0.55, 0.16, 1.65), mat('#35b9b0'));
    deck.position.y = 0.24;
    g.add(deck);
    const stem = mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.2, 6), mat('#d9e1dd'));
    stem.position.set(0, 0.95, -0.64);
    stem.rotation.x = -0.2;
    g.add(stem);
    const bar = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.74, 6), mat('#222'));
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.52, -0.72);
    g.add(bar);
    for (const z of [-0.72, 0.72]) {
      const wheel = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 10), mat('#181f22'));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.24, z);
      g.add(wheel);
    }
    const under = new THREE.PointLight('#4de0cf', 1.2, 5);
    under.position.y = 0.1;
    g.add(under);
  } else {
    const deck = mesh(new THREE.BoxGeometry(0.75, 0.16, 1.9), mat('#2f3154', { metalness: 0.6, roughness: 0.25 }));
    deck.position.y = 0.28;
    g.add(deck);
    const glow = mesh(new THREE.BoxGeometry(0.68, 0.05, 1.8), new THREE.MeshBasicMaterial({ color: '#6ff4e8' }), false);
    glow.position.y = 0.18;
    g.add(glow);
    const light = new THREE.PointLight('#66eadf', 2, 7);
    light.position.y = 0.2;
    g.add(light);
  }
  return g;
}

export function animateHumanoid(g, opts) {
  const u = g.userData;
  if (!u || !u.legL) return;
  const t = opts.time || 0;
  const moving = opts.moving ? 1 : 0;
  const speed = opts.speed || 1;
  u.walk += (opts.dt || 0.016) * (moving ? 9 * speed : 5);
  const swing = moving ? Math.sin(u.walk) * 0.55 : Math.sin(t * 1.8) * 0.025;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.7;
  u.armR.rotation.x = swing * 0.7;
  u.torso.position.y = 1.42 + (moving ? Math.abs(Math.sin(u.walk)) * 0.035 : Math.sin(t * 2) * 0.015);
  u.head.position.y = 2.14 + (moving ? Math.abs(Math.sin(u.walk)) * 0.02 : 0);
  u.cape.rotation.x = 0.12 + (moving ? 0.18 + Math.sin(u.walk * 1.2) * 0.05 : 0.02);
  if (opts.attack > 0) {
    const a = Math.sin(Math.min(1, opts.attack) * Math.PI);
    if (opts.weapon === 'bow') {
      u.armL.rotation.x = -a * 1.25;
      u.armR.rotation.x = -a * 1.05;
    } else {
      u.armR.rotation.x = -a * 1.8;
      u.armR.rotation.z = -a * 0.35;
      u.weapon.rotation.y = a * 1.3;
    }
  } else {
    u.armR.rotation.z = 0;
    u.weapon.rotation.y *= 0.9;
  }
  if (opts.mounted) {
    u.legL.rotation.x = 0.18;
    u.legR.rotation.x = -0.18;
    u.armL.rotation.x = -0.2;
    u.armR.rotation.x = -0.2;
  }
  u.shades.visible = !!opts.shades;
  u.hood.visible = !!opts.hoodie;
  u.jacket.visible = !!opts.jacket;
  if (opts.jacket) u.jacket.material.color.set(opts.jacket);
  if (opts.hoodie) u.hood.material.color.set(opts.hoodie);
  if (opts.shoeColor) {
    for (const leg of [u.legL, u.legR]) {
      const boot = leg.userData.boot;
      if (boot) boot.material.color.set(opts.shoeColor);
    }
  }
}

export function createHero(heroKey, opts = {}) {
  if (heroKey === 'aurora') {
    return createHumanoid({
      skin: '#e7b99a', hair: '#e8d8c8', hairStyle: 'long', primary: '#4d3c73', secondary: '#2d2547',
      accent: '#d980b1', weapon: 'bow', shoes: '#f2eee2', hoodie: '#37c9bd', jacket: '#d75683'
    });
  }
  if (heroKey === 'boris') {
    return createHumanoid({
      skin: '#d6a072', hair: '#3a2a20', hairStyle: 'short', primary: '#365879', secondary: '#283d53',
      accent: '#d9b45f', weapon: 'hammer', shoes: '#42352f', hoodie: '#3f8dbf', jacket: '#284760'
    });
  }
  return createHumanoid({
    skin: '#e3b58e', hair: '#a74d2f', hairStyle: 'bun', primary: '#2f5e49', secondary: '#243f34',
    accent: '#e1b552', weapon: 'daggers', shoes: '#e8e2d2', hoodie: '#51b78a', jacket: '#83445c'
  });
}

export function createPet(type) {
  const g = new THREE.Group();
  const u = { type, legs: [], wings: [], tail: null, head: null };
  if (type === 'fox' || type === 'wolfpup') {
    const color = type === 'fox' ? '#d8723a' : '#7a8494';
    const body = mesh(new THREE.CapsuleGeometry(0.28, 0.55, 4, 8), mat(color));
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.48;
    g.add(body);
    const head = new THREE.Group();
    head.position.set(0.5, 0.62, 0);
    const skull = mesh(new THREE.SphereGeometry(0.26, 8, 6), mat(color));
    head.add(skull);
    const snout = mesh(new THREE.ConeGeometry(0.12, 0.3, 5), mat('#f1e4ce'));
    snout.rotation.z = -Math.PI / 2;
    snout.position.set(0.28, -0.04, 0);
    head.add(snout);
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(0.09, 0.22, 4), mat(color));
      ear.position.set(-0.04, 0.23, s * 0.14);
      head.add(ear);
    }
    g.add(head);
    u.head = head;
    for (const [x, z] of [[-0.2, -0.18], [-0.2, 0.18], [0.22, -0.18], [0.22, 0.18]]) {
      const leg = new THREE.Group();
      const l = mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.4, 5), mat(color));
      l.position.y = -0.2;
      leg.add(l);
      leg.position.set(x, 0.28, z);
      g.add(leg);
      u.legs.push(leg);
    }
    const tail = mesh(new THREE.ConeGeometry(0.16, 0.75, 6), mat(type === 'fox' ? '#f0e1c7' : color));
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-0.65, 0.6, 0);
    g.add(tail);
    u.tail = tail;
  } else if (type === 'owl') {
    const body = mesh(new THREE.SphereGeometry(0.36, 8, 6), mat('#8c939b'));
    body.position.y = 0.62;
    g.add(body);
    const head = new THREE.Group();
    head.position.y = 1.02;
    const skull = mesh(new THREE.SphereGeometry(0.29, 8, 6), mat('#9aa2aa'));
    head.add(skull);
    for (const s of [-1, 1]) {
      const eye = mesh(new THREE.SphereGeometry(0.075, 6, 5), new THREE.MeshBasicMaterial({ color: '#6ff4e8' }), false);
      eye.position.set(0.2, 0.03, s * 0.12);
      head.add(eye);
    }
    g.add(head);
    u.head = head;
    for (const s of [-1, 1]) {
      const wing = new THREE.Group();
      const w = mesh(new THREE.BoxGeometry(0.07, 0.8, 0.4), mat('#6f7780'));
      w.position.y = -0.4;
      wing.add(w);
      wing.position.set(0, 0.9, s * 0.35);
      wing.rotation.z = s * 0.1;
      g.add(wing);
      u.wings.push(wing);
    }
  } else {
    const body = mesh(new THREE.CapsuleGeometry(0.32, 0.5, 4, 8), mat('#4b6973'));
    body.position.y = 0.62;
    body.rotation.z = Math.PI / 2;
    g.add(body);
    const head = new THREE.Group();
    head.position.set(0.55, 0.95, 0);
    const skull = mesh(new THREE.BoxGeometry(0.4, 0.32, 0.32), mat('#7c9ba4'));
    head.add(skull);
    const jaw = mesh(new THREE.BoxGeometry(0.3, 0.12, 0.26), mat('#526e76'));
    jaw.position.set(0.16, -0.17, 0);
    head.add(jaw);
    for (const s of [-1, 1]) {
      const horn = mesh(new THREE.ConeGeometry(0.06, 0.28, 4), mat('#c9b26e'));
      horn.position.set(-0.12, 0.2, s * 0.12);
      head.add(horn);
      const eye = mesh(new THREE.SphereGeometry(0.05, 5, 4), new THREE.MeshBasicMaterial({ color: '#ffd66e' }), false);
      eye.position.set(0.18, 0.02, s * 0.13);
      head.add(eye);
    }
    g.add(head);
    u.head = head;
    for (const s of [-1, 1]) {
      const wing = new THREE.Group();
      const w = mesh(new THREE.BoxGeometry(0.08, 0.55, 0.85), new THREE.MeshStandardMaterial({ color: '#5d7d89', transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      w.position.set(-0.2, 0.1, s * 0.5);
      w.rotation.z = s * 0.4;
      wing.add(w);
      wing.position.set(0.1, 0.9, s * 0.2);
      g.add(wing);
      u.wings.push(wing);
    }
    const tail = mesh(new THREE.ConeGeometry(0.11, 1.1, 5), mat('#4b6973'));
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-0.9, 0.6, 0);
    g.add(tail);
    u.tail = tail;
  }
  g.userData = u;
  return g;
}

export function animatePet(g, opts) {
  const u = g.userData;
  if (!u) return;
  const t = opts.time || 0;
  g.position.y = (opts.baseY || 0) + Math.sin(t * 3 + (opts.seed || 0)) * 0.05;
  u.legs.forEach((leg, i) => { leg.rotation.x = opts.moving ? Math.sin(t * 12 + i * 1.4) * 0.7 : 0; });
  u.wings.forEach((wing, i) => {
    wing.rotation.z = (i % 2 === 0 ? 1 : -1) * (0.35 + Math.sin(t * 7) * (opts.moving ? 0.6 : 0.18));
  });
  if (u.tail) u.tail.rotation.y = Math.sin(t * 5) * 0.25;
  if (u.head) u.head.rotation.y = Math.sin(t * 1.7) * 0.16;
}

export function createEnemy(type) {
  const g = new THREE.Group();
  const u = { type, legs: [], arms: [], wings: [], core: null, head: null };
  if (type === 'slime') {
    const body = mesh(new THREE.SphereGeometry(0.62, 10, 7), new THREE.MeshStandardMaterial({ color: '#66c26c', transparent: true, opacity: 0.84, roughness: 0.25 }));
    body.scale.y = 0.72;
    body.position.y = 0.52;
    g.add(body);
    const core = mesh(new THREE.SphereGeometry(0.18, 6, 5), new THREE.MeshBasicMaterial({ color: '#d9ffb0' }), false);
    core.position.y = 0.5;
    g.add(core);
    for (const s of [-1, 1]) {
      const eye = mesh(new THREE.SphereGeometry(0.06, 5, 4), new THREE.MeshBasicMaterial({ color: '#18301b' }), false);
      eye.position.set(0.28, 0.64, s * 0.2);
      g.add(eye);
    }
    u.core = core;
  } else if (type === 'wolf') {
    const body = mesh(new THREE.CapsuleGeometry(0.3, 0.8, 4, 7), mat('#5f6872'));
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.68;
    g.add(body);
    const head = new THREE.Group();
    head.position.set(0.66, 0.85, 0);
    const skull = mesh(new THREE.SphereGeometry(0.28, 8, 6), mat('#6d7680'));
    head.add(skull);
    const snout = mesh(new THREE.ConeGeometry(0.14, 0.36, 5), mat('#505963'));
    snout.rotation.z = -Math.PI / 2;
    snout.position.set(0.32, -0.05, 0);
    head.add(snout);
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(0.1, 0.24, 4), mat('#4b545d'));
      ear.position.set(-0.05, 0.25, s * 0.15);
      head.add(ear);
      const eye = mesh(new THREE.SphereGeometry(0.045, 5, 4), new THREE.MeshBasicMaterial({ color: '#ffcf5c' }), false);
      eye.position.set(0.2, 0.05, s * 0.14);
      head.add(eye);
    }
    g.add(head);
    u.head = head;
    for (const [x, z] of [[-0.3, -0.2], [-0.3, 0.2], [0.28, -0.2], [0.28, 0.2]]) {
      const leg = new THREE.Group();
      const l = mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 5), mat('#535c66'));
      l.position.y = -0.25;
      leg.add(l);
      leg.position.set(x, 0.45, z);
      g.add(leg);
      u.legs.push(leg);
    }
    const tail = mesh(new THREE.ConeGeometry(0.13, 0.8, 5), mat('#5f6872'));
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-0.75, 0.78, 0);
    g.add(tail);
  } else if (type === 'deer') {
    const body = mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 7), mat('#9a6b43'));
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.92;
    g.add(body);
    const head = new THREE.Group();
    head.position.set(0.7, 1.35, 0);
    const skull = mesh(new THREE.SphereGeometry(0.22, 7, 6), mat('#a8794f'));
    head.add(skull);
    const snout = mesh(new THREE.BoxGeometry(0.3, 0.16, 0.18), mat('#b98a5e'));
    snout.position.set(0.22, -0.06, 0);
    head.add(snout);
    for (const s of [-1, 1]) {
      const antler = mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.65, 4), mat('#d8c39b'));
      antler.position.set(-0.04, 0.34, s * 0.1);
      antler.rotation.z = s * 0.25;
      head.add(antler);
    }
    g.add(head);
    u.head = head;
    for (const [x, z] of [[-0.28, -0.2], [-0.28, 0.2], [0.28, -0.2], [0.28, 0.2]]) {
      const leg = new THREE.Group();
      const l = mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.85, 5), mat('#8a5e3a'));
      l.position.y = -0.42;
      leg.add(l);
      leg.position.set(x, 0.58, z);
      g.add(leg);
      u.legs.push(leg);
    }
  } else if (type === 'boar') {
    const body = mesh(new THREE.CapsuleGeometry(0.42, 0.8, 4, 7), mat('#5c4538'));
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.76;
    g.add(body);
    const head = new THREE.Group();
    head.position.set(0.68, 0.84, 0);
    const skull = mesh(new THREE.SphereGeometry(0.3, 7, 6), mat('#6b5142'));
    head.add(skull);
    const snout = mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.32, 6), mat('#a88b74'));
    snout.rotation.z = -Math.PI / 2;
    snout.position.set(0.34, -0.05, 0);
    head.add(snout);
    for (const s of [-1, 1]) {
      const tusk = mesh(new THREE.ConeGeometry(0.05, 0.3, 4), mat('#f0e4c4'));
      tusk.position.set(0.35, -0.15, s * 0.13);
      tusk.rotation.x = s * 0.3;
      head.add(tusk);
    }
    g.add(head);
    u.head = head;
    for (const [x, z] of [[-0.3, -0.22], [-0.3, 0.22], [0.28, -0.22], [0.28, 0.22]]) {
      const leg = new THREE.Group();
      const l = mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.48, 5), mat('#4b372b'));
      l.position.y = -0.24;
      leg.add(l);
      leg.position.set(x, 0.48, z);
      g.add(leg);
      u.legs.push(leg);
    }
  } else if (type === 'bandit' || type === 'skeleton') {
    const isSkel = type === 'skeleton';
    const primary = isSkel ? '#d8d4be' : '#6f3438';
    const h = createHumanoid({
      skin: isSkel ? '#d8d4be' : '#d2a074', hair: isSkel ? '#c8c4ae' : '#2b211d',
      primary, secondary: isSkel ? '#a8a48e' : '#3c2528', accent: isSkel ? '#72808a' : '#9b3f45',
      weapon: isSkel ? 'hammer' : 'daggers', shoes: '#2d2823'
    });
    g.add(h);
    u.humanoid = h;
    const eye = mesh(new THREE.SphereGeometry(0.05, 5, 4), new THREE.MeshBasicMaterial({ color: isSkel ? '#6ff4e8' : '#ffb35c' }), false);
    eye.position.set(0, 2.15, 0.27);
    g.add(eye);
  } else if (type === 'golem') {
    const body = mesh(new THREE.BoxGeometry(1.1, 1.5, 0.8), mat('#6e6d62'));
    body.position.y = 1.2;
    g.add(body);
    const head = mesh(new THREE.BoxGeometry(0.62, 0.58, 0.62), mat('#7d7c70'));
    head.position.y = 2.2;
    g.add(head);
    const core = mesh(new THREE.SphereGeometry(0.17, 6, 5), new THREE.MeshBasicMaterial({ color: '#79e1d7' }), false);
    core.position.set(0, 1.35, 0.42);
    g.add(core);
    u.core = core;
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      const a = mesh(new THREE.BoxGeometry(0.36, 1.3, 0.36), mat('#5f5e55'));
      a.position.y = -0.55;
      arm.add(a);
      arm.position.set(s * 0.75, 1.85, 0);
      g.add(arm);
      u.arms.push(arm);
      const leg = new THREE.Group();
      const l = mesh(new THREE.BoxGeometry(0.4, 1.1, 0.44), mat('#5f5e55'));
      l.position.y = -0.5;
      leg.add(l);
      leg.position.set(s * 0.27, 0.95, 0);
      g.add(leg);
      u.legs.push(leg);
    }
  } else if (type === 'boss') {
    const body = mesh(new THREE.CylinderGeometry(1.6, 2.1, 3.2, 8), mat('#5d6d72'));
    body.position.y = 2.4;
    body.rotation.z = Math.PI / 2;
    g.add(body);
    const head = new THREE.Group();
    head.position.set(2.6, 3.2, 0);
    const skull = mesh(new THREE.BoxGeometry(1.7, 1.1, 1.2), mat('#7c9095'));
    head.add(skull);
    const snout = mesh(new THREE.BoxGeometry(1.1, 0.55, 0.75), mat('#697c81'));
    snout.position.set(1.1, -0.18, 0);
    head.add(snout);
    for (const s of [-1, 1]) {
      const horn = mesh(new THREE.ConeGeometry(0.18, 1.1, 5), mat('#c9b26e'));
      horn.position.set(-0.4, 0.8, s * 0.5);
      horn.rotation.z = s * 0.2;
      head.add(horn);
      const eye = mesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshBasicMaterial({ color: '#8ffcf1' }), false);
      eye.position.set(0.55, 0.16, s * 0.43);
      head.add(eye);
    }
    g.add(head);
    const core = mesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshBasicMaterial({ color: '#78efe4' }), false);
    core.position.set(0, 2.6, 0);
    g.add(core);
    u.core = core;
    for (const s of [-1, 1]) {
      const wing = new THREE.Group();
      const w = mesh(new THREE.BoxGeometry(3.2, 0.14, 1.8), mat('#4b5c61'));
      w.position.x = -1.4;
      wing.add(w);
      wing.position.set(0, 3.2, s * 0.9);
      wing.rotation.y = s * 0.2;
      g.add(wing);
      u.wings.push(wing);
    }
    const tail = mesh(new THREE.ConeGeometry(0.45, 3.6, 6), mat('#53666b'));
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-3.2, 2.1, 0);
    g.add(tail);
    u.head = head;
  }
  g.userData = { ...g.userData, ...u };
  return g;
}

export function animateEnemy(g, opts) {
  const u = g.userData;
  const t = opts.time || 0;
  if (u.humanoid) {
    animateHumanoid(u.humanoid, { ...opts, weapon: 'daggers' });
    const swing = opts.moving ? Math.sin(t * 9) * 0.55 : 0;
    u.humanoid.userData.legL.rotation.x = swing;
    u.humanoid.userData.legR.rotation.x = -swing;
  }
  u.legs.forEach((leg, i) => { leg.rotation.x = opts.moving ? Math.sin(t * 8 + i * 1.5) * 0.5 : 0; });
  u.arms.forEach((arm, i) => { arm.rotation.x = opts.moving ? Math.sin(t * 6 + i) * 0.25 : 0; });
  u.wings.forEach((wing, i) => { wing.rotation.z = (i % 2 ? -1 : 1) * (0.2 + Math.sin(t * 2.5) * 0.18); });
  if (u.core) u.core.material.color.setHex(opts.angry ? 0xff7b58 : 0x79e1d7);
  if (u.head) u.head.rotation.y = Math.sin(t * 1.4) * 0.08;
  if (u.type === 'slime') g.scale.y = 0.9 + Math.sin(t * 5) * 0.08;
  if (u.type === 'boss') g.position.y = (opts.baseY || 0) + Math.sin(t * 1.6) * 0.12;
}

export function makeLabel(text, color = '#ffe6b0', size = 40) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 96;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 256, 96);
  ctx.font = `bold ${size}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(6,14,18,0.72)';
  ctx.fillRect(18, 22, 220, 52);
  ctx.strokeStyle = 'rgba(255,221,148,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 22, 220, 52);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 51);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(2.6, 0.98, 1);
  return sprite;
}

export function makeHealthBar(color = '#6ee38c') {
  const group = new THREE.Group();
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#1a2228', transparent: true, opacity: 0.75, depthWrite: false }));
  bg.scale.set(1.4, 0.12, 1);
  group.add(bg);
  const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color, transparent: true, depthWrite: false }));
  fill.scale.set(1.36, 0.08, 1);
  fill.position.z = 0.01;
  group.add(fill);
  group.userData.fill = fill;
  return group;
}
