"use client";

import Link from "next/link";

export default function CopyrightStepsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-2xl border border-cyan-500/40 bg-slate-900/60 p-6">
          <h1 className="text-2xl font-bold text-cyan-200">Copyright Steps</h1>
          <p className="mt-2 text-sm text-slate-300">
            Professional workflow for creating timeline evidence and future EVM anchoring.
          </p>
          <div className="mt-3">
            <Link
              href="/dashboard"
              className="inline-flex rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-orange-500/40 bg-slate-900/60 p-5">
            <h2 className="font-semibold text-orange-200">Step 1: Hash The Work</h2>
            <p className="mt-2 text-sm text-slate-300">
              Compute SHA-256 on final file bytes. Store filename, MIME type, hash, and version notes.
            </p>
          </div>
          <div className="rounded-2xl border border-orange-500/40 bg-slate-900/60 p-5">
            <h2 className="font-semibold text-orange-200">Step 2: Anchor Evidence</h2>
            <p className="mt-2 text-sm text-slate-300">
              Record chain id, tx hash, block number, and timestamp after final confirmation depth.
            </p>
          </div>
          <div className="rounded-2xl border border-orange-500/40 bg-slate-900/60 p-5">
            <h2 className="font-semibold text-orange-200">Step 3: Verify Anytime</h2>
            <p className="mt-2 text-sm text-slate-300">
              Recompute hash and compare against anchored tx data or event log. Keep immutable audit history.
            </p>
          </div>
          <div className="rounded-2xl border border-orange-500/40 bg-slate-900/60 p-5">
            <h2 className="font-semibold text-orange-200">Step 4: Export Proof Packet</h2>
            <p className="mt-2 text-sm text-slate-300">
              Package file hash, tx evidence, block timestamp, and legal memo summary for review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
