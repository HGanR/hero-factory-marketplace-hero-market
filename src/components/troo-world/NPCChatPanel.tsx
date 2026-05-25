"use client";

/**
 * NpcChatPanel.tsx
 * Chat interface for talking to AI NPCs in Troo World.
 * Uses the /api/troo-world/npc-chat endpoint.
 * Features: Text/Voice input, draggable panel, department-aware styling
 */

import { useState, useCallback, useRef, useEffect } from "react";

/** Minimal Web Speech API types (vendor-prefixed ctor; not always in TS `lib.dom`). */
type NpcSpeechRecognitionResultList = {
  readonly length: number;
  [index: number]: { readonly length: number; [i: number]: { transcript: string } };
};

type NpcSpeechRecognitionEvent = {
  readonly results: NpcSpeechRecognitionResultList;
};

type NpcSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((ev: NpcSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type NpcSpeechRecognitionCtor = new () => NpcSpeechRecognition;

function getNpcSpeechRecognitionCtor(): NpcSpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: NpcSpeechRecognitionCtor;
    webkitSpeechRecognition?: NpcSpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

interface ChatMessage {
  role: "user" | "npc";
  content: string;
  timestamp?: Date;
}

interface NpcInfo {
  id: number;
  npcId: string;
  name: string;
  title: string | null;
  avatarEmoji: string;
  role: string;
  department?: string;
  expertise?: string;
}

interface NpcChatPanelProps {
  npcId: string;
  npcName: string;
  npcTitle?: string;
  npcEmoji?: string;
  npcGreeting?: string;
  npcDepartment?: string;
  npcExpertise?: string;
  worldId?: string;
  onClose: () => void;
}

const hasSpeechRecognition =
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

const hasSpeechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;

function speakText(text: string) {
  if (!hasSpeechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      (v.name.includes("Natural") ||
        v.name.includes("Neural") ||
        v.name.includes("Google") ||
        v.name.includes("Samantha"))
  );
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

const DEPT_COLORS: Record<string, string> = {
  Administration: "#2a6fbd",
  Security: "#8b4513",
  Legal: "#5a2d82",
  Finance: "#1a6b3a",
  "Human Resources": "#c0392b",
  Technology: "#0d5c8a",
};

export default function NpcChatPanel({
  npcId,
  npcName,
  npcTitle,
  npcEmoji = "🤖",
  npcGreeting,
  npcDepartment,
  npcExpertise,
  worldId,
  onClose,
}: NpcChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [npcInfo, setNpcInfo] = useState<NpcInfo | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<NpcSpeechRecognition | null>(null);
  
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const accentColor = DEPT_COLORS[npcDepartment || npcInfo?.department || ""] || "#2a6fbd";

  useEffect(() => {
    if (npcGreeting) {
      setMessages([{ role: "npc", content: npcGreeting, timestamp: new Date() }]);
    }
  }, [npcGreeting]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onDragStart = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({
        x: dragStart.current.px + e.clientX - dragStart.current.mx,
        y: dragStart.current.py + e.clientY - dragStart.current.my,
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || loading) return;

      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: msg, timestamp: new Date() }]);
      setLoading(true);

      try {
        const res = await fetch("/api/troo-world/npc-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            npcId,
            message: msg,
            sessionId,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to send message");
        }

        setSessionId(data.sessionId);
        if (data.npc) setNpcInfo(data.npc);
        const response = data.response;
        setMessages((prev) => [...prev, { role: "npc", content: response, timestamp: new Date() }]);

        if (voiceMode && hasSpeechSynthesis) {
          const plainText = response
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/\*(.*?)\*/g, "$1")
            .replace(/#{1,6}\s/g, "")
            .replace(/\n/g, " ");
          speakText(plainText);
        }
      } catch (error) {
        console.error("Chat error:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "npc",
            content: "I apologize, I'm having trouble responding right now. Please try again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, npcId, sessionId, voiceMode]
  );

  const startListening = useCallback(() => {
    if (!hasSpeechRecognition) return;
    const SR = getNpcSpeechRecognitionCtor();
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: NpcSpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      sendMessage(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [sendMessage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const displayName = npcInfo?.name || npcName;
  const displayTitle = npcInfo?.title || npcTitle;
  const displayEmoji = npcInfo?.avatarEmoji || npcEmoji;
  const displayExpertise = npcInfo?.expertise || npcExpertise;

  return (
    <div
      style={{
        position: "fixed",
        right: Math.max(8, 20 - pos.x),
        bottom: Math.max(8, 20 - pos.y),
        width: 420,
        maxHeight: "76vh",
        background: "rgba(8, 14, 26, 0.97)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${accentColor}55`,
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, sans-serif",
        zIndex: 1100,
        boxShadow: `0 8px 48px rgba(0,0,0,0.75), 0 0 0 1px ${accentColor}22`,
        overflow: "hidden",
        userSelect: dragging ? "none" : "auto",
      }}
    >
      {/* Header - draggable */}
      <div
        onMouseDown={onDragStart}
        style={{
          background: `linear-gradient(135deg, ${accentColor}ee 0%, ${accentColor}66 100%)`,
          padding: "13px 14px",
          cursor: "grab",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
            border: "2px solid rgba(255,255,255,0.35)",
          }}
        >
          {displayEmoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {displayName}
          </div>
          <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 11 }}>{displayTitle}</div>
        </div>
        <button
          onClick={() => {
            setVoiceMode((v) => !v);
            if (isListening) stopListening();
            if (hasSpeechSynthesis) window.speechSynthesis.cancel();
          }}
          style={{
            background: voiceMode ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 8,
            color: "#fff",
            padding: "5px 10px",
            cursor: "pointer",
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {voiceMode ? "🎙️ Voice" : "💬 Text"}
        </button>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            color: "#fff",
            width: 28,
            height: 28,
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Knowledge badge */}
      {displayExpertise && (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "5px 14px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 10, color: `${accentColor}bb` }}>🧠</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
            Knowledge base active · {displayExpertise.split(",")[0]?.trim()}
          </span>
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 12px 6px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minHeight: 0,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: "rgba(255,255,255,0.4)",
              textAlign: "center",
              padding: "40px 20px",
              fontSize: 13,
            }}
          >
            Send a message to start chatting with {displayName}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: msg.role === "user" ? "row-reverse" : "row",
              gap: 7,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: msg.role === "user" ? "rgba(255,255,255,0.13)" : `${accentColor}77`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {msg.role === "user" ? "👤" : "🤖"}
            </div>
            <div
              style={{
                maxWidth: "78%",
                background: msg.role === "user" ? `${accentColor}99` : "rgba(255,255,255,0.06)",
                border: `1px solid ${msg.role === "user" ? `${accentColor}55` : "rgba(255,255,255,0.09)"}`,
                borderRadius: msg.role === "user" ? "13px 4px 13px 13px" : "4px 13px 13px 13px",
                padding: "9px 11px",
              }}
            >
              <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                {msg.content}
              </div>
              {msg.timestamp && (
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.28)",
                    marginTop: 3,
                    textAlign: msg.role === "user" ? "right" : "left",
                  }}
                >
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: `${accentColor}77`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                marginTop: 2,
              }}
            >
              🤖
            </div>
            <div
              style={{
                padding: "9px 11px",
                borderRadius: "4px 13px 13px 13px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.09)",
              }}
            >
              <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "3px 0" }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: `${accentColor}cc`,
                      animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          padding: "9px 11px 11px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
          background: "rgba(0,0,0,0.25)",
        }}
      >
        {voiceMode ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "4px 0" }}>
            <button
              onMouseDown={startListening}
              onMouseUp={stopListening}
              onTouchStart={startListening}
              onTouchEnd={stopListening}
              disabled={!hasSpeechRecognition}
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: isListening ? "#e74c3c" : `${accentColor}cc`,
                border: isListening ? "3px solid #ff6b6b" : `3px solid ${accentColor}`,
                color: "#fff",
                fontSize: 22,
                cursor: hasSpeechRecognition ? "pointer" : "not-allowed",
                boxShadow: isListening ? "0 0 20px rgba(231,76,60,0.6)" : `0 0 12px ${accentColor}44`,
                transition: "all 0.2s",
              }}
            >
              {isListening ? "⏹" : "🎤"}
            </button>
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
              {isListening
                ? "Listening... release to send"
                : hasSpeechRecognition
                  ? "Hold to speak"
                  : "Speech not supported in this browser"}
            </span>
            {input && (
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, fontStyle: "italic", textAlign: "center" }}>
                &quot;{input}&quot;
              </div>
            )}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            style={{ display: "flex", gap: 7, alignItems: "flex-end" }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${displayName}...`}
              rows={2}
              disabled={loading}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.11)",
                borderRadius: 10,
                color: "#fff",
                padding: "8px 11px",
                fontSize: 13,
                resize: "none",
                outline: "none",
                fontFamily: "inherit",
                lineHeight: 1.4,
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              style={{
                background: input.trim() && !loading ? `${accentColor}cc` : "rgba(255,255,255,0.07)",
                border: "none",
                borderRadius: 10,
                color: "#fff",
                width: 38,
                height: 38,
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              {loading ? "⏳" : "➤"}
            </button>
          </form>
        )}

        {worldId && (
          <div
            style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: 10,
              marginTop: 6,
              textAlign: "center",
            }}
          >
            World: {worldId}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%,
          80%,
          100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-6px);
          }
        }
      `}</style>
    </div>
  );
}
