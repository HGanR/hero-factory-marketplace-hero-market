import Link from "next/link";

const routeMap = `app/
  page.tsx
  create/page.tsx
  studio/page.tsx
  projects/page.tsx
  projects/[projectId]/page.tsx
  assets/page.tsx
  exports/page.tsx
  orders/page.tsx
  api/projects...
  api/assets...
  api/jobs...
  api/exports...
  api/orders...
  api/webhooks/payments...`;

export default function MerchCreationPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Merch Creation</h1>
            <p className="mt-2 text-sm text-slate-400">
              Two-lane product foundation: fast consumer mockups and advanced brand studio workflows.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard" className="rounded-full border border-cyan-500/50 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/30">
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/create"
            className="rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-500/20 to-slate-900/70 p-5 transition-all hover:-translate-y-0.5 hover:border-orange-300"
          >
            <div className="text-xl font-semibold">/create lane</div>
            <p className="mt-2 text-sm text-slate-300">
              Consumer-first flow: simple controls, fast mockup generation, optional checkout path.
            </p>
          </Link>
          <Link
            href="/studio"
            className="rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-500/20 to-slate-900/70 p-5 transition-all hover:-translate-y-0.5 hover:border-orange-300"
          >
            <div className="text-xl font-semibold">/studio lane</div>
            <p className="mt-2 text-sm text-slate-300">
              Brand workflow: templates, references, inpainting iterations, exports, and tech packs.
            </p>
          </Link>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold">Core Route Map</h2>
          <pre className="mt-3 overflow-auto rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-300">
            {routeMap}
          </pre>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Link href="/projects" className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm hover:border-cyan-400">
            Projects and versions
          </Link>
          <Link href="/assets" className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm hover:border-cyan-400">
            Asset library
          </Link>
          <Link href="/exports" className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm hover:border-cyan-400">
            Export center
          </Link>
          <Link href="/orders" className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm hover:border-cyan-400 md:col-span-3">
            Orders and fulfillment lane
          </Link>
        </section>
      </div>
    </div>
  );
}

