"use client";

import { Suspense } from "react";
import MinutesWizard from "@/components/governance/minutes/MinutesWizard";

export default function NewMinutesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
      <MinutesWizard />
    </Suspense>
  );
}
