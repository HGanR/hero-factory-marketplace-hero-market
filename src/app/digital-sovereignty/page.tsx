import type { Metadata } from "next";
import Link from "next/link";
import { Fingerprint, ShieldCheck, Lock, FileCheck, Database, Landmark } from "lucide-react";
import styles from "./sovereignty.module.css";

const socialTitle = "Digital Sovereignty™ | TROOTHHURTZ";
const socialDescription = "Your Identity. Your Data. Your Assets. Your Legacy. Explore digital identity, privacy rights and digital asset governance.";
const canonicalUrl = "https://troothhurtz.app/digital-sovereignty";
const socialImage = "https://troothhurtz.app/images/digital-sovereignty-og.png";

export const metadata: Metadata = {
  title: socialTitle,
  description: socialDescription,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: socialTitle,
    description: socialDescription,
    url: canonicalUrl,
    siteName: "TROOTHHURTZ",
    type: "website",
    images: [{ url: socialImage, alt: "TROOTHHURTZ Digital Sovereignty" }],
  },
  twitter: {
    card: "summary_large_image",
    title: socialTitle,
    description: socialDescription,
    images: [socialImage],
  },
};

const services = [
  { icon: Fingerprint, title: "Digital Identity", description: "Explore verifiable credentials and authorized identity relationships." },
  { icon: ShieldCheck, title: "Personal Data Rights", description: "Understand applicable privacy rights and organize requests to data processors." },
  { icon: Lock, title: "Digital Evidence", description: "Plan confidential record retention and cryptographic integrity verification." },
  { icon: FileCheck, title: "Intellectual Property", description: "Document creative assets, permissions and licensing arrangements." },
  { icon: Database, title: "Consent Management", description: "Organize consent records, retention policies and privacy requests." },
  { icon: Landmark, title: "Digital Legacy", description: "Explore digital asset administration, trust governance and succession planning." },
];

const cta = "inline-flex items-center justify-center rounded-full border border-cyan-400 bg-cyan-400 px-6 py-3 font-semibold text-slate-950 shadow-[0_0_24px_rgba(0,209,255,.35)] transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300";

export default function DigitalSovereigntyPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-6">
        <Link href="/" className="font-bold tracking-wider text-cyan-200">TROOTHHURTZ™</Link>
        <Link href="/consultations" className="rounded-full border border-cyan-400 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-950">Consultations</Link>
      </header>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 md:grid-cols-2 md:py-20">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-cyan-300">Digital Sovereignty</p>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">Your Identity. Your Data. Your Assets. <span className="text-cyan-300">Your Legacy.</span></h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-300">Take a proactive approach to your digital identity, personal information, intellectual property and digital legacy with the TROOTHHURTZ digital family office.</p>
          <Link href="/consultations" className={cta + " mt-8"}>Schedule a Consultation</Link>
          <p className="mt-3 text-sm text-slate-400">Sign in to schedule through our existing consultation service.</p>
        </div>
        <figure className={styles.stage}>
          <div className={styles.credential}>
            <p className={styles.brand}>TROOTHHURTZ™</p>
            <p className={styles.eyebrow}>DIGITAL SOVEREIGNTY</p>
            <div className={styles.emblem} aria-hidden="true"><Fingerprint size={92} strokeWidth={1.1}/></div>
            <p className="text-xl font-bold tracking-widest">SOVEREIGN ID</p>
            <p className="mt-2 text-sm tracking-widest text-cyan-300">SOULBOUND TOKEN</p>
            <div className={styles.rule}/>
            <p className="text-xs tracking-wider text-slate-300">NON-TRANSFERABLE CREDENTIAL</p>
            <p className="mt-3 text-xs text-amber-200">CONCEPT • NOT ISSUED</p>
          </div>
          <figcaption className="mt-8 text-center text-xs text-slate-400">Illustrative credential. No token has been issued.</figcaption>
        </figure>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-12" aria-labelledby="services">
        <h2 id="services" className="text-3xl font-bold">Protect. Verify. Administer. Build.</h2>
        <p className="mt-3 text-slate-300">Explore these proposed service areas with a specialist.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(({icon: Icon, title, description}) => (
            <article key={title} className="rounded-3xl border border-white/10 bg-slate-800/40 p-6 transition hover:ring-1 hover:ring-cyan-400/40 hover:shadow-[0_0_34px_rgba(0,209,255,.35)]">
              <Icon aria-hidden="true" className="mb-4 text-cyan-300" size={30}/>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 leading-relaxed text-slate-300">{description}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="smart-ip-rights" className="mx-auto max-w-6xl px-5 py-12" aria-labelledby="ip-rights-heading">
        <div className="rounded-3xl border border-cyan-400/30 bg-slate-950 p-6 md:p-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-cyan-300">TROOTHHURTZ™ · Digital Sovereignty</p>
          <h2 id="ip-rights-heading" className="mt-4 text-3xl font-bold text-cyan-200 sm:text-4xl">SMART IP RIGHTS OS™</h2>
          <p className="mt-3 text-xl font-semibold">Document. Protect. License. Commercialize.</p>
          <p className="mt-4 max-w-3xl leading-relaxed text-slate-300">Explore how to organize your intellectual property, document ownership and permissions, and develop a roadmap for responsible commercialization and digital legacy planning.</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Database, title: "IP Asset Registry", description: "Document creative works, software and digital assets." },
              { icon: FileCheck, title: "Chain of Title", description: "Organize ownership evidence, assignments and provenance." },
              { icon: ShieldCheck, title: "Rights & Licensing", description: "Define permissions, restrictions and commercial usage rights." },
              { icon: Landmark, title: "Collateral Readiness", description: "Prepare collateral and encumbrance documentation for professional review." },
              { icon: Lock, title: "Royalty Administration", description: "Plan tracking of licensing income and contractual allocations." },
              { icon: Fingerprint, title: "Digital Commercialization", description: "Explore marketplace and tokenization opportunities subject to legal and technical review." },
            ].map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-cyan-400/20 bg-slate-800/40 p-5 transition hover:ring-1 hover:ring-cyan-400/40">
                <Icon aria-hidden="true" className="mb-3 text-cyan-300" size={28}/>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 leading-relaxed text-slate-300">{description}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm leading-relaxed text-slate-400">Proposed capabilities intended to integrate with SMART TRUST OS™, SKIPPER and HERO Factory Marketplace. These tools are not yet offered as operational services. Documentation or tokenization alone does not establish ownership, valuation or perfection of a security interest.</p>
          <Link href="/consultations" className={cta + " mt-6"}>Schedule an Intellectual Property Consultation</Link>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="rounded-3xl border border-cyan-400/30 bg-slate-950 p-8 text-center md:p-12">
          <h2 className="text-3xl font-bold">Take Control of Your Digital Future.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">Discuss your goals, identify your priorities and explore a digital governance roadmap tailored to your needs.</p>
          <Link href="/consultations" className={cta + " mt-6"}>Schedule a Consultation</Link>
          <p className="mx-auto mt-6 max-w-2xl text-xs leading-relaxed text-slate-400">This page introduces proposed capabilities. A digital credential or blockchain record does not itself establish legal ownership, government identity or entitlement to compensation. No payment or token issuance is offered here.</p>
        </div>
      </section>
      <footer className="mx-auto max-w-6xl px-5 pb-8 text-sm text-slate-400"><Link href="/" className="hover:text-cyan-300">Return to HERO Market</Link></footer>
    </main>
  );
}
