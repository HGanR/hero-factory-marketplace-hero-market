import { motion } from "framer-motion";
import { X, Mic, MicOff, Volume2 } from "lucide-react";

interface PlayerProfileCardProps {
  player: {
    id: string;
    username: string;
    isTalking: boolean;
    isMuted: boolean;
    bodyShape?: string;
    skinTone?: string;
    attachments?: Record<string, string | undefined>;
  };
  position: { x: number; y: number };
  onClose: () => void;
}

export default function PlayerProfileCard({ player, position, onClose }: PlayerProfileCardProps) {
  const attachmentList = player.attachments
    ? Object.entries(player.attachments)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute z-30 pointer-events-auto"
      style={{ left: Math.min(position.x, window.innerWidth - 220), top: Math.max(position.y - 160, 80) }}
    >
      <div className="bg-black/85 backdrop-blur-sm border border-gray-700/50 rounded-2xl w-52 overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: player.skinTone ?? "#F5CBA7", color: "#000" }}
            >
              {player.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">{player.username}</p>
              <p className="text-gray-500 text-xs capitalize">{player.bodyShape ?? "avatar"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Status */}
        <div className="px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-2">
            {player.isTalking && !player.isMuted ? (
              <div className="flex items-center gap-1.5 text-green-400 text-xs">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                <span>Speaking</span>
              </div>
            ) : player.isMuted ? (
              <div className="flex items-center gap-1.5 text-red-400 text-xs">
                <MicOff className="w-3.5 h-3.5" />
                <span>Muted</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                <Mic className="w-3.5 h-3.5" />
                <span>Silent</span>
              </div>
            )}
          </div>

          {/* Outfit preview */}
          {attachmentList.length > 0 && (
            <div className="mt-2">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Wearing</p>
              <div className="space-y-0.5">
                {attachmentList.slice(0, 5).map(item => (
                  <p key={item} className="text-gray-400 text-xs truncate">{item}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
