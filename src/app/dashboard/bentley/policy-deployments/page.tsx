import { Suspense } from "react";
import { BentleyPolicyDeploymentsClient } from "@/components/revenue-os/bentley-command-center/BentleyPolicyDeploymentsClient";

export const metadata = {
  title: "Bentley Policy Deployments",
  description: "Cross-family change sets, staged ordering, and deployment history — governed apply.",
};

export default function BentleyPolicyDeploymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 px-4 py-10 text-sm text-zinc-400">
          Loading policy deployments…
        </div>
      }
    >
      <BentleyPolicyDeploymentsClient />
    </Suspense>
  );
}
