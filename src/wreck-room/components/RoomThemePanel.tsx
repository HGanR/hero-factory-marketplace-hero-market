import { useState } from "react";
import { motion } from "framer-motion";
import { X, Settings, Lock, Unlock, Check, Palette, Music, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const LIGHTING_PRESETS = [
  { color: "#ff0080", label: "Neon Pink" },
  { color: "#00ffff", label: "Cyan" },
  { color: "#ff6600", label: "Amber" },
  { color: "#00ff88", label: "Matrix" },
  { color: "#8800ff", label: "Purple" },
  { color: "#ff2200", label: "Red" },
  { color: "#0044ff", label: "Blue" },
  { color: "#ffffff", label: "White" },
];

const MUSIC_GENRES = ["Electronic", "Hip-Hop", "R&B", "Trap", "House", "Afrobeats", "Drill", "Lo-Fi", "Pop", "Rock", "Jazz", "Reggaeton"];
const AMBIANCES = [
  { id: "club", label: "Club" },
  { id: "lounge", label: "Lounge" },
  { id: "outdoor", label: "Outdoor" },
  { id: "arcade", label: "Arcade" },
  { id: "vip", label: "VIP" },
];

interface RoomThemePanelProps {
  roomId: number;
  onClose: () => void;
  onThemeChange?: (color: string, ambiance: string) => void;
}

function useMarketplaceAuth() {
  if (typeof window === "undefined") return false;
  return !!(
    localStorage.getItem("user") ||
    localStorage.getItem("adminLoggedIn") === "true" ||
    document.cookie.includes("auth-token") ||
    document.cookie.includes("admin-token")
  );
}

export default function RoomThemePanel({ roomId, onClose, onThemeChange }: RoomThemePanelProps) {
  const isAuthenticated = useMarketplaceAuth();
  const [lightingColor, setLightingColor] = useState("#ff0080");
  const [musicGenre, setMusicGenre] = useState("Electronic");
  const [ambiance, setAmbiance] = useState("club");
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!isAuthenticated) {
      toast.error("Sign in to save room theme changes.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/wreck-room/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          roomId,
          lightingColor,
          musicGenre,
          ambiance,
          password: clearPassword ? null : password || undefined,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success("Room theme updated!");
      onThemeChange?.(lightingColor, ambiance);
    } catch (e) {
      toast.error(`Failed to update theme: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute top-16 right-4 w-72 pointer-events-auto z-20"
    >
      <div className="bg-black/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
          <span className="text-white font-semibold text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-purple-400" /> Room Theme
          </span>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" /> Lighting Color
            </p>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {LIGHTING_PRESETS.map((p) => (
                <button
                  key={p.color}
                  type="button"
                  title={p.label}
                  onClick={() => setLightingColor(p.color)}
                  className={`h-8 rounded-lg border-2 transition-all hover:scale-105 ${lightingColor === p.color ? "border-white scale-105" : "border-transparent"}`}
                  style={{
                    backgroundColor: p.color + "66",
                    boxShadow: lightingColor === p.color ? `0 0 8px ${p.color}` : undefined,
                  }}
                >
                  <span className="sr-only">{p.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={lightingColor}
                onChange={(e) => setLightingColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
              />
              <span className="text-gray-400 text-xs font-mono">{lightingColor}</span>
              <div
                className="flex-1 h-2 rounded-full"
                style={{ background: `linear-gradient(to right, #000, ${lightingColor})` }}
              />
            </div>
          </div>

          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5" /> Music Genre
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {MUSIC_GENRES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setMusicGenre(g)}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    musicGenre === g
                      ? "border-purple-500 bg-purple-500/15 text-purple-300"
                      : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Ambiance
            </p>
            <div className="flex gap-2 flex-wrap">
              {AMBIANCES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAmbiance(a.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    ambiance === a.id
                      ? "border-purple-500 bg-purple-500/15 text-purple-300"
                      : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Room Password
            </p>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Set a password (leave blank to keep current)..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setClearPassword(false);
                }}
                disabled={clearPassword}
                className="bg-gray-800/80 border-gray-700 text-white placeholder:text-gray-500 text-xs h-8"
              />
              <button
                type="button"
                onClick={() => {
                  setClearPassword((v) => !v);
                  setPassword("");
                }}
                className={`flex items-center gap-2 text-xs transition-colors ${clearPassword ? "text-red-400" : "text-gray-500 hover:text-gray-300"}`}
              >
                {clearPassword ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {clearPassword ? "Will remove password lock" : "Remove existing password"}
              </button>
            </div>
          </div>

          {!isAuthenticated && (
            <p className="text-yellow-400/80 text-xs bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2">
              Sign in to save room theme changes permanently.
            </p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-700/50">
          <Button
            type="button"
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold gap-1.5"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "Saving..." : (
              <>
                <Check className="w-4 h-4" /> Apply Theme
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
