import * as THREE from "three";
import { RoomEnvironment } from "./room/RoomEnvironment";
import { AvatarRenderer, type AvatarState } from "./avatar/AvatarRenderer";
import { PlayerController } from "./player/PlayerController";
import { MultiplayerManager, type ChatMessage } from "./multiplayer/MultiplayerManager";
import { VoiceManager } from "./voice/VoiceManager";

export interface SceneCallbacks {
  onChatMessage?: (msg: ChatMessage) => void;
  onPlayerCountChange?: (count: number) => void;
  onTalkingChange?: (talking: boolean) => void;
  onVoiceError?: (err: string) => void;
  onMultiplayerError?: (err: string) => void;
}

export class WreckRoomScene {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();

  private room: RoomEnvironment;
  private localAvatar: AvatarRenderer;
  private playerController: PlayerController;
  multiplayer: MultiplayerManager;
  voice: VoiceManager;

  private animFrameId = 0;
  private callbacks: SceneCallbacks;
  private lastBroadcast = 0;
  private broadcastInterval = 50; // ms

  constructor(canvas: HTMLCanvasElement, callbacks: SceneCallbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    // Scene + camera
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a14, 0.025);
    this.camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
    this.camera.position.set(0, 5, 8);

    // Room
    this.room = new RoomEnvironment(this.scene);

    // Placeholder avatar (replaced on join)
    this.localAvatar = new AvatarRenderer({});
    this.scene.add(this.localAvatar.group);

    // Player controller
    this.playerController = new PlayerController(this.scene, this.camera, this.renderer, this.room);

    // Multiplayer
    this.multiplayer = new MultiplayerManager(this.scene);
    this.multiplayer.onChatMessage = msg => callbacks.onChatMessage?.(msg);
    this.multiplayer.onPlayerJoined = () => callbacks.onPlayerCountChange?.(this.multiplayer.getRemotePlayerCount() + 1);
    this.multiplayer.onPlayerLeft = () => callbacks.onPlayerCountChange?.(this.multiplayer.getRemotePlayerCount() + 1);

    // Voice
    this.voice = new VoiceManager(this.multiplayer);
    this.voice.onTalkingChange = t => callbacks.onTalkingChange?.(t);
    this.voice.onError = e => callbacks.onVoiceError?.(e);

    // Movement broadcast
    this.playerController.onMove((pos, rot, anim) => {
      const now = Date.now();
      if (now - this.lastBroadcast > this.broadcastInterval) {
        this.multiplayer.sendMove(pos, rot, anim);
        this.lastBroadcast = now;
      }
      this.localAvatar.group.position.set(pos.x, pos.y, pos.z);
      this.localAvatar.group.rotation.y = rot;
      this.localAvatar.setAnimation(anim as any);
    });

    // Resize
    window.addEventListener("resize", this.handleResize);
    this.start();
  }

  async join(roomId: number, username: string, avatarData: AvatarState) {
    // Replace placeholder avatar with real one
    this.scene.remove(this.localAvatar.group);
    this.localAvatar.dispose();
    this.localAvatar = new AvatarRenderer(avatarData);
    this.localAvatar.setNameLabel(username);
    this.scene.add(this.localAvatar.group);

    // Spawn at a random position
    const spawnX = (Math.random() - 0.5) * 10;
    const spawnZ = (Math.random() - 0.5) * 10;
    this.playerController.setPosition({ x: spawnX, y: 0, z: spawnZ });
    this.localAvatar.group.position.set(spawnX, 0, spawnZ);

    try {
      await this.multiplayer.joinRoom(roomId, username, avatarData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.callbacks.onMultiplayerError?.(msg);
      throw e;
    }
  }

  sendChat(content: string) {
    this.multiplayer.sendMessage(content);
    this.localAvatar.showSpeechBubble(content);
    this.localAvatar.setAnimation("talk");
    setTimeout(() => this.localAvatar.setAnimation("idle"), 3000);
  }

  triggerEmote(emote: "dance" | "wave" | "sit") {
    this.playerController.triggerEmote(emote);
    this.multiplayer.sendEmote(emote);
    this.localAvatar.setAnimation(emote);
    setTimeout(() => this.localAvatar.setAnimation("idle"), 3000);
  }

  async toggleVoice() {
    if (!this.voice.isEnabled) {
      await this.voice.enable();
    } else {
      this.voice.disable();
    }
    return this.voice.isEnabled;
  }

  toggleMute() {
    return this.voice.toggleMute();
  }

  private start() {
    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate);
      const delta = Math.min(this.clock.getDelta(), 0.05);

      this.playerController.update(delta);
      this.localAvatar.update(delta);
      this.room.update(delta);
      this.multiplayer.update(delta);

      // Proximity voice
      if (this.voice.isEnabled) {
        const pos = this.playerController.position;
        this.voice.updateProximity({ x: pos.x, z: pos.z });
      }

      // Sync talking animation
      if (this.voice.isTalking && this.playerController.animState === "idle") {
        this.localAvatar.setAnimation("talk");
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  private handleResize = () => {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  getMinimapData() {
    const players: Array<{ x: number; z: number; isLocal: boolean; username: string }> = [];
    const pos = this.playerController.position;
    players.push({ x: pos.x, z: pos.z, isLocal: true, username: "You" });
    this.multiplayer.remotePlayers.forEach(p => {
      players.push({ x: p.position.x, z: p.position.z, isLocal: false, username: p.username });
    });
    return { players, roomSize: this.room.floorSize };
  }

  getPlayerCount() {
    return this.multiplayer.getRemotePlayerCount() + 1;
  }

  getPlayerAtScreenPos(x: number, y: number): { id: string } | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = (x / rect.width) * 2 - 1;
    const ndcY = -(y / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const meshes: THREE.Object3D[] = [];
    this.multiplayer.remotePlayers.forEach(p => meshes.push(p.renderer.group));
    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return null;
    const hitObj = hits[0].object;
    let found: { id: string } | null = null;
    this.multiplayer.remotePlayers.forEach((p, id) => {
      if (!found && (hitObj === p.renderer.group || p.renderer.group.getObjectById(hitObj.id) !== undefined)) {
        found = { id };
      }
    });
    return found;
  }

  applyTheme(lightingColor: string, ambiance: string) {
    this.room.applyTheme(lightingColor, ambiance);
  }

  destroy() {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener("resize", this.handleResize);
    this.voice.disable();
    this.multiplayer.disconnect();
    this.localAvatar.dispose();
    this.renderer.dispose();
  }
}
