import Link from "next/link";

export default function TrustTypeSelectionPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 text-slate-100">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Trust Records</p>
        <h1 className="mt-2 text-3xl font-bold">Choose the trust you want to prepare</h1>
        <p className="mt-3 text-sm text-slate-300">Both trust types require careful consideration of your state law, beneficiaries, assets, and legal execution requirements. This service organizes drafting information and does not replace legal advice.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Revocable Living Trust</h2>
          <p className="mt-3 text-sm text-slate-300">Generally allows the settlor to amend or revoke the trust while retaining capacity, subject to its terms and applicable law.</p>
          <p className="mt-4 text-sm text-amber-200">The dedicated revocable trust questionnaire and drafting workflow are being prepared. Do not use the irrevocable questionnaire for a revocable trust.</p>
          <span className="mt-5 block rounded-lg border border-slate-600 px-4 py-3 text-center text-sm text-slate-300">Revocable trust wizard — coming soon</span>
        </section>
        <section className="rounded-2xl border border-cyan-500/50 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Irrevocable Trust</h2>
          <p className="mt-3 text-sm text-slate-300">Typically limits changes or revocation after establishment. The applicable rules and exceptions depend on the trust terms and governing law.</p>
          <Link href="/trust-records/wizard/irrevocable-trust" className="mt-5 block rounded-lg bg-cyan-500 px-4 py-3 text-center text-sm font-semibold text-slate-950 hover:bg-cyan-400">Start or resume irrevocable trust</Link>
        </section>
      </div>
      <Link href="/trust-records" className="inline-block text-sm text-cyan-300 underline">Return to Trust Records</Link>
    </main>
  );
}
