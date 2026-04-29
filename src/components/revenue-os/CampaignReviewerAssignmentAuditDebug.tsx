"use client";

import { useEffect, useState } from "react";

type AuditEvent = {
  id: string;
  action: string;
  targetUserId: number;
  actorUserId: number;
  previousRole: string | null;
  nextRole: string | null;
  createdAt: string;
};

export function CampaignReviewerAssignmentAuditDebug(props: {
  campaignId: string | null;
  enabled: boolean;
}) {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!props.enabled || !props.campaignId) {
      setEvents(null);
      setErr(null);
      return;
    }
    let cancelled = false;
    const cid = props.campaignId;
    const run = async () => {
      try {
        const res = await fetch(`/api/campaigns/${encodeURIComponent(cid)}/reviewer-audit`, {
          credentials: "include",
        });
        const j = (await res.json().catch(() => null)) as { events?: unknown; message?: string } | null;
        if (cancelled) return;
        if (!res.ok) {
          setErr(typeof j?.message === "string" ? j.message : res.statusText || "Request failed");
          setEvents(null);
          return;
        }
        setErr(null);
        setEvents(Array.isArray(j?.events) ? (j!.events as AuditEvent[]) : []);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "fetch failed");
          setEvents(null);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [props.enabled, props.campaignId]);

  if (!props.enabled || !props.campaignId) return null;

  return (
    <div className="mt-3 rounded-lg border border-dashed border-amber-700/40 bg-amber-950/20 p-2.5 text-[10px] text-amber-100/90 space-y-1">
      <p className="font-semibold text-amber-200/90">Reviewer assignment audit (debug)</p>
      {err ? <p className="text-red-300">{err}</p> : null}
      {!events?.length && !err ? <p className="text-slate-500">No events yet.</p> : null}
      <ul className="space-y-1 font-mono text-[10px]">
        {events?.map((e) => (
          <li key={e.id} className="border-b border-amber-900/30 pb-1 last:border-0">
            <span className="text-amber-300">{e.createdAt.slice(0, 19)}</span>{" "}
            <span className="text-white">{e.action}</span> target={e.targetUserId} actor={e.actorUserId}{" "}
            {e.previousRole != null ? `prev=${e.previousRole}` : ""}{" "}
            {e.nextRole != null ? `next=${e.nextRole}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
