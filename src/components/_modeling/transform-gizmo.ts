import * as THREE from "three";

export type GizmoMode = "translate" | "rotate" | "scale";

/**
 * Transform Gizmo with Ground Collision
 * Allows moving, rotating, and scaling objects with visual feedback.
 *
 * Based on: /Users/apple/Desktop/transform-gizmo.ts
 * Fixes:
 * - Correct typing for renderer (WebGLRenderer)
 * - Fix ground constraint math
 * - Fix rotate delta (track previous mouse)
 * - Make keyboard shortcuts work (canvas focus handled by caller)
 */
export class TransformGizmo {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private object: THREE.Object3D | null = null;
  private mode: GizmoMode = "translate";
  private gizmoGroup: THREE.Group;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private isDragging = false;
  private dragPlane: THREE.Plane;
  private groundLevel = 0;
  private selectedAxis: "x" | "y" | "z" | null = null;
  private gizmoScale = 1;
  private lastMouse: { x: number; y: number } | null = null;

  // Optional callback when a drag completes (mouse up)
  private onTransformEnd?: (obj: THREE.Object3D) => void;

  private materials = {
    x: new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.5,
    }),
    y: new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.5,
    }),
    z: new THREE.MeshStandardMaterial({
      color: 0x0000ff,
      emissive: 0x0000ff,
      emissiveIntensity: 0.5,
    }),
    hover: new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 0.8,
    }),
  };

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    groundLevel = 0,
    opts?: { onTransformEnd?: (obj: THREE.Object3D) => void }
  ) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.groundLevel = groundLevel;
    this.gizmoGroup = new THREE.Group();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.onTransformEnd = opts?.onTransformEnd;

    this.scene.add(this.gizmoGroup);
    this.setupEventListeners();
  }

  private setupEventListeners() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    canvas.addEventListener("mouseup", () => this.onMouseUp());
    canvas.addEventListener("mouseleave", () => this.onMouseUp());
  }

  private updateMouseFromEvent(event: MouseEvent) {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    this.mouse.x = x * 2 - 1;
    this.mouse.y = -(y * 2 - 1);
    this.raycaster.setFromCamera(this.mouse, this.camera);
  }

  private onMouseMove(event: MouseEvent) {
    this.updateMouseFromEvent(event);
    if (this.isDragging && this.object) {
      this.handleDrag(event);
    } else {
      this.updateHover();
    }
  }

  private onMouseDown(event: MouseEvent) {
    if (!this.object) return;

    this.updateMouseFromEvent(event);
    const intersects = this.raycaster.intersectObjects(this.gizmoGroup.children, true);
    if (intersects.length === 0) return;

    this.isDragging = true;
    this.lastMouse = { x: this.mouse.x, y: this.mouse.y };

    const intersected = intersects[0].object as THREE.Mesh;
    const axis = intersected.userData.axis as "x" | "y" | "z" | undefined;
    this.selectedAxis = axis ?? null;
    if (!this.selectedAxis) return;

    // Set a drag plane oriented so movement feels stable for each axis
    if (this.mode === "translate") {
      if (this.selectedAxis === "x") {
        this.dragPlane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(0, 1, 1).normalize(),
          this.object.position
        );
      } else if (this.selectedAxis === "y") {
        this.dragPlane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(1, 0, 1).normalize(),
          this.object.position
        );
      } else if (this.selectedAxis === "z") {
        this.dragPlane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(1, 1, 0).normalize(),
          this.object.position
        );
      }
    }
  }

  private onMouseUp() {
    const wasDragging = this.isDragging;
    this.isDragging = false;
    this.selectedAxis = null;
    this.lastMouse = null;
    if (wasDragging && this.object) this.onTransformEnd?.(this.object);
  }

  private handleDrag(event: MouseEvent) {
    if (!this.object || !this.selectedAxis) return;

    // Always keep gizmo positioned at object
    this.gizmoGroup.position.copy(this.object.position);

    if (this.mode === "translate") {
      const intersection = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
      if (this.selectedAxis === "x") {
        this.object.position.x = intersection.x;
      } else if (this.selectedAxis === "y") {
        this.object.position.y = Math.max(this.groundLevel, intersection.y);
      } else if (this.selectedAxis === "z") {
        this.object.position.z = intersection.z;
      }
      constrainToGround(this.object, this.groundLevel);
    } else if (this.mode === "rotate") {
      if (!this.lastMouse) this.lastMouse = { x: this.mouse.x, y: this.mouse.y };
      const dx = this.mouse.x - this.lastMouse.x;
      const dy = this.mouse.y - this.lastMouse.y;
      const delta = dx - dy;
      const speed = 2.5;
      if (this.selectedAxis === "x") this.object.rotation.x += delta * speed;
      if (this.selectedAxis === "y") this.object.rotation.y += delta * speed;
      if (this.selectedAxis === "z") this.object.rotation.z += delta * speed;
      this.lastMouse = { x: this.mouse.x, y: this.mouse.y };
    } else if (this.mode === "scale") {
      if (!this.lastMouse) this.lastMouse = { x: this.mouse.x, y: this.mouse.y };
      const dy = this.mouse.y - this.lastMouse.y;
      const scaleFactor = 1 + dy * 2.0;
      const clamp = (v: number) => Math.max(0.1, Math.min(20, v));
      if (this.selectedAxis === "x") this.object.scale.x = clamp(this.object.scale.x * scaleFactor);
      if (this.selectedAxis === "y") this.object.scale.y = clamp(this.object.scale.y * scaleFactor);
      if (this.selectedAxis === "z") this.object.scale.z = clamp(this.object.scale.z * scaleFactor);
      this.lastMouse = { x: this.mouse.x, y: this.mouse.y };
      constrainToGround(this.object, this.groundLevel);
    }
  }

  private updateHover() {
    const intersects = this.raycaster.intersectObjects(this.gizmoGroup.children, true);

    // Reset materials
    this.gizmoGroup.traverse((child) => {
      if (!(child as any).isMesh) return;
      const mesh = child as THREE.Mesh;
      const axis = mesh.userData.axis as "x" | "y" | "z" | undefined;
      if (axis === "x") mesh.material = this.materials.x;
      if (axis === "y") mesh.material = this.materials.y;
      if (axis === "z") mesh.material = this.materials.z;
    });

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      mesh.material = this.materials.hover;
    }
  }

  public setObject(object: THREE.Object3D | null) {
    this.object = object;
    this.updateGizmo();
  }

  public setMode(mode: GizmoMode) {
    this.mode = mode;
    this.updateGizmo();
  }

  public setGroundLevel(level: number) {
    this.groundLevel = level;
  }

  public setOnTransformEnd(cb?: (obj: THREE.Object3D) => void) {
    this.onTransformEnd = cb;
  }

  private updateGizmo() {
    this.gizmoGroup.clear();
    if (!this.object) return;

    const distance = this.camera.position.distanceTo(this.object.position);
    this.gizmoScale = Math.max(0.5, distance * 0.1);

    if (this.mode === "translate") this.createTranslateGizmo();
    else if (this.mode === "rotate") this.createRotateGizmo();
    else this.createScaleGizmo();

    this.gizmoGroup.position.copy(this.object.position);
  }

  private createTranslateGizmo() {
    const axisRadius = 0.08 * this.gizmoScale;
    const axisLength = this.gizmoScale;
    // X
    const xGeom = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8);
    const xMesh = new THREE.Mesh(xGeom, this.materials.x);
    xMesh.rotation.z = Math.PI / 2;
    xMesh.position.x = axisLength / 2;
    xMesh.userData.axis = "x";
    this.gizmoGroup.add(xMesh);
    // Y
    const yGeom = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8);
    const yMesh = new THREE.Mesh(yGeom, this.materials.y);
    yMesh.position.y = axisLength / 2;
    yMesh.userData.axis = "y";
    this.gizmoGroup.add(yMesh);
    // Z
    const zGeom = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8);
    const zMesh = new THREE.Mesh(zGeom, this.materials.z);
    zMesh.rotation.x = Math.PI / 2;
    zMesh.position.z = axisLength / 2;
    zMesh.userData.axis = "z";
    this.gizmoGroup.add(zMesh);
  }

  private createRotateGizmo() {
    const r = this.gizmoScale * 0.7;
    const t = 0.06 * this.gizmoScale;
    // X
    const xGeom = new THREE.TorusGeometry(r, t, 8, 48);
    const xMesh = new THREE.Mesh(xGeom, this.materials.x);
    xMesh.rotation.y = Math.PI / 2;
    xMesh.userData.axis = "x";
    this.gizmoGroup.add(xMesh);
    // Y
    const yGeom = new THREE.TorusGeometry(r, t, 8, 48);
    const yMesh = new THREE.Mesh(yGeom, this.materials.y);
    yMesh.rotation.x = Math.PI / 2;
    yMesh.userData.axis = "y";
    this.gizmoGroup.add(yMesh);
    // Z
    const zGeom = new THREE.TorusGeometry(r, t, 8, 48);
    const zMesh = new THREE.Mesh(zGeom, this.materials.z);
    zMesh.userData.axis = "z";
    this.gizmoGroup.add(zMesh);
  }

  private createScaleGizmo() {
    const axis = this.gizmoScale;
    const thickness = 0.12 * this.gizmoScale;
    // X
    const xGeom = new THREE.BoxGeometry(axis, thickness, thickness);
    const xMesh = new THREE.Mesh(xGeom, this.materials.x);
    xMesh.position.x = axis / 2;
    xMesh.userData.axis = "x";
    this.gizmoGroup.add(xMesh);
    // Y
    const yGeom = new THREE.BoxGeometry(thickness, axis, thickness);
    const yMesh = new THREE.Mesh(yGeom, this.materials.y);
    yMesh.position.y = axis / 2;
    yMesh.userData.axis = "y";
    this.gizmoGroup.add(yMesh);
    // Z
    const zGeom = new THREE.BoxGeometry(thickness, thickness, axis);
    const zMesh = new THREE.Mesh(zGeom, this.materials.z);
    zMesh.position.z = axis / 2;
    zMesh.userData.axis = "z";
    this.gizmoGroup.add(zMesh);
  }

  public dispose() {
    this.gizmoGroup.clear();
    Object.values(this.materials).forEach((m) => m.dispose());
  }
}

/**
 * Ground collision constraint: prevents objects from going below ground.
 */
export function constrainToGround(object: THREE.Object3D, groundLevel = 0): void {
  const boundingBox = new THREE.Box3().setFromObject(object);
  const bottomY = boundingBox.min.y;
  if (bottomY < groundLevel) object.position.y += groundLevel - bottomY;
}

export function isObjectAboveGround(object: THREE.Object3D, groundLevel = 0): boolean {
  const boundingBox = new THREE.Box3().setFromObject(object);
  return boundingBox.min.y >= groundLevel;
}


