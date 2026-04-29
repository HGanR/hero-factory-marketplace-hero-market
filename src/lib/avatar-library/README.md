# Avatar Creator Library

A comprehensive, self-contained **3D avatar creation library** for the web, built on top of [Three.js](https://threejs.org/). Drop it into any 3D website to give users a full avatar customisation experience — no external API required.

---

## Features at a Glance

| Category | Contents |
|---|---|
| **Body** | 6 body shapes, muscle tone slider, height slider, gender toggle |
| **Skin** | 16 preset skin tones + custom hex colour picker |
| **Face** | 10 eye shapes, 10 nose shapes, 10 ear shapes, 12 mouth shapes — each with colour options |
| **Hair** | 12 hairstyles × 18 colour presets + custom colour |
| **Hats** | 10 hat styles (baseball, beanie, fedora, cowboy, top hat, snapback, bucket, visor, beret, hard hat) |
| **Eyewear** | 8 glasses + 8 sunglasses (round, square, cat-eye, aviator, wayfarer, shield, sport, mirrored…) |
| **Jewelry** | 5 necklaces, 6 earring pairs, 4 bracelets, 5 rings — gold, silver, rose gold, gems |
| **Shirts** | 10 styles (dress shirt, polo, T-shirt, V-neck, tank, turtleneck, hoodie, crop, flannel, jersey) |
| **Jackets** | 8 styles (blazer, bomber, denim, leather, puffer, varsity, trench, windbreaker) |
| **Sneakers** | 10 styles (low, high-top, runner, chunky, slip-on, basketball, skate, retro, platform…) |
| **Shoes** | 8 styles (Oxford, loafer, heel, flat, derby, mule, wedge, monk strap) |
| **Boots** | 8 styles (Chelsea, combat, cowboy, knee-high, ankle, snow, hiking, rain) |

**Total: 130+ unique 3D assets**, all procedurally generated with Three.js geometry — no external model files needed.

---

## Quick Start

### 1. Install / Copy

Copy the `avatar-library/` folder into your project, or import directly:

```html
<!-- In your HTML head -->
<link rel="stylesheet" href="path/to/avatar-library/src/ui/avatar-library.css" />

<!-- Three.js import map (or use your own bundler) -->
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/examples/jsm/controls/OrbitControls.js": "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js"
  }
}
</script>
```

### 2. Mount the Creator

```html
<div id="avatar-root" style="width:100%;height:600px;"></div>

<script type="module">
  import { AvatarCreator } from './avatar-library/src/AvatarCreator.js';

  const creator = new AvatarCreator(
    document.getElementById('avatar-root'),
    { /* options */ }
  );
</script>
```

### 3. Open the Demo

Open `demo/index.html` in a browser (via a local HTTP server, e.g. `npx serve .`).

---

## API Reference

### `new AvatarCreator(element, options?)`

Mounts the full avatar creator UI into `element`.

| Option | Type | Default | Description |
|---|---|---|---|
| `engine.backgroundColor` | `number` | `0x0f0f1a` | Three.js scene background colour |
| `engine.ambientIntensity` | `number` | `0.7` | Ambient light intensity |
| `engine.directionalIntensity` | `number` | `1.3` | Key light intensity |

#### Methods

| Method | Returns | Description |
|---|---|---|
| `getState()` | `object` | Full avatar state (body + face + wardrobe) |
| `loadState(state)` | `Promise` | Restore a previously saved state |
| `exportJSON()` | `string` | Serialise avatar to JSON |
| `on(event, fn)` | `this` | Subscribe to events |
| `destroy()` | `void` | Unmount and clean up |

#### Events

| Event | Payload | Description |
|---|---|---|
| `skinToneChanged` | `hex: string` | User changed skin tone |
| `bodyShapeChanged` | `shape: string` | User changed body shape |
| `muscleToneChanged` | `value: number` | Muscle tone slider moved |
| `heightChanged` | `value: number` | Height slider moved |
| `wearableAdded` | `{ slot, assetId }` | Item equipped |
| `wearableRemoved` | `{ slot }` | Item removed |
| `avatarSaved` | `state: object` | Save button clicked |

---

## Using Individual Modules

Every module can be imported independently:

```js
// Core engine only
import { AvatarEngine } from './avatar-library/src/core/AvatarEngine.js';

// Just the asset registry
import { AssetRegistry } from './avatar-library/src/assets/AssetRegistry.js';

// Just a specific library
import { SNEAKER_LIBRARY } from './avatar-library/src/assets/shoes/ShoeAssets.js';
import { HAIR_LIBRARY, HAIR_COLORS } from './avatar-library/src/assets/hair/HairAssets.js';
```

### `AvatarEngine`

The core Three.js engine. Manages the scene, camera, renderer, body mesh, and attachment slots.

```js
const engine = new AvatarEngine(containerEl);

engine.setSkinTone('#8B4513');
engine.setBodyShape('athletic');    // 'slim'|'average'|'athletic'|'curvy'|'plus'|'muscular'
engine.setMuscleTone(0.75);         // 0.0 – 1.0
engine.setHeight(1.05);             // scale multiplier
engine.wear('hat', 'hat-fedora');
engine.remove('hat');
engine.focusRegion('face');         // 'full'|'face'|'torso'|'legs'|'feet'
engine.getState();                  // returns full state object
```

### `FaceBuilder`

Assembles facial features onto the head mesh.

```js
const face = new FaceBuilder(scene, { skinColor: '#FDBCB4' });
face.setEyes('eye-almond', '#5C4033');
face.setNose('nose-button');
face.setEars('ear-round');
face.setMouth('mouth-full', '#C0392B');
face.getState();
```

### `AssetRegistry`

Central lookup for all 130+ assets.

```js
import { AssetRegistry } from './avatar-library/src/assets/AssetRegistry.js';

AssetRegistry.get('sneaker-chunky');          // get by ID
AssetRegistry.getBySlot('jacket');            // all jackets
AssetRegistry.getByCategory('formal');        // all formal items
AssetRegistry.search('leather');              // fuzzy search
AssetRegistry.count;                          // total asset count
```

---

## File Structure

```
avatar-library/
├── src/
│   ├── AvatarCreator.js          ← Top-level component (entry point)
│   ├── core/
│   │   ├── AvatarEngine.js       ← Three.js scene, camera, renderer
│   │   ├── BodyMesh.js           ← Procedural body with morph targets
│   │   ├── FaceBuilder.js        ← Facial feature assembler
│   │   └── AttachmentManager.js  ← Wearable slot system
│   ├── controls/
│   │   ├── SkinTonePicker.js     ← Skin tone palette UI
│   │   ├── BodyControls.js       ← Shape / muscle / height sliders
│   │   └── FacePicker.js         ← Tabbed face feature picker
│   ├── assets/
│   │   ├── AssetRegistry.js      ← Central asset registry
│   │   ├── eyes/EyeAssets.js     ← 10 eye shapes
│   │   ├── nose/NoseAssets.js    ← 10 nose shapes
│   │   ├── ears/EarAssets.js     ← 10 ear shapes
│   │   ├── mouths/MouthAssets.js ← 12 mouth shapes
│   │   ├── hair/HairAssets.js    ← 12 hairstyles
│   │   ├── hats/HatAssets.js     ← 10 hat styles
│   │   ├── glasses/GlassesAssets.js ← 8 glasses + 8 sunglasses
│   │   ├── jewelry/JewelryAssets.js ← 20 jewelry pieces
│   │   ├── shirts/ShirtAssets.js ← 10 shirts + 8 jackets
│   │   └── shoes/ShoeAssets.js   ← 10 sneakers + 8 shoes + 8 boots
│   ├── ui/
│   │   ├── WardrobePanel.js      ← Full wardrobe UI
│   │   └── avatar-library.css    ← Complete stylesheet
│   └── utils/
│       └── EventEmitter.js       ← Lightweight event bus
├── demo/
│   └── index.html                ← Live demo page
├── package.json
└── README.md
```

---

## Saving & Loading Avatars

```js
// Save to JSON
const state = creator.exportJSON();
localStorage.setItem('myAvatar', state);

// Load from JSON
const saved = JSON.parse(localStorage.getItem('myAvatar'));
creator.loadState(saved);
```

The saved state object looks like:

```json
{
  "skinTone": "#FDBCB4",
  "bodyShape": "athletic",
  "muscleTone": 0.65,
  "height": 1.0,
  "gender": "neutral",
  "attachments": {
    "hair": "hair-medium-wavy",
    "hat": null,
    "glasses": "glasses-round",
    "shirt": "shirt-tshirt",
    "jacket": "jacket-denim",
    "sneakers": "sneaker-high-top"
  },
  "face": {
    "eyes": "eye-almond",
    "eyeColor": "#5C4033",
    "nose": "nose-straight",
    "ears": "ear-round",
    "mouth": "mouth-full",
    "lipColor": "#C0392B"
  }
}
```

---

## Adding Custom Assets

Extend any library by pushing to its array before mounting:

```js
import { SHIRT_LIBRARY } from './avatar-library/src/assets/shirts/ShirtAssets.js';
import * as THREE from 'three';

SHIRT_LIBRARY.push({
  id: 'shirt-my-custom',
  label: 'My Custom Shirt',
  slot: 'shirt',
  category: 'custom',
  thumbnail: '✨',
  description: 'A custom shirt I made.',
  build: (color = '#FF00FF') => {
    const g = new THREE.Group();
    // ... your Three.js geometry here
    return g;
  },
});
```

---

## Browser Support

| Browser | Version |
|---|---|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 15+ |
| Edge | 90+ |

Requires **ES Modules** and **WebGL 2.0** support.

---

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `three` | `^0.160.0` | 3D rendering engine |
| `three/examples/jsm/controls/OrbitControls` | bundled | Camera orbit controls |

No other runtime dependencies. All assets are procedural — no external model files.

---

## License

MIT — free to use in personal and commercial projects.
