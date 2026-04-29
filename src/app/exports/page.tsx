import Link from "next/link";

export default function ExportsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-3xl font-bold">Exports</h1>
        <p className="mt-2 text-sm text-slate-400">
          Download generated mockup packs and tech pack documents.
        </p>
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-5 text-sm text-slate-300">
          Exports list placeholder. Intended API: `POST /api/exports/mockup-pack` and `POST /api/exports/tech-pack`.
        </div>
        <Link href="/merch-creation" className="mt-4 inline-flex rounded-full border border-cyan-500/50 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/30">
          Back to Merch Creation
        </Link>
      </div>
    </div>
  );
}

