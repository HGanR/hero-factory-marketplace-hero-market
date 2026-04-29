/**
 * AttachmentManager.js
 * Manages attaching and detaching 3D wearable assets to avatar slots.
 * Handles loading, positioning, scaling, and cleanup of all attachments.
 */

import * as THREE from 'three';
import { AssetRegistry } from '../assets/AssetRegistry.js';

// Slot configuration: offset from attach point, rotation, scale multiplier
const SLOT_CONFIG = {
  hair:       { offset: [0,  0.01, 0],   rotation: [0, 0, 0],            scale: 1.0 },
  hat:        { offset: [0,  0.03, 0],   rotation: [0, 0, 0],            scale: 1.0 },
  glasses:    { offset: [0,  0,    0.01], rotation: [0, 0, 0],           scale: 1.0 },
  sunglasses: { offset: [0,  0,    0.01], rotation: [0, 0, 0],           scale: 1.0 },
  earringL:   { offset: [0,  0,    0],   rotation: [0, 0, 0],            scale: 1.0 },
  earringR:   { offset: [0,  0,    0],   rotation: [0, 0, 0],            scale: 1.0 },
  necklace:   { offset: [0, -0.02, 0.02], rotation: [0, 0, 0],           scale: 1.0 },
  braceletL:  { offset: [0,  0,    0],   rotation: [0, 0, 0],            scale: 1.0 },
  braceletR:  { offset: [0,  0,    0],   rotation: [0, 0, 0],            scale: 1.0 },
  ring:       { offset: [0,  0,    0],   rotation: [0, 0, 0],            scale: 1.0 },
  shirt:      { offset: [0,  0,    0],   rotation: [0, 0, 0],            scale: 1.0 },
  jacket:     { offset: [0,  0,    0],   rotation: [0, 0, 0],            scale: 1.0 },
  pants:      { offset: [0,  0,    0],   rotation: [0, 0, 0],            scale: 1.0 },
  shoes:      { offset: [0,  0,    0],   rotation: [0, 0, 0],            scale: 1.0 },
  sneakers:   { offset: [0,  0,    0],   rotation: [0, 0, 0],            scale: 1.0 },
  boots:      { offset: [0,  0,    0],   rotation: [0, 0, 0],            scale: 1.0 },
};

export class AttachmentManager {
  /**
   * @param {BodyMesh} bodyMesh
   * @param {THREE.Scene} scene
   */
  constructor(bodyMesh, scene) {
    this.bodyMesh = bodyMesh;
    this.scene = scene;
    this.attached = {};   // slot → { mesh, assetId }
  }

  /**
   * Attach an asset to a slot. Replaces any existing attachment in that slot.
   * @param {string} slot
   * @param {string} assetId
   * @returns {Promise<void>}
   */
  async attach(slot, assetId) {
    // Remove existing
    this.detach(slot);

    const asset = AssetRegistry.get(assetId);
    if (!asset) {
      console.warn(`[AttachmentManager] Unknown asset: ${assetId}`);
      return;
    }

    // Build the 3D mesh from the asset definition
    const mesh = await this._buildMesh(asset);
    if (!mesh) return;

    // Position it
    const attachPoint = this.bodyMesh.getAttachPoint(slot);
    const cfg = SLOT_CONFIG[slot] || { offset: [0,0,0], rotation: [0,0,0], scale: 1.0 };

    mesh.position.set(
      attachPoint.x + cfg.offset[0],
      attachPoint.y + cfg.offset[1],
      attachPoint.z + cfg.offset[2]
    );
    mesh.rotation.set(cfg.rotation[0], cfg.rotation[1], cfg.rotation[2]);
    mesh.scale.setScalar(cfg.scale);

    this.scene.add(mesh);
    this.attached[slot] = { mesh, assetId };
  }

  /**
   * Remove attachment from a slot.
   * @param {string} slot
   */
  detach(slot) {
    if (this.attached[slot]) {
      this.scene.remove(this.attached[slot].mesh);
      this._disposeMesh(this.attached[slot].mesh);
      delete this.attached[slot];
    }
  }

  /**
   * Remove all attachments.
   */
  detachAll() {
    for (const slot of Object.keys(this.attached)) {
      this.detach(slot);
    }
  }

  /**
   * Build a Three.js mesh from an asset definition.
   * Assets define their geometry via a factory function.
   * @param {object} asset
   * @returns {THREE.Object3D}
   */
  async _buildMesh(asset) {
    try {
      const obj = await asset.build();
      obj.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      return obj;
    } catch (err) {
      console.error(`[AttachmentManager] Failed to build asset:`, err);
      return null;
    }
  }

  _disposeMesh(obj) {
    obj.traverse(child => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
  }
}
