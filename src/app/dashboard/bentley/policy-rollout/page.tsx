import { Suspense } from "react";
import { BentleyPolicyRolloutClient } from "@/components/revenue-os/bentley-command-center/BentleyPolicyRolloutClient";

export const metadata = {
  title: "Bentley Policy Rollout",
  description: "Staged policy rollout coaching, pilot workspace selection, and saved rollout plans — dry-run only.",
};

export default function BentleyPolicyRolloutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 px-4 py-10 text-sm text-zinc-400">
          Loading rollout workbench…
        </div>
      }
    >
      <BentleyPolicyRolloutClient />
    </Suspense>
  );
}
