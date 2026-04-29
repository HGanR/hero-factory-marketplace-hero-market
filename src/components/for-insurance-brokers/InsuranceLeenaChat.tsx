"use client";

/**
 * Insurance broker demo assistant — same widget integration pattern as SalonLeenaChat.
 * Uses `NEXT_PUBLIC_INSURANCE_DEMO_WIDGET_KEY` for a dedicated Agency widget.
 */

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Send, X } from "lucide-react";

const AGENT_NAME = process.env.NEXT_PUBLIC_INSURANCE_AGENT_NAME?.trim() || "JAH";
const AVATAR = "/insurance-jah-avatar.png";

const BRAND = "#06b6d4";
const BRAND_GLOW = "0 0 20px rgba(6,182,212,0.4), 0 0 40px rgba(37,99,235,0.15)";

function renderBold(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const boldRegex = /\*\*(.*?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let k = 0;
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={`t${k++}`}>{text.slice(last, match.index)}</span>);
    parts.push(
      <strong key={`b${k++}`} className="font-semibold text-cyan-200">
        {match[1]}
      </strong>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(<span key={`t${k++}`}>{text.slice(last)}</span>);
  return parts.length ? parts : text;
}

const WELCOME_MARKDOWN = `Hi — I'm **${AGENT_NAME}**, your brokerage assistant. Ask about quotes, coverage basics, renewals, or what happens next after you submit a request.`;

export function InsuranceLeenaChat() {
  const widgetKey = process.env.NEXT_PUBLIC_INSURANCE_DEMO_WIDGET_KEY?.trim();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [widgetSessionId] = useState(
    () =>
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `ins_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendToWidget = useCallback(
    async (text: string) => {
      if (!widgetKey || !text.trim()) return;
      setPending(true);
      try {
        const trimmed = text.trim();
        const context: Record<string, unknown> = {
          pageType: "insurance",
          source: "insurance_broker_demo",
          siteSection: "broker-demo",
          insuranceDemo: { assistant: AGENT_NAME },
        };

        const res = await fetch(`/api/widget/${encodeURIComponent(widgetKey)}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            message: trimmed,
            sessionId: widgetSessionId,
            page:
              typeof window !== "undefined"
                ? { url: window.location.href, title: document.title }
                : undefined,
            context,
          }),
        });
        const data = await res.json().catch(() => ({}));
        const reply =
          typeof data?.reply === "string"
            ? data.reply
            : typeof data?.text === "string"
              ? data.text
              : res.ok
                ? "No reply from assistant."
                : `Could not reach assistant (${res.status}).`;
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: "Network error. Check your connection and try again.",
          },
        ]);
      } finally {
        setPending(false);
      }
    },
    [widgetKey, widgetSessionId]
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || pending) return;
    if (!widgetKey) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: userMsg }]);
    void sendToWidget(userMsg);
  };

  useEffect(() => {
    if (!open) return;
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      if (!widgetKey) {
        return [
          {
            id: "welcome-setup",
            role: "assistant",
            content: `**Setup:** Add \`NEXT_PUBLIC_INSURANCE_DEMO_WIDGET_KEY\` to your environment (separate widget key in AI Agency for the insurance broker agent). Allow **this site's origin** in that widget's allowed domains.`,
          },
        ];
      }
      return [{ id: "welcome", role: "assistant", content: WELCOME_MARKDOWN }];
    });
  }, [open, widgetKey]);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[99999] flex flex-col items-center group"
          aria-label={`Open chat with ${AGENT_NAME}`}
        >
          <div className="mb-2 whitespace-nowrap">
            <span
              className="rounded-full px-4 py-1.5 text-sm font-bold tracking-wider text-white"
              style={{
                backgroundColor: "rgba(7,17,26,0.9)",
                border: `1px solid ${BRAND}`,
                boxShadow: BRAND_GLOW,
              }}
            >
              {AGENT_NAME}
            </span>
          </div>
          <div className="relative">
            <div
              className="absolute inset-[-8px] rounded-full opacity-70 transition-opacity group-hover:opacity-100"
              style={{
                background: "radial-gradient(circle, rgba(6,182,212,0.3) 0%, transparent 70%)",
                filter: "blur(12px)",
              }}
            />
            <div
              className="relative h-32 w-32 cursor-pointer overflow-hidden rounded-full border-4 transition-transform group-hover:scale-105 bg-slate-900"
              style={{
                borderColor: BRAND,
                boxShadow: BRAND_GLOW,
              }}
            >
              <Image src={AVATAR} alt={AGENT_NAME} fill className="object-cover object-top" sizes="128px" priority />
            </div>
            <div
              className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-900 text-[10px] font-bold text-white"
              style={{ backgroundColor: BRAND, boxShadow: BRAND_GLOW }}
            >
              AI
            </div>
          </div>
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-6 right-6 z-[99999] flex h-[520px] max-h-[calc(100vh-120px)] w-[380px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-2xl border-2 shadow-2xl"
          style={{
            background: "linear-gradient(145deg, rgba(7,17,26,0.98) 0%, rgba(8,19,29,0.99) 100%)",
            borderColor: "rgba(6,182,212,0.45)",
            boxShadow: `0 25px 50px rgba(0,0,0,0.45), ${BRAND_GLOW}`,
          }}
        >
          <div
            className="flex items-center justify-between border-b px-3 py-2"
            style={{ borderColor: "rgba(6,182,212,0.25)" }}
          >
            <div className="flex items-center gap-2">
              <div className="relative h-11 w-11 overflow-hidden rounded-full border-2 bg-slate-900" style={{ borderColor: BRAND }}>
                <Image src={AVATAR} alt={AGENT_NAME} fill className="object-cover object-top" sizes="44px" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-wide text-white">{AGENT_NAME}</h3>
                <p className="text-[11px] text-emerald-400/90">● Broker intake &amp; coverage help</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[92%] rounded-xl px-3 py-2 text-[13px] leading-snug ${
                  m.role === "user"
                    ? "ml-auto border border-cyan-500/30 bg-cyan-950/40 text-slate-100"
                    : "border border-white/10 bg-slate-900/80 text-slate-200"
                }`}
              >
                {m.role === "assistant" ? renderBold(m.content) : m.content}
              </div>
            ))}
            {pending ? <div className="text-xs italic text-slate-500">{AGENT_NAME} is typing…</div> : null}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="border-t border-white/10 p-2">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  widgetKey
                    ? `Message ${AGENT_NAME}…`
                    : "Set NEXT_PUBLIC_INSURANCE_DEMO_WIDGET_KEY to enable chat…"
                }
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                disabled={pending || !widgetKey}
              />
              <button
                type="submit"
                disabled={pending || !input.trim() || !widgetKey}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${BRAND}, #2563eb)` }}
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
