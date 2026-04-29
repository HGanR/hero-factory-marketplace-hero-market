/**
 * Socket.IO server for Wreck Room (multiplayer, chat, WebRTC signaling).
 * Run standalone: `npx tsx scripts/wreck-room-socket.ts` (see package.json).
 */
import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { wreckSaveMessage } from "./queries";

export interface WreckPlayerState {
  id: string;
  username: string;
  avatarData: unknown;
  position: { x: number; y: number; z: number };
  rotation: number;
  animation: "idle" | "walk" | "talk" | "dance" | "wave" | "sit";
  isTalking: boolean;
  isMuted: boolean;
  roomId: number;
}

const rooms = new Map<number, Map<string, WreckPlayerState>>();

function getRoom(roomId: number): Map<string, WreckPlayerState> {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId)!;
}

export function initWreckRoomSocketServer(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/socket",
  });

  io.on("connection", (socket) => {
    let currentRoomId: number | null = null;
    let currentPlayer: WreckPlayerState | null = null;

    socket.on(
      "join_room",
      async (data: {
        roomId: number;
        username: string;
        avatarData: unknown;
        position?: { x: number; y: number; z: number };
      }) => {
        currentRoomId = data.roomId;
        const room = getRoom(data.roomId);

        currentPlayer = {
          id: socket.id,
          username: data.username,
          avatarData: data.avatarData,
          position: data.position ?? { x: 0, y: 0, z: 0 },
          rotation: 0,
          animation: "idle",
          isTalking: false,
          isMuted: false,
          roomId: data.roomId,
        };

        room.set(socket.id, currentPlayer);
        socket.join(`room:${data.roomId}`);

        socket.emit("room_state", {
          players: Array.from(room.values()),
          roomId: data.roomId,
        });

        socket.to(`room:${data.roomId}`).emit("player_joined", currentPlayer);

        const systemMsg = {
          id: Date.now(),
          username: "System",
          content: `${data.username} joined the room`,
          type: "system" as const,
          createdAt: new Date().toISOString(),
          roomId: data.roomId,
        };
        io.to(`room:${data.roomId}`).emit("chat_message", systemMsg);

        try {
          await wreckSaveMessage({
            roomId: data.roomId,
            username: "System",
            content: `${data.username} joined the room`,
            type: "system",
          });
        } catch {
          /* optional persistence */
        }
      }
    );

    socket.on(
      "player_move",
      (data: {
        position: { x: number; y: number; z: number };
        rotation: number;
        animation: WreckPlayerState["animation"];
      }) => {
        if (!currentRoomId || !currentPlayer) return;
        currentPlayer.position = data.position;
        currentPlayer.rotation = data.rotation;
        currentPlayer.animation = data.animation;
        getRoom(currentRoomId).set(socket.id, currentPlayer);
        socket.to(`room:${currentRoomId}`).emit("player_moved", {
          id: socket.id,
          position: data.position,
          rotation: data.rotation,
          animation: data.animation,
        });
      }
    );

    socket.on(
      "send_message",
      async (data: { content: string; type?: "chat" | "emote" }) => {
        if (!currentRoomId || !currentPlayer) return;
        const msg = {
          id: Date.now(),
          username: currentPlayer.username,
          content: data.content,
          type: data.type ?? "chat",
          createdAt: new Date().toISOString(),
          roomId: currentRoomId,
          senderId: socket.id,
        };
        io.to(`room:${currentRoomId}`).emit("chat_message", msg);
        try {
          await wreckSaveMessage({
            roomId: currentRoomId,
            username: currentPlayer.username,
            content: data.content,
            type: data.type ?? "chat",
          });
        } catch {
          /* optional */
        }
      }
    );

    socket.on("voice_state", (data: { isTalking: boolean; isMuted: boolean }) => {
      if (!currentRoomId || !currentPlayer) return;
      currentPlayer.isTalking = data.isTalking;
      currentPlayer.isMuted = data.isMuted;
      getRoom(currentRoomId).set(socket.id, currentPlayer);
      socket.to(`room:${currentRoomId}`).emit("player_voice_state", {
        id: socket.id,
        isTalking: data.isTalking,
        isMuted: data.isMuted,
      });
    });

    socket.on("emote", (data: { emote: string }) => {
      if (!currentRoomId) return;
      io.to(`room:${currentRoomId}`).emit("player_emote", {
        id: socket.id,
        username: currentPlayer?.username,
        emote: data.emote,
      });
    });

    socket.on("rtc_offer", (data: { targetId: string; offer: unknown }) => {
      io.to(data.targetId).emit("rtc_offer", { fromId: socket.id, offer: data.offer });
    });
    socket.on("rtc_answer", (data: { targetId: string; answer: unknown }) => {
      io.to(data.targetId).emit("rtc_answer", { fromId: socket.id, answer: data.answer });
    });
    socket.on("rtc_ice_candidate", (data: { targetId: string; candidate: unknown }) => {
      io.to(data.targetId).emit("rtc_ice_candidate", {
        fromId: socket.id,
        candidate: data.candidate,
      });
    });

    socket.on("disconnect", async () => {
      if (!currentRoomId || !currentPlayer) return;
      getRoom(currentRoomId).delete(socket.id);
      socket.to(`room:${currentRoomId}`).emit("player_left", { id: socket.id });
      const systemMsg = {
        id: Date.now(),
        username: "System",
        content: `${currentPlayer.username} left the room`,
        type: "system" as const,
        createdAt: new Date().toISOString(),
        roomId: currentRoomId,
      };
      io.to(`room:${currentRoomId}`).emit("chat_message", systemMsg);
      try {
        await wreckSaveMessage({
          roomId: currentRoomId,
          username: "System",
          content: `${currentPlayer.username} left the room`,
          type: "system",
        });
      } catch {
        /* optional */
      }
    });
  });

  return io;
}
