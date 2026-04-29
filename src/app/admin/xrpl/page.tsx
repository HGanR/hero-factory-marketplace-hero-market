"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminXrplGuidePage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const isAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!isAdmin) router.push("/admin");
    } catch {
      router.push("/admin");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold">XRPL Services Usage Guide (Admin)</div>
            <div className="mt-1 text-sm text-slate-300">
              Internal guide for admins/devs using the XRPL IOU issuance + trust line services.
            </div>
          </div>
          <button className="text-sm text-cyan-300 underline hover:text-cyan-200" onClick={() => router.push("/admin")}>
            Back to Admin Panel
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="text-sm text-slate-200">Table of Contents</div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
            <li>
              <a className="underline hover:text-slate-100" href="#installation-setup">
                Installation &amp; Setup
              </a>
            </li>
            <li>
              <a className="underline hover:text-slate-100" href="#basic-usage">
                Basic Usage
              </a>
            </li>
            <li>
              <a className="underline hover:text-slate-100" href="#trust-line-manager-examples">
                Trust Line Manager Examples
              </a>
            </li>
            <li>
              <a className="underline hover:text-slate-100" href="#iou-issuer-examples">
                IOU Issuer Examples
              </a>
            </li>
            <li>
              <a className="underline hover:text-slate-100" href="#error-handling">
                Error Handling
              </a>
            </li>
          </ul>
        </div>

        <section id="installation-setup" className="space-y-3">
          <h2 className="text-xl font-semibold">Installation &amp; Setup</h2>
          <p className="text-sm text-slate-300">
            XRPL is configured via server environment variables. See <span className="font-mono">XRPL_ENV_TEMPLATE.txt</span>{" "}
            at the repo root. Note: <span className="font-mono">XRPL_RPC_URL</span> must be a WebSocket URL (
            <span className="font-mono">wss://</span> or <span className="font-mono">ws://</span>).
          </p>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Services live here:</div>
            <pre className="mt-2 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-200">
              <code>{`src/lib/xrpl/xrpl-client.ts
src/lib/xrpl/xrpl-trustline-manager.ts
src/lib/xrpl/xrpl-iou-issuer.ts
src/app/api/xrpl/issue/route.ts`}</code>
            </pre>
          </div>
        </section>

        <section id="basic-usage" className="space-y-3">
          <h2 className="text-xl font-semibold">Basic Usage</h2>
          <p className="text-sm text-slate-300">
            End users do not need this. The Trust Records UI calls <span className="font-mono">/api/xrpl/issue</span> when
            “Issue on XRPL” is enabled and embeds the tx hash into the digital certificate (with watermark + seal).
          </p>
        </section>

        <section id="trust-line-manager-examples" className="space-y-3">
          <h2 className="text-xl font-semibold">Trust Line Manager Examples</h2>
          <pre className="overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-200">
            <code>{`import { getTrustLineManager, getXrplEnv } from "@/lib/xrpl";

const env = getXrplEnv();
const mgr = getTrustLineManager();

// Create trust line (SIGNED by holder => requires holder seed)
await mgr.createTrustLine(process.env.XRPL_TRUST_SEED || "", {
  issuer: env.issuerAddress,
  currency: "USD",
  limit: "1000000",
  memo: "Trust line for distribution",
});

// Query trust line (no seed required)
const tl = await mgr.getTrustLine(env.trustAddress, env.issuerAddress, "USD");`}</code>
          </pre>
        </section>

        <section id="iou-issuer-examples" className="space-y-3">
          <h2 className="text-xl font-semibold">IOU Issuer Examples</h2>
          <pre className="overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-200">
            <code>{`import { getIouIssuer } from "@/lib/xrpl";

const issuer = getIouIssuer();
const txHash = await issuer.issueIOUs({
  amount: "100000",
  currency: "USD",
  recipient: "rBeneficiary...",
  memo: "Trust distribution",
  memoType: "TrustCertificate",
});`}</code>
          </pre>
        </section>

        <section id="error-handling" className="space-y-3">
          <h2 className="text-xl font-semibold">Error Handling</h2>
          <pre className="overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-200">
            <code>{`// /api/xrpl/issue returns JSON { txHash, issuer } on success
// and { error } with status 4xx/5xx on failure.`}</code>
          </pre>
        </section>
      </div>
    </div>
  );
}














