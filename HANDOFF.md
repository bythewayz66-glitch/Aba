# HANDOFF — Aurora Boris Alice

Last updated: 2026-10-25

## 1. What this project is

**Aurora Boris Alice** is a browser-based, third-person medieval open-world co-op RPG built with **Vite 8.3.5 + Three.js 0.186.1**. It supports solo play, same-browser co-op, quests, combat, skills, crafting, farming, fishing, pets, mounts, and a save system.

The current visual direction is a stylized, low-poly fantasy valley with three human heroes:

- **Aurora Vale** — female star archer
- **Boris Stone** — large male iron vanguard
- **Alice Quill** — female gearblade rogue

The game is playable and buildable. The latest work focused on:

1. Replacing robot placeholders with human GLB heroes.
2. Icon-based hotbar and mobile controls.
3. A floating mobile joystick with camera-relative strafing.
4. A first-person view toggle.
5. A stronger graphics pipeline: PBR environment, soft shadows, GTAO, bloom, color grading, fog, and material normalization.

---

## 2. Quick start

```bash
npm install
npm run dev -- --port 3002
```

Open `http://localhost:3002/`.

Useful commands:

```bash
npm run check   # syntax-check every source module
npm test        # 98 smoke checks
npm run build   # production build into dist/
npm run preview # preview production build on port 3002
```

The dev server is normally kept alive in tmux:

```bash
tmux new-session -d -s aba 'npm run dev -- --port 3002'
tmux attach -t aba
```

Do not start long-lived servers with plain background `&`; use tmux or another persistent session.

---

## 3. Controls

### Desktop

| Input | Action |
| --- | --- |
| `WASD` / arrows | Move |
| `Shift` | Sprint |
| `Space` | Jump |
| Left click | Basic attack |
| Right-drag | Orbit camera |
| Mouse wheel | Zoom third-person camera |
| `Q` / `R` / `F` | Hero skills |
| `G` | Pet skill |
| `V` | Mount / dismount |
| `H` | Drink tonic |
| `E` | Interact / talk / shop / farm / fish |
| `X` | Toggle first-person / third-person |
| `I` | Inventory |
| `K` | Skills |
| `C` | Crafting |
| `P` | Pets |
| `M` | World map |
| `Tab` | Switch hero in solo/host |
| `T` | Open chat |
| `Esc` | Pause / close overlay |

### Mobile

- **Floating joystick**: touch the left **55%** of the game canvas. The joystick appears at the touch point and moves the hero camera-relative.
- **Camera**: touch and drag on the right side of the canvas.
- **Action buttons**: attack, skill, interact, pet, mount, and view toggle.
- **View button** (eye icon) toggles first-person.

### Movement semantics

- Keyboard movement is turn-to-move in third person.
- Joystick movement is **camera-relative strafing**; the hero keeps facing camera-forward while moving.
- First-person movement is also camera-relative strafing; the hero faces camera-forward so attacks and skills align with the reticle.
- Joystick and first-person use `camYaw + Math.PI` as the hero facing target.

---

## 4. Repository map

| Path | Purpose |
| --- | --- |
| `index.html` | HUD, menus, overlays, hotbar, mobile controls, help text |
| `styles.css` | Full UI, HUD, menu, responsive rules, joystick, reticle |
| `src/main.js` | App bootstrap, menu scene, hero cards, portraits, start flow |
| `src/game.js` | Main game loop, input, camera, combat, quests, UI, networking |
| `src/assets.js` | GLB loading, hero wrappers, animation setup, mounts, model fitting |
| `src/gfx.js` | Renderer config, PMREM studio environment, material polishing |
| `src/world.js` | Terrain, water, props, towns, roads, collision/height queries |
| `src/models.js` | Legacy procedural model helpers; not the primary hero path |
| `src/data.js` | Hero/enemy/pet/item/quest definitions and save key |
| `src/audio.js` | Web Audio sound effects |
| `src/util.js` | Math/noise/seed helpers |
| `tests/smoke.mjs` | Static smoke checks for data, markup, features, assets |
| `public/models/` | GLB assets and attribution sidecars |
| `dist/` | Tracked production build output |

---

## 5. Graphics pipeline

The pipeline is centralized in `src/gfx.js` and wired from `src/game.js` and `src/main.js`.

### Renderer

- WebGL renderer with antialiasing.
- `ACESFilmicToneMapping`.
- Exposure `1.15` in game, `1.2` in menu.
- `PCFShadowMap` (Three 0.186 removed `PCFSoftShadowMap`; do not reintroduce it).
- Pixel ratio:
  - Desktop: up to `1.75`.
  - Mobile/low: up to `1.25`.
- Quality tier:
  - `high` when viewport is at least `860px` wide and not coarse-pointer.
  - `low` on mobile/coarse-pointer.

### Lighting and environment

- Hemisphere light + warm directional sun + cool rim light.
- Sun shadow map `2048`, camera area `76 × 76`, `normalBias 0.02`, `radius 2`.
- Sun follows the local hero for useful shadow coverage.
- PMREM-generated studio environment from a procedural equirectangular sky:
  - warm sun highlight,
  - teal bounce,
  - ground/sky gradient.
- `scene.environment` drives PBR reflections on armor, weapons, and mounts.
- `scene.environmentIntensity` changes with daylight.
- Exponential fog is tuned by daylight:
  - roughly `0.0042` in daylight,
  - up to `~0.0066` at night.

### Post-processing

Composer order:

1. `RenderPass`
2. `GTAOPass` — high quality only
3. `UnrealBloomPass`
4. Custom color-grade `ShaderPass` (saturation, contrast, vignette)
5. `OutputPass`

Details:

- MSAA render target: `4` samples on high, `2` on low.
- GTAO settings: radius `0.28`, distance exponent `1.4`, thickness `0.8`, 16 samples, denoise enabled.
- Bloom: strength `0.48`, radius `0.6`, threshold `0.88`.
- Color grade: saturation `1.07`, contrast `1.035`, vignette `0.3`.

### Model material pipeline

`polishModel()` in `src/gfx.js` runs on every loaded GLB:

- Enables cast/receive shadows.
- Disables frustum culling for skinned meshes to avoid disappearing characters.
- Sets `envMapIntensity`.
- Enables dithering.
- Marks albedo/emissive textures as sRGB.
- Sets anisotropy `8`.
- Keeps normal maps at neutral scale.

`fitModel()` in `src/assets.js` additionally:

- Fits each model to a target height.
- Centers it on the ground.
- Clones materials so per-instance edits do not leak.
- Slightly raises roughness for a consistent look.

### Menu rendering

- Separate menu renderer/scene.
- PMREM environment.
- Key, rim, and pink fill lights.
- Real shadows on a circular platform.
- Offscreen WebGL portrait renderer per hero, composited into 2D card canvases.

---

## 6. Hero and animation pipeline

`src/assets.js` handles GLBs and animation wrappers.

### Loaded models

| Key | File | Height |
| --- | --- | --- |
| `aurora` | `aurora.glb` | 1.78 |
| `boris` | `boris.glb` | 2.08 |
| `alice` | `alice.glb` | 1.80 |
| `soldier` | `Soldier.glb` | 1.90 |
| `fox` | `Fox.glb` | 0.75 |
| `horse` | `Horse.glb` | 2.20 |
| `knight` | `Knight.glb` | 2.10 |

### Facing and idle fixes

```js
HERO_FACING = {
  alice: Math.PI,
  aurora: 0,
  boris: Math.PI
}
```

Root-motion tracks are removed for Alice and Boris:

```js
HERO_ROOT_BONE = {
  alice: 'Bip01_07',
  boris: 'Bip01_06'
}
```

Custom idle windows:

```js
HERO_IDLE_WINDOW = {
  alice: [21.5, 23.4],
  boris: [30.1, 32.3]
}
```

`makeHero()` wraps the model in a facing group so model orientation and gameplay yaw stay separate. It exposes:

```js
wrapper.userData = { mixer, actions, current, body, facing }
```

`makeSoldier()` is used for enemies and is rotated `Math.PI` to normalize forward direction.

### Attribution

Keep these files with their GLBs:

- `public/models/aurora.glb.attribution.json`
- `public/models/alice.glb.attribution.json`
- `public/models/boris.glb.attribution.json`
- `public/models/Knight.glb.attribution.json`

Do not remove attribution when replacing or optimizing models.

---

## 7. First-person view

Implemented in `src/game.js`.

- Toggle key: `X`.
- HUD button: `#btn-view`.
- Mobile button: `#mob-view`.
- Reticle: `#fpv-reticle`.

Behavior:

- Local hero model and name label are hidden in first-person.
- Local mount is hidden in first-person.
- Camera sits at eye height (`1.62`, or `2.35` when mounted).
- Camera direction is derived from `camYaw` and `camPitch`.
- Pitch range expands to `-1.1 … 1.1` in first-person.
- Subtle head bob while moving.
- Hero yaw is locked to `camYaw + Math.PI` so attacks/skills aim forward.
- Switching heroes re-applies view visibility through `applyViewMode()`.

Known limitation:

- First-person camera does **not** do wall collision; it can clip through geometry if the player backs into a wall or stands inside a structure.
- The local body/weapon is hidden, so there is no visible first-person weapon model yet.

---

## 8. Floating joystick and strafe

Implemented in `src/game.js` and `styles.css`.

- Touch on the left **55%** of the canvas calls `beginFloatingJoystick(e)`.
- Joystick base is repositioned to the touch origin.
- Base diameter is `96–100px`; stick translation is `26px`.
- Deadzone: `0.14`.
- Response exponent: `1.65`.
- Touch on the right side starts camera drag.
- `pointerup` and `pointercancel` reset the joystick and touch vector.
- `.joystick` and `.stick` use `pointer-events: none` so canvas receives touches.
- The visible joystick uses the `.floating` class while active.
- Joystick movement is camera-relative and causes strafing; hero facing is camera-forward.

Important: do not restore `pointer-events: auto` on `.joystick`; it will block the canvas-driven floating joystick.

---

## 9. UI / HUD state

- Hotbar has seven icon slots: attack, Q, R, F, pet, mount, tonic.
- Word glyphs/labels are visually hidden; text remains in the DOM for accessibility and tooltips.
- Mobile action buttons use SVG icons.
- `updateHud()` updates ARIA labels and titles.
- HUD buttons include Map, Skills, Craft, Pets, View, Sound, Menu.
- Help overlay documents movement, combat, exploration, co-op, and the new `X` view toggle.

---

## 10. Verification status

Last verified in this workspace:

- `npm run check` — passes.
- `npm test` — **98 checks passed**.
- `npm run build` — succeeds.
- Production JS bundle: **801.81 kB** (gzip ~210.96 kB).
- Vite warning: chunk larger than 500 kB. This is expected until code splitting is introduced.
- Browser checks:
  - Menu renders all three human heroes.
  - Game starts and renders.
  - Floating joystick appears at touch point.
  - Left/right joystick movement is camera-relative.
  - Joystick strafe yaw equals `camYaw + Math.PI`.
  - Right-side touch drag rotates the camera.
  - Joystick resets on pointer-up.
  - First-person view hides local hero and shows reticle.
  - First-person forward movement moves away from the camera.
  - Toggling back restores the local hero model.
  - Mobile quality tier disables GTAO.

Browser screenshots from the session were written to `/tmp` and Playwright output, not the repo. `screenshots/` is gitignored.

---

## 11. Known issues / gotchas

1. **`PCFSoftShadowMap` is removed in Three 0.186.** Use `PCFShadowMap`; the engine warns and falls back otherwise.
2. **`THREE.Clock` is deprecated.** Menu uses `THREE.Timer` now. Avoid reintroducing `Clock`.
3. **`dist/` is tracked.** Run `npm run build` after source changes if the committed build output should match. Old hashed assets are deleted by the build.
4. **`screenshots/` is gitignored.** Use `/tmp` or Playwright's output directory for verification captures.
5. **First-person camera clipping.** No wall/ceiling collision in FPV.
6. **No first-person weapon/body.** Local hero is hidden to avoid camera obstruction.
7. **GTAO is desktop-only.** Mobile uses no AO pass to keep frame time reasonable.
8. **Contact-shadow decals were tried and removed.** Flat planes clipped into sloped terrain and produced hard-edged patches; GTAO is used instead.
9. **Fox pet reads as a dark silhouette at distance.** Candidate for future material/scale polish.
10. **The bundle is large.** Three.js, GTAO, bloom, and GLB loaders dominate; dynamic imports/code splitting are the next optimization step.

---

## 12. Recommended next steps

### Graphics / assets

1. Add a proper model optimization script:
   - `gltf-transform` prune/dedup/resize textures.
   - Draco or Meshopt compression.
   - Keep attribution files alongside optimized GLBs.
2. Add per-material tuning for armor, leather, cloth, and skin:
   - metalness/roughness overrides,
   - subtle clearcoat on metal,
   - sheen on cloth if using `MeshPhysicalMaterial`.
3. Add a first-person weapon/arm model and simple camera collision.
4. Add terrain-conforming character contact shadows (decal projected onto ground) instead of flat planes.
5. Consider VSM soft shadows or a higher-resolution shadow map for hero close-ups.
6. Add quality settings UI (Low / High / Ultra) instead of viewport-only detection.

### Performance

1. Code-split the game from the menu.
2. Lazy-load GTAO/bloom or drop GTAO on low-end GPUs.
3. Add adaptive resolution based on frame time.
4. Add model LODs for NPCs/enemies at distance.

### Gameplay / UX

1. Add a visible first-person crosshair hit marker.
2. Add controller/gamepad support.
3. Add a settings overlay for view mode, sensitivity, invert-Y, and quality.
4. Add mobile FPV pitch controls and a look-sensitivity setting.

---

## 13. Current working tree notes

Recent changes include:

- New `src/gfx.js`.
- New human GLBs and attribution sidecars.
- Reworked `src/assets.js` hero pipeline.
- Floating joystick and strafe in `src/game.js`.
- First-person toggle and reticle in `src/game.js`, `index.html`, `styles.css`.
- GTAO, bloom, color grade, PMREM environment, fog tuning.
- Updated smoke tests to 98 checks.
- Rebuilt `dist/`.

No commit was created as part of this handoff. Review `git diff` and `git status` before committing.
