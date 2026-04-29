import Link from "next/link";

export default function StudioPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Brand Studio</h1>
            <p className="mt-2 text-sm text-slate-400">
              Advanced lane for brand kits, garment templates, inpainting, iterations, exports, and tech packs.
            </p>
          </div>
          <Link href="/merch-creation" className="rounded-full border border-cyan-500/50 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/30">
            Back to Merch Creation
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold">Studio Controls</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>- Template library picker</li>
              <li>- Brand kit and reference asset manager</li>
              <li>- Placement transform controls (scale/position/rotation)</li>
              <li>- Inpaint mask upload + iterative edits</li>
              <li>- Multi-scene render queue and variant generation</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold">Exports + Docs</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>- Mockup pack ZIP export</li>
              <li>- Tech pack PDF export (BOM/spec sheet)</li>
              <li>- Version history with render lineage</li>
              <li>- API and worker pipeline hooks (self-hosted GPU)</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

