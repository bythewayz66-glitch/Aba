import * as THREE from 'three';

export function configureRenderer(renderer, { mobile = false } = {}) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.75));
}

export function createStudioEnvironment(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#173d59');
  sky.addColorStop(0.34, '#8ac6d8');
  sky.addColorStop(0.52, '#f6d8ad');
  sky.addColorStop(0.58, '#5b6d57');
  sky.addColorStop(1, '#17251f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sun = ctx.createRadialGradient(720, 120, 4, 720, 120, 190);
  sun.addColorStop(0, 'rgba(255,250,224,1)');
  sun.addColorStop(0.18, 'rgba(255,236,190,0.95)');
  sun.addColorStop(0.55, 'rgba(255,214,150,0.32)');
  sun.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const teal = ctx.createRadialGradient(250, 190, 2, 250, 190, 160);
  teal.addColorStop(0, 'rgba(120,255,240,0.7)');
  teal.addColorStop(1, 'rgba(120,255,240,0)');
  ctx.fillStyle = teal;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(texture).texture;
  pmrem.dispose();
  texture.dispose();
  return environment;
}

export function polishModel(root, { anisotropy = 8, envIntensity = 1.05 } = {}) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (object.isSkinnedMesh) object.frustumCulled = false;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      material.envMapIntensity = envIntensity;
      material.dithering = true;
      if (material.normalMap) material.normalScale?.set(1, 1);
      for (const key of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) {
        const texture = material[key];
        if (!texture) continue;
        if (key === 'map' || key === 'emissiveMap') texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = anisotropy;
        texture.needsUpdate = true;
      }
      material.needsUpdate = true;
    }
  });
}


