"use client";

import { Suspense } from "react";
import IrrevocableTrustWizard from "@/components/irrevocableTrust/IrrevocableTrustWizard";

export default function IrrevocableTrustWizardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
      <IrrevocableTrustWizard />
    </Suspense>
  );
}
