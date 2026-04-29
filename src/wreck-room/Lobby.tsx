import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Upload, Zap, Music, Gamepad2, Star, Wand2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { AvatarState } from "@/wreck-room/lib/avatar/AvatarRenderer";
import AvatarCreatorModal from "@/wreck-room/components/AvatarCreatorModal";

const PROFILE_KEY = "wreckroom_profile";

const DEFAULT_AVATARS: Array<{ id: string; label: string; emoji: string; data: AvatarState }> = [
  { id: "neon",   label: "Neon Rider",  emoji: "🟣", data: { skinTone: "#F5CBA7", bodyShape: "athletic",  attachments: { hair: "hair-short-crop",    shirt: "shirt-tshirt",  sneakers: "sneaker-low-white" } } },
  { id: "street", label: "Street King", emoji: "🔵", data: { skinTone: "#8B4513", bodyShape: "muscular",  muscleTone: 0.9, attachments: { hair: "hair-buzz",  jacket: "jacket-bomber", sneakers: "sneaker-high-top" } } },
  { id: "glam",   label: "Glam Queen",  emoji: "🩷", data: { skinTone: "#FDEBD0", bodyShape: "curvy",     attachments: { hair: "hair-long-straight", glasses: "glasses-cat-eye", shirt: "shirt-crop" } } },
  { id: "cyber",  label: "Cyber Ghost", emoji: "🟢", data: { skinTone: "#4A235A", bodyShape: "slim",      attachments: { hair: "hair-mohawk",        jacket: "jacket-leather", boots: "boots-combat" } } },
];

const ROOM_ICONS: Record<string, React.ReactNode> = {
  "Main Lounge": <Music className="w-5 h-5" />,
  "Rooftop":     <Star className="w-5 h-5" />,
  "Game Zone":   <Gamepad2 className="w-5 h-5" />,
  "VIP Lounge":  <Zap className="w-5 h-5" />,
};

/** Matches `drizzle/wreck_room_tables.sql` — used when API fails or DB has no public rows */
const FALLBACK_ROOMS: { id: number; name: string; description: string | null; maxUsers: number }[] = [
  { id: 1, name: "Main Lounge", description: "Hang out and chat.", maxUsers: 24 },
  { id: 2, name: "Rooftop", description: "Open air vibes.", maxUsers: 16 },
  { id: 3, name: "Game Zone", description: "Casual games & banter.", maxUsers: 20 },
  { id: 4, name: "VIP Lounge", description: "Members only feel.", maxUsers: 12 },
];

const FALLBACK_THEMES: {
  roomId: number;
  lightingColor: string | null;
  musicGenre: string | null;
  ambiance: string | null;
  passwordHash: string | null;
}[] = [
  { roomId: 1, lightingColor: "#ff0080", musicGenre: "Electronic", ambiance: "club", passwordHash: null },
  { roomId: 2, lightingColor: "#00ffff", musicGenre: "Lo-Fi", ambiance: "outdoor", passwordHash: null },
  { roomId: 3, lightingColor: "#00ff88", musicGenre: "Hip-Hop", ambiance: "arcade", passwordHash: null },
  { roomId: 4, lightingColor: "#8800ff", musicGenre: "R&B", ambiance: "vip", passwordHash: null },
];

interface LobbyProps {
  onJoin: (roomId: number, username: string, avatarData: AvatarState) => void;
}

export default function Lobby({ onJoin }: LobbyProps) {
  const [step, setStep] = useState<"avatar" | "username" | "rooms">("avatar");
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarState | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [showCreator, setShowCreator] = useState(false);
  const [passwordInputs, setPasswordInputs] = useState<Record<number, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<number, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const [rooms, setRooms] = useState<
    { id: number; name: string; description: string | null; maxUsers: number }[]
  >([]);
  const [roomThemes, setRoomThemes] = useState<
    {
      roomId: number;
      lightingColor: string | null;
      musicGenre: string | null;
      ambiance: string | null;
      passwordHash: string | null;
    }[]
  >([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsUsingFallback, setRoomsUsingFallback] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    setRoomsUsingFallback(false);
    try {
      const [rRes, tRes] = await Promise.all([
        fetch("/api/wreck-room/rooms"),
        fetch("/api/wreck-room/themes"),
      ]);
      const r = await rRes.json();
      const t = await tRes.json();

      const serverRooms = Array.isArray(r) ? r : [];
      const serverThemes = Array.isArray(t) ? t : [];

      const roomsFailed = !rRes.ok || !Array.isArray(r);
      const themesFailed = !tRes.ok || !Array.isArray(t);

      const useRoomFallback = roomsFailed || serverRooms.length === 0;
      const useThemeFallback = themesFailed || serverThemes.length === 0;

      if (roomsFailed) {
        toast.error("Could not load rooms from the server. Showing default rooms.", { duration: 4000 });
      } else if (serverRooms.length === 0) {
        toast.message("No rooms in database yet. Using default rooms.", { duration: 3500 });
      }
      if (themesFailed && !roomsFailed) {
        toast.message("Room themes unavailable; using default styling.", { duration: 3000 });
      }

      setRooms(useRoomFallback ? FALLBACK_ROOMS : serverRooms);
      setRoomThemes(useThemeFallback ? FALLBACK_THEMES : serverThemes);
      setRoomsUsingFallback(useRoomFallback || useThemeFallback);
    } catch {
      setRooms(FALLBACK_ROOMS);
      setRoomThemes(FALLBACK_THEMES);
      setRoomsUsingFallback(true);
      toast.error("Offline: using default room list.");
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  // ── Auto-fill saved profile ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      if (!saved) return;
      const profile = JSON.parse(saved) as { username: string; avatar: AvatarState };
      if (profile.username) setUsername(profile.username);
      if (profile.avatar) {
        setSelectedAvatar(profile.avatar);
        setSelectedAvatarId("saved");
        toast.success(`Welcome back, ${profile.username}! Your profile was restored.`, { duration: 3000 });
      }
    } catch { /* ignore */ }
  }, []);

  const saveProfile = (uname: string, avatar: AvatarState) => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ username: uname, avatar }));
    } catch { /* ignore */ }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAvatarSelect = (id: string, data: AvatarState) => {
    setSelectedAvatarId(id);
    setSelectedAvatar(data);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string) as AvatarState;
        setSelectedAvatar(data);
        setSelectedAvatarId("custom");
        toast.success("Avatar loaded from file!");
      } catch {
        toast.error("Invalid avatar file. Please upload a valid avatar.json from the Avatar Creator.");
      }
    };
    reader.readAsText(file);
  };

  const handleUsernameNext = () => {
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 2) { setUsernameError("Username must be at least 2 characters."); return; }
    if (trimmed.length > 20) { setUsernameError("Username must be 20 characters or less."); return; }
    if (!/^[a-zA-Z0-9_\- ]+$/.test(trimmed)) { setUsernameError("Only letters, numbers, spaces, - and _ allowed."); return; }
    setUsernameError("");
    if (selectedAvatar) saveProfile(trimmed, selectedAvatar);
    setStep("rooms");
  };

  const handleJoin = async (roomId: number) => {
    if (!selectedAvatar || !username.trim()) return;
    const theme = roomThemes?.find((t: { roomId: number; lightingColor: string | null; musicGenre: string | null; ambiance: string | null; passwordHash: string | null }) => t.roomId === roomId);
    if (theme?.passwordHash) {
      const pw = passwordInputs[roomId] ?? "";
      if (!pw) { setPasswordErrors(prev => ({ ...prev, [roomId]: "This room requires a password." })); return; }
      setVerifyPending(true);
      try {
        const res = await fetch("/api/wreck-room/verify-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, password: pw }),
        });
        const data = (await res.json()) as { valid?: boolean };
        if (!data.valid) { setPasswordErrors(prev => ({ ...prev, [roomId]: "Incorrect password." })); return; }
      } catch {
        setPasswordErrors(prev => ({ ...prev, [roomId]: "Could not verify password." }));
        return;
      } finally {
        setVerifyPending(false);
      }
    }
    onJoin(roomId, username.trim(), selectedAvatar);
  };

  return (
    <div className="min-h-screen bg-[#0a0a14] flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-900/20 rounded-full blur-3xl" />
      </div>

      {/* Logo */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8 relative z-10">
        <h1 className="text-5xl font-black text-white tracking-tight">WRECK<span className="text-pink-500">ROOM</span></h1>
        <p className="text-gray-400 mt-2 text-sm tracking-widest uppercase">3D Social Space</p>
      </motion.div>

      {/* Step indicator */}
      <div className="flex gap-2 mb-8 relative z-10">
        {["avatar", "username", "rooms"].map((s, i) => (
          <div key={s} className={`flex items-center gap-2 ${i > 0 ? "ml-2" : ""}`}>
            {i > 0 && <div className="w-8 h-px bg-gray-700" />}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step === s ? "bg-pink-500 text-white" :
              ["avatar","username","rooms"].indexOf(step) > i ? "bg-green-600 text-white" :
              "bg-gray-800 text-gray-500"
            }`}>{i + 1}</div>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── Step 1: Avatar ── */}
        {step === "avatar" && (
          <motion.div key="avatar" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="w-full max-w-lg relative z-10">
            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-1">Choose Your Avatar</h2>
              <p className="text-gray-400 text-sm mb-5">Pick a preset, build your own, or upload from the Avatar Creator.</p>

              {/* Saved profile banner */}
              {selectedAvatarId === "saved" && (
                <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 text-sm flex items-center gap-2">
                  <span>✓</span> Saved profile loaded — you can change it below.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-4">
                {DEFAULT_AVATARS.map(av => (
                  <button
                    key={av.id}
                    onClick={() => handleAvatarSelect(av.id, av.data)}
                    className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-105 ${
                      selectedAvatarId === av.id ? "border-pink-500 bg-pink-500/10" : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                    }`}
                  >
                    <div className="text-3xl mb-2">{av.emoji}</div>
                    <div className="text-white font-semibold text-sm">{av.label}</div>
                    <div className="text-gray-400 text-xs mt-1 capitalize">{av.data.bodyShape}</div>
                  </button>
                ))}
              </div>

              {/* Build your own */}
              <button
                onClick={() => setShowCreator(true)}
                className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition-all mb-3 hover:border-purple-500/70 ${
                  selectedAvatarId === "created" ? "border-purple-500 bg-purple-500/10" : "border-gray-700 hover:bg-gray-800/50"
                }`}
              >
                <Wand2 className="w-5 h-5 text-purple-400" />
                <span className="text-gray-300 text-sm font-medium">
                  {selectedAvatarId === "created" ? "✓ Custom avatar created" : "Build your own avatar →"}
                </span>
              </button>

              {/* Upload custom */}
              <button
                onClick={() => fileRef.current?.click()}
                className={`w-full p-3 rounded-xl border-2 border-dashed flex items-center gap-3 transition-all hover:border-pink-500/50 ${
                  selectedAvatarId === "custom" ? "border-pink-500 bg-pink-500/10" : "border-gray-700 hover:bg-gray-800/50"
                }`}
              >
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-gray-300 text-sm">
                  {selectedAvatarId === "custom" ? "✓ Custom avatar loaded" : "Upload avatar.json from Avatar Creator"}
                </span>
              </button>
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />

              <Button
                className="w-full mt-5 bg-pink-600 hover:bg-pink-500 text-white font-bold h-11"
                disabled={!selectedAvatar}
                onClick={() => setStep("username")}
              >
                Continue →
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Step 2: Username ── */}
        {step === "username" && (
          <motion.div key="username" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="w-full max-w-lg relative z-10">
            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-1">What's Your Name?</h2>
              <p className="text-gray-400 text-sm mb-5">This is how other players will see you in the room.</p>

              <Input
                value={username}
                onChange={e => { setUsername(e.target.value); setUsernameError(""); }}
                onKeyDown={e => e.key === "Enter" && handleUsernameNext()}
                placeholder="Enter your username..."
                maxLength={20}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-12 text-base"
                autoFocus
              />
              {usernameError && <p className="text-red-400 text-sm mt-2">{usernameError}</p>}
              <p className="text-gray-500 text-xs mt-2">{username.length}/20 characters</p>

              <div className="flex gap-3 mt-5">
                <Button variant="outline" className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800" onClick={() => setStep("avatar")}>
                  ← Back
                </Button>
                <Button className="flex-1 bg-pink-600 hover:bg-pink-500 text-white font-bold h-11" onClick={handleUsernameNext}>
                  Continue →
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Step 3: Room selection ── */}
        {step === "rooms" && (
          <motion.div key="rooms" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="w-full max-w-lg relative z-10">
            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-1">Choose a Room</h2>
              <p className="text-gray-400 text-sm mb-5">
                Welcome, <span className="text-pink-400 font-semibold">{username}</span>! Pick where you want to hang.
              </p>

              {roomsUsingFallback && (
                <div className="mb-4 rounded-xl border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-amber-100/90 text-xs">
                  Using the built-in room list (database unavailable or empty).{" "}
                  <button
                    type="button"
                    className="underline font-medium text-amber-200 hover:text-white"
                    onClick={() => void loadRooms()}
                  >
                    Retry load
                  </button>
                </div>
              )}

              {roomsLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />)}
                </div>
              ) : rooms.length === 0 ? (
                <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 text-sm text-gray-300">
                  <p className="mb-3">No rooms are available. Try again or go back and check your connection.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-200 hover:bg-gray-800"
                    onClick={() => void loadRooms()}
                  >
                    Refresh rooms
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {rooms.map(room => {
                    const theme = roomThemes?.find((t: { roomId: number; lightingColor: string | null; musicGenre: string | null; ambiance: string | null; passwordHash: string | null }) => t.roomId === room.id);
                    const isLocked = !!theme?.passwordHash;
                    return (
                      <div key={room.id} className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
                        <button
                          onClick={() => !isLocked && handleJoin(room.id)}
                          className="w-full p-4 text-left hover:bg-pink-500/5 hover:border-pink-500/50 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-pink-400 group-hover:bg-pink-500/20 transition-colors"
                              style={{ backgroundColor: theme?.lightingColor ? `${theme.lightingColor}22` : undefined }}
                            >
                              {ROOM_ICONS[room.name] ?? <Users className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-semibold">{room.name}</span>
                                {isLocked && <Lock className="w-3.5 h-3.5 text-yellow-400" />}
                                {theme?.musicGenre && (
                                  <span className="text-xs text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded-full">{theme.musicGenre}</span>
                                )}
                              </div>
                              <div className="text-gray-400 text-xs truncate">{room.description}</div>
                            </div>
                            <div className="text-gray-500 text-xs whitespace-nowrap">Max {room.maxUsers}</div>
                          </div>
                        </button>

                        {/* Password input for locked rooms */}
                        {isLocked && (
                          <div className="px-4 pb-3 flex gap-2">
                            <Input
                              type="password"
                              placeholder="Enter room password..."
                              value={passwordInputs[room.id] ?? ""}
                              onChange={e => {
                                setPasswordInputs(prev => ({ ...prev, [room.id]: e.target.value }));
                                setPasswordErrors(prev => ({ ...prev, [room.id]: "" }));
                              }}
                              onKeyDown={e => e.key === "Enter" && handleJoin(room.id)}
                              className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 h-8 text-sm flex-1"
                            />
                            <Button
                              size="sm"
                              className="bg-yellow-600 hover:bg-yellow-500 text-white h-8 px-3"
                              onClick={() => handleJoin(room.id)}
                              disabled={verifyPending}
                            >
                              {verifyPending ? "..." : "Enter"}
                            </Button>
                          </div>
                        )}
                        {passwordErrors[room.id] && (
                          <p className="px-4 pb-2 text-red-400 text-xs">{passwordErrors[room.id]}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <Button variant="outline" className="w-full mt-4 border-gray-700 text-gray-300 hover:bg-gray-800" onClick={() => setStep("username")}>
                ← Back
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar Creator Modal */}
      <AnimatePresence>
        {showCreator && (
          <AvatarCreatorModal
            onClose={() => setShowCreator(false)}
            onSave={avatar => {
              setSelectedAvatar(avatar);
              setSelectedAvatarId("created");
              setShowCreator(false);
              toast.success("Avatar created! Click Continue to proceed.");
            }}
            initial={selectedAvatar ?? undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
