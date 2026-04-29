"use client";

import dynamic from "next/dynamic";
import { SystemModelOverview } from "@/components/revenue-os/SystemModelOverview";
import { AiRevenueOsMainBodyTop } from "./AiRevenueOsMainBodyTop";
import { AiRevenueOsMainBodyFooter } from "./AiRevenueOsMainBodyFooter";

/** Separate webpack chunks so a TDZ bug in one step does not fuse with others (fixes “Cannot access 'ea' before initialization”). */
const AiRevenueOsSteps12Chunk = dynamic(
  () => import("./AiRevenueOsSteps12Chunk").then((m) => m.AiRevenueOsSteps12Chunk),
  { ssr: false, loading: () => <div className="min-h-16 bg-slate-950/50" aria-hidden /> }
);

const AiRevenueOsStep3IndustryChunk = dynamic(
  () => import("./AiRevenueOsStep3IndustryChunk").then((m) => m.AiRevenueOsStep3IndustryChunk),
  { ssr: false, loading: () => <div className="min-h-16 bg-slate-950/50" aria-hidden /> }
);

const AiRevenueOsSteps45Chunk = dynamic(
  () => import("./AiRevenueOsSteps45Chunk").then((m) => m.AiRevenueOsSteps45Chunk),
  { ssr: false, loading: () => <div className="min-h-16 bg-slate-950/50" aria-hidden /> }
);

const sectionWrap = "max-w-6xl mx-auto px-6";

export function AiRevenueOsMainBody() {
  return (
    <>
      <AiRevenueOsMainBodyTop />
      <SystemModelOverview />
      <section className="pb-16 md:pb-24 bg-slate-950/90">
        <div className={`${sectionWrap} space-y-4`}>
          <AiRevenueOsSteps12Chunk />
          <AiRevenueOsStep3IndustryChunk />
          <AiRevenueOsSteps45Chunk />
        </div>
      </section>
      <AiRevenueOsMainBodyFooter />
    </>
  );
}
