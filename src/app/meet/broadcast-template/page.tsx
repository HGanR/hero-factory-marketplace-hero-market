import { Suspense } from "react";
import { BroadcastEgressTemplateClient } from "@/components/meet/BroadcastEgressTemplateClient";

export default function BroadcastTemplatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-slate-200 flex items-center justify-center text-sm">
          Loading broadcast template…
        </div>
      }
    >
      <BroadcastEgressTemplateClient />
    </Suspense>
  );
}
