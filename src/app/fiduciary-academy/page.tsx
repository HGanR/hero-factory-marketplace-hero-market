import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Fiduciary Academy | TROOTHHURTZ",
  description: "Explore legal identity, the historical foundations of equity, fiduciary governance, and digital credentials in the TROOTHHURTZ Fiduciary Academy.",
  openGraph: {
    title: "TROOTHHURTZ Fiduciary Academy",
    description: "From common law to equity: legal identity, trust establishment, fiduciary governance, and digital credentials.",
    url: "https://troothhurtz.app/fiduciary-academy",
    type: "website",
    images: [{ url: "/fiduciary-academy-social.jpg", width: 1200, height: 630, alt: "TROOTHHURTZ Fiduciary Academy — historical equity and digital credentials" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TROOTHHURTZ Fiduciary Academy",
    description: "Historical foundations, practical preparation, and modern digital verification.",
    images: ["/fiduciary-academy-social.jpg"],
  },
};

const modules = [
  { weeks: "01–02", title: "Legal Identity and Petition Preparation", body: "Explore the distinction between customary name usage and court-authorized name changes. Study jurisdiction, petition structure, disclosures, and procedural safeguards." },
  { weeks: "03–04", title: "Judicial Process and Record Alignment", body: "Examine notice, publication exceptions, hearings, decrees, and the orderly updating of identity records with public agencies and financial institutions." },
  { weeks: "05–06", title: "Equity, Fiduciary Duties, and Trust Instruments", body: "Trace the development of equitable jurisdiction and the distinction between legal title and beneficial interests. Study settlors, trustees, beneficiaries, governing provisions, and drafting exercises." },
  { weeks: "07–08", title: "Formalization, Administration, and Funding", body: "Review execution requirements, tax identification considerations, certifications, asset schedules, and evidence of property transfer, culminating in an educational portfolio." },
];

export default function FiduciaryAcademyLanding() {
  return (
    <main className="min-h-screen bg-[#080e1b] text-slate-100">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <nav className="flex items-center justify-between gap-4 text-sm">
          <Link href="/" className="font-semibold tracking-wide text-cyan-300 hover:text-cyan-100">TROOTHHURTZ · HERO-MARKET</Link>
          <Link href="/smart-trust" className="rounded-full border border-slate-600 px-4 py-2 text-slate-200 hover:border-cyan-400">Explore SMART TRUST</Link>
        </nav>
        <header className="mt-14 max-w-4xl space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">TROOTHHURTZ Fiduciary Academy · Educational overview</p>
          <h1 className="text-4xl font-bold leading-tight sm:text-6xl">Understand the foundations. Prepare with purpose. Preserve the record.</h1>
          <p className="max-w-3xl text-lg leading-relaxed text-slate-300">An educational pathway connecting legal identity, the historical development of equity, fiduciary stewardship, and modern methods of organizing verifiable digital records.</p>
          <div className="flex flex-wrap gap-3">
            <a href="#curriculum" className="rounded-lg bg-amber-400 px-5 py-3 font-semibold text-slate-950 hover:bg-amber-300">Explore the curriculum</a>
            <a href="#nft-program" className="rounded-lg border border-cyan-500 px-5 py-3 font-semibold text-cyan-200 hover:bg-cyan-950">Education & the NFT program</a>
          </div>
        </header>
        <section className="mt-16 grid gap-5 md:grid-cols-2" aria-label="Historical nexus">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-7">
            <h2 className="text-2xl font-semibold text-amber-200">The historical nexus</h2>
            <p className="mt-4 leading-relaxed text-slate-300">The law of equity developed alongside common-law courts, providing principles and remedies concerned with conscience, fiduciary obligations, and beneficial interests. The trust became a prominent expression of this tradition: a trustee may hold legal title while beneficiaries hold interests recognized and protected in equity.</p>
            <p className="mt-4 leading-relaxed text-slate-300">Modern trust practice builds on this history but operates under applicable statutes, case law, tax rules, and formal requirements. Historical concepts illuminate the structure of a trust; they do not replace contemporary legal compliance.</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-7">
            <h2 className="text-2xl font-semibold text-cyan-200">From historical record to digital provenance</h2>
            <p className="mt-4 leading-relaxed text-slate-300">For centuries, petitions, deeds, trust instruments, and institutional registers have helped establish an auditable record of decisions and transactions. Digital credentials and blockchain attestations introduce new ways to associate a record with a timestamp, an issuer, or a holder.</p>
            <p className="mt-4 leading-relaxed text-slate-300">The connection is one of documentary continuity—not legal equivalence. An NFT does not itself establish a trust, convey property, validate a name change, or substitute for a court decree, signed instrument, or properly completed transfer.</p>
          </div>
        </section>
        <section id="curriculum" className="mt-20 scroll-mt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">Eight-week modular framework</p>
          <h2 className="mt-2 text-3xl font-bold">A curriculum grounded in practice</h2>
          <p className="mt-3 max-w-3xl text-slate-300">The proposed academy follows the supplied course syllabus: four weeks of legal identity and judicial procedure, followed by four weeks of equitable principles, trust drafting, administration, and funding.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {modules.map((module) => (
              <article key={module.weeks} className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
                <p className="text-sm font-semibold text-amber-300">Weeks {module.weeks}</p>
                <h3 className="mt-2 text-xl font-semibold">{module.title}</h3>
                <p className="mt-3 leading-relaxed text-slate-300">{module.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 text-sm text-slate-400">Learning activities are planned to include jurisdictional comparisons, hypothetical petition drafting, fiduciary case analysis, a declaration and Schedule A exercise, and a capstone portfolio. This page describes the educational program; it does not represent that classes, enrollment, or certification are currently operational.</p>
        </section>
        <section id="nft-program" className="mt-20 scroll-mt-8 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/50 to-slate-900 p-7 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Educational credentials · Digital participation</p>
          <h2 className="mt-3 text-3xl font-bold">How the Academy connects with the NFT program</h2>
          <p className="mt-4 max-w-4xl leading-relaxed text-slate-200">The TROOTHHURTZ NFT ecosystem can provide a digital participation layer for the Academy. Subject to the program's final access rules and technical verification, a wallet-linked NFT may serve as an access credential, participation marker, or record of educational achievement. The Academy provides the underlying instruction; a token can help document participation without replacing the knowledge, assessment, or professional judgment involved.</p>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-5"><h3 className="font-semibold text-cyan-200">Access</h3><p className="mt-2 text-sm text-slate-300">Explore token-aware access to eligible educational experiences, without requiring a wallet merely to read this overview.</p></div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-5"><h3 className="font-semibold text-cyan-200">Achievement</h3><p className="mt-2 text-sm text-slate-300">Consider optional, privacy-conscious credentials for completed learning milestones, distinct from legal or professional licensure.</p></div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-5"><h3 className="font-semibold text-cyan-200">Continuity</h3><p className="mt-2 text-sm text-slate-300">Connect educational progress to future trust-preparation tools and member services while keeping sensitive legal records off public blockchains.</p></div>
          </div>
          <p className="mt-5 text-sm text-slate-300">NFT ownership is not proof of legal identity, ownership of trust property, fiduciary authority, attorney qualification, or completion of a court procedure. NFT eligibility, issuance, and educational benefits must be separately defined and verified.</p>
        </section>
        <section className="mt-16 rounded-2xl border border-amber-500/20 bg-slate-900/60 p-7">
          <h2 className="text-2xl font-semibold">Education and responsible preparation</h2>
          <p className="mt-3 leading-relaxed text-slate-300">The Academy is envisioned as the educational foundation for HERO-MARKET's Digital Trust Workspace and SMART TRUST administration tools. Educational exercises should use fictional or redacted information. Actual petitions, trust instruments, tax filings, and asset transfers require jurisdiction-specific verification and, where appropriate, qualified legal or tax professionals.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/trust-records" className="rounded-lg border border-amber-400 px-5 py-3 font-semibold text-amber-200 hover:bg-amber-400/10">Explore Trust Records</Link>
            <Link href="/" className="rounded-lg border border-slate-500 px-5 py-3 font-semibold hover:bg-slate-800">Return to HERO-MARKET</Link>
          </div>
        </section>
        <footer className="py-12 text-xs leading-relaxed text-slate-400">Educational information only. No legal, tax, financial, or investment advice; no attorney-client relationship. This overview is not an offer of accredited instruction or a representation of currently available NFT benefits.</footer>
      </div>
    </main>
  );
}
