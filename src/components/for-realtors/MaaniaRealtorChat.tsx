"use client";

import type { ReactNode } from "react";

/**
 * MAANIA — floating realtor assistant (same footprint as landing REALITY chat).
 * `NEXT_PUBLIC_RET_WIDGET_KEY` must match an Agency widget binding (CRM + allowed domains).
 * Chat turns use `retSnapshot.maaniaMode` so the server runs structured MAANIA intake logic
 * (`lib/maania`) without requiring third-party LLM APIs; optional sync to `/api/ret/session` when signed in.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronUp, Send, X } from "lucide-react";
import type { RetAgentDraft } from "@/lib/ret/types";
import { buyerDemoPayloadToSiteSchemaDocument } from "@/lib/maania/buyer-demo-payload-to-site-schema";
import {
  buildBuyerDemoPayload,
  BUYER_DEMO_PAYLOAD_MIN_PERCENT,
  BUYER_PREVIEW_DIRECTION_MIN_PERCENT,
  BUYER_TAILORED_DEMO_MIN_PERCENT,
} from "@/lib/maania/build-buyer-demo-payload";
import { buildRetDemoPayload, getRetDemoIntakeProgressPercent } from "@/lib/maania/build-ret-demo-payload";
import { buildRetMaaniaSnapshot } from "@/lib/maania/build-maania-snapshot";
import { createInitialBuyerDraft } from "@/lib/maania/buyer-draft";
import { extractBuyerDraftPatchFromMessage } from "@/lib/maania/extract-buyer-patch";
import { mergeBuyerDraft } from "@/lib/maania/merge-buyer-draft";
import { MAANIA_WELCOME_MARKDOWN, type MaaniaIntakePath } from "@/lib/maania/maania-intake";
import { persistMaaniaBuyerDemoArtifacts, persistMaaniaRetDemoArtifacts } from "@/lib/maania/maania-demo-storage";
import { openBuyerDemoInBuilder, openRetDemoInBuilder } from "@/lib/maania/open-in-builder";
import { retDemoPayloadToSiteSchemaDocument } from "@/lib/maania/ret-demo-payload-to-site-schema";
import { sendMaaniaDemoToClientViaMailto } from "@/lib/maania/maania-send-to-client";
import { copyMaaniaShareLinkToClipboard } from "@/lib/maania/share-demo";
import { getBuyerIntakeProgress } from "@/lib/maania/buyer-progress";

const AGENT_NAME = process.env.NEXT_PUBLIC_MAANIA_AGENT_NAME?.trim() || undefined;
import { getOrCreateRetClientSessionId } from "@/lib/ret/client-session";

const AVATAR = "/for-realtors/maania.png";
const NAME = "MAANIA";

const BRAND = "#2563EB";
const BRAND_GLOW = "0 0 20px rgba(37,99,235,0.45), 0 0 40px rgba(37,99,235,0.2)";

const DEFAULT_ESCALATION: Record<string, boolean> = {
  "Title defect or missing instrument": false,
  "Lien payoff or subordination required": false,
  "Lender / covenant breach exposure": false,
  "Securities / token offering review": false,
  "Jurisdiction or tax counsel": false,
};

function defaultDraft(): RetAgentDraft {
  return {
    intake: { propertyLabel: "", ownerContact: "", notes: "" },
    flags: { titleClear: false, lienRecorded: false, mortgageActive: false },
    structure: "llc",
    tokenDesign: "utility-receipt",
    risk: { securities: 3, lender: 3, title: 3 },
    jurisdiction: "",
    consultantSummary: "",
    clientSummary: "",
    escalation: { ...DEFAULT_ESCALATION },
  };
}

function renderBold(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const boldRegex = /\*\*(.*?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let k = 0;
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={`t${k++}`}>{text.slice(last, match.index)}</span>);
    parts.push(
      <strong key={`b${k++}`} className="font-semibold text-blue-200">
        {match[1]}
      </strong>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(<span key={`t${k++}`}>{text.slice(last)}</span>);
  return parts.length ? parts : text;
}

const LS_RET_SESSION = "ret_draft_session_id_maania";

export function MaaniaRealtorChat({ pageSource }: { pageSource: "for-realtors" | "realtor-demo" }) {
  const widgetKey = process.env.NEXT_PUBLIC_RET_WIDGET_KEY?.trim();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<RetAgentDraft>(defaultDraft);
  const [intakePath, setIntakePath] = useState<MaaniaIntakePath>("unknown");
  const [buyerDraft, setBuyerDraft] = useState(() => createInitialBuyerDraft());
  const buyerDraftRef = useRef(buyerDraft);
  buyerDraftRef.current = buyerDraft;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [showIntake, setShowIntake] = useState(false);
  const [retSessionId, setRetSessionId] = useState<string | null>(null);
  const [widgetSessionId] = useState(
    () =>
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `maania_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const draftForSession = useMemo(
    (): RetAgentDraft => ({ ...draft, maaniaIntakePath: intakePath }),
    [draft, intakePath]
  );

  const buyerProgress = useMemo(() => getBuyerIntakeProgress(buyerDraft), [buyerDraft]);

  const retProgressPercent = useMemo(() => {
    if (intakePath !== "sell") return 0;
    return getRetDemoIntakeProgressPercent(draft);
  }, [draft, intakePath]);

  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_RET_SESSION)?.trim();
      if (s) setRetSessionId(s);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced RET session sync (same pattern as RetAgentWidget) when signed in
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/ret/session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft: draftForSession, sessionId: retSessionId ?? undefined }),
        });
        if (r.status === 401) return;
        const j = await r.json().catch(() => ({}));
        if (typeof j?.sessionId === "string" && j.sessionId) {
          setRetSessionId(j.sessionId);
          try {
            localStorage.setItem(LS_RET_SESSION, j.sessionId);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* offline */
      }
    }, 1600);
    return () => clearTimeout(t);
  }, [draftForSession, retSessionId]);

  const sendToWidget = useCallback(
    async (text: string, pathOverride?: MaaniaIntakePath) => {
      if (!widgetKey || !text.trim()) return;
      setPending(true);
      try {
        const pathForSnapshot = pathOverride ?? intakePath;
        const trimmed = text.trim();

        let buyerForSnapshot = buyerDraftRef.current;
        if (pathForSnapshot === "buy") {
          const patch = extractBuyerDraftPatchFromMessage(trimmed, buyerDraftRef.current);
          buyerForSnapshot = mergeBuyerDraft(buyerDraftRef.current, patch);
          buyerDraftRef.current = buyerForSnapshot;
          setBuyerDraft(buyerForSnapshot);
        }

        const context: Record<string, unknown> = {
          pageType: "ret",
          source: pageSource === "for-realtors" ? "for_realtors_maania" : "realtor_demo_maania",
          siteSection: "realtor-listing-assistant",
          retClientSessionId: getOrCreateRetClientSessionId(),
          retSnapshot: buildRetMaaniaSnapshot(draft, {
            maaniaMode: true,
            pageSource,
            intakePath: pathForSnapshot,
            buyerDraft: pathForSnapshot === "buy" ? buyerForSnapshot : undefined,
          }),
        };
        if (retSessionId) context.retSessionId = retSessionId;

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
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", content: reply },
        ]);
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
    [widgetKey, draft, pageSource, retSessionId, widgetSessionId, intakePath]
  );

  const pickIntakePath = useCallback(
    (path: MaaniaIntakePath, userLine: string) => {
      setIntakePath(path);
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: userLine }]);
      void sendToWidget(userLine, path);
    },
    [sendToWidget]
  );

  const openBuyerDemoPreview = useCallback(() => {
    const payload = buildBuyerDemoPayload(buyerDraftRef.current);
    const schema = buyerDemoPayloadToSiteSchemaDocument(payload);
    persistMaaniaBuyerDemoArtifacts(payload, schema);
    const url = `/for-realtors/demo?buyerDemo=1`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const openBuyerDemoInSiteBuilder = useCallback(() => {
    const payload = buildBuyerDemoPayload(buyerDraftRef.current);
    const schema = buyerDemoPayloadToSiteSchemaDocument(payload);
    persistMaaniaBuyerDemoArtifacts(payload, schema);
    openBuyerDemoInBuilder(schema);
  }, []);

  const copyBuyerDemoJson = useCallback(async () => {
    const d = buyerDraftRef.current;
    const payload = buildBuyerDemoPayload(d);
    const schema = buyerDemoPayloadToSiteSchemaDocument(payload);
    const json = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      try {
        persistMaaniaBuyerDemoArtifacts(payload, schema);
      } catch {
        /* quota / private mode */
      }
    } catch {
      window.alert("Could not copy to clipboard. Try again or copy from the browser manually.");
    }
  }, []);

  const copyBuyerShareLink = useCallback(async () => {
    const payload = buildBuyerDemoPayload(buyerDraftRef.current);
    const schema = buyerDemoPayloadToSiteSchemaDocument(payload);
    persistMaaniaBuyerDemoArtifacts(payload, schema);
    const r = await copyMaaniaShareLinkToClipboard({
      kind: "buyer",
      title: payload.heroTitle.slice(0, 200),
      payload,
      schema,
    });
    if (!r.ok) window.alert(r.error || "Could not create share link");
  }, []);

  const openRetDemoPreview = useCallback(() => {
    const payload = buildRetDemoPayload(draftRef.current);
    const schema = retDemoPayloadToSiteSchemaDocument(payload);
    persistMaaniaRetDemoArtifacts(payload, schema);
    window.open("/for-realtors/demo?retDemo=1", "_blank", "noopener,noreferrer");
  }, []);

  const openRetDemoInSiteBuilder = useCallback(() => {
    const payload = buildRetDemoPayload(draftRef.current);
    const schema = retDemoPayloadToSiteSchemaDocument(payload);
    persistMaaniaRetDemoArtifacts(payload, schema);
    openRetDemoInBuilder(schema);
  }, []);

  const copyRetDemoJson = useCallback(async () => {
    const payload = buildRetDemoPayload(draftRef.current);
    const schema = retDemoPayloadToSiteSchemaDocument(payload);
    const json = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      try {
        persistMaaniaRetDemoArtifacts(payload, schema);
      } catch {
        /* quota / private mode */
      }
    } catch {
      window.alert("Could not copy to clipboard. Try again or copy from the browser manually.");
    }
  }, []);

  const copyRetShareLink = useCallback(async () => {
    const payload = buildRetDemoPayload(draftRef.current);
    const schema = retDemoPayloadToSiteSchemaDocument(payload);
    persistMaaniaRetDemoArtifacts(payload, schema);
    const r = await copyMaaniaShareLinkToClipboard({
      kind: "ret",
      title: payload.heroTitle.slice(0, 200),
      payload,
      schema,
    });
    if (!r.ok) window.alert(r.error || "Could not create share link");
  }, []);

  const sendBuyerDemoToClient = useCallback(async () => {
    const payload = buildBuyerDemoPayload(buyerDraftRef.current);
    const schema = buyerDemoPayloadToSiteSchemaDocument(payload);
    persistMaaniaBuyerDemoArtifacts(payload, schema);
    await sendMaaniaDemoToClientViaMailto({
      shareInput: {
        kind: "buyer",
        title: payload.heroTitle.slice(0, 200),
        payload,
        schema,
      },
      agentName: AGENT_NAME,
    });
  }, []);

  const sendRetDemoToClient = useCallback(async () => {
    const payload = buildRetDemoPayload(draftRef.current);
    const schema = retDemoPayloadToSiteSchemaDocument(payload);
    persistMaaniaRetDemoArtifacts(payload, schema);
    await sendMaaniaDemoToClientViaMailto({
      shareInput: {
        kind: "ret",
        title: payload.heroTitle.slice(0, 200),
        payload,
        schema,
      },
      agentName: AGENT_NAME,
    });
  }, []);

  const onSubmit = (e: React.FormEvent) => {
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
            content: `**Setup:** Add \`NEXT_PUBLIC_RET_WIDGET_KEY\` to your environment (same Agency widget key as the RET page). Allow **this site’s origin** in the widget’s allowed domains. Then you can chat here for **intake** and **listing copy** ideas.`,
          },
        ];
      }
      return [
        {
          id: "welcome",
          role: "assistant",
          content: MAANIA_WELCOME_MARKDOWN,
        },
      ];
    });
  }, [open, widgetKey]);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[99999] flex flex-col items-center group"
          aria-label={`Open chat with ${NAME}`}
        >
          <div className="mb-2 whitespace-nowrap">
            <span
              className="rounded-full px-4 py-1.5 text-sm font-bold tracking-wider text-white"
              style={{
                backgroundColor: "rgba(15,23,42,0.85)",
                border: `1px solid ${BRAND}`,
                boxShadow: BRAND_GLOW,
              }}
            >
              {NAME}
            </span>
          </div>
          <div className="relative">
            <div
              className="absolute inset-[-8px] rounded-full opacity-70 transition-opacity group-hover:opacity-100"
              style={{
                background: "radial-gradient(circle, rgba(37,99,235,0.35) 0%, transparent 70%)",
                filter: "blur(12px)",
              }}
            />
            <div
              className="relative h-32 w-32 cursor-pointer overflow-hidden rounded-full border-4 transition-transform group-hover:scale-105"
              style={{
                borderColor: BRAND,
                boxShadow: BRAND_GLOW,
              }}
            >
              <Image src={AVATAR} alt={NAME} fill className="object-cover object-top" sizes="128px" priority />
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
            background: "linear-gradient(145deg, rgba(15,23,42,0.96) 0%, rgba(15,23,42,0.98) 100%)",
            borderColor: "rgba(37,99,235,0.5)",
            boxShadow: `0 25px 50px rgba(0,0,0,0.45), ${BRAND_GLOW}`,
          }}
        >
          <div
            className="flex items-center justify-between border-b px-3 py-2"
            style={{ borderColor: "rgba(37,99,235,0.25)" }}
          >
            <div className="flex items-center gap-2">
              <div className="relative h-11 w-11 overflow-hidden rounded-full border-2" style={{ borderColor: BRAND }}>
                <Image src={AVATAR} alt={NAME} fill className="object-cover object-top" sizes="44px" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-wide text-white">{NAME}</h3>
                <p className="text-[11px] text-emerald-400/90">● Intake &amp; demo assistant</p>
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

          <button
            type="button"
            onClick={() => setShowIntake((v) => !v)}
            className="flex w-full items-center justify-between border-b border-white/10 px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/5"
          >
            <span>RET intake fields (seller path — feeds the assistant)</span>
            {showIntake ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showIntake && (
            <div className="space-y-2 border-b border-white/10 px-3 py-2 text-xs">
              <label className="block text-slate-500">Property / deal label</label>
              <input
                className="w-full rounded-lg border border-white/10 bg-slate-950/80 px-2 py-1.5 text-slate-200"
                value={draft.intake.propertyLabel}
                onChange={(e) => setDraft((d) => ({ ...d, intake: { ...d.intake, propertyLabel: e.target.value } }))}
                placeholder="e.g. 123 Oak St — listing preview"
              />
              <label className="block text-slate-500">Notes for the page</label>
              <textarea
                className="min-h-[56px] w-full rounded-lg border border-white/10 bg-slate-950/80 px-2 py-1.5 text-slate-200"
                value={draft.intake.notes}
                onChange={(e) => setDraft((d) => ({ ...d, intake: { ...d.intake, notes: e.target.value } }))}
                placeholder="Bed/bath, price band, neighborhood, seller goals…"
              />
              <Link href="/ret" className="inline-block text-[11px] font-medium text-blue-400 hover:underline">
                Open full RET workspace →
              </Link>
            </div>
          )}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[92%] rounded-xl px-3 py-2 text-[13px] leading-snug ${
                  m.role === "user"
                    ? "ml-auto border border-blue-500/30 bg-blue-600/20 text-slate-100"
                    : "border border-white/10 bg-slate-900/80 text-slate-200"
                }`}
              >
                {m.role === "assistant" ? renderBold(m.content) : m.content}
              </div>
            ))}
            {widgetKey && intakePath === "unknown" && messages.length <= 1 && !pending ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    pickIntakePath("sell", "I'm selling a property — let's use the RET-style transfer intake.")
                  }
                  className="rounded-lg border border-blue-500/40 bg-blue-600/15 px-3 py-1.5 text-xs font-medium text-blue-100 hover:bg-blue-600/25"
                >
                  Selling
                </button>
                <button
                  type="button"
                  onClick={() =>
                    pickIntakePath(
                      "buy",
                      "I'm looking to purchase a property — let's run the buyer qualification questions."
                    )
                  }
                  className="rounded-lg border border-violet-500/40 bg-violet-600/15 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-600/25"
                >
                  Purchasing
                </button>
                <button
                  type="button"
                  onClick={() =>
                    pickIntakePath(
                      "unknown",
                      "I'm not sure yet — can you help me decide between selling and buying?"
                    )
                  }
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10"
                >
                  Not sure yet
                </button>
              </div>
            ) : null}
            {pending ? (
              <div className="text-xs italic text-slate-500">MAANIA is typing…</div>
            ) : null}
            <div ref={endRef} />
          </div>

          {widgetKey && intakePath === "buy" && buyerProgress.percent >= BUYER_DEMO_PAYLOAD_MIN_PERCENT ? (
            <div className="flex items-center justify-between gap-2 border-t border-violet-500/20 bg-violet-950/30 px-3 py-2">
              <span className="text-[11px] font-medium text-violet-200/95">Buyer demo ready</span>
              <button
                type="button"
                onClick={() => void copyBuyerDemoJson()}
                className="shrink-0 rounded-lg border border-violet-500/45 bg-violet-600/25 px-2.5 py-1 text-[11px] font-semibold text-violet-100 hover:bg-violet-600/35"
              >
                Copy demo JSON
              </button>
            </div>
          ) : null}

          {widgetKey && intakePath === "buy" && buyerProgress.percent >= BUYER_PREVIEW_DIRECTION_MIN_PERCENT ? (
            <div className="border-t border-white/10 px-3 py-2 text-[11px] text-slate-400">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span>
                  Buyer intake{" "}
                  <span className="font-mono text-emerald-400/90">
                    {buyerProgress.answeredCount}/{buyerProgress.totalCount}
                  </span>{" "}
                  ({buyerProgress.percent}%)
                  {buyerProgress.percent >= BUYER_TAILORED_DEMO_MIN_PERCENT ? (
                    <span className="ml-1 text-emerald-300/90">· tailored demo</span>
                  ) : (
                    <span className="ml-1 text-slate-500">· preview direction</span>
                  )}
                </span>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={openBuyerDemoPreview}
                    className="rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-600/30"
                  >
                    {buyerProgress.percent >= BUYER_TAILORED_DEMO_MIN_PERCENT
                      ? "Open tailored demo page"
                      : "Preview demo direction"}
                  </button>
                  {buyerProgress.percent >= BUYER_TAILORED_DEMO_MIN_PERCENT ? (
                    <>
                      <button
                        type="button"
                        onClick={openBuyerDemoInSiteBuilder}
                        className="rounded-lg border border-blue-500/45 bg-blue-600/25 px-2.5 py-1 text-[11px] font-semibold text-blue-100 hover:bg-blue-600/35"
                      >
                        Open in Site Builder
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyBuyerShareLink()}
                        className="rounded-lg border border-violet-500/45 bg-violet-600/25 px-2.5 py-1 text-[11px] font-semibold text-violet-100 hover:bg-violet-600/35"
                      >
                        Copy share link
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendBuyerDemoToClient()}
                        className="rounded-lg border border-amber-500/45 bg-amber-600/20 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-600/30"
                      >
                        Send to client
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <p className="text-slate-500">
                Opens the realtor demo with hero + Site Builder block layout (session only). At{" "}
                {BUYER_TAILORED_DEMO_MIN_PERCENT}%+ intake, the page reflects a fuller generated structure.
              </p>
            </div>
          ) : null}

          {widgetKey && intakePath === "sell" && retProgressPercent >= BUYER_DEMO_PAYLOAD_MIN_PERCENT ? (
            <div className="flex items-center justify-between gap-2 border-t border-blue-500/20 bg-blue-950/30 px-3 py-2">
              <span className="text-[11px] font-medium text-blue-200/95">RET demo ready</span>
              <button
                type="button"
                onClick={() => void copyRetDemoJson()}
                className="shrink-0 rounded-lg border border-blue-500/45 bg-blue-600/25 px-2.5 py-1 text-[11px] font-semibold text-blue-100 hover:bg-blue-600/35"
              >
                Copy demo JSON
              </button>
            </div>
          ) : null}

          {widgetKey && intakePath === "sell" && retProgressPercent >= BUYER_PREVIEW_DIRECTION_MIN_PERCENT ? (
            <div className="border-t border-white/10 px-3 py-2 text-[11px] text-slate-400">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span>
                  RET intake{" "}
                  <span className="font-mono text-blue-400/90">{retProgressPercent}%</span>
                  {retProgressPercent >= BUYER_TAILORED_DEMO_MIN_PERCENT ? (
                    <span className="ml-1 text-emerald-300/90">· tailored demo</span>
                  ) : (
                    <span className="ml-1 text-slate-500">· preview direction</span>
                  )}
                </span>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={openRetDemoPreview}
                    className="rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-600/30"
                  >
                    {retProgressPercent >= BUYER_TAILORED_DEMO_MIN_PERCENT
                      ? "Open tailored demo page"
                      : "Preview demo direction"}
                  </button>
                  {retProgressPercent >= BUYER_TAILORED_DEMO_MIN_PERCENT ? (
                    <>
                      <button
                        type="button"
                        onClick={openRetDemoInSiteBuilder}
                        className="rounded-lg border border-blue-500/45 bg-blue-600/25 px-2.5 py-1 text-[11px] font-semibold text-blue-100 hover:bg-blue-600/35"
                      >
                        Open in Site Builder
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyRetShareLink()}
                        className="rounded-lg border border-violet-500/45 bg-violet-600/25 px-2.5 py-1 text-[11px] font-semibold text-violet-100 hover:bg-violet-600/35"
                      >
                        Copy share link
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendRetDemoToClient()}
                        className="rounded-lg border border-amber-500/45 bg-amber-600/20 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-600/30"
                      >
                        Send to client
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <p className="text-slate-500">
                Uses RET intake fields + chat context. Opens the realtor demo with a transfer-focused hero and Site
                Builder blocks (session only).
              </p>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="border-t border-white/10 p-2">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  widgetKey
                    ? "Answer MAANIA’s question or add details…"
                    : "Set NEXT_PUBLIC_RET_WIDGET_KEY to enable chat…"
                }
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                disabled={pending || !widgetKey}
              />
              <button
                type="submit"
                disabled={pending || !input.trim() || !widgetKey}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${BRAND}, #7C3AED)` }}
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
