"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const TrooWorldUnifiedViewer = dynamic(
  () => import("@/components/troo-world/TrooWorldUnifiedViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-[#0d0a06] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-amber-500 mx-auto mb-4" />
          <p className="text-amber-400 font-semibold tracking-wider">Loading Apex Tower</p>
        </div>
      </div>
    ),
  }
);

export default function ApexPage() {
  return (
    <div className="fixed inset-0 bg-[#0d0a06]">
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <Link
          href="/troo-world"
          className="px-4 py-2 text-sm text-amber-400 border border-amber-500/50 rounded-lg hover:bg-amber-500/10 transition-colors"
        >
          Troo World
        </Link>
        <Link
          href="/dashboard"
          className="px-4 py-2 text-sm text-slate-400 border border-slate-500/50 rounded-lg hover:bg-slate-500/10 transition-colors"
        >
          Dashboard
        </Link>
      </div>
      <TrooWorldUnifiedViewer initialBuilding="apex" />
    </div>
  );
}
