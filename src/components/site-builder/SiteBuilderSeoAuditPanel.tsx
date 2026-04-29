"use client";

import { SiteBuilderKeywordScoreCard, type SeoScoreBreakdown } from "@/components/site-builder/SiteBuilderKeywordScoreCard";

type Props = {
  title: string;
  description: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  h1Status: string;
  structuredDataStatus: string;
  imageAltStatus: string;
  localSeoStatus: string;
  warnings: string[];
  score: SeoScoreBreakdown;
  onGenerateSeo: () => void;
  onImproveTitle: () => void;
  onAddStructuredData: () => void;
  onOptimizeLocal: () => void;
};

export function SiteBuilderSeoAuditPanel(props: Props) {
  return (
    <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3" open>
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100">SEO Readiness</summary>
      <div className="mt-3 space-y-2 text-xs text-slate-300">
        <p><span className="text-slate-400">Title:</span> {props.title || "Missing"}</p>
        <p><span className="text-slate-400">Meta description:</span> {props.description || "Missing"}</p>
        <p><span className="text-slate-400">Primary keyword:</span> {props.primaryKeyword || "Missing"}</p>
        <p><span className="text-slate-400">Secondary:</span> {props.secondaryKeywords.join(", ") || "None"}</p>
        <p><span className="text-slate-400">H1:</span> {props.h1Status}</p>
        <p><span className="text-slate-400">Structured data:</span> {props.structuredDataStatus}</p>
        <p><span className="text-slate-400">Image alt text:</span> {props.imageAltStatus}</p>
        <p><span className="text-slate-400">Local SEO:</span> {props.localSeoStatus}</p>
      </div>
      <SiteBuilderKeywordScoreCard primaryKeyword={props.primaryKeyword} breakdown={props.score} />
      {props.warnings.length ? (
        <ul className="mt-2 space-y-1 text-xs text-amber-200">
          {props.warnings.map((w) => (
            <li key={w}>- {w}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <button type="button" onClick={props.onGenerateSeo} className="rounded-md border border-slate-700 px-2 py-1">Generate SEO</button>
        <button type="button" onClick={props.onImproveTitle} className="rounded-md border border-slate-700 px-2 py-1">Improve title</button>
        <button type="button" onClick={props.onAddStructuredData} className="rounded-md border border-slate-700 px-2 py-1">Add structured data</button>
        <button type="button" onClick={props.onOptimizeLocal} className="rounded-md border border-slate-700 px-2 py-1">Optimize for local search</button>
      </div>
    </details>
  );
}
