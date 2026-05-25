import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ArrowRight,
  BookMarked,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileStack,
  Fingerprint,
  Globe2,
  Landmark,
  Layers3,
  Link2,
  Lock,
  Scale,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
  Vault,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Smart Trust™ — Digital Trust Administration, Governance & Legacy Infrastructure",
  description:
    "Organize trust certificates, minutes, resolutions, amendments, governance packets, and review-ready folders from one secure dashboard. Tools for trustees, planners, and family offices — not legal advice.",
};

const GET_STARTED_HREF = "/consultations";
const WORKSPACE_HREF = "/smart-trust/dashboard";

/** Query keys that indicate the user intended the Smart Trust workspace, not the marketing page. */
const WORKSPACE_QUERY_KEYS = [
  "trustId",
  "clientId",
  "createdClient",
  "type",
  "affiliation",
  "playbookId",
  "docs",
  "constitutionSubtype",
] as const;

function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function SmartTrustLandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const key of WORKSPACE_QUERY_KEYS) {
    const raw = firstString(sp[key]);
    if (raw && raw.trim()) qs.set(key, raw.trim());
  }
  if (qs.toString()) {
    redirect(`${WORKSPACE_HREF}?${qs.toString()}`);
  }

  return <SmartTrustMarketingBody />;
}

const TRUST_TYPES: {
  title: string;
  summary: string;
  uses: string[];
}[] = [
  {
    title: "Revocable Trusts",
    summary: "Flexible structures often used while the grantor is living and capacity is clear.",
    uses: ["Estate flow planning", "Privacy around transfers", "Iterative updates as life changes"],
  },
  {
    title: "Irrevocable Trusts",
    summary: "Structures intended to be durable with defined amendment paths and documented authority.",
    uses: ["Clear grant of powers in writing", "Recorded decisions and notices", "Long-horizon administration"],
  },
  {
    title: "Family Trusts",
    summary: "Household and lineage-focused vehicles for stewardship, education, and continuity.",
    uses: ["Successor trustee clarity", "Family governance records", "Intergenerational minutes"],
  },
  {
    title: "Land Trusts",
    summary: "Title-holding and privacy-oriented arrangements for real property administration.",
    uses: ["Deed-adjacent schedules", "Beneficiary communications", "Recorded resolutions on property actions"],
  },
  {
    title: "Charitable Trusts",
    summary: "Mission-aligned vehicles supporting philanthropic intent and disbursement discipline.",
    uses: ["Grant ledgers", "Disbursement approvals", "Public / private reporting packets as applicable"],
  },
  {
    title: "Business Trusts",
    summary: "Operating and holding structures for enterprises, joint ventures, and structured finance prep.",
    uses: ["Board-style minutes", "Capital actions", "Instrument and schedule alignment"],
  },
  {
    title: "Ecclesiastical Trusts",
    summary: "Faith-aligned stewardship vehicles historically tied to ministry continuity and charitable works.",
    uses: ["Mission continuity records", "Stewardship ledgers", "Governance across leadership transitions"],
  },
  {
    title: "Asset Protection / Private Governance",
    summary: "Organizational frameworks where documentation, authority, and chronology must stay exceptionally clear.",
    uses: ["Structured resolutions", "Protector / committee records", "Review-ready disclosure folders"],
  },
];

const DASHBOARD_FEATURES: { title: string; description: string; icon: typeof ShieldCheck }[] = [
  {
    title: "Trustee Management",
    description: "Role-aware views for assignments, notices, and documented decision trails.",
    icon: Users,
  },
  {
    title: "Trust Protector Controls",
    description: "Capture protector actions, scope, and approvals inside a structured record.",
    icon: ShieldCheck,
  },
  {
    title: "Minutes & Meeting Records",
    description: "Agenda-linked minutes with immutable-friendly exports for your archive.",
    icon: ScrollText,
  },
  {
    title: "Resolutions Builder",
    description: "Template-aware flows to draft resolutions aligned to your governance model.",
    icon: FileStack,
  },
  {
    title: "Amendment Tracking",
    description: "Version lineage, attachments, and chronology for each change packet.",
    icon: Layers3,
  },
  {
    title: "Digital Certificates",
    description: "Issue, seal, and organize certificates with consistent metadata.",
    icon: Landmark,
  },
  {
    title: "Signature Workflows",
    description: "Packet assembly and follow-up tracking for signers and countersigners.",
    icon: Fingerprint,
  },
  {
    title: "Private Virtual Meetings",
    description: "Close-session tooling with attendee logs and encrypted archive hooks.",
    icon: CalendarClock,
  },
  {
    title: "Secure Document Vault",
    description: "Centralized storage for trust instruments, schedules, and supporting evidence.",
    icon: Vault,
  },
  {
    title: "Blockchain Audit Trail",
    description: "Timestamping and integrity checks that strengthen administrative confidence.",
    icon: Link2,
  },
  {
    title: "Asset Schedules",
    description: "Schedules that stay aligned to instruments and meeting decisions.",
    icon: Building2,
  },
  {
    title: "Legal Review Packets",
    description: "One-click bundles for counsel: checklist, certificates, minutes, and logs.",
    icon: Scale,
  },
  {
    title: "Governance Timeline",
    description: "Chronological map of meetings, resolutions, amendments, and seals.",
    icon: Sparkles,
  },
  {
    title: "Family Office Records",
    description: "Multi-entity views for offices coordinating trusts and operating companies.",
    icon: Globe2,
  },
  {
    title: "PPM / Bond / Securities Packet Organization",
    description: "Folder discipline for offering materials without claiming securities law advice.",
    icon: BookMarked,
  },
];

const WHY_POINTS: string[] = [
  "Reduces disorganization across scattered drives and inboxes",
  "Centralizes governance records in one secure workspace",
  "Prepares review-ready packets for counsel when you choose",
  "Improves trustee accountability with clearer chronology",
  "Strengthens administrative confidence through structured capture",
  "Modernizes private recordkeeping with premium UX",
  "Supports family office planning across entities",
  "Helps preserve continuity across generations",
];

const MEETING_FEATURES: string[] = [
  "Meeting agenda templates",
  "Attendee log",
  "Digital minutes",
  "Resolution capture",
  "Signature follow-up tasks",
  "Encrypted archive hooks",
];

const LEGAL_REVIEW_ITEMS: string[] = [
  "Document checklist",
  "Trust certificate",
  "Minutes",
  "Resolutions",
  "Amendments",
  "Asset schedule",
  "Signatures",
  "Blockchain timestamp log",
  "Governance timeline",
  "Supporting notes",
];

function SmartTrustMarketingBody() {
  return (
    <div className="min-h-screen bg-[#030712] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-[480px] w-[480px] rounded-full bg-amber-400/10 blur-[100px]" />
        <div className="absolute bottom-0 left-0 h-[420px] w-[420px] rounded-full bg-violet-600/10 blur-[110px]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `linear-gradient(rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.2) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#030712]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="group flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-300/90">Smart Trust™</span>
            <span className="text-xs text-slate-500 transition group-hover:text-slate-300">Hero Market</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex" aria-label="Section navigation">
            <a href="#what-is" className="transition hover:text-white">
              Overview
            </a>
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#trust-types" className="transition hover:text-white">
              Trust types
            </a>
            <a href="#blockchain" className="transition hover:text-white">
              Blockchain
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="#features"
              className="hidden rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/40 hover:text-white sm:inline-block sm:px-4 sm:text-sm"
            >
              Explore Features
            </a>
            <Link
              href={GET_STARTED_HREF}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 shadow-[0_0_24px_rgba(251,191,36,0.35)] transition hover:brightness-110 sm:gap-2 sm:px-5 sm:text-sm"
            >
              Book a consultation
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      {/* Legal disclaimer banner */}
      <aside
        className="border-b border-amber-500/20 bg-amber-500/[0.06]"
        role="note"
        aria-label="Important notice about legal advice"
      >
        <div className="mx-auto max-w-7xl px-4 py-4 text-sm leading-relaxed text-amber-50/90 sm:px-6 lg:px-8">
          <p>
            <span className="font-semibold text-amber-200">Notice:</span> We are not attorneys, a law firm, or legal
            advisors. Smart Trust™ does not provide legal, tax, securities, or fiduciary advice. The platform provides
            organizational, document-preparation, recordkeeping, and governance tools. We recommend review by qualified
            legal, tax, and securities professionals before executing or relying on any trust, certificate, PPM, bond,
            security, or fiduciary structure. Confident individuals retain the lawful right to determine whether
            professional review is necessary for their own private affairs.
          </p>
        </div>
      </aside>

      <main>
        {/* Hero */}
        <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-cyan-200">
                <Lock className="h-3.5 w-3.5" aria-hidden />
                Secure · Structured · Review-ready
              </div>
              <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Smart Trust™: Digital Trust Administration, Governance &amp; Legacy Infrastructure
              </h1>
              <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-300">
                Create, organize, manage, and present trust-related records, certificates, resolutions, minutes,
                amendments, and governance packets from one secure dashboard.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href={GET_STARTED_HREF}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-cyan-300 px-8 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:brightness-110"
                >
                  Book a consultation
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:border-cyan-400/40 hover:bg-white/10"
                >
                  Explore Features
                </a>
              </div>
              <ul className="mt-10 flex flex-wrap gap-3 text-xs text-slate-400">
                {["Vault-grade organization", "Ledger & seal motifs", "Trustee & protector views", "Premium dark UI"].map(
                  (t) => (
                    <li
                      key={t}
                      className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1.5 text-slate-300"
                    >
                      {t}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-cyan-500/20 via-transparent to-amber-400/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/95 p-6 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl sm:p-8">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10">
                      <Vault className="h-6 w-6 text-amber-200" aria-hidden />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Governance desk</p>
                      <p className="text-sm font-medium text-white">Trust operations snapshot</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                    Encrypted
                  </span>
                </div>
                <div className="mt-6 grid gap-3 font-mono text-[11px] text-slate-400">
                  <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-3 py-2">
                    <span>Certificate lineage</span>
                    <span className="text-cyan-300">VERIFIED</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-3 py-2">
                    <span>Blockchain timestamp</span>
                    <span className="text-amber-200">ANCHORED</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-3 py-2">
                    <span>Resolution packet</span>
                    <span className="text-violet-300">READY</span>
                  </div>
                </div>
                <p className="mt-6 text-xs leading-relaxed text-slate-500">
                  Illustrative UI motifs. Your workspace connects to the tools behind this experience — not a substitute
                  for independent legal judgment.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What is Smart Trust */}
        <section id="what-is" className="border-y border-white/10 bg-slate-900/40">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">What is Smart Trust™?</h2>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300">
              Smart Trust™ is a digital trust operations platform for trust planners, trustees, trust protectors, family
              offices, estate organizers, private associations, ministries, ecclesiastical organizations, and business
              trust operators who need disciplined documentation and chronology.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
                <h3 className="text-lg font-semibold text-white">Who it serves</h3>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-300">
                  {[
                    "Trust planners coordinating complex instructions",
                    "Trustees documenting authority and diligence",
                    "Trust protectors monitoring scope and intent",
                    "Family offices harmonizing entities",
                    "Ministries and ecclesiastical stewards preserving records",
                    "Business trust operators preparing instrument packages",
                  ].map((line) => (
                    <li key={line} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
                <h3 className="text-lg font-semibold text-white">What you can organize</h3>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-300">
                  {[
                    "Trust certificates & private memorandums",
                    "Trustee minutes & resolutions",
                    "Amendments & asset schedules",
                    "PPM-style packets & bond presentation files",
                    "Governance records & signature packets",
                    "Legal-review-ready document folders",
                  ].map((line) => (
                    <li key={line} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Trust types */}
        <section id="trust-types" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Trust types we help you structure</h2>
            <p className="mt-4 text-lg text-slate-400">
              Plain-English overviews for orientation only. Classification and validity depend on facts, jurisdiction,
              and professional review.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {TRUST_TYPES.map((card) => (
              <article
                key={card.title}
                className="group flex flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-6 shadow-lg transition hover:border-cyan-400/30 hover:shadow-cyan-500/10"
              >
                <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{card.summary}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Commonly used for</p>
                <ul className="mt-2 flex-1 space-y-2 text-sm text-slate-300">
                  {card.uses.map((u) => (
                    <li key={u} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/80" />
                      {u}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* Ecclesiastical history */}
        <section id="ecclesiastical" className="border-y border-white/10 bg-slate-900/35">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Ecclesiastical trust history</h2>
            <div className="mt-8 max-w-4xl space-y-6 text-base leading-relaxed text-slate-300">
              <p>
                Ecclesiastical trusts have historically been associated with churches, ministries, religious societies,
                charitable missions, and faith-based stewardship. These structures were often used to hold property,
                preserve mission continuity, administer charitable works, maintain records, support education, and protect
                governance across generations.
              </p>
              <p>
                Historic ecclesiastical administration often relied on trustees, minutes, resolutions, seals,
                certificates, ledgers, private archives, and fiduciary stewardship — patterns that still inform modern
                governance thinking.
              </p>
              <p>
                <span className="font-semibold text-white">Smart Trust™</span> modernizes these governance concepts with
                encrypted records, digital certificates, private meeting tools, blockchain timestamping, and
                dashboard-based administration. The platform does{" "}
                <span className="font-semibold text-amber-200">not</span> create legally valid ecclesiastical trusts
                automatically, and it does not replace counsel where your facts or jurisdiction require it.
              </p>
            </div>
          </div>
        </section>

        {/* Blockchain */}
        <section id="blockchain" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Blockchain-backed confidence</h2>
              <p className="mt-6 text-lg leading-relaxed text-slate-300">
                Where enabled, blockchain technology supports timestamping, document integrity verification, audit trails,
                amendment history, governance chronology, certificate verification references, and tamper-resistant record
                lineage.
              </p>
              <p className="mt-6 text-base leading-relaxed text-slate-400">
                Blockchain strengthens recordkeeping, proof of sequence, and administrative confidence. It does{" "}
                <span className="text-white">not</span> replace legal review, does not by itself create legal validity,
                and does not guarantee outcomes in any jurisdiction.
              </p>
            </div>
            <ul className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-8 text-sm leading-relaxed text-slate-200">
              {[
                "Immutable-leaning timestamps for critical filings",
                "Integrity fingerprints for uploaded instruments",
                "Chronological anchors for amendments and packets",
                "Verification helpers for counterparties (process-dependent)",
              ].map((item) => (
                <li key={item} className="flex gap-3 border-b border-white/5 py-3 first:pt-0 last:border-0 last:pb-0">
                  <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Dashboard features */}
        <section id="features" className="border-y border-white/10 bg-slate-900/40">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Dashboard capabilities</h2>
            <p className="mt-4 max-w-3xl text-lg text-slate-400">
              A single operations layer for the artifacts trustees and planners touch every quarter.
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {DASHBOARD_FEATURES.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition hover:border-amber-400/25"
                >
                  <Icon className="h-8 w-8 text-amber-300" aria-hidden />
                  <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trustee power - careful copy */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950 p-8 sm:p-10 lg:p-12">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">Structure, recordkeeping, and fiduciary authority</h2>
            <p className="mt-6 max-w-4xl text-base leading-relaxed text-slate-300">
              With the right lawful structure, trustees and trust protectors may operate through defined fiduciary roles,
              documented authority, resolutions, minutes, and administrative powers. Smart Trust™ helps organize those
              actions so the record is clear, structured, and easier to present for review. Nothing here authorizes
              unlawful conduct, shortcuts around governing law, or bypassing required filings or disclosures.
            </p>
          </div>
        </section>

        {/* Legal review ready */}
        <section id="legal-review" className="border-y border-white/10 bg-slate-900/35">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Legal review-ready packets</h2>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300">
              The platform is designed so users can prepare organized packets for a legal professional to review. Typical
              bundle components include:
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {LEGAL_REVIEW_ITEMS.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-200"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-10 text-base font-medium text-slate-200">
              Prepare your trust records with confidence, then present them for professional review when desired.
            </p>
          </div>
        </section>

        {/* Private meetings */}
        <section id="meetings" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Private virtual meetings</h2>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300">
            Trustees and trust protectors can hold private virtual meetings, record minutes, capture decisions, document
            resolutions, and preserve governance history inside the same workspace discipline as your vault.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MEETING_FEATURES.map((f) => (
              <li
                key={f}
                className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-sm text-slate-200"
              >
                {f}
              </li>
            ))}
          </ul>
        </section>

        {/* Why must-have */}
        <section className="border-y border-white/10 bg-gradient-to-b from-slate-900/50 to-transparent">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Why Smart Trust™ is a must-have</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {WHY_POINTS.map((point) => (
                <div key={point} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-relaxed text-slate-200">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
                  {point}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-10 text-center shadow-2xl sm:p-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.12),_transparent_55%)]" />
            <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Build Your Trust Operations System Today
            </h2>
            <p className="relative mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-300">
              Smart Trust™ gives trustees, planners, families, ministries, and private organizations the digital
              infrastructure to organize trust records, manage governance activity, and prepare professional-grade review
              packets.
            </p>
            <div className="relative mt-10">
              <Link
                href={GET_STARTED_HREF}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-cyan-300 px-10 py-4 text-sm font-bold text-slate-950 shadow-lg transition hover:brightness-110"
              >
                Book a consultation
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-10 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Smart Trust™ · Hero Market · Administrative software only.</p>
        <p className="mt-4">
          <Link
            href={GET_STARTED_HREF}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-200 underline-offset-4 hover:text-white hover:underline"
          >
            Book a consultation
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </p>
      </footer>
    </div>
  );
}
