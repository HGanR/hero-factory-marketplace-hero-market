import {
  RoomEvent,
  Track,
  type LocalTrackPublication,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";
import type { MultiplayerManager } from "../multiplayer/MultiplayerManager";

interface RemoteAudioHandle {
  peerId: string;
  gainNode: GainNode;
}

const PROXIMITY_MAX_DIST = 15;
const PROXIMITY_MIN_DIST = 2;

export class VoiceManager {
  private multiplayer: MultiplayerManager;
  private audioCtx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private remote = new Map<string, RemoteAudioHandle>();
  private talkingThreshold = 20;

  private onTrackSubscribed = (
    track: RemoteTrack,
    _publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => {
    if (participant.identity === this.multiplayer.room.localParticipant.identity) return;
    if (track.kind !== Track.Kind.Audio) return;
    this.attachRemoteAudio(participant.identity, track);
  };

  private onTrackUnsubscribed = (
    track: RemoteTrack,
    _publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => {
    if (track.kind !== Track.Kind.Audio) return;
    this.detachRemote(participant.identity);
  };

  private onParticipantDisconnected = (participant: RemoteParticipant) => {
    this.detachRemote(participant.identity);
  };

  isMuted = false;
  isEnabled = false;
  isTalking = false;

  onTalkingChange?: (talking: boolean) => void;
  onError?: (err: string) => void;

  constructor(multiplayer: MultiplayerManager) {
    this.multiplayer = multiplayer;
  }

  private attachRemoteAudio(peerId: string, track: RemoteTrack) {
    if (!this.audioCtx) return;
    this.detachRemote(peerId);

    const stream = new MediaStream([track.mediaStreamTrack]);
    const source = this.audioCtx.createMediaStreamSource(stream);
    const gainNode = this.audioCtx.createGain();
    gainNode.gain.value = 1;
    source.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    this.remote.set(peerId, { peerId, gainNode });
  }

  private detachRemote(peerId: string) {
    const h = this.remote.get(peerId);
    if (!h) return;
    try {
      h.gainNode.disconnect();
    } catch {
      /* ignore */
    }
    this.remote.delete(peerId);
  }

  private wireRoomListeners(room: typeof this.multiplayer.room) {
    room.on(RoomEvent.TrackSubscribed, this.onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribed);
    room.on(RoomEvent.ParticipantDisconnected, this.onParticipantDisconnected);

    room.remoteParticipants.forEach((p) => {
      p.audioTrackPublications.forEach((pub) => {
        if (pub.track) this.attachRemoteAudio(p.identity, pub.track);
      });
    });
  }

  private unwireRoomListeners(room: typeof this.multiplayer.room) {
    room.off(RoomEvent.TrackSubscribed, this.onTrackSubscribed);
    room.off(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribed);
    room.off(RoomEvent.ParticipantDisconnected, this.onParticipantDisconnected);
  }

  private setupLocalAnalyser(room: typeof this.multiplayer.room) {
    if (!this.audioCtx) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const mediaTrack = pub?.track?.mediaStreamTrack;
    if (!mediaTrack) return;
    const stream = new MediaStream([mediaTrack]);
    const source = this.audioCtx.createMediaStreamSource(stream);
    this.localAnalyser = this.audioCtx.createAnalyser();
    this.localAnalyser.fftSize = 256;
    source.connect(this.localAnalyser);
  }

  async enable() {
    const room = this.multiplayer.room;
    try {
      this.audioCtx = new AudioContext();
      await room.startAudio();
      await room.localParticipant.setMicrophoneEnabled(true);

      this.isEnabled = true;

      this.setupLocalAnalyser(room);
      if (!this.localAnalyser) {
        const once = (pub: LocalTrackPublication) => {
          if (pub.source !== Track.Source.Microphone) return;
          room.off(RoomEvent.LocalTrackPublished, once);
          this.setupLocalAnalyser(room);
          if (this.localAnalyser) this.startTalkingDetection();
        };
        room.on(RoomEvent.LocalTrackPublished, once);
      }

      this.wireRoomListeners(room);

      if (this.localAnalyser) this.startTalkingDetection();
    } catch {
      void room.localParticipant.setMicrophoneEnabled(false);
      this.unwireRoomListeners(room);
      this.localStreamCleanup();
      this.isEnabled = false;
      this.onError?.("Microphone access denied. Voice chat unavailable.");
    }
  }

  private startTalkingDetection() {
    const check = () => {
      if (!this.isEnabled) return;
      if (!this.localAnalyser || this.isMuted) {
        if (this.isTalking) {
          this.isTalking = false;
          this.onTalkingChange?.(false);
          this.multiplayer.sendVoiceState(false, this.isMuted);
        }
        requestAnimationFrame(check);
        return;
      }
      const data = new Uint8Array(this.localAnalyser.frequencyBinCount);
      this.localAnalyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const talking = avg > this.talkingThreshold;
      if (talking !== this.isTalking) {
        this.isTalking = talking;
        this.onTalkingChange?.(talking);
        this.multiplayer.sendVoiceState(talking, this.isMuted);
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  updateProximity(myPosition: { x: number; z: number }) {
    if (!this.audioCtx) return;
    this.remote.forEach((handle, peerId) => {
      const remote = this.multiplayer.remotePlayers.get(peerId);
      if (!remote) return;
      const dx = remote.position.x - myPosition.x;
      const dz = remote.position.z - myPosition.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const t = Math.max(
        0,
        Math.min(1, 1 - (dist - PROXIMITY_MIN_DIST) / (PROXIMITY_MAX_DIST - PROXIMITY_MIN_DIST))
      );
      handle.gainNode.gain.setTargetAtTime(t, this.audioCtx!.currentTime, 0.1);
    });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    void this.multiplayer.room.localParticipant.setMicrophoneEnabled(!this.isMuted);
    this.multiplayer.sendVoiceState(this.isTalking, this.isMuted);
    return this.isMuted;
  }

  getLocalAudioLevel(): number {
    if (!this.localAnalyser) return 0;
    const data = new Uint8Array(this.localAnalyser.frequencyBinCount);
    this.localAnalyser.getByteFrequencyData(data);
    return data.reduce((a, b) => a + b, 0) / data.length / 255;
  }

  disable() {
    this.isEnabled = false;
    const room = this.multiplayer.room;
    this.unwireRoomListeners(room);
    this.remote.forEach((_, id) => this.detachRemote(id));
    void room.localParticipant.setMicrophoneEnabled(false);
    this.localStreamCleanup();
    this.isTalking = false;
  }

  private localStreamCleanup() {
    this.localAnalyser = null;
    this.audioCtx?.close();
    this.audioCtx = null;
  }
}
