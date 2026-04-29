"use client";

export type SeoScoreBreakdown = {
  score: number;
  missingItems: string[];
  suggestedKeywords: string[];
};

type Props = {
  primaryKeyword: string;
  breakdown: SeoScoreBreakdown;
};

export function SiteBuilderKeywordScoreCard({ primaryKeyword, breakdown }: Props) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/65 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Keyword Scoring</p>
      <div className="mt-1 flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-slate-100">SEO Score</p>
          <p className="text-xs text-slate-400">{primaryKeyword || "No primary keyword yet"}</p>
        </div>
        <div className="text-xl font-semibold text-cyan-200">{Math.max(0, Math.min(100, breakdown.score))}</div>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Suggested keywords: {breakdown.suggestedKeywords.length ? breakdown.suggestedKeywords.join(", ") : "None"}
      </p>
      <p className="mt-2 text-xs text-amber-200">
        Missing: {breakdown.missingItems.length ? breakdown.missingItems.join(", ") : "No obvious gaps"}
      </p>
    </section>
  );
}
