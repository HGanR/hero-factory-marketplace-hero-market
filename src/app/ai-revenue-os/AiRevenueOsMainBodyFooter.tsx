"use client";

import Link from "next/link";
import { SystemInsightPanel } from "@/components/revenue-os/SystemInsightPanel";
import { SevenDayLaunchModePanel } from "@/components/revenue-os/SevenDayLaunchModePanel";
import { RevenueOsLinkedInPublishingPanel } from "@/components/revenue-os/RevenueOsLinkedInPublishingPanel";
import { RevenueOsPublishingPlanner } from "@/components/revenue-os/RevenueOsPublishingPlanner";

const sectionWrap = "max-w-6xl mx-auto px-6";

export function AiRevenueOsMainBodyFooter() {
  return (
    <div className={`${sectionWrap} pb-10 space-y-8`}>
      <div className="max-w-xl mx-auto">
        <SystemInsightPanel />
      </div>
      <SevenDayLaunchModePanel />
      <div className="max-w-4xl mx-auto space-y-6">
        <RevenueOsPublishingPlanner />
        <RevenueOsLinkedInPublishingPanel />
      </div>
      <div className="text-center text-gray-500 text-xs space-y-2">
        <div>
          <Link href="/dashboard" className="text-cyan-400 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
        <div>TROOTHHERTZ LLC. • DBA: TROOTHHURTZ.APP</div>
      </div>
    </div>
  );
}
