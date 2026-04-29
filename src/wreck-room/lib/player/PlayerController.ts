import * as THREE from "three";
import type { RoomEnvironment } from "../room/RoomEnvironment";

export interface PlayerPosition {
  x: number;
  y: number;
  z: number;
}

export class PlayerController {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private room: RoomEnvironment;

  position = new THREE.Vector3(0, 0, 5);
  rotation = 0;
  velocity = new THREE.Vector3();
  speed = 5;

  private keys: Record<string, boolean> = {};
  private targetPosition: THREE.Vector3 | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private cameraOffset = new THREE.Vector3(0, 5, 8);
  private cameraTarget = new THREE.Vector3();

  animState: "idle" | "walk" | "talk" | "dance" | "wave" | "sit" = "idle";

  private onMoveCallback?: (pos: PlayerPosition, rot: number, anim: string) => void;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    room: RoomEnvironment
  ) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.room = room;
    this.bindEvents();
  }

  private bindEvents() {
    window.addEventListener("keydown", e => { this.keys[e.code] = true; });
    window.addEventListener("keyup",   e => { this.keys[e.code] = false; });

    this.renderer.domElement.addEventListener("click", e => {
      this.handleClick(e);
    });
  }

  private handleClick(e: MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Cast against floor plane
    const target = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.floorPlane, target)) {
      const half = this.room.floorSize / 2 - 1;
      target.x = Math.max(-half, Math.min(half, target.x));
      target.z = Math.max(-half, Math.min(half, target.z));
      this.targetPosition = target;
    }
  }

  onMove(cb: (pos: PlayerPosition, rot: number, anim: string) => void) {
    this.onMoveCallback = cb;
  }

  update(delta: number) {
    const prev = this.position.clone();
    let moved = false;

    // WASD movement
    const dir = new THREE.Vector3();
    if (this.keys["KeyW"] || this.keys["ArrowUp"])    dir.z -= 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"])  dir.z += 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"])  dir.x -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) dir.x += 1;

    if (dir.lengthSq() > 0) {
      dir.normalize();
      this.targetPosition = null; // cancel click-to-move
      const move = dir.clone().multiplyScalar(this.speed * delta);
      this.position.add(move);
      this.rotation = Math.atan2(dir.x, dir.z);
      moved = true;
    }

    // Click-to-move
    if (this.targetPosition) {
      const diff = this.targetPosition.clone().sub(this.position);
      diff.y = 0;
      const dist = diff.length();
      if (dist > 0.15) {
        const step = Math.min(dist, this.speed * delta);
        const moveDir = diff.normalize().multiplyScalar(step);
        this.position.add(moveDir);
        this.rotation = Math.atan2(moveDir.x, moveDir.z);
        moved = true;
      } else {
        this.targetPosition = null;
      }
    }

    // Boundary clamp
    const half = this.room.floorSize / 2 - 0.8;
    this.position.x = Math.max(-half, Math.min(half, this.position.x));
    this.position.z = Math.max(-half, Math.min(half, this.position.z));
    this.position.y = 0;

    // Collision detection against room colliders
    const playerBox = new THREE.Box3().setFromCenterAndSize(
      this.position.clone().add(new THREE.Vector3(0, 1, 0)),
      new THREE.Vector3(0.5, 2, 0.5)
    );
    for (const collider of this.room.colliders) {
      if (playerBox.intersectsBox(collider)) {
        this.position.copy(prev);
        break;
      }
    }

    // Animation state
    this.animState = moved ? "walk" : "idle";

    // Camera follow
    const desiredCamPos = this.position.clone().add(this.cameraOffset);
    this.camera.position.lerp(desiredCamPos, 8 * delta);
    this.cameraTarget.lerp(this.position.clone().add(new THREE.Vector3(0, 1, 0)), 8 * delta);
    this.camera.lookAt(this.cameraTarget);

    // Broadcast
    if (moved && this.onMoveCallback) {
      this.onMoveCallback(
        { x: this.position.x, y: this.position.y, z: this.position.z },
        this.rotation,
        this.animState
      );
    }
  }

  setPosition(pos: PlayerPosition) {
    this.position.set(pos.x, pos.y, pos.z);
  }

  triggerEmote(emote: "dance" | "wave" | "sit") {
    this.animState = emote;
    setTimeout(() => { this.animState = "idle"; }, 3000);
  }

  dispose() {
    window.removeEventListener("keydown", () => {});
    window.removeEventListener("keyup",   () => {});
  }
}
