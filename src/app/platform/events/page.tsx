"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, RefreshCw } from "lucide-react";

type PlatformEvent = {
  id: string;
  eventType: string;
  sourceModule: string;
  payload: Record<string, unknown>;
  trustId?: string;
  createdAt: string;
};

const EVENT_LABELS: Record<string, string> = {
  certificate_issued: "Certificate Issued",
  instrument_issued: "Instrument Issued",
  collateral_pledged: "Collateral Pledged",
  proceeds_received: "Proceeds Received",
  entity_created: "Entity Created",
  accounting_event_processed: "Accounting Event Processed",
};

export default function PlatformEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<PlatformEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/events?limit=50", { credentials: "include" });
      const data = await res.json();
      if (data.ok) setEvents(data.events ?? []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) {
        router.push("/");
        return;
      }
      fetchEvents();
    } catch {
      router.push("/");
    }
  }, [router, fetchEvents]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Platform Activity Stream</h1>
              <p className="text-slate-400">Observable heartbeat of the platform</p>
            </div>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <Link href="/developers/events" className="text-cyan-400 hover:text-cyan-300 text-sm">
            Event Registry →
          </Link>
          <button
            onClick={() => { setLoading(true); fetchEvents(); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : events.length === 0 ? (
          <div className="p-8 rounded-2xl border border-slate-800 bg-slate-950/50 text-center">
            <p className="text-slate-400 mb-2">No platform events yet.</p>
            <p className="text-sm text-slate-500">
              Events appear when certificates are issued, instruments are pushed to accounting, or accounting events are processed.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <div
                key={e.id}
                className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 hover:border-slate-700 flex items-start gap-4"
              >
                <div className="shrink-0 w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
                  {new Date(e.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-cyan-300">
                    {EVENT_LABELS[e.eventType] ?? e.eventType}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {e.sourceModule}
                    {e.trustId && ` · Trust ${e.trustId.slice(0, 8)}…`}
                  </p>
                  {Object.keys(e.payload ?? {}).length > 0 && (
                    <pre className="mt-2 p-2 rounded bg-slate-900 text-xs text-slate-400 overflow-x-auto max-h-24 overflow-y-auto">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
