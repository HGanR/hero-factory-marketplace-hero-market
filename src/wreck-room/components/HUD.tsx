import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Mic, MicOff, Users, Map, X,
  Send, Volume2, VolumeX, Smile, Music, Hand, Coffee
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMessage } from "@/wreck-room/lib/multiplayer/MultiplayerManager";

interface MinimapPlayer { x: number; z: number; isLocal: boolean; username: string; }
interface MinimapData { players: MinimapPlayer[]; roomSize: number; }

interface HUDProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onEmote: (emote: "dance" | "wave" | "sit") => void;
  onToggleVoice: () => void;
  onToggleMute: () => void;
  voiceEnabled: boolean;
  isMuted: boolean;
  isTalking: boolean;
  playerCount: number;
  username: string;
  getMinimapData: () => MinimapData;
  remoteUsers: Array<{ id: string; username: string; isTalking: boolean; isMuted: boolean }>;
}

const EMOTES = [
  { id: "dance", label: "Dance", icon: <Music className="w-4 h-4" /> },
  { id: "wave",  label: "Wave",  icon: <Hand className="w-4 h-4" /> },
  { id: "sit",   label: "Sit",   icon: <Coffee className="w-4 h-4" /> },
];

export default function HUD({
  messages, onSendMessage, onEmote, onToggleVoice, onToggleMute,
  voiceEnabled, isMuted, isTalking, playerCount, username,
  getMinimapData, remoteUsers,
}: HUDProps) {
  const [chatOpen, setChatOpen] = useState(true);
  const [usersOpen, setUsersOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [emotesOpen, setEmotesOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [minimapData, setMinimapData] = useState<MinimapData>({ players: [], roomSize: 40 });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update minimap
  useEffect(() => {
    if (!mapOpen) return;
    const interval = setInterval(() => {
      setMinimapData(getMinimapData());
    }, 100);
    return () => clearInterval(interval);
  }, [mapOpen, getMinimapData]);

  // Draw minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapOpen) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    const half = minimapData.roomSize / 2;

    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, size, size);

    // Grid
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 8; i++) {
      const p = (i / 8) * size;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
    }

    // Players
    minimapData.players.forEach(p => {
      const px = ((p.x + half) / minimapData.roomSize) * size;
      const py = ((p.z + half) / minimapData.roomSize) * size;
      ctx.beginPath();
      ctx.arc(px, py, p.isLocal ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = p.isLocal ? "#ec4899" : "#60a5fa";
      ctx.fill();
      if (p.isLocal) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  }, [minimapData, mapOpen]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;
    onSendMessage(text);
    setInputValue("");
  }, [inputValue, onSendMessage]);

  const msgColor = (type: string) => {
    if (type === "system") return "text-yellow-400/80";
    if (type === "emote")  return "text-purple-400";
    return "text-gray-100";
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-sm border border-gray-700/50 rounded-full px-5 py-2 flex items-center gap-4">
          <span className="text-white font-bold text-sm tracking-wide">WRECK<span className="text-pink-500">ROOM</span></span>
          <div className="w-px h-4 bg-gray-700" />
          <div className="flex items-center gap-1.5 text-gray-300 text-xs">
            <Users className="w-3.5 h-3.5 text-pink-400" />
            <span>{playerCount} online</span>
          </div>
          {isTalking && (
            <div className="flex items-center gap-1 text-green-400 text-xs animate-pulse">
              <Mic className="w-3.5 h-3.5" />
              <span>Speaking</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Controls bar (bottom center) ────────────────────────────────── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="bg-black/70 backdrop-blur-sm border border-gray-700/50 rounded-2xl px-4 py-2.5 flex items-center gap-2">
          {/* Chat toggle */}
          <button
            onClick={() => { setChatOpen(v => !v); setUsersOpen(false); setMapOpen(false); setEmotesOpen(false); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${chatOpen ? "bg-pink-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            title="Chat"
          >
            <MessageCircle className="w-5 h-5" />
          </button>

          {/* Users toggle */}
          <button
            onClick={() => { setUsersOpen(v => !v); setChatOpen(false); setMapOpen(false); setEmotesOpen(false); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${usersOpen ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            title="Users"
          >
            <Users className="w-5 h-5" />
          </button>

          {/* Minimap toggle */}
          <button
            onClick={() => { setMapOpen(v => !v); setChatOpen(false); setUsersOpen(false); setEmotesOpen(false); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${mapOpen ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            title="Minimap"
          >
            <Map className="w-5 h-5" />
          </button>

          {/* Emotes toggle */}
          <button
            onClick={() => { setEmotesOpen(v => !v); setChatOpen(false); setUsersOpen(false); setMapOpen(false); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${emotesOpen ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            title="Emotes"
          >
            <Smile className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-gray-700 mx-1" />

          {/* Voice enable */}
          <button
            onClick={onToggleVoice}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${voiceEnabled ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            title={voiceEnabled ? "Disable voice" : "Enable voice"}
          >
            <Volume2 className="w-5 h-5" />
          </button>

          {/* Mute */}
          {voiceEnabled && (
            <button
              onClick={onToggleMute}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isMuted ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute bottom-20 left-4 w-80 pointer-events-auto"
          >
            <div className="bg-black/75 backdrop-blur-sm border border-gray-700/50 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/50">
                <span className="text-white font-semibold text-sm flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-pink-400" /> Chat
                </span>
                <button onClick={() => setChatOpen(false)} className="text-gray-500 hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Messages */}
              <div className="h-52 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700">
                {messages.length === 0 && (
                  <p className="text-gray-500 text-xs text-center py-4">No messages yet. Say hi!</p>
                )}
                {messages.map(msg => (
                  <div key={msg.id} className="text-xs leading-relaxed">
                    {msg.type === "system" ? (
                      <span className="text-yellow-400/70 italic">{msg.content}</span>
                    ) : (
                      <>
                        <span className="text-pink-400 font-semibold">{msg.username}: </span>
                        <span className={msgColor(msg.type)}>{msg.content}</span>
                      </>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2 p-2 border-t border-gray-700/50">
                <Input
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  placeholder="Say something..."
                  maxLength={200}
                  className="bg-gray-800/80 border-gray-700 text-white placeholder:text-gray-500 text-xs h-8 flex-1"
                />
                <Button size="sm" className="h-8 w-8 p-0 bg-pink-600 hover:bg-pink-500" onClick={handleSend}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Users panel ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {usersOpen && (
          <motion.div
            key="users"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute bottom-20 left-4 w-64 pointer-events-auto"
          >
            <div className="bg-black/75 backdrop-blur-sm border border-gray-700/50 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/50">
                <span className="text-white font-semibold text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" /> Players ({playerCount})
                </span>
                <button onClick={() => setUsersOpen(false)} className="text-gray-500 hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                {/* Local user */}
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-pink-500/10">
                  <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-pink-300 text-sm font-medium flex-1 truncate">{username}</span>
                  <span className="text-gray-500 text-xs">You</span>
                </div>
                {/* Remote users */}
                {remoteUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800/50">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${u.isTalking ? "bg-green-400 animate-pulse" : "bg-blue-400"}`} />
                    <span className="text-gray-200 text-sm flex-1 truncate">{u.username}</span>
                    {u.isMuted && <MicOff className="w-3 h-3 text-red-400 flex-shrink-0" />}
                    {u.isTalking && !u.isMuted && <Mic className="w-3 h-3 text-green-400 flex-shrink-0 animate-pulse" />}
                  </div>
                ))}
                {remoteUsers.length === 0 && (
                  <p className="text-gray-500 text-xs text-center py-3">You're the only one here. Invite friends!</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Minimap ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mapOpen && (
          <motion.div
            key="map"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute bottom-20 right-4 pointer-events-auto"
          >
            <div className="bg-black/75 backdrop-blur-sm border border-gray-700/50 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50">
                <span className="text-white font-semibold text-xs flex items-center gap-1.5">
                  <Map className="w-3.5 h-3.5 text-green-400" /> Minimap
                </span>
                <button onClick={() => setMapOpen(false)} className="text-gray-500 hover:text-gray-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <canvas ref={canvasRef} width={160} height={160} className="block" />
              <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500 inline-block" /> You</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Others</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Emotes ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {emotesOpen && (
          <motion.div
            key="emotes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-auto"
          >
            <div className="bg-black/75 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-3 flex gap-2">
              {EMOTES.map(e => (
                <button
                  key={e.id}
                  onClick={() => { onEmote(e.id as "dance" | "wave" | "sit"); setEmotesOpen(false); }}
                  className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-purple-600/30 hover:border-purple-500 border border-gray-700 transition-all text-gray-300 hover:text-white"
                >
                  {e.icon}
                  <span className="text-xs">{e.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Controls hint ────────────────────────────────────────────────── */}
      <div className="absolute top-4 right-4 pointer-events-none">
        <div className="bg-black/50 backdrop-blur-sm border border-gray-700/30 rounded-xl px-3 py-2 text-xs text-gray-500 space-y-0.5">
          <div>WASD / Arrow keys — Move</div>
          <div>Click floor — Walk to</div>
          <div>Scroll — Zoom</div>
        </div>
      </div>
    </div>
  );
}
