"use client";

import { useEffect, useMemo, useState } from "react";

type EligibleResolution = {
  id: string;
  title: string;
  resolutionType: string;
  effectiveDate: string | null;
  counterparty: string | null;
  minutes: { id: string; title: string; actionDate: string; status: string };
};

export function ResolutionPicker(props: {
  trustId?: string;
  entityId?: string;
  value?: string | null;
  onChange: (resolutionId: string) => void;
}) {
  const { trustId, entityId, value, onChange } = props;
  const [q, setQ] = useState("");
  const [items, setItems] = useState<EligibleResolution[]>([]);
  const [loading, setLoading] = useState(false);
  const contextQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (trustId) p.set("trustId", trustId);
    if (entityId) p.set("entityId", entityId);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [trustId, entityId, q]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        const res = await fetch(`/api/governance/resolutions/eligible?${contextQuery}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        const data = await res.json();
        if (!cancelled) setItems(data.items ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Require context
    if (!trustId && !entityId) return;

    run();
    return () => {
      cancelled = true;
    };
  }, [contextQuery, trustId, entityId]);

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="text-sm font-semibold">Approving Resolution</div>
      <div className="text-sm text-muted-foreground">
        Only approved resolutions whose minutes are approved/locked are selectable.
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search resolutions (title, counterparty)..."
        className="w-full rounded-xl border px-3 py-2 text-sm"
      />

      <div className="rounded-xl border">
        {loading ? (
          <div className="p-3 text-sm text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">No eligible resolutions found.</div>
        ) : (
          <div className="max-h-64 overflow-auto">
            {items.map((r) => {
              const selected = value === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onChange(r.id)}
                  className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 ${
                    selected ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.resolutionType} • Minutes: {r.minutes.title} •{" "}
                    {new Date(r.minutes.actionDate).toLocaleDateString()}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
