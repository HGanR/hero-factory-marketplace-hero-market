"use client";

import { useEffect, useState } from "react";
import {
  BUYER_TAILORED_DEMO_MIN_PERCENT,
  type BuyerDemoPayload,
} from "@/lib/maania/build-buyer-demo-payload";
import {
  retDemoPayloadProgressPercent,
  type RetDemoPagePayload,
} from "@/lib/maania/build-ret-demo-payload";
import {
  MAANIA_BUYER_DEMO_STORAGE_KEY,
  MAANIA_BUYER_SITE_SCHEMA_STORAGE_KEY,
  MAANIA_RET_DEMO_STORAGE_KEY,
  MAANIA_RET_SITE_SCHEMA_STORAGE_KEY,
} from "@/lib/maania/maania-demo-storage";
import { openBuyerDemoInBuilder, openRetDemoInBuilder } from "@/lib/maania/open-in-builder";
import { copyMaaniaShareLinkToClipboard } from "@/lib/maania/share-demo";
import { sendMaaniaDemoToClientViaMailto } from "@/lib/maania/maania-send-to-client";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

const AGENT_NAME = process.env.NEXT_PUBLIC_MAANIA_AGENT_NAME?.trim() || undefined;

/**
 * Session banner: MAANIA-generated preview, completeness, Open in Builder, optional share link.
 */
export function MaaniaDemoPageBanner() {
  const [buyerPayload, setBuyerPayload] = useState<BuyerDemoPayload | null>(null);
  const [retPayload, setRetPayload] = useState<RetDemoPagePayload | null>(null);
  const [schema, setSchema] = useState<SiteSchemaDocumentType | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    try {
      const br = sessionStorage.getItem(MAANIA_BUYER_DEMO_STORAGE_KEY);
      const rr = sessionStorage.getItem(MAANIA_RET_DEMO_STORAGE_KEY);
      const s =
        sessionStorage.getItem(MAANIA_BUYER_SITE_SCHEMA_STORAGE_KEY) ??
        sessionStorage.getItem(MAANIA_RET_SITE_SCHEMA_STORAGE_KEY);
      if (br) setBuyerPayload(JSON.parse(br) as BuyerDemoPayload);
      if (rr) setRetPayload(JSON.parse(rr) as RetDemoPagePayload);
      if (s) setSchema(JSON.parse(s) as SiteSchemaDocumentType);
    } catch {
      /* ignore */
    }
  }, []);

  if (!buyerPayload && !retPayload && !schema) return null;

  const mode: "buyer" | "ret" = buyerPayload
    ? "buyer"
    : retPayload
      ? "ret"
      : schema?.metadata?.title?.includes("RET demo")
        ? "ret"
        : "buyer";

  const hasPayload = Boolean(buyerPayload || retPayload);
  const pct = buyerPayload
    ? buyerPayload.readiness.progressPercent
    : retPayload
      ? retDemoPayloadProgressPercent(retPayload)
      : 0;

  const canOpenBuilder =
    !!schema &&
    (!hasPayload || pct >= BUYER_TAILORED_DEMO_MIN_PERCENT);

  const canShare = canOpenBuilder;

  const shareInput = (): {
    kind: "buyer" | "ret";
    title: string;
    payload: unknown;
    schema: SiteSchemaDocumentType;
  } | null => {
    if (!schema || !canShare) return null;
    const title =
      (mode === "buyer" && buyerPayload
        ? buyerPayload.heroTitle
        : retPayload?.heroTitle ?? schema?.metadata?.title?.split("|")[0]?.trim())?.slice(0, 200) ?? "MAANIA demo";
    return {
      kind: mode,
      title,
      payload: mode === "buyer" ? buyerPayload ?? {} : retPayload ?? {},
      schema,
    };
  };

  const onShare = async () => {
    const input = shareInput();
    if (!input) return;
    setShareBusy(true);
    setShareNote(null);
    try {
      const r = await copyMaaniaShareLinkToClipboard(input);
      if (r.ok) setShareNote("Share link copied to clipboard.");
      else setShareNote(r.error || "Could not create share link.");
    } finally {
      setShareBusy(false);
    }
  };

  const onSendToClient = async () => {
    const input = shareInput();
    if (!input) return;
    setShareBusy(true);
    setShareNote(null);
    try {
      const r = await sendMaaniaDemoToClientViaMailto({
        shareInput: input,
        agentName: AGENT_NAME,
      });
      if (r.ok) setShareNote("Opening your email app — review the message before sending.");
      else if (r.reason === "cancelled" || r.reason === "invalid_email") {
        /* prompt dismissed or validation alert shown */
      } else if (r.reason === "share_failed") {
        setShareNote(r.error || "Could not create share link.");
      }
    } finally {
      setShareBusy(false);
    }
  };

  const onOpenBuilder = () => {
    if (!schema) return;
    if (mode === "buyer") openBuyerDemoInBuilder(schema);
    else openRetDemoInBuilder(schema);
  };

  return (
    <div className="mx-auto mb-10 max-w-2xl rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-4 text-left">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-300/90">
            Preview generated from MAANIA intake
          </p>
          <p className="mt-1 text-sm text-slate-300">
            {mode === "buyer"
              ? "This page updates as more buyer details are collected in MAANIA (same browser session)."
              : "This page reflects RET-style seller intake (same browser session)."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {canOpenBuilder ? (
            <button
              type="button"
              onClick={onOpenBuilder}
              className="rounded-lg border border-blue-500/40 bg-blue-600/25 px-3 py-1.5 text-xs font-semibold text-blue-100 hover:bg-blue-600/35"
            >
              Open in Site Builder
            </button>
          ) : null}
          {canShare ? (
            <>
              <button
                type="button"
                disabled={shareBusy}
                onClick={() => void onShare()}
                className="rounded-lg border border-violet-500/40 bg-violet-600/25 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-600/35 disabled:opacity-50"
              >
                {shareBusy ? "Creating…" : "Copy share link"}
              </button>
              <button
                type="button"
                disabled={shareBusy}
                onClick={() => void onSendToClient()}
                className="rounded-lg border border-amber-500/45 bg-amber-600/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-600/30 disabled:opacity-50"
              >
                Send to client
              </button>
            </>
          ) : null}
        </div>
      </div>
      {(buyerPayload || retPayload) && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>{mode === "buyer" ? "Buyer intake completeness" : "RET intake completeness"}</span>
            <span className="font-mono text-emerald-400/90">{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-cyan-500 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
          {!canOpenBuilder && schema && hasPayload ? (
            <p className="mt-2 text-[11px] text-slate-500">
              Reach {BUYER_TAILORED_DEMO_MIN_PERCENT}%+ intake in MAANIA to unlock Open in Site Builder and share.
            </p>
          ) : null}
          {shareNote ? <p className="mt-2 text-[11px] text-slate-400">{shareNote}</p> : null}
        </div>
      )}
    </div>
  );
}
