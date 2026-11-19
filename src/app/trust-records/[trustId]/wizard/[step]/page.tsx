import Link from "next/link";
import { redirect } from "next/navigation";
import { isStepAllowed, getWizardSteps, type WizardStepId } from "@/lib/trust/wizardConfig";
import { getDb } from "@/lib/db";
import { trusts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** This route is always rendered at request time. */
export const dynamic = "force-dynamic";

const STEP_GUIDANCE: Record<WizardStepId, { title: string; purpose: string; questions: string[]; destination: string; action: string }> = {
  overview: {
    title: "Purpose and trust selection",
    purpose: "Clarify the intended trust structure, governing jurisdiction, and reasons for preparing the trust before drafting provisions.",
    questions: ["What type of trust is intended?", "Which jurisdiction's law is expected to govern?", "What are the settlor's objectives and intended trust property?"],
    destination: "/smart-trust", action: "Open trust preparation",
  },
  parties: {
    title: "Parties and fiduciaries",
    purpose: "Identify the settlor, initial and successor trustees, beneficiaries, and relevant appointment or succession questions.",
    questions: ["Who will establish the trust?", "Who will administer it, and who succeeds them?", "Who benefits, and under what circumstances?"],
    destination: "/smart-trust", action: "Review parties in Smart Trust",
  },
  assets: {
    title: "Trust property and funding",
    purpose: "Identify the property intended for the trust and distinguish a proposed asset schedule from a completed legal transfer.",
    questions: ["What property is proposed for the trust?", "Which assets require deeds, assignments, retitling, or consent?", "What evidence of transfer is still needed?"],
    destination: "/trust-records?tab=assets", action: "Open asset records",
  },
  state_helper: {
    title: "Governing law and execution",
    purpose: "Review jurisdiction-dependent questions, including formalities and any additional instruments needed.",
    questions: ["What law governs the trust?", "Are witnesses, acknowledgments, or special execution requirements applicable?", "What should a licensed attorney confirm?"],
    destination: "/smart-trust", action: "Review preparation details",
  },
  tax_ein: {
    title: "Tax identification assessment",
    purpose: "Determine whether professional tax review is needed. Not every trust requires a separate EIN.",
    questions: ["Is this treated as a grantor or non-grantor trust?", "Does the trust need an EIN for its circumstances?", "Who will handle tax reporting?"],
    destination: "/smart-trust", action: "Review tax-related intake",
  },
  filings: {
    title: "Filings and external requirements",
    purpose: "Identify potentially applicable tax, property, and jurisdiction-specific filings without assuming a trust is created by registration.",
    questions: ["Are any tax filings needed?", "Are property-transfer filings or notices needed?", "Which items require professional confirmation?"],
    destination: "/smart-trust", action: "Review filing requirements",
  },
  documents: {
    title: "Declaration and supporting documents",
    purpose: "Prepare for a full declaration containing operative trust terms, execution pages, schedules, and appropriate supporting records.",
    questions: ["Are all intended terms documented?", "Are trustee powers, distributions, succession, and termination addressed?", "Are schedules and execution pages ready for review?"],
    destination: "/trust-records?tab=instruments", action: "Open existing instruments",
  },
  review: {
    title: "Legal review and handoff",
    purpose: "Check completeness and route the proposed instrument for qualified legal review before execution or release.",
    questions: ["Are there missing or contradictory terms?", "Has jurisdiction-specific review been completed?", "What execution, funding, and recordkeeping tasks remain?"],
    destination: "/trust-records?tab=certificates", action: "Open certificate records",
  },
};

export default async function WizardStepPage({
  params,
}: {
  params: Promise<{ trustId: string; step: string }>;
}) {
  const { trustId, step: stepParam } = await params;
  const db = await getDb();
  const trustRows = await db.select({
    id: trusts.id,
    trustMode: trusts.trustMode,
  }).from(trusts).where(eq(trusts.id, trustId)).limit(1);
  const trust = trustRows[0];
  if (!trust) redirect("/trust-records");

  const mode = trust.trustMode === "private_safe" ? "private_safe" : "standard";
  const steps = getWizardSteps(mode);
  const step = stepParam as WizardStepId;
  if (!isStepAllowed(step, mode)) redirect(`/trust-records/${trust.id}/wizard/${steps[0]}`);

  const index = steps.indexOf(step);
  const guide = STEP_GUIDANCE[step];
  const url = (id: WizardStepId) => `/trust-records/${trust.id}/wizard/${id}`;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-cyan-400/30 bg-gradient-to-r from-slate-900 to-cyan-950/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">TROOTHHURTZ · Trust Records</p>
          <h1 className="mt-2 text-2xl font-bold">Digital Trust Creation</h1>
          <p className="mt-1 text-slate-300">Digital Trust Workspace · Guided preparation</p>
          <p className="mt-3 text-sm text-slate-300">Step {index + 1} of {steps.length} · This pathway organizes preparation and review; it does not certify legal completion.</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuenow={index + 1} aria-valuemin={0} aria-valuemax={steps.length} aria-label="Wizard navigation progress">
            <div className="h-full bg-cyan-400" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
          </div>
        </header>
        <nav aria-label="Trust preparation steps" className="flex flex-wrap gap-2">
          {steps.map((id, i) => (
            <Link key={id} href={url(id)} aria-current={id === step ? "step" : undefined}
              className={`rounded-lg border px-3 py-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${id === step ? "border-cyan-400 bg-cyan-950 text-cyan-100" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}>
              {i + 1}. {STEP_GUIDANCE[id].title}
            </Link>
          ))}
        </nav>
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-7" aria-labelledby="step-title">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Preparation stage {index + 1}</p>
          <h2 id="step-title" className="mt-2 text-xl font-semibold">{guide.title}</h2>
          <p className="mt-3 leading-relaxed text-slate-300">{guide.purpose}</p>
          <h3 className="mt-6 font-semibold">Questions to address</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
            {guide.questions.map((question) => <li key={question}>{question}</li>)}
          </ul>
          <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-100">
            Preparation guidance only. This step does not yet collect or validate responses in this wizard. Use the linked existing workspace to enter records; professional legal and tax review remains necessary where applicable.
          </div>
          <Link href={guide.destination} className="mt-5 inline-flex rounded-lg border border-cyan-500 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-950">
            {guide.action}
          </Link>
        </section>
        <footer className="flex items-center justify-between gap-3">
          {index > 0 ? <Link className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800" href={url(steps[index - 1])}>Previous step</Link> : <Link className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800" href="/trust-records">Back to Trust Records</Link>}
          {index < steps.length - 1 ? <Link className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500" href={url(steps[index + 1])}>Next step</Link> : <Link className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500" href="/trust-records">Return to workspace</Link>}
        </footer>
      </div>
    </main>
  );
}
