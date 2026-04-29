import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { WreckRoomScene } from "@/wreck-room/lib/WreckRoomScene";
import Lobby from "@/wreck-room/Lobby";
import HUD from "@/wreck-room/components/HUD";
import RoomThemePanel from "@/wreck-room/components/RoomThemePanel";
import PlayerProfileCard from "@/wreck-room/components/PlayerProfileCard";
import type { AvatarState } from "@/wreck-room/lib/avatar/AvatarRenderer";
import type { ChatMessage } from "@/wreck-room/lib/multiplayer/MultiplayerManager";
import { Settings } from "lucide-react";

const DEFAULT_ROOM_ID = 1;

type RemoteUser = {
  id: string;
  username: string;
  isTalking: boolean;
  isMuted: boolean;
  bodyShape?: string;
  skinTone?: string;
  attachments?: Record<string, string | undefined>;
};

export default function WreckRoom() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<WreckRoomScene | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [joined, setJoined] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState(DEFAULT_ROOM_ID);
  const [username, setUsername] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [playerCount, setPlayerCount] = useState(1);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [clickedPlayer, setClickedPlayer] = useState<{ player: RemoteUser; pos: { x: number; y: number } } | null>(null);

  useEffect(() => {
    if (!joined) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/wreck-room/messages?roomId=${currentRoomId}&limit=50`
        );
        const data = await res.json();
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setMessages(
            data.map(
              (m: {
                id: number;
                username: string;
                content: string;
                type: string;
                createdAt: string | Date;
                roomId: number;
              }) => ({
                id: m.id,
                username: m.username,
                content: m.content,
                type: m.type as "chat" | "system" | "emote",
                createdAt:
                  typeof m.createdAt === "string"
                    ? m.createdAt
                    : new Date(m.createdAt).toISOString(),
                roomId: m.roomId,
              })
            )
          );
        }
      } catch {
        /* keep local messages */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [joined, currentRoomId]);

  // Resize canvas
  useEffect(() => {
    if (!joined) return;
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.style.width = container.clientWidth + "px";
      canvas.style.height = container.clientHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [joined]);

  const handleJoin = useCallback((roomId: number, uname: string, avatarData: AvatarState) => {
    setUsername(uname);
    setCurrentRoomId(roomId);
    setJoined(true);

    setTimeout(() => {
      void (async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const scene = new WreckRoomScene(canvas, {
          onChatMessage: msg => setMessages(prev => [...prev.slice(-200), msg]),
          onPlayerCountChange: count => {
            setPlayerCount(count);
            if (sceneRef.current) {
              const players = sceneRef.current.multiplayer.getAllPlayers();
              setRemoteUsers(players.map(p => ({
                id: p.id,
                username: p.username,
                isTalking: p.isTalking,
                isMuted: p.isMuted,
                bodyShape: (p.avatarData as AvatarState)?.bodyShape,
                skinTone: (p.avatarData as AvatarState)?.skinTone,
                attachments: (p.avatarData as AvatarState)?.attachments as Record<string, string | undefined> | undefined,
              })));
            }
          },
          onTalkingChange: t => setIsTalking(t),
          onVoiceError: e => setVoiceError(e),
          onMultiplayerError: e => setVoiceError(e),
        });

        try {
          await scene.join(roomId, uname, avatarData);
          sceneRef.current = scene;
        } catch {
          scene.destroy();
          setJoined(false);
        }
      })();
    }, 100);
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    sceneRef.current?.sendChat(text);
  }, []);

  const handleEmote = useCallback((emote: "dance" | "wave" | "sit") => {
    sceneRef.current?.triggerEmote(emote);
  }, []);

  const handleToggleVoice = useCallback(async () => {
    if (!sceneRef.current) return;
    const enabled = await sceneRef.current.toggleVoice();
    setVoiceEnabled(enabled);
  }, []);

  const handleToggleMute = useCallback(() => {
    if (!sceneRef.current) return;
    const muted = sceneRef.current.toggleMute();
    setIsMuted(muted);
  }, []);

  const getMinimapData = useCallback(() => {
    return sceneRef.current?.getMinimapData() ?? { players: [], roomSize: 40 };
  }, []);

  // Handle canvas clicks to detect player selection
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!sceneRef.current) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = sceneRef.current.getPlayerAtScreenPos(x, y);
    if (hit) {
      const user = remoteUsers.find(u => u.id === hit.id);
      if (user) setClickedPlayer({ player: user, pos: { x: e.clientX, y: e.clientY } });
    } else {
      setClickedPlayer(null);
    }
  }, [remoteUsers]);

  const handleThemeChange = useCallback((color: string, ambiance: string) => {
    sceneRef.current?.applyTheme(color, ambiance);
  }, []);

  useEffect(() => {
    return () => { sceneRef.current?.destroy(); };
  }, []);

  if (!joined) {
    return <Lobby onJoin={handleJoin} />;
  }

  return (
    <div ref={containerRef} className="w-screen h-screen bg-black overflow-hidden relative">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        style={{ display: "block" }}
        onClick={handleCanvasClick}
      />

      <HUD
        messages={messages}
        onSendMessage={handleSendMessage}
        onEmote={handleEmote}
        onToggleVoice={handleToggleVoice}
        onToggleMute={handleToggleMute}
        voiceEnabled={voiceEnabled}
        isMuted={isMuted}
        isTalking={isTalking}
        playerCount={playerCount}
        username={username}
        getMinimapData={getMinimapData}
        remoteUsers={remoteUsers}
      />

      {/* Room theme button */}
      <div className="absolute top-4 right-4 pointer-events-auto z-10">
        <button
          onClick={() => setShowThemePanel(v => !v)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
            showThemePanel
              ? "bg-purple-600 border-purple-500 text-white"
              : "bg-black/60 border-gray-700/50 text-gray-400 hover:bg-gray-800 hover:text-white backdrop-blur-sm"
          }`}
          title="Room Theme"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Theme panel */}
      <AnimatePresence>
        {showThemePanel && (
          <RoomThemePanel
            roomId={currentRoomId}
            onClose={() => setShowThemePanel(false)}
            onThemeChange={handleThemeChange}
          />
        )}
      </AnimatePresence>

      {/* Player profile card */}
      <AnimatePresence>
        {clickedPlayer && (
          <PlayerProfileCard
            player={clickedPlayer.player}
            position={clickedPlayer.pos}
            onClose={() => setClickedPlayer(null)}
          />
        )}
      </AnimatePresence>

      {/* Voice error toast */}
      {voiceError && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-700 text-red-200 text-sm px-4 py-2 rounded-xl backdrop-blur-sm z-20">
          {voiceError}
          <button className="ml-3 text-red-400 hover:text-white" onClick={() => setVoiceError(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
