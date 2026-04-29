"use client";

export function ClientFunnelChart({
  visits,
  conversations,
  leads,
  bookings,
}: {
  visits: number;
  conversations: number;
  leads: number;
  bookings: number;
}) {
  const top = Math.max(1, visits, conversations, leads, bookings);
  const rows = [
    { label: "Visit / widget open", value: visits },
    { label: "Conversation", value: conversations },
    { label: "Lead", value: leads },
    { label: "Booking", value: bookings },
  ];
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h2 className="text-sm font-semibold text-cyan-200/90">Conversion funnel</h2>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>{r.label}</span>
              <span>{r.value}</span>
            </div>
            <div className="h-2 rounded bg-slate-800">
              <div className="h-2 rounded bg-cyan-500/80" style={{ width: `${Math.max(3, Math.round((r.value / top) * 100))}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">Website visits are approximated from widget activity when direct traffic series is unavailable.</p>
    </section>
  );
}
