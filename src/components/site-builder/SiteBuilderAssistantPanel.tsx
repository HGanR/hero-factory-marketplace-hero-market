"use client";

import type { ReactNode } from "react";
import { SiteBuilderSeoAuditPanel } from "@/components/site-builder/SiteBuilderSeoAuditPanel";
import type { SeoScoreBreakdown } from "@/components/site-builder/SiteBuilderKeywordScoreCard";

type SeoAuditProps = {
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

type Props = {
  statusLabel: "Building" | "Editing" | "Ready" | "Needs input";
  stageNav: ReactNode;
  aiPanel: ReactNode;
  /** When omitted, SEO checklist is not shown in the rail (e.g. moved to Engines drawer). */
  seoAudit?: SeoAuditProps;
};

export function SiteBuilderAssistantPanel({ statusLabel, stageNav, aiPanel, seoAudit }: Props) {
  const statusTone =
    statusLabel === "Building"
      ? "text-cyan-200"
      : statusLabel === "Editing"
        ? "text-indigo-200"
        : statusLabel === "Needs input"
          ? "text-amber-200"
          : "text-emerald-200";
  return (
    <section className="space-y-3 rounded-2xl border border-white/[0.08] bg-slate-900/35 p-3">
      <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
        <p className="text-xs text-slate-400">Assistant status</p>
        <p className={`text-xs font-semibold ${statusTone}`}>{statusLabel}</p>
      </div>
      {stageNav}
      {seoAudit ? <SiteBuilderSeoAuditPanel {...seoAudit} /> : null}
      {aiPanel}
    </section>
  );
}
