import { Suspense } from "react";
import { BentleyPolicyRollbackClient } from "@/components/revenue-os/bentley-command-center/BentleyPolicyRollbackClient";

export const metadata = {
  title: "Bentley Policy Rollback",
  description: "Explicit rollback packages and governed apply — operator-approved; not automatic.",
};

export default function BentleyPolicyRollbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 px-4 py-10 text-sm text-zinc-400">
          Loading rollback workbench…
        </div>
      }
    >
      <BentleyPolicyRollbackClient />
    </Suspense>
  );
}
