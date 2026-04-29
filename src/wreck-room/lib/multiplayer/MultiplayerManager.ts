import {
  ConnectionState,
  Room,
  RoomEvent,
  type RemoteParticipant,
} from "livekit-client";
import * as THREE from "three";
import { AvatarRenderer, type AvatarState } from "../avatar/AvatarRenderer";
import type { PlayerPosition } from "../player/PlayerController";

export interface RemotePlayer {
  id: string;
  username: string;
  avatarData: AvatarState;
  position: PlayerPosition;
  rotation: number;
  animation: string;
  isTalking: boolean;
  isMuted: boolean;
  renderer: AvatarRenderer;
  targetPosition: THREE.Vector3;
  targetRotation: number;
}

export interface ChatMessage {
  id: number;
  username: string;
  content: string;
  type: "chat" | "system" | "emote";
  createdAt: string;
  roomId: number;
  senderId?: string;
}

type WreckDataPayload =
  | { type: "move"; position: PlayerPosition; rotation: number; animation: string }
  | { type: "chat"; content: string; msgType?: "chat" | "emote" }
  | { type: "emote"; emote: string }
  | { type: "voice_state"; isTalking: boolean; isMuted: boolean };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function wreckRoomName(roomId: number) {
  return `wreck-${roomId}`;
}

function parseParticipantMeta(p: RemoteParticipant): { username: string; avatarData: AvatarState } {
  try {
    if (p.metadata) {
      const o = JSON.parse(p.metadata) as { username?: string; avatarData?: AvatarState };
      return {
        username: o.username || p.name || p.identity,
        avatarData: (o.avatarData ?? {}) as AvatarState,
      };
    }
  } catch {
    /* fall through */
  }
  return { username: p.name || p.identity, avatarData: {} };
}

export class MultiplayerManager {
  readonly room: Room;
  private scene: THREE.Scene;
  remotePlayers = new Map<string, RemotePlayer>();

  onPlayerJoined?: (player: RemotePlayer) => void;
  onPlayerLeft?: (id: string) => void;
  onChatMessage?: (msg: ChatMessage) => void;
  onPlayerVoiceState?: (id: string, isTalking: boolean, isMuted: boolean) => void;

  private roomId = 0;
  private participantListenersBound = false;
  private boundData = (payload: Uint8Array, participant?: RemoteParticipant) => {
    if (!participant) return;
    this.handleDataPayload(participant.identity, payload);
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.room = new Room();
    this.room.on(RoomEvent.DataReceived, this.boundData);
  }

  get socketId() {
    return this.room.localParticipant.identity;
  }

  private handleDataPayload(senderId: string, payload: Uint8Array) {
    let msg: WreckDataPayload;
    try {
      msg = JSON.parse(decoder.decode(payload)) as WreckDataPayload;
    } catch {
      return;
    }

    if (msg.type === "move") {
      const p = this.remotePlayers.get(senderId);
      if (p) {
        p.targetPosition.set(msg.position.x, msg.position.y, msg.position.z);
        p.position = { ...msg.position };
        p.targetRotation = msg.rotation;
        p.rotation = msg.rotation;
        p.animation = msg.animation;
        p.renderer.setAnimation(msg.animation as any);
      }
      return;
    }

    if (msg.type === "chat") {
      const p = this.remotePlayers.get(senderId);
      const username = p?.username ?? "Player";
      const chatMsg: ChatMessage = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        username,
        content: msg.content,
        type: (msg.msgType === "emote" ? "emote" : "chat") as "chat" | "emote",
        createdAt: new Date().toISOString(),
        roomId: this.roomId,
        senderId,
      };
      this.onChatMessage?.(chatMsg);
      if (p && chatMsg.type === "chat") p.renderer.showSpeechBubble(msg.content);
      return;
    }

    if (msg.type === "emote") {
      const p = this.remotePlayers.get(senderId);
      if (p) p.renderer.setAnimation(msg.emote as any);
      return;
    }

    if (msg.type === "voice_state") {
      const p = this.remotePlayers.get(senderId);
      if (p) {
        p.isTalking = msg.isTalking;
        p.isMuted = msg.isMuted;
        p.renderer.setTalking(msg.isTalking);
      }
      this.onPlayerVoiceState?.(senderId, msg.isTalking, msg.isMuted);
    }
  }

  private addRemoteFromParticipant(participant: RemoteParticipant) {
    const id = participant.identity;
    if (id === this.room.localParticipant.identity) return;
    if (this.remotePlayers.has(id)) return;

    const { username, avatarData } = parseParticipantMeta(participant);
    const renderer = new AvatarRenderer(avatarData);
    renderer.setNameLabel(username);
    renderer.group.position.set(0, 0, 0);
    this.scene.add(renderer.group);

    const player: RemotePlayer = {
      id,
      username,
      avatarData,
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      animation: "idle",
      isTalking: false,
      isMuted: false,
      renderer,
      targetPosition: new THREE.Vector3(0, 0, 0),
      targetRotation: 0,
    };
    this.remotePlayers.set(id, player);
    this.onPlayerJoined?.(player);
  }

  private removeRemote(id: string) {
    const p = this.remotePlayers.get(id);
    if (!p) return;
    this.scene.remove(p.renderer.group);
    p.renderer.dispose();
    this.remotePlayers.delete(id);
    this.onPlayerLeft?.(id);
  }

  private ensureParticipantListeners() {
    if (this.participantListenersBound) return;
    this.participantListenersBound = true;
    this.room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
      this.addRemoteFromParticipant(p);
    });
    this.room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
      this.removeRemote(p.identity);
    });
  }

  async joinRoom(roomId: number, username: string, avatarData: AvatarState) {
    this.roomId = roomId;
    const identity =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? `wreck-${roomId}-${crypto.randomUUID()}`
        : `wreck-${roomId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const metadata = JSON.stringify({ username, avatarData });

    const res = await fetch("/api/livekit/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomName: wreckRoomName(roomId),
        participantIdentity: identity,
        participantName: username,
        metadata,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof data.error === "string" ? data.error : `LiveKit token failed (${res.status})`
      );
    }

    const { token, serverUrl } = data as { token: string; serverUrl: string };
    if (!token || !serverUrl) {
      throw new Error("Invalid LiveKit token response");
    }

    this.ensureParticipantListeners();

    await this.room.connect(serverUrl, token, { autoSubscribe: true });

    this.room.remoteParticipants.forEach(p => this.addRemoteFromParticipant(p));
  }

  private publishData(payload: WreckDataPayload) {
    if (this.room.state !== ConnectionState.Connected) return;
    void this.room.localParticipant.publishData(encoder.encode(JSON.stringify(payload)), {
      reliable: true,
    });
  }

  sendMove(position: PlayerPosition, rotation: number, animation: string) {
    this.publishData({ type: "move", position, rotation, animation });
  }

  sendMessage(content: string, type: "chat" | "emote" = "chat") {
    this.publishData({ type: "chat", content, msgType: type });
  }

  sendVoiceState(isTalking: boolean, isMuted: boolean) {
    this.publishData({ type: "voice_state", isTalking, isMuted });
  }

  sendEmote(emote: string) {
    this.publishData({ type: "emote", emote });
  }

  update(delta: number) {
    this.remotePlayers.forEach(p => {
      p.renderer.group.position.lerp(p.targetPosition, Math.min(1, 10 * delta));
      const currentY = p.renderer.group.rotation.y;
      const diff = p.targetRotation - currentY;
      const normalizedDiff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
      p.renderer.group.rotation.y += normalizedDiff * Math.min(1, 10 * delta);
      p.renderer.update(delta);
    });
  }

  getRemotePlayerCount() {
    return this.remotePlayers.size;
  }

  getAllPlayers() {
    return Array.from(this.remotePlayers.values());
  }

  disconnect() {
    this.room.off(RoomEvent.DataReceived, this.boundData);
    this.room.disconnect();
  }
}
