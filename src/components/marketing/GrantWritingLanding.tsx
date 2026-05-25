"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FileCheck,
  FileText,
  HeartHandshake,
  Landmark,
  Lightbulb,
  PenLine,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

const glass =
  "rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-xl backdrop-blur-md";

const LEAD_PATH = "/consultations";

export function GrantWritingLanding() {
  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#04110f] text-slate-100">
      {/* Warm emerald + gold accents */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.14]"
        style={{
          backgroundImage: `linear-gradient(rgba(16,185,129,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.05) 1px, transparent 1px)`,
          backgroundSize: "52px 52px",
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-emerald-500/15">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.95]"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% -30%, rgba(16,185,129,0.45), transparent 55%), radial-gradient(ellipse 50% 45% at 100% 40%, rgba(245,158,11,0.18), transparent 50%), radial-gradient(ellipse 45% 40% at 0% 70%, rgba(52,211,153,0.12), transparent 45%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pb-28 sm:pt-16 lg:px-8">
          <Link href="/" className="inline-flex text-sm font-medium text-emerald-200/70 transition hover:text-amber-200">
            ← Back to Hero Market
          </Link>
          <div className="mx-auto mt-10 max-w-4xl text-center">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-950/40 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-100">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              Grant Writing &amp; Proposal Strategy
            </p>
            <h1 className="text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.15rem] lg:leading-[1.1]">
              Funding Doesn&apos;t Find You —{" "}
              <span className="bg-gradient-to-r from-amber-200 via-emerald-200 to-teal-300 bg-clip-text text-transparent">
                It&apos;s Won With a Winning Proposal.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-emerald-100/75 sm:text-xl">
              We help foundations, charities, nonprofits, and mission-driven businesses organize, sharpen, and submit
              grant proposals that funders actually read — so your representatives can focus on impact, not paperwork
              chaos.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={LEAD_PATH}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-300 to-amber-600 px-8 py-4 text-base font-bold text-emerald-950 shadow-[0_4px_0_#92400e] transition hover:brightness-110 sm:w-auto"
              >
                Start My Grant Strategy
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <button
                type="button"
                onClick={() => scrollToId("what-are-grants")}
                className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-950/40 px-8 py-4 text-base font-semibold text-emerald-50 transition hover:border-amber-400/40 hover:bg-emerald-900/50 sm:w-auto"
              >
                What Are Grants?
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* What are grants */}
      <section id="what-are-grants" className="relative scroll-mt-24 mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className={`${glass} border-emerald-500/20 bg-emerald-950/20`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/15">
              <Lightbulb className="h-7 w-7 text-emerald-300" aria-hidden />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">What Are Grants?</h2>
              <p className="mt-4 text-base leading-relaxed text-emerald-100/80 sm:text-lg">
                Grants are <strong className="text-white">non-repayable awards</strong> — funding governments,
                foundations, corporations, and trusts give to organizations that align with their mission. Unlike loans,
                you don&apos;t pay them back — but you <em className="text-amber-100/95">do</em> have to prove you&apos;re
                the right steward of those dollars through a clear, compliant, compelling proposal.
              </p>
              <p className="mt-4 text-base leading-relaxed text-emerald-100/75">
                The competition is fierce: dozens or hundreds of applicants may chase the same pool. Funders skim for
                clarity, measurable outcomes, and credibility. A scattered narrative or missing attachment can quietly
                disqualify you — before anyone sees your vision.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who can get them */}
      <section className="relative border-t border-emerald-500/10 bg-black/25 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl md:text-4xl">
            Who Can Qualify For Grants?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-emerald-100/70">
            If you&apos;re building something that serves the public good — or meets a funder&apos;s strategic goals —
            there&apos;s often a pathway. Here&apos;s who we support most often.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Foundations",
                body: "Family and private foundations seeking program dollars or capacity-building awards.",
                icon: Landmark,
              },
              {
                title: "Charities",
                body: "501(c)(3) and charitable arms delivering direct community impact.",
                icon: HeartHandshake,
              },
              {
                title: "Nonprofits",
                body: "Mission-driven orgs scaling programs, capital projects, or operating support.",
                icon: Users,
              },
              {
                title: "Businesses",
                body: "Innovation, workforce, regional development, and industry-specific funding — where eligible.",
                icon: Building2,
              },
            ].map(({ title, body, icon: Icon }) => (
              <div key={title} className={`${glass} border-amber-500/10 hover:border-emerald-400/25 transition-colors`}>
                <Icon className="h-9 w-9 text-amber-300" aria-hidden />
                <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-emerald-100/70">{body}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-3xl text-center text-sm text-emerald-200/65">
            <strong className="text-amber-100">Representatives &amp; leadership teams:</strong> whether you&apos;re a
            board member, ED, or development lead — if your organization needs funding and your proposal isn&apos;t
            airtight, you&apos;re leaving money on the table.
          </p>
        </div>
      </section>

      {/* Why our service */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Why Organized Proposal Support Isn&apos;t Optional — It&apos;s a Must-Have.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-emerald-100/75">
              Grant writing isn&apos;t just “writing.” It&apos;s strategy: aligning your story with funder priorities,
              locking deadlines, budgets, logic models, attachments, and compliance — then packaging it so reviewers say{" "}
              <span className="text-amber-200">&quot;fund this.&quot;</span>
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "Stop drowning board members and staff in version chaos and last-minute scrambles.",
                "Turn scattered notes into a coherent narrative funders can score in minutes.",
                "Catch eligibility gaps before you invest weeks in the wrong opportunity.",
                "Present budgets and outcomes with the clarity auditors and reviewers expect.",
              ].map((line) => (
                <li key={line} className="flex gap-3 text-sm text-emerald-50/90 sm:text-base">
                  <FileCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className={`${glass} relative overflow-hidden border-amber-400/20 bg-gradient-to-br from-amber-950/30 to-emerald-950/40`}>
            <PenLine className="absolute right-4 top-4 h-24 w-24 text-amber-400/10" aria-hidden />
            <h3 className="relative text-xl font-bold text-white">How we help</h3>
            <p className="relative mt-3 text-sm leading-relaxed text-emerald-100/80">
              We partner with your team to <strong className="text-white">organize the proposal end-to-end</strong> —
              from opportunity fit and storyline to supporting documents — so your foundation, charity, nonprofit, or
              business puts its best foot forward when funding is on the line.
            </p>
            <div className="relative mt-6 flex flex-wrap gap-2">
              {["Narrative alignment", "Compliance checklist", "Budget framing", "Deadline discipline", "Reviewer-ready polish"].map(
                (tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-emerald-500/30 bg-emerald-950/50 px-3 py-1 text-xs font-semibold text-emerald-100"
                  >
                    {tag}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Outcomes strip */}
      <section className="relative border-y border-emerald-500/15 bg-gradient-to-r from-emerald-950/50 via-black/40 to-amber-950/30 py-14">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Built For Leaders Who Need Funding — Not Friction.</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              { icon: Target, label: "Sharper positioning", sub: "Match programs to funder language." },
              { icon: ShieldCheck, label: "Reduced risk", sub: "Fewer omissions that sink submissions." },
              { icon: FileText, label: "Submission-ready kit", sub: "Organized files & narrative flow." },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/25 bg-black/30">
                  <Icon className="h-6 w-6 text-amber-300" aria-hidden />
                </div>
                <p className="mt-3 font-semibold text-white">{label}</p>
                <p className="mt-1 text-sm text-emerald-100/65">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative px-4 pb-24 pt-12 sm:px-6 lg:px-8">
        <div
          className="mx-auto max-w-3xl rounded-3xl border border-amber-400/25 bg-gradient-to-b from-emerald-950/80 to-black/80 p-10 text-center backdrop-blur-md"
          style={{ boxShadow: "0 0 80px -20px rgba(245,158,11,0.25)" }}
        >
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready To Fund What Matters?</h2>
          <p className="mx-auto mt-4 max-w-xl text-emerald-100/75">
            Share your mission and funding goals — we&apos;ll help you organize a proposal strategy that speaks funder
            language and protects your team&apos;s time.
          </p>
          <Link
            href={LEAD_PATH}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-700 px-8 py-4 text-lg font-bold text-emerald-950 shadow-lg transition hover:brightness-110 sm:w-auto"
          >
            Book A Grant Writing Consultation
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
          <p className="mt-4 text-xs text-emerald-200/50">Serving foundations, charities, nonprofits &amp; eligible businesses.</p>
        </div>
      </section>

      <footer className="border-t border-emerald-500/10 py-8 text-center text-xs text-emerald-800/80">
        © {new Date().getFullYear()} Hero Market · Grant Writing Services
      </footer>
    </div>
  );
}
