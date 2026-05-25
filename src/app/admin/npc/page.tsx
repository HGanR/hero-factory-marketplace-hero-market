"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Unlink,
  Users,
  X,
  HelpCircle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PersonalityState {
  friendliness: number;
  formality: number;
  verbosity: number;
  humor: number;
  patience: number;
  expertise: number;
}

interface NPCProfile {
  id: string;
  name: string;
  role: "secretary" | "avatar" | "guide" | "voice_agent" | "executive_admin";
  title?: string | null;
  avatarEmoji: string;
  greeting?: string | null;
  farewell?: string | null;
  voiceStyle?: string | null;
  language?: string | null;
  worldId?: string | null;
  buildingId?: string | null;
  floor?: number | null;
  personality?: PersonalityState;
  knowledgeTopics?: string[];
  isActive?: boolean;
}

interface NPCQuestion {
  id: number;
  npcId: number;
  question: string;
  correctAnswers: string[];
  wrongAnswerResponse: string;
  successResponse: string | null;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_PERSONALITY: PersonalityState = {
  friendliness: 70,
  formality: 50,
  verbosity: 50,
  humor: 30,
  patience: 70,
  expertise: 50,
};

const ROLE_INFO: Record<string, { emoji: string; description: string; defaultEmoji: string }> = {
  secretary: {
    emoji: "👔",
    description: "Manages schedules, handles visitors, and assists with administrative tasks.",
    defaultEmoji: "👔",
  },
  avatar: {
    emoji: "🧑‍💼",
    description: "Represents the world owner, greets visitors, and shares personal information.",
    defaultEmoji: "🧑‍💼",
  },
  guide: {
    emoji: "🗺️",
    description: "Tours the world, explains buildings, and helps visitors navigate.",
    defaultEmoji: "🗺️",
  },
  voice_agent: {
    emoji: "📞",
    description: "Answers phone calls, assignable to consultant websites. Twilio/SMS integration.",
    defaultEmoji: "📞",
  },
  executive_admin: {
    emoji: "🎛️",
    description: "Executive administration desk — analytics, CRM, cross-agent intelligence; not a generic receptionist.",
    defaultEmoji: "🎛️",
  },
};

const PERSONALITY_LABELS: Record<keyof PersonalityState, { label: string; low: string; high: string }> = {
  friendliness: { label: "Friendliness", low: "Reserved", high: "Very Warm" },
  formality: { label: "Formality", low: "Casual", high: "Very Formal" },
  verbosity: { label: "Verbosity", low: "Concise", high: "Detailed" },
  humor: { label: "Humor", low: "Serious", high: "Playful" },
  patience: { label: "Patience", low: "Direct", high: "Very Patient" },
  expertise: { label: "Expertise", low: "General", high: "Expert" },
};

const EMOJI_OPTIONS = ["👔", "🧑‍💼", "🗺️", "🤖", "🧙", "👩‍💻", "🦊", "🐉", "🎭", "🛡️", "⚔️", "🌟", "🧠", "💎", "🔮", "🎪"];

const COMMON_LANGUAGES = [
  { value: "", label: "Default (match user)" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "zh", label: "Chinese (Simplified)" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "ru", label: "Russian" },
];

/** Troo Town uses worldId=green-terrain. Filter to show only NPCs that appear in /troo-town. */
const TROO_TOWN_WORLD_ID = "green-terrain";

function errorMessageFromUnknown(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

/** Avoid JSON.parse on empty or HTML error bodies (browser shows a clear message instead of SyntaxError). */
async function readResponseJson(res: Response): Promise<Record<string, unknown>> {
  const raw = await res.text();
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(
      `Empty response from server (HTTP ${res.status}). Often DATABASE_URL/API failure — check deployment logs.`,
    );
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error(`Non-JSON response (HTTP ${res.status}): ${trimmed.slice(0, 160)}`);
  }
}

const adminFetchInit = { credentials: "include" as const };

function NPCAdminPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [npcList, setNpcList] = useState<NPCProfile[]>([]);
  /** Default "All NPCs" — Troo-only filter hides most seeded NPCs (other worlds / global). */
  const [trooTownFilter, setTrooTownFilter] = useState<boolean>(false);
  const [selectedNPCId, setSelectedNPCId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<NPCProfile | null>(null);
  /** Latest NPC id we intend to show in the detail pane — avoids applying a stale fetch after switching NPCs. */
  const profileLoadForNpcIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editVoice, setEditVoice] = useState("");
  const [editLanguage, setEditLanguage] = useState("");
  const [editGreeting, setEditGreeting] = useState("");
  const [editFarewell, setEditFarewell] = useState("");
  const [editPersonality, setEditPersonality] = useState<PersonalityState>({ ...DEFAULT_PERSONALITY });

  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState<string>("guide");
  const [createTitle, setCreateTitle] = useState("");
  const [createEmoji, setCreateEmoji] = useState("🤖");
  const [createVoice, setCreateVoice] = useState<string>("friendly");
  const [createLanguage, setCreateLanguage] = useState("");
  const [createWorldId, setCreateWorldId] = useState("");
  const [createPersonality, setCreatePersonality] = useState<PersonalityState>({ ...DEFAULT_PERSONALITY });

  const [telegramStatus, setTelegramStatus] = useState<{
    isConnected: boolean;
    hasToken: boolean;
    webhookUrl: string | null;
    botInfo: { username?: string; firstName?: string } | null;
    connectedAt: string | null;
  } | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [showTelegramDialog, setShowTelegramDialog] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState("");

  // Q&A State
  const [qaList, setQaList] = useState<NPCQuestion[]>([]);
  const [qaLoading, setQaLoading] = useState(false);
  const [showQADialog, setShowQADialog] = useState(false);
  const [editingQA, setEditingQA] = useState<NPCQuestion | null>(null);
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaCorrectAnswers, setQaCorrectAnswers] = useState("");
  const [qaWrongResponse, setQaWrongResponse] = useState("");
  const [qaSuccessResponse, setQaSuccessResponse] = useState("");

  const npcIdFromQuery = searchParams?.get("npcId")?.trim() || null;

  const loadNPCs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/npc/admin/npcs", adminFetchInit);
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(String(data.error || "Failed to load NPCs"));
      const raw = Array.isArray(data.npcs) ? (data.npcs as NPCProfile[]) : [];
      raw.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
      setNpcList(raw);
      if (npcIdFromQuery && raw.some((n) => n.id === npcIdFromQuery)) {
        setSelectedNPCId(npcIdFromQuery);
      }
    } catch (err: unknown) {
      toast.error(errorMessageFromUnknown(err, "Failed to load NPCs"));
      setNpcList([]);
    } finally {
      setLoading(false);
    }
  }, [npcIdFromQuery]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/check", { ...adminFetchInit, cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          try {
            localStorage.removeItem("adminLoggedIn");
          } catch {
            /* ignore */
          }
          router.replace("/admin");
          return;
        }
        try {
          localStorage.setItem("adminLoggedIn", "true");
        } catch {
          /* ignore */
        }
      } catch {
        if (!cancelled) router.replace("/admin");
        return;
      }
      if (cancelled) return;
      await loadNPCs();
    })();
    return () => {
      cancelled = true;
    };
  }, [router, loadNPCs]);

  const loadProfile = async (npcId: string) => {
    try {
      const res = await fetch(`/api/npc/profile/${encodeURIComponent(npcId)}`);
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(String(data.error || "Failed to load profile"));
      if (profileLoadForNpcIdRef.current !== npcId) return;
      const raw = data.profile;
      if (!raw || typeof raw !== "object") {
        throw new Error("Invalid profile response from server");
      }
      const profile = raw as NPCProfile;
      if (!profile.id || typeof profile.id !== "string") {
        throw new Error("NPC profile is missing id");
      }
      setSelectedProfile(profile);
    } catch (err: unknown) {
      if (profileLoadForNpcIdRef.current === npcId) {
        toast.error(errorMessageFromUnknown(err, "Failed to load profile"));
        setSelectedProfile(null);
        setSelectedNPCId(null);
      }
    }
  };

  useEffect(() => {
    setIsEditing(false);
    setTelegramStatus(null);
    setQaList([]);
    if (!selectedNPCId) {
      profileLoadForNpcIdRef.current = null;
      setSelectedProfile(null);
      return;
    }
    profileLoadForNpcIdRef.current = selectedNPCId;
    setSelectedProfile(null);
    void loadProfile(selectedNPCId);
    void loadTelegramStatus(selectedNPCId);
    void loadQAList(selectedNPCId);
  }, [selectedNPCId]);

  const loadQAList = async (npcId: string) => {
    setQaLoading(true);
    try {
      const res = await fetch(`/api/npc/admin/qa?npcId=${encodeURIComponent(npcId)}`, adminFetchInit);
      const data = await readResponseJson(res);
      if (res.ok) {
        setQaList((data.questions as NPCQuestion[] | undefined) || []);
      }
    } catch {
      // Q&A loading is optional
    } finally {
      setQaLoading(false);
    }
  };

  const openQADialog = (qa?: NPCQuestion) => {
    if (qa) {
      setEditingQA(qa);
      setQaQuestion(qa.question);
      setQaCorrectAnswers(qa.correctAnswers.join(", "));
      setQaWrongResponse(qa.wrongAnswerResponse);
      setQaSuccessResponse(qa.successResponse || "");
    } else {
      setEditingQA(null);
      setQaQuestion("");
      setQaCorrectAnswers("");
      setQaWrongResponse("");
      setQaSuccessResponse("");
    }
    setShowQADialog(true);
  };

  const handleSaveQA = async () => {
    if (!selectedProfile || !qaQuestion.trim() || !qaCorrectAnswers.trim() || !qaWrongResponse.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    const answers = qaCorrectAnswers.split(",").map(a => a.trim().toLowerCase()).filter(a => a);

    try {
      if (editingQA) {
        // Update existing
        const res = await fetch("/api/npc/admin/qa", {
          ...adminFetchInit,
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingQA.id,
            question: qaQuestion.trim(),
            correctAnswers: answers,
            wrongAnswerResponse: qaWrongResponse.trim(),
            successResponse: qaSuccessResponse.trim() || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error || "Failed to update Q&A");
        }
        toast.success("Q&A updated successfully");
      } else {
        // Create new
        const res = await fetch("/api/npc/admin/qa", {
          ...adminFetchInit,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            npcId: selectedProfile.id,
            question: qaQuestion.trim(),
            correctAnswers: answers,
            wrongAnswerResponse: qaWrongResponse.trim(),
            successResponse: qaSuccessResponse.trim() || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error || "Failed to create Q&A");
        }
        toast.success("Q&A created successfully");
      }
      setShowQADialog(false);
      loadQAList(selectedProfile.id);
    } catch (err: unknown) {
      toast.error(errorMessageFromUnknown(err, "Failed to save Q&A"));
    }
  };

  const handleDeleteQA = async (qaId: number) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      const res = await fetch("/api/npc/admin/qa", {
        ...adminFetchInit,
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: qaId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Failed to delete Q&A");
      }
      toast.success("Q&A deleted");
      if (selectedProfile) loadQAList(selectedProfile.id);
    } catch (err: unknown) {
      toast.error(errorMessageFromUnknown(err, "Failed to delete Q&A"));
    }
  };

  const handleReorderQA = async (qaId: number, direction: "up" | "down") => {
    const idx = qaList.findIndex(q => q.id === qaId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === qaList.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const currentQA = qaList[idx];
    const swapQA = qaList[swapIdx];
    if (!currentQA?.id || !swapQA?.id) {
      toast.error("Could not reorder — Q&A list is out of sync. Refresh the page.");
      return;
    }

    try {
      // Swap order indices
      await Promise.all([
        fetch("/api/npc/admin/qa", {
          ...adminFetchInit,
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: currentQA.id, orderIndex: swapQA.orderIndex }),
        }),
        fetch("/api/npc/admin/qa", {
          ...adminFetchInit,
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: swapQA.id, orderIndex: currentQA.orderIndex }),
        }),
      ]);
      if (selectedProfile) loadQAList(selectedProfile.id);
    } catch {
      toast.error("Failed to reorder questions");
    }
  };

  const loadTelegramStatus = async (npcId: string) => {
    try {
      const res = await fetch(`/api/npc/admin/telegram?npcId=${encodeURIComponent(npcId)}`, adminFetchInit);
      const data = await res.json();
      if (res.ok) {
        setTelegramStatus(data);
      }
    } catch {
      // Telegram status is optional
    }
  };

  const connectTelegram = async () => {
    if (!selectedProfile || !telegramBotToken.trim()) return;
    setTelegramLoading(true);
    try {
      const res = await fetch("/api/npc/admin/telegram", {
        ...adminFetchInit,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npcId: selectedProfile.id,
          botToken: telegramBotToken.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to connect Telegram bot");
        return;
      }
      toast.success(`Connected to @${data.botUsername || "bot"}!`);
      setShowTelegramDialog(false);
      setTelegramBotToken("");
      await loadTelegramStatus(selectedProfile.id);
    } catch (err: unknown) {
      toast.error(errorMessageFromUnknown(err, "Failed to connect Telegram"));
    } finally {
      setTelegramLoading(false);
    }
  };

  const disconnectTelegram = async () => {
    if (!selectedProfile) return;
    setTelegramLoading(true);
    try {
      const res = await fetch("/api/npc/admin/telegram", {
        ...adminFetchInit,
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npcId: selectedProfile.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data?.error || "Failed to disconnect");
        return;
      }
      toast.success("Telegram bot disconnected");
      await loadTelegramStatus(selectedProfile.id);
    } catch (err: unknown) {
      toast.error(errorMessageFromUnknown(err, "Failed to disconnect"));
    } finally {
      setTelegramLoading(false);
    }
  };

  const startEditing = () => {
    if (!selectedProfile) return;
    setEditName(selectedProfile.name);
    setEditTitle(selectedProfile.title || "");
    setEditEmoji(selectedProfile.avatarEmoji);
    setEditVoice(selectedProfile.voiceStyle || "friendly");
    setEditLanguage(selectedProfile.language || "");
    setEditGreeting(selectedProfile.greeting || "");
    setEditFarewell(selectedProfile.farewell || "");
    setEditPersonality(selectedProfile.personality ? { ...selectedProfile.personality } : { ...DEFAULT_PERSONALITY });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedProfile || !editName.trim()) return;
    const res = await fetch("/api/npc/admin/npcs", {
      ...adminFetchInit,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        npcId: selectedProfile.id,
        name: editName.trim(),
        title: editTitle.trim() || undefined,
        avatarEmoji: editEmoji,
        voiceStyle: editVoice,
        language: editLanguage.trim() || undefined,
        greeting: editGreeting.trim() || undefined,
        farewell: editFarewell.trim() || undefined,
        personality: editPersonality,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error || "Failed to update NPC");
      return;
    }
    toast.success(`NPC "${editName}" updated.`);
    setIsEditing(false);
    await loadNPCs();
    if (selectedProfile?.id) await loadProfile(selectedProfile.id);
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      toast.error("Please enter a name for the NPC");
      return;
    }
    const res = await fetch("/api/npc/admin/npcs", {
      ...adminFetchInit,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: createName.trim(),
        role: createRole,
        title: createTitle.trim() || undefined,
        avatarEmoji: createEmoji,
        voiceStyle: createVoice,
        language: createLanguage.trim() || undefined,
        worldId: createWorldId.trim() || undefined,
        personality: createPersonality,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error || "Failed to create NPC");
      return;
    }
    toast.success(`NPC "${createName}" created.`);
    setShowCreateDialog(false);
    setCreateName("");
    setCreateRole("guide");
    setCreateTitle("");
    setCreateEmoji("🤖");
    setCreateVoice("friendly");
    setCreateLanguage("");
    setCreateWorldId("");
    setCreatePersonality({ ...DEFAULT_PERSONALITY });
    await loadNPCs();
  };

  const handleDeactivate = async (npcId: string) => {
    const res = await fetch("/api/npc/admin/npcs", {
      ...adminFetchInit,
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ npcId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error || "Failed to deactivate NPC");
      return;
    }
    toast.success("NPC deactivated");
    setShowDeactivateConfirm(null);
    setSelectedNPCId(null);
    await loadNPCs();
  };

  const detailReady =
    selectedNPCId != null &&
    selectedProfile != null &&
    selectedProfile.id === selectedNPCId;
  const profileLoadPending = selectedNPCId != null && !detailReady;

  if (detailReady && selectedProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white"
                onClick={() => {
                  setSelectedNPCId(null);
                  setIsEditing(false);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to NPCs
              </Button>
              <Separator className="h-6 w-px bg-gray-700" />
              <div className="flex items-center gap-3">
                {isEditing ? (
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_OPTIONS.slice(0, 8).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setEditEmoji(emoji)}
                        className={`w-9 h-9 rounded-md flex items-center justify-center text-lg transition-all ${
                          editEmoji === emoji
                            ? "bg-purple-600 ring-2 ring-purple-400 scale-110"
                            : "bg-gray-700/50 hover:bg-gray-600/50"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-3xl">{selectedProfile.avatarEmoji}</span>
                )}
                <div>
                  {isEditing ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-gray-700/50 border-purple-500/50 text-white text-xl font-bold h-8 w-48"
                    />
                  ) : (
                    <h1 className="text-xl font-bold">{selectedProfile.name}</h1>
                  )}
                  {isEditing ? (
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Title..."
                      className="bg-gray-700/50 border-gray-600 text-gray-300 text-sm h-7 w-48 mt-1"
                    />
                  ) : (
                    <p className="text-sm text-gray-400">{selectedProfile.title}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:text-white" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleSaveEdit}>
                    <Save className="h-4 w-4 mr-1" />
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="border-purple-600 text-purple-300 hover:text-white hover:bg-purple-900/30" onClick={startEditing}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit NPC
                  </Button>
                  <Link href={`/admin/npc/knowledge?npcId=${selectedProfile.id}`}>
                    <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:text-white">
                      <BookOpen className="h-4 w-4 mr-2" />
                      Knowledge Base
                    </Button>
                  </Link>
                  <Link href={`/admin/npc/analytics?npcId=${selectedProfile.id}`}>
                    <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:text-white">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Analytics
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-400" />
                  Profile Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400 text-xs uppercase tracking-wider">Role</Label>
                    <p className="text-white capitalize mt-1">{selectedProfile.role}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs uppercase tracking-wider">Voice Style</Label>
                    {isEditing ? (
                      <Select value={editVoice} onValueChange={setEditVoice}>
                        <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white mt-1 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="friendly">Friendly</SelectItem>
                          <SelectItem value="authoritative">Authoritative</SelectItem>
                          <SelectItem value="warm">Warm</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-white capitalize mt-1">{selectedProfile.voiceStyle || "Default"}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs uppercase tracking-wider">Language</Label>
                    {isEditing ? (
                      <select
                        value={editLanguage}
                        onChange={(e) => setEditLanguage(e.target.value)}
                        className="mt-1 h-8 w-full rounded-md bg-gray-700/50 border border-gray-600 text-white text-sm px-3"
                      >
                        {COMMON_LANGUAGES.map((l) => (
                          <option key={l.value || "default"} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-white mt-1">
                        {selectedProfile.language
                          ? COMMON_LANGUAGES.find((l) => l.value === selectedProfile.language)?.label ?? selectedProfile.language
                          : "Default"}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs uppercase tracking-wider">World</Label>
                    <p className="text-white mt-1">{selectedProfile.worldId || "Global"}</p>
                  </div>
                  {selectedProfile.buildingId && (
                    <div>
                      <Label className="text-gray-400 text-xs uppercase tracking-wider">Building · Floor</Label>
                      <p className="text-white mt-1">
                        {selectedProfile.buildingId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        {selectedProfile.floor !== undefined && selectedProfile.floor !== null ? ` · Floor ${selectedProfile.floor}` : ""}
                      </p>
                    </div>
                  )}
                  <div>
                    <Label className="text-gray-400 text-xs uppercase tracking-wider">Knowledge Topics</Label>
                    <p className="text-white mt-1">{selectedProfile.knowledgeTopics?.length || 0} entries</p>
                  </div>
                </div>

                <Separator className="bg-gray-700" />

                <div>
                  <Label className="text-gray-400 text-xs uppercase tracking-wider">Greeting</Label>
                  {isEditing ? (
                    <Textarea value={editGreeting} onChange={(e) => setEditGreeting(e.target.value)} className="bg-gray-700/50 border-gray-600 text-white mt-1 text-sm min-h-[60px]" />
                  ) : (
                    <p className="text-gray-300 mt-1 text-sm italic">{`"${selectedProfile.greeting ?? ""}"`}</p>
                  )}
                </div>
                <div>
                  <Label className="text-gray-400 text-xs uppercase tracking-wider">Farewell</Label>
                  {isEditing ? (
                    <Textarea value={editFarewell} onChange={(e) => setEditFarewell(e.target.value)} className="bg-gray-700/50 border-gray-600 text-white mt-1 text-sm min-h-[60px]" />
                  ) : (
                    <p className="text-gray-300 mt-1 text-sm italic">{`"${selectedProfile.farewell ?? ""}"`}</p>
                  )}
                </div>

                <Separator className="bg-gray-700" />

                <div className="flex gap-2">
                  <Link href="/oasis-npc">
                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Chat with {selectedProfile.name}
                    </Button>
                  </Link>
                  {!isEditing && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-800 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                      onClick={() => setShowDeactivateConfirm(selectedProfile.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Deactivate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-400" />
                  Personality Profile
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {isEditing ? "Drag the sliders to adjust personality traits" : "How this NPC behaves in conversations"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {Object.entries(PERSONALITY_LABELS).map(([key, meta]) => {
                  const traitKey = key as keyof PersonalityState;
                  const value = isEditing ? editPersonality[traitKey] : selectedProfile.personality?.[traitKey] || 50;

                  return (
                    <div key={key}>
                      <div className="flex justify-between items-center mb-2">
                        <Label className="text-gray-300 text-sm">{meta.label}</Label>
                        <span className="text-xs text-gray-500">
                          {value <= 30 ? meta.low : value >= 70 ? meta.high : "Balanced"}
                        </span>
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-16 text-right">{meta.low}</span>
                          <Slider
                            value={[editPersonality[traitKey]]}
                            onValueChange={([val]) => setEditPersonality((prev) => ({ ...prev, [key]: val }))}
                            min={0}
                            max={100}
                            step={5}
                            className="flex-1"
                          />
                          <span className="text-xs text-purple-400 font-mono w-8 text-center">
                            {editPersonality[traitKey]}
                          </span>
                          <span className="text-xs text-gray-500 w-20">{meta.high}</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${value}%`,
                                background: `linear-gradient(90deg, #6366f1 0%, #a855f7 ${value}%)`,
                              }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-gray-600">{meta.low}</span>
                            <span className="text-[10px] text-purple-400 font-medium">{value}</span>
                            <span className="text-[10px] text-gray-600">{meta.high}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Q&A Gatekeeper Questions Card */}
          <Card className="mt-8 bg-gray-800/50 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-amber-400" />
                    Gatekeeper Questions
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Set up questions the NPC will ask visitors. They must answer correctly to proceed.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={() => openQADialog()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {qaLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                </div>
              ) : qaList.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No gatekeeper questions configured</p>
                  <p className="text-sm mt-1">Add questions that visitors must answer correctly</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {qaList.map((qa, idx) => (
                    <div
                      key={qa.id}
                      className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg hover:border-amber-500/30 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-1 pt-1">
                          <button
                            onClick={() => handleReorderQA(qa.id, "up")}
                            disabled={idx === 0}
                            className="p-1 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <span className="text-xs text-gray-500 font-mono">{idx + 1}</span>
                          <button
                            onClick={() => handleReorderQA(qa.id, "down")}
                            disabled={idx === qaList.length - 1}
                            className="p-1 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium">{qa.question}</p>
                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-start gap-2">
                              <Badge variant="outline" className="border-green-500/50 text-green-400 text-xs shrink-0">
                                ✓ Correct
                              </Badge>
                              <span className="text-sm text-gray-400">
                                {qa.correctAnswers.join(", ")}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <Badge variant="outline" className="border-red-500/50 text-red-400 text-xs shrink-0">
                                ✗ Wrong
                              </Badge>
                              <span className="text-sm text-gray-400 line-clamp-1">
                                {qa.wrongAnswerResponse}
                              </span>
                            </div>
                            {qa.successResponse && (
                              <div className="flex items-start gap-2">
                                <Badge variant="outline" className="border-blue-500/50 text-blue-400 text-xs shrink-0">
                                  → Success
                                </Badge>
                                <span className="text-sm text-gray-400 line-clamp-1">
                                  {qa.successResponse}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-400 hover:text-white"
                            onClick={() => openQADialog(qa)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                            onClick={() => handleDeleteQA(qa.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Telegram Integration Card */}
          <Card className="mt-8 bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-400" />
                Telegram Integration
              </CardTitle>
              <CardDescription className="text-gray-400">
                Connect this NPC to a Telegram bot to chat with users on Telegram
              </CardDescription>
            </CardHeader>
            <CardContent>
              {telegramStatus?.isConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <Send className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">
                          @{telegramStatus.botInfo?.username || "Connected Bot"}
                        </span>
                        <Badge variant="outline" className="border-green-500/50 text-green-400 text-xs">
                          Connected
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400">
                        {telegramStatus.botInfo?.firstName && `${telegramStatus.botInfo.firstName} · `}
                        Messages are routed to this NPC
                      </p>
                    </div>
                    <a
                      href={`https://t.me/${telegramStatus.botInfo?.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  {telegramStatus.webhookUrl && (
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-xs uppercase tracking-wider">Webhook URL</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={telegramStatus.webhookUrl}
                          className="bg-gray-900/50 border-gray-600 text-gray-300 font-mono text-xs"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-600 text-gray-300 shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(telegramStatus.webhookUrl!);
                            toast.success("Copied to clipboard");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-800 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                      onClick={disconnectTelegram}
                      disabled={telegramLoading}
                    >
                      {telegramLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Unlink className="h-4 w-4 mr-2" />
                      )}
                      Disconnect Bot
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
                    <h4 className="text-white font-medium mb-2">Connect a Telegram Bot</h4>
                    <ol className="text-sm text-gray-400 space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 font-mono">1.</span>
                        <span>
                          Open Telegram and search for{" "}
                          <a
                            href="https://t.me/BotFather"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            @BotFather
                          </a>
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 font-mono">2.</span>
                        <span>Send <code className="bg-gray-800 px-1.5 py-0.5 rounded text-blue-300">/newbot</code> and follow the prompts</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 font-mono">3.</span>
                        <span>Copy the HTTP API token BotFather gives you</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 font-mono">4.</span>
                        <span>Paste it below to connect</span>
                      </li>
                    </ol>
                  </div>

                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => setShowTelegramDialog(true)}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Connect Telegram Bot
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        {/* Telegram Connection Dialog */}
        <Dialog open={showTelegramDialog} onOpenChange={setShowTelegramDialog}>
          <DialogContent className="bg-gray-800 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-400" />
                Connect Telegram Bot
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Enter your bot token from @BotFather to connect this NPC to Telegram.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Bot Token</Label>
                <Input
                  type="password"
                  placeholder="123456789:ABCdefGHI..."
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white font-mono placeholder:text-gray-500"
                />
                <p className="text-xs text-gray-500">
                  This token is stored securely and used to send/receive messages.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="border-gray-600 text-gray-300"
                onClick={() => {
                  setShowTelegramDialog(false);
                  setTelegramBotToken("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={connectTelegram}
                disabled={!telegramBotToken.trim() || telegramLoading}
              >
                {telegramLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!showDeactivateConfirm} onOpenChange={() => setShowDeactivateConfirm(null)}>
          <DialogContent className="bg-gray-800 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>Deactivate NPC?</DialogTitle>
              <DialogDescription className="text-gray-400">
                This will disable the NPC. It will not appear in the chat interface anymore.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" className="border-gray-600 text-gray-300" onClick={() => setShowDeactivateConfirm(null)}>
                Cancel
              </Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => showDeactivateConfirm && handleDeactivate(showDeactivateConfirm)}>
                Deactivate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Q&A Dialog */}
        <Dialog open={showQADialog} onOpenChange={setShowQADialog}>
          <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-amber-400" />
                {editingQA ? "Edit Question" : "Add Gatekeeper Question"}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Configure a question the NPC will ask visitors. Multiple correct answers can be comma-separated.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Question *</Label>
                <Textarea
                  placeholder="e.g., What is the company name you are visiting?"
                  value={qaQuestion}
                  onChange={(e) => setQaQuestion(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Correct Answers * (comma-separated)</Label>
                <Input
                  placeholder="e.g., troothhertz, troothhertz llc, trooth"
                  value={qaCorrectAnswers}
                  onChange={(e) => setQaCorrectAnswers(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                />
                <p className="text-xs text-gray-500">
                  Enter all acceptable answers separated by commas. Matching is case-insensitive.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Wrong Answer Response *</Label>
                <Textarea
                  placeholder="e.g., I'm sorry, that doesn't match our records. Please try again."
                  value={qaWrongResponse}
                  onChange={(e) => setQaWrongResponse(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 min-h-[80px]"
                />
                <p className="text-xs text-gray-500">
                  What the NPC says when the visitor gives a wrong answer.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Success Response (optional)</Label>
                <Textarea
                  placeholder="e.g., Perfect! Let me verify one more thing..."
                  value={qaSuccessResponse}
                  onChange={(e) => setQaSuccessResponse(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 min-h-[60px]"
                />
                <p className="text-xs text-gray-500">
                  Optional message when correct. If blank, moves to next question silently.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="border-gray-600 text-gray-300"
                onClick={() => setShowQADialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700"
                onClick={handleSaveQA}
                disabled={!qaQuestion.trim() || !qaCorrectAnswers.trim() || !qaWrongResponse.trim()}
              >
                <Check className="h-4 w-4 mr-2" />
                {editingQA ? "Save Changes" : "Add Question"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (profileLoadPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
              onClick={() => {
                setSelectedNPCId(null);
                setSelectedProfile(null);
                profileLoadForNpcIdRef.current = null;
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to NPCs
            </Button>
            <Separator className="h-6 w-px bg-gray-700" />
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
            <span className="text-gray-400 text-sm">Loading NPC…</span>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Admin
              </Button>
            </Link>
            <Separator className="h-6 w-px bg-gray-700" />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Settings className="h-6 w-6 text-purple-400" />
                NPC Admin Panel
              </h1>
              <p className="text-sm text-gray-400">Manage AI characters, knowledge, and analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app/dashboard">
              <Button variant="outline" size="sm" className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10">
                CRM Dashboard
              </Button>
            </Link>
            <Link href="/admin/npc/knowledge">
              <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:text-white">
                <BookOpen className="h-4 w-4 mr-2" />
                Knowledge
              </Button>
            </Link>
            <Link href="/admin/npc/analytics">
              <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:text-white">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </Button>
            </Link>
            <Button className="bg-purple-600 hover:bg-purple-700" size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create NPC
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-8 border-cyan-500/30 bg-cyan-500/5">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-cyan-200 flex items-center gap-2">
                  <span className="text-2xl">📞</span>
                  AI / Voice Agents
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Create voice agents that answer phone calls. Assign to consultant websites for 24/7 automated reception.
                  Build on NPCs — add voice_agent role when creating.
                </p>
                <Link href="/app/dashboard" className="inline-block mt-3 text-cyan-400 hover:text-cyan-300 text-sm font-medium">
                  Open CRM Dashboard →
                </Link>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20 shrink-0"
                onClick={() => setShowCreateDialog(true)}
              >
                Create NPC (incl. Voice Agent)
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-3 bg-purple-900/30 rounded-lg">
                <Users className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{npcList.length}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Active NPCs</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-3 bg-blue-900/30 rounded-lg">
                <Brain className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">3</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Role Types</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-3 bg-green-900/30 rounded-lg">
                <Sparkles className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">Hybrid</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">AI Engine</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-pulse text-gray-500">Loading NPCs...</div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Label className="text-gray-400 text-sm">Show:</Label>
                <Select
                  value={trooTownFilter ? "troo-town" : "all"}
                  onValueChange={(v) => setTrooTownFilter(v === "troo-town")}
                >
                  <SelectTrigger className="w-[280px] bg-gray-800 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations (Jarva, MAANIA, all towers, global…)</SelectItem>
                    <SelectItem value="troo-town">Troo Town / green-terrain only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!trooTownFilter && (
                <p className="text-sm text-gray-500 max-w-xl">
                  Full roster for management. Use “Troo Town only” to focus on{" "}
                  <code className="text-gray-400">worldId=green-terrain</code> (Nexus, TroothHertz, etc.).
                </p>
              )}
              {trooTownFilter && (
                <p className="text-sm text-cyan-400/80">
                  Showing NPCs with worldId=green-terrain · Edits here appear in <Link href="/troo-town" className="underline hover:text-cyan-300">Troo Town</Link>
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(() => {
              const safeList = npcList.filter((n): n is NPCProfile => Boolean(n && typeof n.id === "string"));
              const filtered = trooTownFilter
                ? safeList.filter((n) => n.worldId === TROO_TOWN_WORLD_ID)
                : safeList;
              if (filtered.length === 0) {
                return (
                  <div className="col-span-full py-12 text-center text-gray-500">
                    {trooTownFilter
                      ? "No NPCs match Troo Town (worldId=green-terrain). Use the Show menu and pick All NPCs to list every NPC, or seed Troo Town NPCs if this world should have its own roster."
                      : "No NPCs yet. Create one to get started."}
                  </div>
                );
              }
              return filtered.map((npc) => (
              <Card
                key={npc.id}
                className="bg-gray-800/50 border-gray-700 hover:border-purple-500/50 transition-all cursor-pointer group"
                onClick={() => setSelectedNPCId(npc.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl group-hover:scale-110 transition-transform">{npc.avatarEmoji}</span>
                      <div>
                        <CardTitle className="text-white text-lg">{npc.name}</CardTitle>
                        <p className="text-sm text-purple-400">{npc.title}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-gray-600 text-gray-400 capitalize text-xs">
                      {npc.role}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 text-sm line-clamp-2 mb-4">{npc.greeting}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                      <span className="capitalize">{npc.voiceStyle || "friendly"} voice</span>
                      <span>·</span>
                      {npc.buildingId ? (
                        <span className="text-cyan-400/80">
                          {npc.buildingId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          {npc.floor !== undefined && npc.floor !== null ? ` · Floor ${npc.floor}` : ""}
                        </span>
                      ) : (
                        <span>{npc.worldId || "Global"}</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/30 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNPCId(npc.id);
                      }}
                    >
                      Manage →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ));
            })()}
            </div>
          </>
        )}
      </main>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              Create New NPC
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Design a new AI character with a unique personality and role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Name *</Label>
                <Input
                  placeholder="e.g., Luna"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Title</Label>
                <Input
                  placeholder="e.g., Head of Security"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Role *</Label>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(ROLE_INFO).map(([role, info]) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      setCreateRole(role);
                      setCreateEmoji(info.defaultEmoji);
                    }}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      createRole === role
                        ? "border-purple-500 bg-purple-900/30"
                        : "border-gray-600 bg-gray-700/30 hover:border-gray-500"
                    }`}
                  >
                    <div className="text-2xl mb-1">{info.emoji}</div>
                    <div className="text-sm font-medium text-white capitalize">{role}</div>
                    <div className="text-xs text-gray-400 mt-1 line-clamp-2">{info.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Avatar Emoji</Label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setCreateEmoji(emoji)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                        createEmoji === emoji
                          ? "bg-purple-600 ring-2 ring-purple-400"
                          : "bg-gray-700/50 hover:bg-gray-600/50"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Voice Style</Label>
                  <Select value={createVoice} onValueChange={setCreateVoice}>
                    <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="authoritative">Authoritative</SelectItem>
                      <SelectItem value="warm">Warm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Language</Label>
                  <select
                    value={createLanguage}
                    onChange={(e) => setCreateLanguage(e.target.value)}
                    className="w-full rounded-md bg-gray-700/50 border border-gray-600 text-white text-sm px-3 py-2"
                  >
                    {COMMON_LANGUAGES.map((l) => (
                      <option key={l.value || "default"} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">When set, NPC will speak and respond in this language</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">World ID (optional)</Label>
                  <Input
                    placeholder="e.g., my-world-1"
                    value={createWorldId}
                    onChange={(e) => setCreateWorldId(e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-gray-700" />

            <div>
              <Label className="text-gray-300 text-base font-semibold mb-4 block">Personality Tuning</Label>
              <div className="space-y-5">
                {Object.entries(PERSONALITY_LABELS).map(([key, meta]) => (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-300">{meta.label}</span>
                      <span className="text-xs text-purple-400 font-mono">
                        {createPersonality[key as keyof PersonalityState]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-16 text-right">{meta.low}</span>
                      <Slider
                        value={[createPersonality[key as keyof PersonalityState]]}
                        onValueChange={([val]) =>
                          setCreatePersonality((prev) => ({ ...prev, [key]: val }))
                        }
                        min={0}
                        max={100}
                        step={5}
                        className="flex-1"
                      />
                      <span className="text-xs text-gray-500 w-20">{meta.high}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleCreate} disabled={!createName.trim()}>
              <Sparkles className="h-4 w-4 mr-2" />
              Create NPC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function NPCAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-8 text-muted-foreground">
          Loading NPC admin…
        </div>
      }
    >
      <NPCAdminPageContent />
    </Suspense>
  );
}
