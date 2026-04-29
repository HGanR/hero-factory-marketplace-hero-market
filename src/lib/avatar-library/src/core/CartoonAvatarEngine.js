/**
 * CartoonAvatarEngine.js — Main engine for the high-quality cartoon avatar
 *
 * Wires together:
 *   - CartoonBodyMesh (smooth humanoid body with T-pose)
 *   - CartoonHairSystem (volumetric strand-based hair)
 *   - CartoonClothingSystem (fitted body-wrapping clothing)
 *   - CartoonFaceExpressions (10 expression morphs)
 *   - Three.js scene with toon shading, rim lighting, and environment
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CartoonBodyMesh } from './CartoonBodyMesh.js';
import { CartoonHairSystem } from './CartoonHairSystem.js';
import { CartoonClothingSystem } from './CartoonClothingSystem.js';
import { applyExpression, EXPRESSION_NAMES } from './CartoonFaceExpressions.js';

export { EXPRESSION_NAMES };

export class CartoonAvatarEngine {
  constructor(container) {
    this.container = container;
    this._state = {
      skinTone:    '#E8A882',
      bodyShape:   'average',
      muscleTone:  0.5,
      gender:      'neutral',
      height:      1.75,
      hairStyle:   'wavyMedium',
      hairColor:   '#3a1a5e',
      eyeColor:    '#d4820a',
      browColor:   '#1a0e28',
      expression:  'neutral',
      outfit: {
        shirt:   { style: 'jersey',      color: '#1a1a2e', accent: '#c8b560' },
        jacket:  null,
        bottom:  { style: 'shorts',      color: '#0f0f1a', accent: '#c8b560' },
        socks:   { style: 'kneeSocks',   color: '#1a1a2e', accent: '#88ccff' },
        shoes:   { style: 'chunkyBoots', color: '#0a1a3a', accent: '#00aaff' },
      },
    };

    this._initScene();
    this._initAvatar();
    this._animate();
  }

  // ─── Scene setup ─────────────────────────────────────────────────────────────

  _initScene() {
    const w = this.container.clientWidth  || 800;
    const h = this.container.clientHeight || 600;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0d1a);
    this.scene.fog = new THREE.Fog(0x0d0d1a, 8, 20);

    // Camera
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.01, 50);
    this.camera.position.set(0, 1.1, 3.2);
    this.camera.lookAt(0, 1.0, 0);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.0;
    this.controls.maxDistance = 6.0;
    this.controls.minPolarAngle = 0.2;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.controls.update();

    // ── Lighting ──────────────────────────────────────────────────────────────

    // Ambient — low warm fill
    this.scene.add(new THREE.AmbientLight(0x1a1030, 1.2));

    // Key light — cool blue-white from front-left
    const keyLight = new THREE.DirectionalLight(0xb0c8ff, 2.8);
    keyLight.position.set(-2.5, 4.0, 3.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 12;
    keyLight.shadow.camera.left = -2;
    keyLight.shadow.camera.right = 2;
    keyLight.shadow.camera.top = 3;
    keyLight.shadow.camera.bottom = -0.5;
    keyLight.shadow.bias = -0.001;
    this.scene.add(keyLight);

    // Fill light — warm from right
    const fillLight = new THREE.DirectionalLight(0xffaa66, 1.2);
    fillLight.position.set(3.0, 2.0, 1.5);
    this.scene.add(fillLight);

    // Rim light — purple/blue from behind
    const rimLight = new THREE.DirectionalLight(0x6644cc, 1.8);
    rimLight.position.set(0, 3.0, -3.5);
    this.scene.add(rimLight);

    // Ground bounce
    const bounceLight = new THREE.PointLight(0x3322aa, 0.8, 3.0);
    bounceLight.position.set(0, 0, 0.5);
    this.scene.add(bounceLight);

    // ── Ground plane ──────────────────────────────────────────────────────────
    const groundGeo = new THREE.CircleGeometry(2.5, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x111122,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Ground glow ring
    const ringGeo = new THREE.RingGeometry(0.35, 0.55, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4422cc, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.001;
    this.scene.add(ring);

    // Resize handler
    this._onResize = () => {
      const w2 = this.container.clientWidth;
      const h2 = this.container.clientHeight;
      this.camera.aspect = w2 / h2;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w2, h2);
    };
    window.addEventListener('resize', this._onResize);
  }

  // ─── Avatar assembly ─────────────────────────────────────────────────────────

  _initAvatar() {
    this.avatarGroup = new THREE.Group();
    this.scene.add(this.avatarGroup);

    const s = this._state;

    // Body
    this.body = new CartoonBodyMesh({
      skinTone:   s.skinTone,
      bodyShape:  s.bodyShape,
      muscleTone: s.muscleTone,
      gender:     s.gender,
      topColor:   s.outfit.shirt?.color || '#1a1a2e',
      botColor:   s.outfit.bottom?.color || '#0f0f1a',
    });
    this.avatarGroup.add(this.body.group);

    // Hair
    this.hair = new CartoonHairSystem();
    this.hair.setStyle(s.hairStyle, s.hairColor);
    this.avatarGroup.add(this.hair.group);

    // Clothing
    this.clothing = new CartoonClothingSystem();
    if (s.outfit.shirt)  this.clothing.equip('shirt',  s.outfit.shirt.style,  s.outfit.shirt.color,  s.outfit.shirt.accent);
    if (s.outfit.jacket) this.clothing.equip('jacket', s.outfit.jacket.style, s.outfit.jacket.color, s.outfit.jacket.accent);
    if (s.outfit.bottom) this.clothing.equip('bottom', s.outfit.bottom.style, s.outfit.bottom.color, s.outfit.bottom.accent);
    if (s.outfit.socks)  this.clothing.equip('socks',  s.outfit.socks.style,  s.outfit.socks.color,  s.outfit.socks.accent);
    if (s.outfit.shoes)  this.clothing.equip('shoes',  s.outfit.shoes.style,  s.outfit.shoes.color,  s.outfit.shoes.accent);
    this.clothing.getAllGroups().forEach(g => this.avatarGroup.add(g));

    // Apply eye / brow colors
    if (this.body.cartoonHead) {
      this.body.cartoonHead.setEyeColor(s.eyeColor);
      this.body.cartoonHead.setBrowColor(s.browColor);
    }

    // Apply expression
    if (s.expression !== 'neutral' && this.body.cartoonHead) {
      applyExpression(this.body.cartoonHead, s.expression);
    }

    // Height
    this.body.setHeight(s.height);
  }

  // ─── Render loop ─────────────────────────────────────────────────────────────

  _animate() {
    this._rafId = requestAnimationFrame(() => this._animate());
    this.controls.update();
    if (this.body) this.body.update();
    this.renderer.render(this.scene, this.camera);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  setSkinTone(hex) {
    this._state.skinTone = hex;
    this.body?.setSkinTone(hex);
  }

  setBodyShape(shape) {
    this._state.bodyShape = shape;
    this.body?.setBodyShape(shape);
  }

  setMuscleTone(v) {
    this._state.muscleTone = v;
    this.body?.setMuscleTone(v);
  }

  setGender(g) {
    this._state.gender = g;
    this.body?.setGender(g);
  }

  setHeight(metres) {
    this._state.height = metres;
    this.body?.setHeight(metres);
  }

  setHairStyle(style, color) {
    this._state.hairStyle = style;
    if (color) this._state.hairColor = color;
    this.hair?.setStyle(style, this._state.hairColor);
  }

  setHairColor(hex) {
    this._state.hairColor = hex;
    this.hair?.setColor(hex);
  }

  setEyeColor(hex) {
    this._state.eyeColor = hex;
    this.body?.cartoonHead?.setEyeColor(hex);
  }

  setBrowColor(hex) {
    this._state.browColor = hex;
    this.body?.cartoonHead?.setBrowColor(hex);
  }

  setExpression(name, blend = 1.0) {
    this._state.expression = name;
    if (this.body?.cartoonHead) {
      applyExpression(this.body.cartoonHead, name, blend);
    }
  }

  equipClothing(slot, style, primaryColor, accentColor) {
    this._state.outfit[slot] = { style, color: primaryColor, accent: accentColor };
    this.clothing?.equip(slot, style, primaryColor, accentColor);
  }

  unequipClothing(slot) {
    this._state.outfit[slot] = null;
    this.clothing?.unequip(slot);
  }

  /** Focus camera on a body region */
  focusCamera(region) {
    const targets = {
      full:   { pos: [0, 1.1, 3.2], target: [0, 1.0, 0] },
      face:   { pos: [0, 1.72, 1.2], target: [0, 1.68, 0] },
      torso:  { pos: [0, 1.2, 1.8], target: [0, 1.15, 0] },
      legs:   { pos: [0, 0.55, 1.8], target: [0, 0.55, 0] },
      feet:   { pos: [0, 0.15, 1.2], target: [0, 0.10, 0] },
    };
    const t = targets[region] || targets.full;
    this.camera.position.set(...t.pos);
    this.controls.target.set(...t.target);
    this.controls.update();
  }

  /** Serialize full avatar state to JSON */
  serialize() {
    return JSON.parse(JSON.stringify(this._state));
  }

  /** Load avatar state from JSON */
  load(state) {
    // Destroy current avatar
    this.avatarGroup.traverse(o => {
      if (o.isMesh) { o.geometry?.dispose(); o.material?.dispose(); }
    });
    while (this.avatarGroup.children.length) this.avatarGroup.remove(this.avatarGroup.children[0]);

    this._state = { ...this._state, ...state };
    this._initAvatar();
  }

  /** Clean up */
  dispose() {
    cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize', this._onResize);
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
