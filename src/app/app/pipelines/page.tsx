"use client";

import Link from "next/link";

export default function PipelinesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pipelines</h1>
          <p className="text-sm text-white/60">Opportunities linked to contacts • Kanban + list view</p>
        </div>
        <Link
          href="/app/dashboard"
          className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/10"
        >
          Dashboard
        </Link>
      </div>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
        <p className="text-white/60">Pipeline Kanban coming soon. Stages, drag-and-drop opportunities.</p>
        <Link href="/app/dashboard" className="mt-4 inline-block text-cyan-400 hover:text-cyan-300">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
