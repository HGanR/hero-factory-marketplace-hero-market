/**
 * CartoonAvatarStudio.js — Full 3D avatar modeling studio
 *
 * Wires together:
 * - CartoonHead3D  — sculpted cartoon head
 * - CartoonBody3D  — smooth humanoid body
 * - CartoonHair3D  — volumetric strand hair
 * - CartoonClothing3D — fitted body-wrapping clothing
 *
 * Scene features:
 * - MeshToonMaterial throughout for stylized cartoon look
 * - Three-point lighting (key, fill, rim) matching reference style
 * - Gradient background (dark blue like reference)
 * - OrbitControls for 360° inspection
 * - Auto-rotate idle animation
 * - Breathing animation on torso
 * - Camera presets (full body, face, torso, feet)
 * - Export to JSON avatar format
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CartoonHead3D } from './CartoonHead3D.js';
import { CartoonBody3D } from './CartoonBody3D.js';
import { CartoonHair3D } from './CartoonHair3D.js';
import { CartoonClothing3D } from './CartoonClothing3D.js';
import { ChibiCreature3D } from './ChibiCreature3D.js';
import { ChibiAccessories3D } from './ChibiAccessories3D.js';

export class CartoonAvatarStudio {
  constructor(container) {
    this.container = container;
    this._avatarType = 'humanoid'; // 'humanoid' | 'chibi'
    this._config = {
      skinTone:    '#f4c5a0',
      eyeColor:    '#d4820a',
      lipColor:    '#c05050',
      hairColor:   '#4a35c8',
      hairStyle:   'longWavy',
      // chibi-specific
      chibiBodyColor: '#e85a10',
      chibiEyeColor:  '#111111',
      chibiEarStyle:  'round',
      chibiHasTail:   true,
      bodyShape:   'average',
      muscleTone:  0.5,
      gender:      0.5,
      height:      1.75,
      shirt:       { style: 'jersey',     color: '#1a2a6c', accent: '#c8a800' },
      jacket:      null,
      bottom:      { style: 'shorts',     color: '#1a2a6c', accent: '#c8a800' },
      socks:       { style: 'kneeHigh',   color: '#1a2a6c', accent: '#88ccff' },
      footwear:    { style: 'chunkyBoots', color: '#0a0a1a', accent: '#c8a800' },
    };

    this._autoRotate = true;
    this._cameraView = 'full';
    this._onChangeCallbacks = [];

    this._initScene();
    this._initLights();
    this._initBackground();
    this._initAvatar();
    this._initControls();
    this._startRender();
    this._handleResize();
  }

  // ── Scene setup ────────────────────────────────────────────────────────────

  _initScene() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.08);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
    this.camera.position.set(0, 0.5, 2.8);
    this.camera.lookAt(0, 0.3, 0);

    this.clock = new THREE.Clock();
  }

  _initLights() {
    // Ambient — soft blue-tinted fill
    const ambient = new THREE.AmbientLight(0x2a3060, 1.8);
    this.scene.add(ambient);

    // Key light — warm from upper-left front (matches reference)
    const key = new THREE.DirectionalLight(0xfff5e0, 3.5);
    key.position.set(-2.5, 4.0, 3.0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -2;
    key.shadow.camera.right = 2;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.001;
    this.scene.add(key);

    // Fill light — cool blue from right
    const fill = new THREE.DirectionalLight(0x6080ff, 1.4);
    fill.position.set(3.0, 1.5, 1.5);
    this.scene.add(fill);

    // Rim light — strong backlight for cartoon outline effect
    const rim = new THREE.DirectionalLight(0x4060ff, 2.2);
    rim.position.set(0, 2.0, -3.5);
    this.scene.add(rim);

    // Ground bounce — warm uplight
    const bounce = new THREE.DirectionalLight(0xff8844, 0.6);
    bounce.position.set(0, -2.0, 1.0);
    this.scene.add(bounce);

    // Floor shadow catcher
    const floorGeo = new THREE.CircleGeometry(1.5, 32);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.05;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Subtle ground glow disc
    const glowGeo = new THREE.CircleGeometry(0.8, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x2244aa,
      transparent: true,
      opacity: 0.18,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -1.04;
    this.scene.add(glow);
  }

  _initBackground() {
    // Dark gradient background matching reference images
    const bgGeo = new THREE.SphereGeometry(50, 16, 8);
    const bgMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor:    { value: new THREE.Color(0x080818) },
        bottomColor: { value: new THREE.Color(0x0a1030) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vPos;
        void main() {
          float t = clamp((vPos.y + 10.0) / 20.0, 0.0, 1.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(bgGeo, bgMat));
  }

    // ── Avatar assembly ────────────────────────────────────────────────────────
  _initAvatar() {
    this.avatarGroup = new THREE.Group();
    this.scene.add(this.avatarGroup);
    this._buildHumanoid();
  }

  _buildHumanoid() {
    // Body
    this.body = new CartoonBody3D(this._config.skinTone);
    this.avatarGroup.add(this.body.group);
    // Head — positioned on top of neck
    this.head = new CartoonHead3D(this._config.skinTone);
    this.head.group.position.set(0, 0.530, 0);
    this.avatarGroup.add(this.head.group);
    // Hair
    this.hair = new CartoonHair3D();
    this.hair.setColor(this._config.hairColor);
    this.hair.setStyle(this._config.hairStyle);
    this.hair.group.position.set(0, 0.530, 0);
    this.avatarGroup.add(this.hair.group);

    // Clothing — parent to torso so it inherits shape + idle breathing scale
    this.clothing = new CartoonClothing3D();
    if (this.body?.parts?.torso) {
      this.body.parts.torso.add(this.clothing.group);
    } else {
      this.avatarGroup.add(this.clothing.group);
    }

    // Apply default outfit
    const c = this._config;
    if (c.shirt)    this.clothing.equip('shirt',    c.shirt.style,    c.shirt.color,    c.shirt.accent);
    if (c.jacket)   this.clothing.equip('jacket',   c.jacket.style,   c.jacket.color,   c.jacket.accent);
    if (c.bottom)   this.clothing.equip('bottom',   c.bottom.style,   c.bottom.color,   c.bottom.accent);
    if (c.socks)    this.clothing.equip('socks',    c.socks.style,    c.socks.color,    c.socks.accent);
    if (c.footwear) this.clothing.equip('footwear', c.footwear.style, c.footwear.color, c.footwear.accent);

    // Center avatar vertically
    this.avatarGroup.position.y = -0.15;

    // Height scales the whole figure (body + head + hair), not the body mesh alone
    this.setHeight(this._config.height ?? 1.75);
  }

  _initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 6.0;
    this.controls.minPolarAngle = 0.1;
    this.controls.maxPolarAngle = Math.PI * 0.88;
    this.controls.target.set(0, 0.3, 0);
    this.controls.autoRotate = this._autoRotate;
    this.controls.autoRotateSpeed = 1.2;
    this.controls.update();
  }

  _buildChibi() {
    this.chibi = new ChibiCreature3D(this._config.chibiBodyColor);
    this.chibi.setEyeColor(this._config.chibiEyeColor);
    this.chibi.setEarStyle(this._config.chibiEarStyle);
    this.chibi.setHasTail(this._config.chibiHasTail);
    // Scale chibi to fill similar screen space as humanoid
    this.chibi.group.scale.setScalar(1.55);
    this.chibi.group.position.set(0, -0.18, 0);
    this.avatarGroup.add(this.chibi.group);
    this.chibiAccessories = new ChibiAccessories3D();
  }

  _clearAvatar() {
    // Detach clothing before body teardown (clothing is parented under torso mesh)
    if (this.clothing && this.body?.parts?.torso && this.clothing.group.parent === this.body.parts.torso) {
      this.body.parts.torso.remove(this.clothing.group);
    }
    // Remove all children from avatarGroup
    while (this.avatarGroup.children.length > 0) {
      const child = this.avatarGroup.children[0];
      this.avatarGroup.remove(child);
    }
    // Dispose humanoid parts
    if (this.clothing) { this.clothing.dispose(); this.clothing = null; }
    if (this.head)     { this.head.dispose();     this.head = null; }
    if (this.body)     { this.body.dispose();     this.body = null; }
    if (this.hair)     { this.hair.dispose();     this.hair = null; }
    // Dispose chibi parts
    if (this.chibi)    { this.chibi.dispose();    this.chibi = null; }
    this._chibiHat = null;
    this._chibiGlasses = null;
  }

  /** Switch between 'humanoid' and 'chibi' avatar types */
  setAvatarType(type) {
    if (type === this._avatarType) return;
    this._avatarType = type;
    this._clearAvatar();
    if (type === 'humanoid') {
      this._buildHumanoid();
      this.setCameraView(this._cameraView || 'full');
    } else {
      this._buildChibi();
      // Chibi camera — slightly closer, lower angle
      this.camera.position.set(0, 0.25, 2.4);
      this.controls.target.set(0, 0.10, 0);
      this.controls.update();
    }
    this._emit('avatarType', type);
  }

  // ── Chibi-specific API ─────────────────────────────────────────────────────
  setChibiBodyColor(hex) {
    this._config.chibiBodyColor = hex;
    if (this.chibi) this.chibi.setBodyColor(hex);
    this._emit('chibiBodyColor', hex);
  }

  setChibiEyeColor(hex) {
    this._config.chibiEyeColor = hex;
    if (this.chibi) this.chibi.setEyeColor(hex);
    this._emit('chibiEyeColor', hex);
  }

  setChibiEarStyle(style) {
    this._config.chibiEarStyle = style;
    if (this.chibi) this.chibi.setEarStyle(style);
    this._emit('chibiEarStyle', style);
  }

  setChibiHasTail(v) {
    this._config.chibiHasTail = v;
    if (this.chibi) this.chibi.setHasTail(v);
    this._emit('chibiHasTail', v);
  }

  equipChibiHat(style, color = '#222266', accent = '#ffffff') {
    if (!this.chibi || !this.chibiAccessories) return;
    // Remove old hat
    if (this._chibiHat) {
      this.chibi.group.remove(this._chibiHat);
      this._chibiHat = null;
    }
    if (style === 'none') return;
    const hat = this.chibiAccessories.buildHat(style, color, accent);
    if (!hat) return;
    const ap = this.chibi.getAttachPoint('hat');
    // Adjust for chibi scale (group is scaled 1.55)
    hat.position.copy(ap);
    this.chibi.group.add(hat);
    this._chibiHat = hat;
    this._emit('chibiHat', { style, color, accent });
  }

  equipChibiGlasses(style, frameColor = '#222222', lensColor = '#88ccff') {
    if (!this.chibi || !this.chibiAccessories) return;
    if (this._chibiGlasses) {
      this.chibi.group.remove(this._chibiGlasses);
      this._chibiGlasses = null;
    }
    if (style === 'none') return;
    const glasses = this.chibiAccessories.buildGlasses(style, frameColor, lensColor);
    if (!glasses) return;
    const ap = this.chibi.getAttachPoint('glasses');
    glasses.position.copy(ap);
    this.chibi.group.add(glasses);
    this._chibiGlasses = glasses;
    this._emit('chibiGlasses', { style, frameColor, lensColor });
  }

  // ── Render loop ────────────────────────────────────────────────────────────

  setChibiChubby(v) {
    this._config.chibiChubby = v;
    if (this.chibi) this.chibi.setChubby(v);
    this._emit('chibiChubby', v);
  }

  setChibiShowBelly(v) {
    this._config.chibiShowBelly = v;
    if (this.chibi) this.chibi.setShowBelly(v);
    this._emit('chibiShowBelly', v);
  }

  equipChibiNecklace(style, color = '#c8a800') {
    if (!this.chibi || !this.chibiAccessories) return;
    if (this._chibiNecklace) {
      this.chibi.group.remove(this._chibiNecklace);
      this._chibiNecklace = null;
    }
    if (style === 'none') return;
    const necklace = this.chibiAccessories.buildNecklace(style, color);
    if (!necklace) return;
    const ap = this.chibi.getAttachPoint('necklace');
    necklace.position.copy(ap);
    this.chibi.group.add(necklace);
    this._chibiNecklace = necklace;
    this._emit('chibiNecklace', { style, color });
  }

  _startRender() {
    this._rafId = requestAnimationFrame(() => this._loop());
  }

  _loop() {
    this._rafId = requestAnimationFrame(() => this._loop());
    const t = this.clock.getElapsedTime();

    // Humanoid: idle breathing + head bob (preserve shape-driven torso depth)
    if (this.body?.parts?.torso) {
      const breathe = 1 + Math.sin(t * 0.9) * 0.006;
      const baseZ = this.body._torsoBaseZ ?? 0.72;
      this.body.parts.torso.scale.z = baseZ * breathe;
    }
    if (this.head?.group) {
      this.head.group.position.y = 0.530 + Math.sin(t * 0.9) * 0.003;
      if (this.hair?.group) this.hair.group.position.y = this.head.group.position.y;
    }
    // Chibi: bouncy idle animation
    if (this.chibi?.group) {
      const bounce = Math.abs(Math.sin(t * 1.4)) * 0.018;
      this.chibi.group.position.y = -0.18 + bounce;
      // Slight squash-and-stretch on bounce
      const squash = 1 - bounce * 0.8;
      const stretch = 1 + bounce * 0.5;
      this.chibi.group.scale.set(1.55 * squash, 1.55 * stretch, 1.55 * squash);
      // Gentle sway
       this.chibi.group.rotation.z = Math.sin(t * 0.7) * 0.025;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  _handleResize() {
    const ro = new ResizeObserver(() => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    ro.observe(this.container);
    this._ro = ro;
  }

  // ── Camera presets ─────────────────────────────────────────────────────────

  setCameraView(view) {
    this._cameraView = view;
    const views = {
      full:   { pos: [0, 0.5, 2.8], target: [0, 0.3, 0] },
      face:   { pos: [0, 0.82, 0.90], target: [0, 0.78, 0] },
      torso:  { pos: [0, 0.40, 1.60], target: [0, 0.30, 0] },
      legs:   { pos: [0, -0.30, 1.80], target: [0, -0.40, 0] },
      feet:   { pos: [0, -0.70, 1.20], target: [0, -0.80, 0] },
    };
    const v = views[view] || views.full;
    this.camera.position.set(...v.pos);
    this.controls.target.set(...v.target);
    this.controls.update();
  }

  setAutoRotate(on) {
    this._autoRotate = on;
    this.controls.autoRotate = on;
  }

  // ── Customization API ──────────────────────────────────────────────────────

  setSkinTone(hex) {
    this._config.skinTone = hex;
    if (this.head?.setSkinTone) this.head.setSkinTone(hex);
    if (this.body?.setSkinTone) this.body.setSkinTone(hex);
    this._emit('skinTone', hex);
  }

  setEyeColor(hex) {
    this._config.eyeColor = hex;
    if (this.head?.setEyeColor) this.head.setEyeColor(hex);
    this._emit('eyeColor', hex);
  }

  setLipColor(hex) {
    this._config.lipColor = hex;
    if (this.head?.setLipColor) this.head.setLipColor(hex);
    this._emit('lipColor', hex);
  }

  setHairColor(hex) {
    this._config.hairColor = hex;
    if (this.hair?.setColor) this.hair.setColor(hex);
    this._emit('hairColor', hex);
  }

  setHairStyle(style) {
    this._config.hairStyle = style;
    if (this.hair?.setStyle) this.hair.setStyle(style);
    this._emit('hairStyle', style);
  }

  setBodyShape(shape) {
    this._config.bodyShape = shape;
    if (this.body?.setBodyShape) this.body.setBodyShape(shape);
    this._emit('bodyShape', shape);
  }

  setMuscleTone(v) {
    this._config.muscleTone = v;
    if (this.body?.setMuscleTone) this.body.setMuscleTone(v);
    this._emit('muscleTone', v);
  }

  setGender(g) {
    this._config.gender = g;
    if (this.body?.setGender) this.body.setGender(g);
    this._emit('gender', g);
  }

  /**
   * Overall height: scale the full avatar (head, hair, body, clothing) together.
   * Clothing is parented to torso so it follows body-shape scaling; height is applied here on avatarGroup only.
   */
  setHeight(metres) {
    this._config.height = metres;
    const s = metres / 1.75;
    if (this.avatarGroup) {
      this.avatarGroup.scale.setScalar(s);
    }
    this._emit('height', metres);
  }

  setShirt(value) {
    this._config.shirt = value;
    if (!this.clothing) return;
    if (value) this.equipItem('shirt', value.style, value.color, value.accent);
    else this.unequipItem('shirt');
  }

  setJacket(value) {
    this._config.jacket = value;
    if (!this.clothing) return;
    if (value) this.equipItem('jacket', value.style, value.color, value.accent);
    else this.unequipItem('jacket');
  }

  setBottom(value) {
    this._config.bottom = value;
    if (!this.clothing) return;
    if (value) this.equipItem('bottom', value.style, value.color, value.accent);
    else this.unequipItem('bottom');
  }

  setSocks(value) {
    this._config.socks = value;
    if (!this.clothing) return;
    if (value) this.equipItem('socks', value.style, value.color, value.accent);
    else this.unequipItem('socks');
  }

  setFootwear(value) {
    this._config.footwear = value;
    if (!this.clothing) return;
    if (value) this.equipItem('footwear', value.style, value.color, value.accent);
    else this.unequipItem('footwear');
  }

  refresh() {
    if (this.controls) this.controls.update();
  }

  equipItem(slot, style, color, accent) {
    this._config[slot] = { style, color, accent };
    if (this.clothing?.equip) this.clothing.equip(slot, style, color, accent);
    this._emit('equip', { slot, style, color, accent });
  }

  unequipItem(slot) {
    this._config[slot] = null;
    if (this.clothing?.unequip) this.clothing.unequip(slot);
    this._emit('unequip', slot);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  onChange(cb) {
    this._onChangeCallbacks.push(cb);
  }

  _emit(type, data) {
    this._onChangeCallbacks.forEach(cb => cb({ type, data, config: this._config }));
  }

  // ── Export / Import ────────────────────────────────────────────────────────

  exportConfig() {
    return JSON.parse(JSON.stringify(this._config));
  }

  importConfig(cfg) {
    if (cfg.skinTone)   this.setSkinTone(cfg.skinTone);
    if (cfg.eyeColor)   this.setEyeColor(cfg.eyeColor);
    if (cfg.lipColor)   this.setLipColor(cfg.lipColor);
    if (cfg.hairColor)  this.setHairColor(cfg.hairColor);
    if (cfg.hairStyle)  this.setHairStyle(cfg.hairStyle);
    if (cfg.bodyShape)  this.setBodyShape(cfg.bodyShape);
    if (cfg.muscleTone !== undefined) this.setMuscleTone(cfg.muscleTone);
    if (cfg.gender !== undefined)     this.setGender(cfg.gender);
    if (cfg.height)     this.setHeight(cfg.height);
    ['shirt', 'jacket', 'bottom', 'socks', 'footwear'].forEach(slot => {
      if (cfg[slot]) this.equipItem(slot, cfg[slot].style, cfg[slot].color, cfg[slot].accent);
      else this.unequipItem(slot);
    });
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  dispose() {
    if (this._rafId != null) cancelAnimationFrame(this._rafId);
    this._rafId = undefined;
    this._ro?.disconnect();
    this._ro = undefined;
    if (this.controls) {
      this.controls.dispose();
      this.controls = undefined;
    }
    if (this.clothing && this.body?.parts?.torso && this.clothing.group.parent === this.body.parts.torso) {
      this.body.parts.torso.remove(this.clothing.group);
    }
    if (this.clothing) { this.clothing.dispose(); this.clothing = undefined; }
    if (this.head)     { this.head.dispose();     this.head = undefined; }
    if (this.body)     { this.body.dispose();     this.body = undefined; }
    if (this.hair)     { this.hair.dispose();     this.hair = undefined; }
    if (this.chibi)    { this.chibi.dispose();    this.chibi = undefined; }
    if (this.renderer) {
      this.renderer.dispose();
      const el = this.renderer.domElement;
      if (el?.parentNode) el.parentNode.removeChild(el);
      this.renderer = undefined;
    }
  }
}
