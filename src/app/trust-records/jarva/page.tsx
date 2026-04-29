import Link from "next/link";
import { Suspense } from "react";

import { JarvaTrustIntakeRouteBody } from "./JarvaTrustIntakeRouteBody";

export const metadata = {
  title: "Build with Jarva | Trust Records",
  description: "Structured trust intake mapped into the Smart Trust workspace draft.",
};

export default async function JarvaTrustIntakePage({
  searchParams,
}: {
  searchParams: Promise<{ trustId?: string }>;
}) {
  const sp = await searchParams;
  const trustId = (sp.trustId || "").trim();

  if (!trustId || trustId.length < 10) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-slate-950/80 p-6 text-slate-200">
        <p className="font-semibold text-white">Trust workspace required</p>
        <p className="mt-2 text-sm text-slate-400">
          Open Trust Records with a <code className="text-amber-200">trustId</code> in the URL, then return here. Example:{" "}
          <code className="text-amber-200">/trust-records/jarva?trustId=YOUR_TRUST_ID</code>
        </p>
        <Link href="/trust-records" className="mt-4 inline-block text-sm font-medium text-amber-400 hover:text-amber-300">
          ← Back to Trust Records
        </Link>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="text-sm text-slate-400">Loading workspace…</div>
        </div>
      }
    >
      <JarvaTrustIntakeRouteBody trustId={trustId} />
    </Suspense>
  );
}
