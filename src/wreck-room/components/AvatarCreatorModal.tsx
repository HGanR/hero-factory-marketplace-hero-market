import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Check, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { AvatarState } from "@/wreck-room/lib/avatar/AvatarRenderer";
import AvatarStudioViewport from "@/wreck-room/components/AvatarStudioViewport";

// ─── Data ─────────────────────────────────────────────────────────────────────
const SKIN_TONES = [
  { hex: "#FDEBD0", label: "Porcelain" },
  { hex: "#F5CBA7", label: "Ivory" },
  { hex: "#E8B89A", label: "Sand" },
  { hex: "#D4956A", label: "Honey" },
  { hex: "#C68642", label: "Caramel" },
  { hex: "#A0522D", label: "Sienna" },
  { hex: "#8B4513", label: "Umber" },
  { hex: "#5C3317", label: "Espresso" },
  { hex: "#3B1F0E", label: "Ebony" },
  { hex: "#4A235A", label: "Amethyst" },
  { hex: "#1B4F72", label: "Sapphire" },
  { hex: "#1E8449", label: "Jade" },
];

const BODY_SHAPES = ["slim", "average", "athletic", "curvy", "plus", "muscular"];

const HAIR_STYLES = [
  { id: "hair-short-crop", label: "Short Crop" },
  { id: "hair-buzz", label: "Buzz Cut" },
  { id: "hair-curly", label: "Curly" },
  { id: "hair-mohawk", label: "Mohawk" },
  { id: "hair-slicked", label: "Slicked" },
  { id: "hair-wavy", label: "Wavy" },
  { id: "hair-cornrows", label: "Cornrows" },
  { id: "hair-ponytail", label: "Ponytail" },
  { id: "hair-bun", label: "Bun" },
  { id: "hair-long-straight", label: "Long Straight" },
  { id: "hair-afro", label: "Afro" },
  { id: "hair-dreadlocks", label: "Dreadlocks" },
  { id: null, label: "Bald" },
];

const HATS = [
  { id: null, label: "None" },
  { id: "hat-baseball", label: "Baseball" },
  { id: "hat-beanie", label: "Beanie" },
  { id: "hat-snapback", label: "Snapback" },
  { id: "hat-bucket", label: "Bucket" },
  { id: "hat-fedora", label: "Fedora" },
  { id: "hat-cowboy", label: "Cowboy" },
];

const GLASSES = [
  { id: null, label: "None" },
  { id: "glasses-round", label: "Round" },
  { id: "glasses-square", label: "Square" },
  { id: "glasses-cat-eye", label: "Cat Eye" },
  { id: "glasses-aviator", label: "Aviator ☀️", isSunglasses: true },
  { id: "glasses-wayfarer", label: "Wayfarer ☀️", isSunglasses: true },
  { id: "glasses-shield", label: "Shield ☀️", isSunglasses: true },
];

const SHIRTS = [
  { id: null, label: "None" },
  { id: "shirt-tshirt", label: "T-Shirt" },
  { id: "shirt-polo", label: "Polo" },
  { id: "shirt-hoodie", label: "Hoodie" },
  { id: "shirt-crop", label: "Crop Top" },
  { id: "shirt-jersey", label: "Jersey" },
  { id: "shirt-flannel", label: "Flannel" },
];

const JACKETS = [
  { id: null, label: "None" },
  { id: "jacket-bomber", label: "Bomber" },
  { id: "jacket-denim", label: "Denim" },
  { id: "jacket-leather", label: "Leather" },
  { id: "jacket-puffer", label: "Puffer" },
  { id: "jacket-varsity", label: "Varsity" },
  { id: "jacket-blazer", label: "Blazer" },
];

const SHOES = [
  { id: "sneaker-low-white", label: "White Low" },
  { id: "sneaker-high-top", label: "High Top" },
  { id: "sneaker-runner", label: "Runner" },
  { id: "boots-combat", label: "Combat Boots" },
  { id: "boots-chelsea", label: "Chelsea Boots" },
  { id: "shoe-oxford", label: "Oxford" },
  { id: "shoe-loafer", label: "Loafer" },
];

const EYE_COLORS = ["#3a2010", "#1a4a8a", "#1a6a2a", "#8a6a1a", "#6a1a6a", "#1a6a6a", "#2a2a2a", "#8a2a1a"];
const LIP_COLORS = ["#c0392b", "#e74c3c", "#f39c12", "#8e44ad", "#e91e63", "#ff6b6b", "#d4a0a0", "#8b0000"];

const TABS = ["Body", "Face", "Hair", "Outfit", "Shoes"];

// ─── Main component ───────────────────────────────────────────────────────────
interface AvatarCreatorModalProps {
  onClose: () => void;
  onSave: (avatar: AvatarState) => void;
  initial?: AvatarState;
}

export default function AvatarCreatorModal({ onClose, onSave, initial }: AvatarCreatorModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [avatar, setAvatar] = useState<AvatarState>(initial ?? {
    skinTone: "#F5CBA7",
    bodyShape: "average",
    muscleTone: 0.5,
    height: 1.0,
    gender: "neutral",
    face: { eyeColor: "#3a2010", lipColor: "#c0392b" },
    attachments: { hair: "hair-short-crop", shirt: "shirt-tshirt", sneakers: "sneaker-low-white" },
  });

  const update = useCallback((patch: Partial<AvatarState>) => {
    setAvatar(prev => ({ ...prev, ...patch }));
  }, []);

  const updateFace = useCallback((patch: Partial<NonNullable<AvatarState["face"]>>) => {
    setAvatar(prev => ({ ...prev, face: { ...prev.face, ...patch } }));
  }, []);

  const updateAttach = useCallback((patch: Partial<NonNullable<AvatarState["attachments"]>>) => {
    setAvatar(prev => ({ ...prev, attachments: { ...prev.attachments, ...patch } }));
  }, []);

  const randomize = useCallback(() => {
    const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    setAvatar({
      skinTone: rand(SKIN_TONES).hex,
      bodyShape: rand(BODY_SHAPES),
      muscleTone: Math.random(),
      height: 0.9 + Math.random() * 0.2,
      face: {
        eyeColor: rand(EYE_COLORS),
        lipColor: rand(LIP_COLORS),
      },
      attachments: {
        hair: rand(HAIR_STYLES).id ?? undefined,
        hat: Math.random() > 0.7 ? rand(HATS.slice(1)).id ?? undefined : undefined,
        glasses: Math.random() > 0.7 ? rand(GLASSES.slice(1)).id ?? undefined : undefined,
        shirt: rand(SHIRTS.slice(1)).id ?? undefined,
        jacket: Math.random() > 0.6 ? rand(JACKETS.slice(1)).id ?? undefined : undefined,
        sneakers: rand(SHOES).id,
      },
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
          <h2 className="text-white font-bold text-lg">Avatar Creator</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800 gap-1.5" onClick={randomize}>
              <Shuffle className="w-3.5 h-3.5" /> Randomize
            </Button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Preview */}
          <div className="w-[320px] flex-shrink-0 flex flex-col items-center justify-center gap-3 p-4 border-r border-gray-700/50 bg-gray-900/50">
            <div className="w-full h-[420px]">
              <AvatarStudioViewport state={avatar} />
            </div>
            <p className="text-gray-500 text-xs text-center">Live 3D Preview</p>
          </div>

          {/* Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-700/50">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(i)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                    activeTab === i
                      ? "text-pink-400 border-b-2 border-pink-500 bg-pink-500/5"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* ── Body ── */}
              {activeTab === 0 && (
                <>
                  <Section title="Skin Tone">
                    <div className="grid grid-cols-6 gap-2">
                      {SKIN_TONES.map(s => (
                        <button
                          key={s.hex}
                          title={s.label}
                          onClick={() => update({ skinTone: s.hex })}
                          className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${avatar.skinTone === s.hex ? "border-pink-400 scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: s.hex }}
                        />
                      ))}
                    </div>
                  </Section>

                  <Section title="Body Shape">
                    <div className="grid grid-cols-3 gap-2">
                      {BODY_SHAPES.map(s => (
                        <button
                          key={s}
                          onClick={() => update({ bodyShape: s })}
                          className={`py-2 rounded-lg text-xs font-medium capitalize transition-all border ${
                            avatar.bodyShape === s
                              ? "border-pink-500 bg-pink-500/15 text-pink-300"
                              : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </Section>

                  <Section title={`Muscle Tone — ${Math.round((avatar.muscleTone ?? 0.5) * 100)}%`}>
                    <Slider
                      value={[avatar.muscleTone ?? 0.5]}
                      min={0} max={1} step={0.05}
                      onValueChange={([v]) => update({ muscleTone: v })}
                      className="w-full"
                    />
                  </Section>

                  <Section title={`Height — ${avatar.height && avatar.height >= 1 ? "+" : ""}${Math.round(((avatar.height ?? 1) - 1) * 100)}%`}>
                    <Slider
                      value={[avatar.height ?? 1.0]}
                      min={0.85} max={1.15} step={0.01}
                      onValueChange={([v]) => update({ height: v })}
                      className="w-full"
                    />
                  </Section>
                </>
              )}

              {/* ── Face ── */}
              {activeTab === 1 && (
                <>
                  <Section title="Eye Color">
                    <div className="flex gap-2 flex-wrap">
                      {EYE_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => updateFace({ eyeColor: c })}
                          className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${avatar.face?.eyeColor === c ? "border-pink-400 scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </Section>

                  <Section title="Lip Color">
                    <div className="flex gap-2 flex-wrap">
                      {LIP_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => updateFace({ lipColor: c })}
                          className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${avatar.face?.lipColor === c ? "border-pink-400 scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </Section>
                </>
              )}

              {/* ── Hair ── */}
              {activeTab === 2 && (
                <>
                  <Section title="Hairstyle">
                    <div className="grid grid-cols-3 gap-2">
                      {HAIR_STYLES.map(h => (
                        <button
                          key={h.id ?? "bald"}
                          onClick={() => updateAttach({ hair: h.id ?? undefined })}
                          className={`py-2 rounded-lg text-xs font-medium transition-all border ${
                            (avatar.attachments?.hair ?? null) === h.id
                              ? "border-pink-500 bg-pink-500/15 text-pink-300"
                              : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                          }`}
                        >
                          {h.label}
                        </button>
                      ))}
                    </div>
                  </Section>

                  <Section title="Hat">
                    <div className="grid grid-cols-3 gap-2">
                      {HATS.map(h => (
                        <button
                          key={h.id ?? "none"}
                          onClick={() => updateAttach({ hat: h.id ?? undefined })}
                          className={`py-2 rounded-lg text-xs font-medium transition-all border ${
                            (avatar.attachments?.hat ?? null) === h.id
                              ? "border-pink-500 bg-pink-500/15 text-pink-300"
                              : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                          }`}
                        >
                          {h.label}
                        </button>
                      ))}
                    </div>
                  </Section>

                  <Section title="Glasses / Sunglasses">
                    <div className="grid grid-cols-3 gap-2">
                      {GLASSES.map(g => (
                        <button
                          key={g.id ?? "none"}
                          onClick={() => {
                            if (!g.id) { updateAttach({ glasses: undefined, sunglasses: undefined }); return; }
                            if (g.isSunglasses) updateAttach({ sunglasses: g.id, glasses: undefined });
                            else updateAttach({ glasses: g.id, sunglasses: undefined });
                          }}
                          className={`py-2 rounded-lg text-xs font-medium transition-all border ${
                            (avatar.attachments?.glasses === g.id || avatar.attachments?.sunglasses === g.id)
                              ? "border-pink-500 bg-pink-500/15 text-pink-300"
                              : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </Section>
                </>
              )}

              {/* ── Outfit ── */}
              {activeTab === 3 && (
                <>
                  <Section title="Shirt">
                    <div className="grid grid-cols-3 gap-2">
                      {SHIRTS.map(s => (
                        <button
                          key={s.id ?? "none"}
                          onClick={() => updateAttach({ shirt: s.id ?? undefined })}
                          className={`py-2 rounded-lg text-xs font-medium transition-all border ${
                            (avatar.attachments?.shirt ?? null) === s.id
                              ? "border-pink-500 bg-pink-500/15 text-pink-300"
                              : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </Section>

                  <Section title="Jacket">
                    <div className="grid grid-cols-3 gap-2">
                      {JACKETS.map(j => (
                        <button
                          key={j.id ?? "none"}
                          onClick={() => updateAttach({ jacket: j.id ?? undefined })}
                          className={`py-2 rounded-lg text-xs font-medium transition-all border ${
                            (avatar.attachments?.jacket ?? null) === j.id
                              ? "border-pink-500 bg-pink-500/15 text-pink-300"
                              : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                          }`}
                        >
                          {j.label}
                        </button>
                      ))}
                    </div>
                  </Section>
                </>
              )}

              {/* ── Shoes ── */}
              {activeTab === 4 && (
                <Section title="Footwear">
                  <div className="grid grid-cols-3 gap-2">
                    {SHOES.map(s => (
                      <button
                        key={s.id}
                        onClick={() => updateAttach({ sneakers: s.id })}
                        className={`py-2 rounded-lg text-xs font-medium transition-all border ${
                          avatar.attachments?.sneakers === s.id
                            ? "border-pink-500 bg-pink-500/15 text-pink-300"
                            : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700/50 bg-gray-900/50">
          <div className="flex gap-2">
            {activeTab > 0 && (
              <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800 gap-1" onClick={() => setActiveTab(t => t - 1)}>
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </Button>
            )}
            {activeTab < TABS.length - 1 && (
              <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800 gap-1" onClick={() => setActiveTab(t => t + 1)}>
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          <Button
            className="bg-pink-600 hover:bg-pink-500 text-white font-bold gap-1.5"
            onClick={() => onSave(avatar)}
          >
            <Check className="w-4 h-4" /> Use This Avatar
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  );
}
