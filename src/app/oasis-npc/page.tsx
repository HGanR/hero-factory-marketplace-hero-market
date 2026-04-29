/* eslint-disable @next/next/no-img-element */
"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  ChevronLeft,
  MessageSquare,
  Send,
  Settings,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface ChatMessage {
  id: string;
  role: "user" | "npc";
  content: string;
  timestamp: Date;
  mood?: string;
  source?: "rule" | "knowledge" | "llm";
  suggestions?: string[];
}

interface NPCInfo {
  id: string;
  name: string;
  role: string;
  title?: string | null;
  avatarEmoji: string;
  greeting?: string | null;
  voiceStyle?: string | null;
}

const MOOD_EMOJIS: Record<string, string> = {
  neutral: "😐",
  happy: "😊",
  busy: "⏰",
  concerned: "🤔",
  excited: "🤩",
  formal: "🎩",
};

const SOURCE_LABELS: Record<string, { label: string; icon: typeof Brain; color: string }> = {
  rule: { label: "Pattern", icon: Zap, color: "text-yellow-500" },
  knowledge: { label: "Knowledge", icon: BookOpen, color: "text-blue-500" },
  llm: { label: "AI Brain", icon: Brain, color: "text-purple-500" },
};

function OasisNPCPageInner() {
  const searchParams = useSearchParams();
  const [selectedNPC, setSelectedNPC] = useState<NPCInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [currentMood, setCurrentMood] = useState("neutral");
  const [npcs, setNpcs] = useState<NPCInfo[]>([]);
  const [loadingNpcs, setLoadingNpcs] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoadingNpcs(true);
      try {
        const res = await fetch("/api/npc/list");
        const data = await res.json();
        setNpcs(Array.isArray(data.npcs) ? data.npcs : []);
      } catch {
        setNpcs([]);
      } finally {
        setLoadingNpcs(false);
      }
    };
    load();
  }, []);

  const npcIdFromUrl = searchParams?.get("npcId")?.trim();
  useEffect(() => {
    if (!npcIdFromUrl) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/npc/profile/${encodeURIComponent(npcIdFromUrl)}`);
        const data = await res.json();
        if (res.ok && data?.profile) {
          const p = data.profile;
          setSelectedNPC({
            id: p.id,
            name: p.name,
            role: p.role,
            title: p.title,
            avatarEmoji: p.avatarEmoji || "🤖",
            greeting: p.greeting,
            voiceStyle: p.voiceStyle,
          });
          setMessages([
            {
              id: "greeting",
              role: "npc",
              content: p.greeting || "Hello! How can I help you today?",
              timestamp: new Date(),
              mood: "happy",
              source: "rule",
              suggestions: ["Tell me more", "What can you do?", "Thanks!"],
            },
          ]);
          setSessionId(null);
          setCurrentMood("happy");
        }
      } catch {
        /* ignore */
      }
    };
    load();
  }, [npcIdFromUrl]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (selectedNPC && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedNPC]);

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const selectNPC = useCallback((npc: NPCInfo) => {
    setSelectedNPC(npc);
    setMessages([
      {
        id: "greeting",
        role: "npc",
        content: npc.greeting || "Hello! How can I help you today?",
        timestamp: new Date(),
        mood: "happy",
        source: "rule",
        suggestions: ["Tell me about this world", "What can you do?", "Show me around"],
      },
    ]);
    setSessionId(null);
    setCurrentMood("happy");
  }, []);

  const sendMessage = useCallback(
    async (text?: string) => {
      const messageText = text || inputValue.trim();
      if (!messageText || !selectedNPC || chatBusy) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: messageText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setChatBusy(true);

      try {
        const res = await fetch("/api/npc/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
            npcId: selectedNPC.id,
            sessionId: sessionId || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Chat failed");
        }

        const npcMessage: ChatMessage = {
          id: `npc-${Date.now()}`,
          role: "npc",
          content: data.response,
          timestamp: new Date(),
          mood: data.mood,
          source: data.source,
          suggestions: data.suggestions,
        };

        setMessages((prev) => [...prev, npcMessage]);
        setSessionId(data.sessionId || null);
        setCurrentMood(data.mood || "neutral");

        if (isVoiceEnabled) {
          speak(data.response);
        }
      } catch {
        const npcMessage: ChatMessage = {
          id: `npc-${Date.now()}`,
          role: "npc",
          content: "I am having trouble right now. Please try again.",
          timestamp: new Date(),
          mood: "concerned",
          source: "rule",
        };
        setMessages((prev) => [...prev, npcMessage]);
      } finally {
        setChatBusy(false);
      }
    },
    [chatBusy, inputValue, isVoiceEnabled, selectedNPC, sessionId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleSuggestion = (suggestion: string) => {
    sendMessage(suggestion);
  };

  if (!selectedNPC) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Oasis AI NPCs</h1>
              <p className="text-sm text-gray-400">Choose an AI character to interact with</p>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 rounded-full px-4 py-2 mb-6">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-purple-300">Custom AI Engine</span>
            </div>
            <h2 className="text-4xl font-bold mb-4">
              Meet Your AI <span className="text-purple-400">Companions</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Each NPC has a unique personality, knowledge base, and role. They use a hybrid engine
              with pattern matching and knowledge-aware responses.
            </p>
          </div>

          {loadingNpcs ? (
            <div className="flex justify-center py-20">
              <div className="animate-pulse text-gray-500">Loading NPCs...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {npcs.map((npc) => (
                <Card
                  key={npc.id}
                  className="bg-gray-800/50 border-gray-700 hover:border-purple-500/50 transition-all cursor-pointer group"
                  onClick={() => selectNPC(npc)}
                >
                  <CardHeader className="text-center pb-2">
                    <div className="text-6xl mb-3 group-hover:scale-110 transition-transform">
                      {npc.avatarEmoji}
                    </div>
                    <CardTitle className="text-white text-xl">{npc.name}</CardTitle>
                    <p className="text-purple-400 text-sm font-medium">{npc.title}</p>
                  </CardHeader>
                  <CardContent className="text-center">
                    <Badge variant="outline" className="mb-3 border-gray-600 text-gray-300 capitalize">
                      {npc.role}
                    </Badge>
                    <p className="text-gray-400 text-sm line-clamp-2">{npc.greeting}</p>
                    <Button className="mt-4 w-full bg-purple-600 hover:bg-purple-700" size="sm">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Start Chat
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  const lastNPCMessage = [...messages].reverse().find((m) => m.role === "npc");
  const suggestions = lastNPCMessage?.suggestions || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col">
      <header className="border-b border-gray-700 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedNPC(null)}
              className="text-gray-400 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-3xl">{selectedNPC.avatarEmoji}</div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg">{selectedNPC.name}</h2>
                <span className="text-lg" title={`Mood: ${currentMood}`}>
                  {MOOD_EMOJIS[currentMood] || "😐"}
                </span>
              </div>
              <p className="text-xs text-gray-400">{selectedNPC.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
              className={isVoiceEnabled ? "text-purple-400" : "text-gray-500"}
            >
              {isVoiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowProfile(!showProfile)}
              className="text-gray-400 hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="container mx-auto px-4 pb-2">
          <div className="flex items-center gap-4 text-xs">
            <button
              onClick={() => setIsVoiceEnabled(false)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full transition-colors ${
                !isVoiceEnabled
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <MessageSquare className="h-3 w-3" />
              Text
            </button>
            <button
              onClick={() => setIsVoiceEnabled(true)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full transition-colors ${
                isVoiceEnabled
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Volume2 className="h-3 w-3" />
              Voice + Text
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="max-w-3xl mx-auto space-y-4 pb-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "npc" && (
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xl">
                      {selectedNPC.avatarEmoji}
                    </div>
                  )}

                  <div className={`max-w-md ${message.role === "user" ? "order-first" : ""}`}>
                    <div
                      className={`px-4 py-3 rounded-2xl ${
                        message.role === "user"
                          ? "bg-purple-600 text-white rounded-br-sm"
                          : "bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-sm"
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    </div>

                    <div
                      className={`flex items-center gap-2 mt-1 ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <span className="text-xs text-gray-600">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {message.role === "npc" && message.source && (
                        <span className={`text-xs flex items-center gap-1 ${SOURCE_LABELS[message.source]?.color || "text-gray-500"}`}>
                          {(() => {
                            const info = SOURCE_LABELS[message.source!];
                            if (!info) return null;
                            const Icon = info.icon;
                            return (
                              <>
                                <Icon className="h-3 w-3" />
                                {info.label}
                              </>
                            );
                          })()}
                        </span>
                      )}
                      {message.role === "npc" && message.mood && (
                        <span className="text-xs" title={`Mood: ${message.mood}`}>
                          {MOOD_EMOJIS[message.mood] || ""}
                        </span>
                      )}
                      {message.role === "npc" && isVoiceEnabled && (
                        <button
                          onClick={() => speak(message.content)}
                          className="text-gray-500 hover:text-purple-400 transition-colors"
                          title="Replay voice"
                        >
                          <Volume2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {message.role === "user" && (
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                  )}
                </div>
              ))}

              {chatBusy && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xl">
                    {selectedNPC.avatarEmoji}
                  </div>
                  <div className="bg-gray-800 border border-gray-700 px-4 py-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {suggestions.length > 0 && !chatBusy && (
            <div className="px-4 pb-2">
              <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(suggestion)}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-700 text-gray-300 hover:border-purple-500 hover:text-purple-300 transition-colors bg-gray-800/50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-700 bg-gray-900/80 backdrop-blur-sm p-4">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
              <Input
                ref={inputRef}
                placeholder={`Message ${selectedNPC.name}...`}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={chatBusy}
                className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-purple-500"
              />
              <Button type="submit" disabled={chatBusy || !inputValue.trim()} className="bg-purple-600 hover:bg-purple-700" size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </form>

            <div className="max-w-3xl mx-auto mt-2 flex items-center justify-between text-xs text-gray-600">
              <span>
                {isVoiceEnabled ? "🎤 Voice enabled" : "💬 Text only"}
                {sessionId ? ` • Session: ${sessionId.slice(0, 8)}...` : ""}
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Custom AI Engine
              </span>
            </div>
          </div>
        </div>

        {showProfile && (
          <div className="w-80 border-l border-gray-700 bg-gray-900/50 p-4 overflow-y-auto">
            <h3 className="font-bold text-lg mb-4">NPC Profile</h3>

            <div className="text-center mb-6">
              <div className="text-6xl mb-2">{selectedNPC.avatarEmoji}</div>
              <h4 className="font-bold text-xl">{selectedNPC.name}</h4>
              <p className="text-purple-400 text-sm">{selectedNPC.title}</p>
              <Badge variant="outline" className="mt-2 border-gray-600 text-gray-300 capitalize">
                {selectedNPC.role}
              </Badge>
            </div>

            <Separator className="bg-gray-700 my-4" />

            <div className="space-y-3">
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wider">Current Mood</span>
                <p className="text-sm mt-1">
                  {MOOD_EMOJIS[currentMood]} {currentMood.charAt(0).toUpperCase() + currentMood.slice(1)}
                </p>
              </div>

              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wider">Voice Style</span>
                <p className="text-sm mt-1 capitalize">{selectedNPC.voiceStyle || "Default"}</p>
              </div>

              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wider">Messages</span>
                <p className="text-sm mt-1">{messages.length} in this session</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OasisNPCPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white/60">Loading…</div>}>
      <OasisNPCPageInner />
    </Suspense>
  );
}
