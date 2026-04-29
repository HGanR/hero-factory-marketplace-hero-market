/**
 * FaceBuilder.js
 * Assembles and manages all facial features on the avatar head:
 *   - Eyes (shape + iris colour)
 *   - Nose (shape)
 *   - Ears (shape)
 *   - Mouth (shape + lip colour)
 *
 * All features are positioned relative to the head centre (y = 1.72).
 * Provides a clean API for swapping individual features at runtime.
 */

import * as THREE from 'three';
import { EYE_LIBRARY }   from '../assets/eyes/EyeAssets.js';
import { NOSE_LIBRARY }  from '../assets/nose/NoseAssets.js';
import { EAR_LIBRARY }   from '../assets/ears/EarAssets.js';
import { MOUTH_LIBRARY } from '../assets/mouths/MouthAssets.js';

// ─── Facial anchor positions (relative to head centre at y=1.72) ─────────────

const FACE_ANCHORS = {
  eyes:  new THREE.Vector3(0,  0.025,  0.095),
  nose:  new THREE.Vector3(0, -0.018,  0.100),
  ears:  new THREE.Vector3(0,  0.000,  0.000),   // ears position themselves
  mouth: new THREE.Vector3(0, -0.055,  0.090),
};

const HEAD_Y = 1.72;

export class FaceBuilder {
  /**
   * @param {THREE.Scene} scene
   * @param {object} initialState
   * @param {string} initialState.skinColor
   * @param {string} initialState.eyeId
   * @param {string} initialState.irisColor
   * @param {string} initialState.noseId
   * @param {string} initialState.earId
   * @param {string} initialState.mouthId
   * @param {string} initialState.lipColor
   */
  constructor(scene, initialState = {}) {
    this.scene = scene;
    this.state = Object.assign({
      skinColor:  '#C68642',
      eyeId:      'eye-almond',
      irisColor:  '#5B8DB8',
      noseId:     'nose-straight',
      earId:      'ear-average',
      mouthId:    'mouth-neutral',
      lipColor:   '#C0726A',
    }, initialState);

    this._mounted = {};   // feature name → Three.js Object3D
    this._buildAll();
  }

  // ─── Build all features ────────────────────────────────────────────────────

  _buildAll() {
    this.setEyes(this.state.eyeId, this.state.irisColor);
    this.setNose(this.state.noseId);
    this.setEars(this.state.earId);
    this.setMouth(this.state.mouthId, this.state.lipColor);
  }

  // ─── Eyes ──────────────────────────────────────────────────────────────────

  /**
   * @param {string} eyeId
   * @param {string} irisColor  hex
   */
  setEyes(eyeId, irisColor) {
    this._remove('eyes');
    const def = EYE_LIBRARY.find(e => e.id === eyeId);
    if (!def) { console.warn(`[FaceBuilder] Unknown eye: ${eyeId}`); return; }

    const obj = def.build(irisColor || this.state.irisColor, this.state.skinColor);
    this._place(obj, 'eyes', FACE_ANCHORS.eyes);
    this.state.eyeId = eyeId;
    if (irisColor) this.state.irisColor = irisColor;
  }

  /** Change only the iris colour without rebuilding the eye shape */
  setIrisColor(irisColor) {
    this.state.irisColor = irisColor;
    this.setEyes(this.state.eyeId, irisColor);
  }

  // ─── Nose ──────────────────────────────────────────────────────────────────

  setNose(noseId) {
    this._remove('nose');
    const def = NOSE_LIBRARY.find(n => n.id === noseId);
    if (!def) { console.warn(`[FaceBuilder] Unknown nose: ${noseId}`); return; }

    const obj = def.build(this.state.skinColor);
    this._place(obj, 'nose', FACE_ANCHORS.nose);
    this.state.noseId = noseId;
  }

  // ─── Ears ──────────────────────────────────────────────────────────────────

  setEars(earId) {
    this._remove('ears');
    const def = EAR_LIBRARY.find(e => e.id === earId);
    if (!def) { console.warn(`[FaceBuilder] Unknown ear: ${earId}`); return; }

    // Ears position themselves absolutely (they include head-relative coords)
    const obj = def.build(this.state.skinColor);
    obj.position.y = HEAD_Y + FACE_ANCHORS.ears.y;
    this.scene.add(obj);
    this._mounted['ears'] = obj;
    this.state.earId = earId;
  }

  // ─── Mouth ─────────────────────────────────────────────────────────────────

  setMouth(mouthId, lipColor) {
    this._remove('mouth');
    const def = MOUTH_LIBRARY.find(m => m.id === mouthId);
    if (!def) { console.warn(`[FaceBuilder] Unknown mouth: ${mouthId}`); return; }

    const obj = def.build(lipColor || this.state.lipColor, this.state.skinColor);
    this._place(obj, 'mouth', FACE_ANCHORS.mouth);
    this.state.mouthId = mouthId;
    if (lipColor) this.state.lipColor = lipColor;
  }

  /** Change only the lip colour without rebuilding the mouth shape */
  setLipColor(lipColor) {
    this.state.lipColor = lipColor;
    this.setMouth(this.state.mouthId, lipColor);
  }

  // ─── Skin tone update (rebuilds all features) ──────────────────────────────

  setSkinColor(hex) {
    this.state.skinColor = hex;
    this._buildAll();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  _place(obj, name, anchor) {
    obj.position.set(
      anchor.x,
      HEAD_Y + anchor.y,
      anchor.z
    );
    this.scene.add(obj);
    this._mounted[name] = obj;
  }

  _remove(name) {
    if (this._mounted[name]) {
      this.scene.remove(this._mounted[name]);
      this._disposeObj(this._mounted[name]);
      delete this._mounted[name];
    }
  }

  _disposeObj(obj) {
    obj.traverse(child => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material?.dispose();
      }
    });
  }

  // ─── State ─────────────────────────────────────────────────────────────────

  getState() {
    return { ...this.state };
  }

  loadState(state) {
    this.state = { ...this.state, ...state };
    this._buildAll();
  }

  destroy() {
    Object.keys(this._mounted).forEach(k => this._remove(k));
  }
}
