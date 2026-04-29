"use client";

export type ApplyReviewSection = {
  id: string;
  badge: string;
  title: string;
  route: string;
  description: string;
  preview: Record<string, unknown>;
  confirm: boolean;
  onConfirmChange: (v: boolean) => void;
  onApply: () => void | Promise<void>;
  canApply: boolean;
  blockedReason?: string | null;
  busy?: boolean;
  ok?: string | null;
  err?: string | null;
  accent?: "rose" | "amber" | "cyan";
};

const ACCENT: Record<NonNullable<ApplyReviewSection["accent"]>, string> = {
  rose: "border-rose-900/50 bg-rose-950/25",
  amber: "border-amber-900/50 bg-amber-950/25",
  cyan: "border-cyan-900/50 bg-cyan-950/25",
};

export function BentleyPolicyApplyReviewPanel({ sections }: { sections: ApplyReviewSection[] }) {
  const visible = sections.filter((s) => s.blockedReason != null || s.canApply);
  if (!visible.length) return null;

  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
      <h2 className="text-sm font-medium text-zinc-200">Apply review (live policies)</h2>
      <p className="text-xs text-zinc-500">
        Each block calls one existing upsert route after explicit confirmation. Simulations above remain dry-run only.
      </p>
      <div className="space-y-4">
        {visible.map((s) => (
          <div
            key={s.id}
            className={`rounded-lg border p-4 ${ACCENT[s.accent ?? "rose"]}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {s.badge}
              </span>
              <h3 className="text-sm font-medium text-zinc-100">{s.title}</h3>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              <code className="text-zinc-400">{s.route}</code> — {s.description}
            </p>
            {s.blockedReason ? (
              <p className="mt-2 text-xs text-amber-200/90">{s.blockedReason}</p>
            ) : (
              <>
                <pre className="mt-2 max-h-40 overflow-auto rounded border border-white/10 bg-black/40 p-2 text-[11px] text-zinc-400">
                  {JSON.stringify(s.preview, null, 2)}
                </pre>
                <label className="mt-2 flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={s.confirm}
                    onChange={(e) => s.onConfirmChange(e.target.checked)}
                  />
                  I confirm this upsert for {s.title}.
                </label>
                <button
                  type="button"
                  disabled={s.busy || !s.confirm}
                  onClick={() => void s.onApply()}
                  className="mt-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-40"
                >
                  Apply
                </button>
                {s.ok ? <p className="mt-2 text-xs text-emerald-400">{s.ok}</p> : null}
                {s.err ? <p className="mt-2 text-xs text-rose-300">{s.err}</p> : null}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
