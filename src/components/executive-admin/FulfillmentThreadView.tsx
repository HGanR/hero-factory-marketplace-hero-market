"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveOperationalThreadDto } from "@/lib/executive-agent/executive-conversation-threads";
import { ExecutiveThreadPanel } from "./ExecutiveThreadPanel";

type Props = {
  orderId: string;
  clientId?: string;
  department: "WEBSITE" | "TRUST";
  subjectId: "site_builder" | "trust_jarva";
};

export function FulfillmentThreadView({ orderId, clientId, department, subjectId }: Props) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [ensuring, setEnsuring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureCaseThread = useCallback(async () => {
    if (!orderId.trim()) return;
    setEnsuring(true);
    setError(null);
    try {
      const params = new URLSearchParams({ orderId: orderId.trim(), limit: "5" });
      const listR = await fetch(`/api/admin/executive-agent/threads?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const listJ = (await listR.json().catch(() => ({}))) as {
        threads?: ExecutiveOperationalThreadDto[];
      };
      const existing = (listJ.threads ?? []).find((t) => t.threadKind === "fulfillment_case");
      if (existing) {
        setThreadId(existing.id);
        return;
      }

      const short = orderId.length > 10 ? `${orderId.slice(0, 8)}…` : orderId;
      const createR = await fetch("/api/admin/executive-agent/threads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${department} fulfillment case ${short}`,
          threadKind: "fulfillment_case",
          subjectId,
          department,
          clientId: clientId?.trim() || null,
          orderId: orderId.trim(),
          initialMessage: `Fulfillment case thread for order ${orderId.trim()}. Internal ops only.`,
        }),
      });
      const createJ = (await createR.json().catch(() => ({}))) as {
        thread?: ExecutiveOperationalThreadDto;
        error?: string;
      };
      if (!createR.ok || !createJ.thread) {
        setError(createJ.error ?? `Create failed (${createR.status})`);
        return;
      }
      setThreadId(createJ.thread.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnsuring(false);
    }
  }, [orderId, clientId, department, subjectId]);

  useEffect(() => {
    void ensureCaseThread();
  }, [ensureCaseThread]);

  return (
    <div className="mt-3 rounded-xl border border-cyan-500/15 bg-slate-950/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
          Case discussion · {department}
        </h3>
        {ensuring ? <span className="text-[9px] text-slate-500">Linking thread…</span> : null}
      </div>
      {error ? <p className="mb-2 text-[10px] text-amber-200">{error}</p> : null}
      <ExecutiveThreadPanel threadId={threadId} />
    </div>
  );
}
