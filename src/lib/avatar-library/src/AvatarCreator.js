/**
 * AvatarCreator.js
 * Top-level component — the single entry point for embedding the
 * full avatar creation experience into any web page.
 *
 * Usage:
 *   import { AvatarCreator } from 'avatar-library';
 *   const creator = new AvatarCreator(document.getElementById('avatar-root'));
 *
 * The component creates a three-column layout:
 *   Left  — Body controls (skin tone, shape, muscle, height, gender)
 *            + Facial features (eyes, nose, ears, mouth)
 *   Centre — Three.js 3D viewport
 *   Right  — Wardrobe (hair, hats, glasses, jewelry, tops, footwear)
 */

import { AvatarEngine }   from './core/AvatarEngine.js';
import { FaceBuilder }    from './core/FaceBuilder.js';
import { SkinTonePicker } from './controls/SkinTonePicker.js';
import { BodyControls }   from './controls/BodyControls.js';
import { FacePicker }     from './controls/FacePicker.js';
import { WardrobePanel }  from './ui/WardrobePanel.js';

export class AvatarCreator {
  /**
   * @param {HTMLElement} rootEl   Container element (should have explicit width/height)
   * @param {object}      options  Optional configuration
   */
  constructor(rootEl, options = {}) {
    this.rootEl  = rootEl;
    this.options = options;
    this._buildDOM();
    this._initEngine();
    this._initFace();
    this._initControls();
    this._initViewportOverlays();
  }

  // ─── DOM scaffold ─────────────────────────────────────────────────────────

  _buildDOM() {
    this.rootEl.classList.add('avl-root');

    this.rootEl.innerHTML = `
      <div class="avl-layout">
        <div class="avl-panel-left"  id="avl-panel-left"></div>
        <div class="avl-viewport"    id="avl-viewport"></div>
        <div class="avl-panel-right" id="avl-panel-right"></div>
      </div>
    `;

    this._leftPanel    = this.rootEl.querySelector('#avl-panel-left');
    this._viewport     = this.rootEl.querySelector('#avl-viewport');
    this._rightPanel   = this.rootEl.querySelector('#avl-panel-right');
  }

  // ─── Engine ───────────────────────────────────────────────────────────────

  _initEngine() {
    this.engine = new AvatarEngine(this._viewport, this.options.engine || {});
  }

  // ─── Face ─────────────────────────────────────────────────────────────────

  _initFace() {
    this.faceBuilder = new FaceBuilder(this.engine.scene, {
      skinColor: this.engine.avatarState.skinTone,
    });

    // Keep face skin in sync with body skin
    this.engine.on('skinToneChanged', hex => {
      this.faceBuilder.setSkinColor(hex);
    });
  }

  // ─── Controls ─────────────────────────────────────────────────────────────

  _initControls() {
    // ── Left panel ──────────────────────────────────────────────────────────

    // Skin tone picker
    const skinSection = document.createElement('div');
    this._leftPanel.appendChild(skinSection);
    this.skinPicker = new SkinTonePicker(skinSection, this.engine);

    // Body controls
    const bodySection = document.createElement('div');
    this._leftPanel.appendChild(bodySection);
    this.bodyControls = new BodyControls(bodySection, this.engine);

    // Divider
    const divider = document.createElement('hr');
    divider.style.cssText = 'border:none;border-top:1px solid #2a2a4a;margin:4px 0';
    this._leftPanel.appendChild(divider);

    // Face picker
    const faceSection = document.createElement('div');
    this._leftPanel.appendChild(faceSection);
    this.facePicker = new FacePicker(faceSection, this.faceBuilder);

    // ── Right panel ─────────────────────────────────────────────────────────

    this.wardrobePanel = new WardrobePanel(this._rightPanel, this.engine);
  }

  // ─── Viewport overlays ────────────────────────────────────────────────────

  _initViewportOverlays() {
    // Camera focus buttons
    const controls = document.createElement('div');
    controls.className = 'avl-viewport-controls';

    ['full', 'face', 'torso', 'legs', 'feet'].forEach(region => {
      const btn = document.createElement('button');
      btn.className = 'avl-focus-btn';
      btn.textContent = region.charAt(0).toUpperCase() + region.slice(1);
      btn.addEventListener('click', () => this.engine.focusRegion(region));
      controls.appendChild(btn);
    });

    this._viewport.appendChild(controls);

    // Save / export button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'avl-save-btn';
    saveBtn.textContent = '💾 Save Avatar';
    saveBtn.addEventListener('click', () => this._handleSave());
    this._viewport.appendChild(saveBtn);
  }

  _handleSave() {
    const state = {
      ...this.engine.getState(),
      face: this.faceBuilder.getState(),
    };
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'avatar.json'; a.click();
    URL.revokeObjectURL(url);
    this.engine.emit('avatarSaved', state);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /** Load a previously saved avatar state */
  async loadState(state) {
    await this.engine.loadState(state);
    if (state.face) this.faceBuilder.loadState(state.face);
    this.skinPicker.setValue(state.skinTone);
    this.bodyControls.loadState(state);
    this.wardrobePanel.refresh();
    this.facePicker.refresh();
  }

  /**
   * Clear all wearables and restore body, face, and sliders to factory defaults
   * (same as a fresh mount).
   */
  async resetToDefaults() {
    const slots = Object.keys(this.engine.attachmentManager.attached);
    for (const slot of slots) {
      this.engine.remove(slot);
    }
    await this.loadState({
      skinTone: '#C68642',
      bodyShape: 'average',
      muscleTone: 0.5,
      height: 1.75,
      gender: 'neutral',
      attachments: {},
      face: {
        skinColor: '#C68642',
        eyeId: 'eye-almond',
        irisColor: '#5B8DB8',
        noseId: 'nose-straight',
        earId: 'ear-average',
        mouthId: 'mouth-neutral',
        lipColor: '#C0726A',
      },
    });
    this.engine.focusRegion('full');
  }

  /** Get the current full avatar state (body + face + wardrobe) */
  getState() {
    return {
      ...this.engine.getState(),
      face: this.faceBuilder.getState(),
    };
  }

  /** Export avatar state as JSON string */
  exportJSON() {
    return JSON.stringify(this.getState(), null, 2);
  }

  /** Listen to avatar events */
  on(event, fn) {
    this.engine.on(event, fn);
    return this;
  }

  /** Destroy and clean up */
  destroy() {
    this.engine.destroy();
    this.faceBuilder.destroy();
    this.rootEl.innerHTML = '';
  }
}

// ─── Named exports for individual components ──────────────────────────────────

export { AvatarEngine }   from './core/AvatarEngine.js';
export { BodyMesh }       from './core/BodyMesh.js';
export { FaceBuilder }    from './core/FaceBuilder.js';
export { AttachmentManager } from './core/AttachmentManager.js';
export { SkinTonePicker, SKIN_TONES } from './controls/SkinTonePicker.js';
export { BodyControls, BODY_SHAPES }  from './controls/BodyControls.js';
export { FacePicker }     from './controls/FacePicker.js';
export { WardrobePanel }  from './ui/WardrobePanel.js';
export { AssetRegistry, SLOTS } from './assets/AssetRegistry.js';
export { EYE_LIBRARY, EYE_COLORS }   from './assets/eyes/EyeAssets.js';
export { NOSE_LIBRARY }              from './assets/nose/NoseAssets.js';
export { EAR_LIBRARY }               from './assets/ears/EarAssets.js';
export { MOUTH_LIBRARY, LIP_COLORS } from './assets/mouths/MouthAssets.js';
export { HAIR_LIBRARY, HAIR_COLORS } from './assets/hair/HairAssets.js';
export { HAT_LIBRARY }               from './assets/hats/HatAssets.js';
export { GLASSES_LIBRARY, SUNGLASSES_LIBRARY } from './assets/glasses/GlassesAssets.js';
export { JEWELRY_LIBRARY }           from './assets/jewelry/JewelryAssets.js';
export { SHIRT_LIBRARY, JACKET_LIBRARY } from './assets/shirts/ShirtAssets.js';
export { SNEAKER_LIBRARY, SHOES_LIBRARY, BOOTS_LIBRARY } from './assets/shoes/ShoeAssets.js';
