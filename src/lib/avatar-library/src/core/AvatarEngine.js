/**
 * AvatarEngine.js
 * Core 3D Avatar Engine — powered by Three.js
 * Provides body mesh generation, morph targets, scene setup,
 * and the primary API surface for the avatar library.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BodyMesh } from './BodyMesh.js';
import { AttachmentManager } from './AttachmentManager.js';
import { EventEmitter } from '../utils/EventEmitter.js';

export class AvatarEngine extends EventEmitter {
  /**
   * @param {HTMLElement} container  - DOM element to mount the renderer into
   * @param {object}      options    - Optional configuration overrides
   */
  constructor(container, options = {}) {
    super();

    this.container = container;
    this.options = Object.assign({
      antialias: true,
      shadows: true,
      backgroundColor: 0x1a1a2e,
      cameraFov: 45,
      cameraNear: 0.1,
      cameraFar: 100,
      cameraPosition: new THREE.Vector3(0, 1.6, 3.5),
      cameraTarget: new THREE.Vector3(0, 1.0, 0),
      ambientIntensity: 0.6,
      directionalIntensity: 1.2,
      rimIntensity: 0.4,
    }, options);

    // Avatar state
    this.avatarState = {
      skinTone: '#C68642',
      bodyShape: 'average',   // slim | average | athletic | heavy
      muscleTone: 0.5,        // 0.0 – 1.0
      height: 1.75,           // metres
      gender: 'neutral',      // neutral | masculine | feminine
      attachments: {},        // slot → asset id
    };

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initControls();
    this._initBody();
    this._initAttachments();
    this._startLoop();
    this._handleResize();
  }

  // ─── Renderer ──────────────────────────────────────────────────────────────

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.options.antialias,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = this.options.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);
  }

  // ─── Scene ─────────────────────────────────────────────────────────────────

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.options.backgroundColor);
    this.scene.fog = new THREE.FogExp2(this.options.backgroundColor, 0.035);

    // Ground plane
    const groundGeo = new THREE.CircleGeometry(4, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x16213e,
      roughness: 0.9,
      metalness: 0.1,
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Subtle grid
    const grid = new THREE.GridHelper(8, 20, 0x0f3460, 0x0f3460);
    grid.material.opacity = 0.3;
    grid.material.transparent = true;
    this.scene.add(grid);
  }

  // ─── Camera ────────────────────────────────────────────────────────────────

  _initCamera() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.camera = new THREE.PerspectiveCamera(
      this.options.cameraFov,
      w / h,
      this.options.cameraNear,
      this.options.cameraFar
    );
    this.camera.position.copy(this.options.cameraPosition);
    this.camera.lookAt(this.options.cameraTarget);
  }

  // ─── Lights ────────────────────────────────────────────────────────────────

  _initLights() {
    // Ambient
    this.ambientLight = new THREE.AmbientLight(0xffffff, this.options.ambientIntensity);
    this.scene.add(this.ambientLight);

    // Key light
    this.keyLight = new THREE.DirectionalLight(0xfff5e0, this.options.directionalIntensity);
    this.keyLight.position.set(2, 4, 3);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 0.1;
    this.keyLight.shadow.camera.far = 20;
    this.keyLight.shadow.camera.left = -3;
    this.keyLight.shadow.camera.right = 3;
    this.keyLight.shadow.camera.top = 4;
    this.keyLight.shadow.camera.bottom = -1;
    this.scene.add(this.keyLight);

    // Fill light
    this.fillLight = new THREE.DirectionalLight(0xc0d8ff, 0.5);
    this.fillLight.position.set(-3, 2, -1);
    this.scene.add(this.fillLight);

    // Rim / back light
    this.rimLight = new THREE.DirectionalLight(0x8888ff, this.options.rimIntensity);
    this.rimLight.position.set(0, 3, -4);
    this.scene.add(this.rimLight);

    // Point light for face detail
    this.faceLight = new THREE.PointLight(0xfff0d0, 0.8, 3);
    this.faceLight.position.set(0, 2.2, 1.5);
    this.scene.add(this.faceLight);
  }

  // ─── Orbit Controls ────────────────────────────────────────────────────────

  _initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.options.cameraTarget);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 8;
    this.controls.minPolarAngle = 0.2;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.controls.update();
  }

  // ─── Body ──────────────────────────────────────────────────────────────────

  _initBody() {
    this.bodyMesh = new BodyMesh(this.avatarState);
    this.scene.add(this.bodyMesh.group);
  }

  // ─── Attachment Manager ────────────────────────────────────────────────────

  _initAttachments() {
    this.attachmentManager = new AttachmentManager(this.bodyMesh, this.scene);
  }

  // ─── Render Loop ───────────────────────────────────────────────────────────

  _startLoop() {
    this._animationId = null;
    const tick = () => {
      this._animationId = requestAnimationFrame(tick);
      this.controls.update();
      this.bodyMesh.update();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  // ─── Resize Handler ────────────────────────────────────────────────────────

  _handleResize() {
    this._resizeObserver = new ResizeObserver(() => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    this._resizeObserver.observe(this.container);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set skin tone by hex colour string.
   * @param {string} hexColor  e.g. '#C68642'
   */
  setSkinTone(hexColor) {
    this.avatarState.skinTone = hexColor;
    this.bodyMesh.setSkinTone(hexColor);
    this.emit('skinToneChanged', hexColor);
  }

  /**
   * Set body shape preset.
   * @param {'slim'|'average'|'athletic'|'heavy'} shape
   */
  setBodyShape(shape) {
    const valid = ['slim', 'average', 'athletic', 'heavy'];
    if (!valid.includes(shape)) throw new Error(`Invalid body shape: ${shape}`);
    this.avatarState.bodyShape = shape;
    this.bodyMesh.setBodyShape(shape);
    this.emit('bodyShapeChanged', shape);
  }

  /**
   * Set muscle tone (0.0 = no muscle definition → 1.0 = maximum definition).
   * @param {number} value  0.0 – 1.0
   */
  setMuscleTone(value) {
    const clamped = Math.max(0, Math.min(1, value));
    this.avatarState.muscleTone = clamped;
    this.bodyMesh.setMuscleTone(clamped);
    this.emit('muscleToneChanged', clamped);
  }

  /**
   * Set avatar height in metres.
   * @param {number} metres  1.4 – 2.2
   */
  setHeight(metres) {
    const clamped = Math.max(1.4, Math.min(2.2, metres));
    this.avatarState.height = clamped;
    this.bodyMesh.setHeight(clamped);
    this.emit('heightChanged', clamped);
  }

  /**
   * Set gender morph blend.
   * @param {'neutral'|'masculine'|'feminine'} gender
   */
  setGender(gender) {
    const valid = ['neutral', 'masculine', 'feminine'];
    if (!valid.includes(gender)) throw new Error(`Invalid gender: ${gender}`);
    this.avatarState.gender = gender;
    this.bodyMesh.setGender(gender);
    this.emit('genderChanged', gender);
  }

  /**
   * Attach a wearable asset to the avatar.
   * @param {string} slot    e.g. 'hair', 'hat', 'shirt', 'shoes'
   * @param {string} assetId Asset identifier from the asset registry
   * @returns {Promise<void>}
   */
  async wear(slot, assetId) {
    await this.attachmentManager.attach(slot, assetId);
    this.avatarState.attachments[slot] = assetId;
    this.emit('attachmentChanged', { slot, assetId });
  }

  /**
   * Remove a wearable from a slot.
   * @param {string} slot
   */
  remove(slot) {
    this.attachmentManager.detach(slot);
    delete this.avatarState.attachments[slot];
    this.emit('attachmentRemoved', { slot });
  }

  /**
   * Get a snapshot of the current avatar configuration.
   * @returns {object}
   */
  getState() {
    return JSON.parse(JSON.stringify(this.avatarState));
  }

  /**
   * Restore a previously saved avatar configuration.
   * @param {object} state
   */
  async loadState(state) {
    this.setSkinTone(state.skinTone);
    this.setBodyShape(state.bodyShape);
    this.setMuscleTone(state.muscleTone);
    if (state.height) this.setHeight(state.height);
    if (state.gender) this.setGender(state.gender);
    for (const [slot, assetId] of Object.entries(state.attachments || {})) {
      await this.wear(slot, assetId);
    }
    this.emit('stateLoaded', state);
  }

  /**
   * Export avatar state as JSON string.
   * @returns {string}
   */
  exportJSON() {
    return JSON.stringify(this.getState(), null, 2);
  }

  /**
   * Focus camera on a body region.
   * @param {'full'|'face'|'torso'|'legs'|'feet'} region
   */
  focusRegion(region) {
    const targets = {
      full:  { pos: new THREE.Vector3(0, 1.6, 3.5), tgt: new THREE.Vector3(0, 1.0, 0) },
      face:  { pos: new THREE.Vector3(0, 1.85, 0.9), tgt: new THREE.Vector3(0, 1.75, 0) },
      torso: { pos: new THREE.Vector3(0, 1.3, 1.4), tgt: new THREE.Vector3(0, 1.2, 0) },
      legs:  { pos: new THREE.Vector3(0, 0.7, 1.8), tgt: new THREE.Vector3(0, 0.6, 0) },
      feet:  { pos: new THREE.Vector3(0, 0.2, 1.2), tgt: new THREE.Vector3(0, 0.1, 0) },
    };
    const t = targets[region] || targets.full;
    this._animateCameraTo(t.pos, t.tgt);
  }

  _animateCameraTo(targetPos, targetLook) {
    const startPos = this.camera.position.clone();
    const startTgt = this.controls.target.clone();
    const duration = 600;
    const start = performance.now();
    const animate = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.controls.target.lerpVectors(startTgt, targetLook, ease);
      this.controls.update();
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /**
   * Cleanly destroy the engine and release GPU resources.
   */
  destroy() {
    cancelAnimationFrame(this._animationId);
    this._resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
