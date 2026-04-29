import Link from "next/link";

export default function RevenueOSLandingPage() {
  const features = [
    {
      title: "Approval Engine",
      items: [
        "Multi-step approval chains tied to roles",
        "Strict role-based enforcement",
        "No skipped steps or accidental publishes",
        "Bulk and resumable approvals for scale",
      ],
    },
    {
      title: "Accountability & Audit",
      items: [
        "Full audit trail of every decision",
        "Clear record of who approved what and when",
        "Reviewer assignment history over time",
        "Exportable proof for internal ops or compliance",
      ],
    },
    {
      title: "Bottleneck Detection & SLA",
      items: [
        "Overdue approvals surface automatically",
        "Smart reminders without extra noise",
        "See exactly where work is blocked",
        "Track stalled steps before deadlines slip",
      ],
    },
    {
      title: "Analytics & Visibility",
      items: [
        "Campaign-level pipeline health",
        "Reviewer workload insights",
        "Role-level bottleneck detection",
        "Actionable visibility instead of guesswork",
      ],
    },
    {
      title: "Reporting & Compliance",
      items: [
        "Exportable JSON and CSV reports",
        "Scheduled report delivery",
        "Compliance-ready logs",
        "Current state plus audit history in one view",
      ],
    },
    {
      title: "Notifications & Governance UX",
      items: [
        "Approvals, rejections, role changes, reminders",
        "Centralized governance configuration",
        "Warnings when setup is incomplete",
        "Operator help and debug visibility",
      ],
    },
  ];

  const steps = [
    {
      step: "01",
      title: "Assign reviewers and roles",
      body: "Map real people to owner, approver, editor, and reviewer responsibilities.",
    },
    {
      step: "02",
      title: "Define the approval flow",
      body: "Choose single-step or multi-step chains that match how your team actually ships work.",
    },
    {
      step: "03",
      title: "Enforce sequence automatically",
      body: "No skipped steps, no side-thread approvals, no accidental publishes.",
    },
    {
      step: "04",
      title: "Track, analyze, and export",
      body: "See bottlenecks, workload, SLA risk, and reports on demand or on a schedule.",
    },
  ];

  const pricing = [
    {
      name: "Starter",
      price: "$49–$99",
      cadence: "/mo",
      description: "For small teams that need structured approval basics.",
      items: ["Single-step approval", "Basic reviewer assignments", "Basic audit trail"],
      cta: "Get started",
      featured: false,
    },
    {
      name: "Growth",
      price: "$149–$299",
      cadence: "/mo",
      description: "For teams moving from ad hoc approvals to defined workflows.",
      items: ["Multi-step approvals", "Notifications", "Basic analytics"],
      cta: "Start growth plan",
      featured: false,
    },
    {
      name: "Pro",
      price: "$399–$699",
      cadence: "/mo",
      description: "For serious operations that need control, visibility, and reporting.",
      items: ["SLA tracking", "Reviewer workload analytics", "Full exports", "Complete audit trails"],
      cta: "Book a demo",
      featured: true,
      badge: "Most Popular",
    },
    {
      name: "Enterprise",
      price: "$999+",
      cadence: "/mo",
      description: "For high-scale teams with compliance and observability requirements.",
      items: ["Scheduled report delivery", "Advanced governance controls", "Internal observability", "Priority support"],
      cta: "Talk to sales",
      featured: false,
    },
  ];

  const audiences = [
    "Agencies managing multiple clients and high-volume campaigns",
    "Marketing teams balancing speed and quality",
    "Growth teams operating under pressure",
    "Founders and leads who need visibility without micromanaging",
  ];

  const appHref = "/ai-revenue-os";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-0 top-40 h-[420px] w-[420px] rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">Revenue OS</div>
            <div className="text-xs text-slate-400">Campaign Governance System</div>
          </div>
          <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#features" className="hover:text-white">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white">
              How it works
            </a>
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#pricing"
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30 hover:text-white"
            >
              Get started
            </a>
            <Link
              href={appHref}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Open Revenue OS
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 pt-20 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:pb-24 lg:pt-28">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1 text-xs font-medium text-cyan-200">
              Governance v1 for teams that ship under pressure
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Stop publishing mistakes. Run campaigns with real control.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Revenue OS Campaign Governance is an operational layer for your campaigns — structured approvals, enforced
              roles, full accountability, and reporting your stakeholders can trust.
            </p>
            <div className="mt-8 grid gap-4 text-sm text-slate-200 sm:grid-cols-3">
              {[
                "Approvals scattered in Slack and DMs become structured and enforced.",
                "Hidden blockers become visible, measurable, and actionable.",
                "Every decision is tracked and exportable when proof matters.",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 leading-6">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href={appHref}
                className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Open Revenue OS
              </Link>
              <a
                href="#pricing"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/5"
              >
                View pricing
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
            <div className="grid gap-4">
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-rose-200">The old way</div>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Slack approvals. DMs. Side conversations. No one knows who approved what, who was next, or why something
                  shipped.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-emerald-200">With Revenue OS</div>
                <p className="mt-2 text-sm leading-6 text-slate-100">
                  Defined roles. Enforced steps. Visible bottlenecks. Full audit trails. Exportable reporting. One operating
                  model for every campaign.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Built for</div>
                <ul className="mt-3 space-y-3 text-sm text-slate-200">
                  {audiences.map((audience) => (
                    <li key={audience} className="flex gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-cyan-300" />
                      <span>{audience}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-slate-900/60">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="max-w-3xl">
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">The problem</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                When “someone approved it in chat” isn’t good enough
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-300">
                Your team is moving fast. So are your mistakes. Approvals happen across Slack threads, email, and side
                conversations. There’s no single source of truth for who approved something, who was next, or why it went
                live.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                "No clear owner for each step",
                "No reliable audit trail",
                "Wrong or off-brand content goes live",
                "Delays nobody can see or measure",
                "Finger-pointing after something breaks",
              ].map((pain) => (
                <div key={pain} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-200">
                  {pain}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8" id="features">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">The solution</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              A governance layer for your campaigns — not another checkbox
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Revenue OS installs structure into how campaigns move. It enforces who must approve, in what order, and with
              what visibility before anything goes live.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-slate-950/20"
              >
                <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
                  {feature.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-white/10 bg-slate-900/60" id="how-it-works">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="max-w-3xl">
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">How it works</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                From chaos to a repeatable operating model
              </h2>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-4">
              {steps.map((step) => (
                <div key={step.step} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <div className="text-xs font-semibold tracking-[0.22em] text-cyan-300">{step.step}</div>
                  <h3 className="mt-3 text-xl font-semibold text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">Differentiation</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              This is not a feature. It’s control.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Revenue OS is not a simple approval toggle, a task board, or a notification tool. It is an operational control
              layer: roles, sequences, enforcement, audit, analytics, and reporting — wired together so your process becomes
              how the system behaves.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              "Not a simple approval on/off switch",
              "Not a generic task board repackaged for marketing",
              "Not a notification firehose with no enforcement behind it",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8" id="pricing">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">Pricing</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Plans based on how serious you are about control
            </h2>
          </div>
          <div className="mt-12 grid gap-6 xl:grid-cols-4">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-3xl border p-6 ${
                  plan.featured
                    ? "border-cyan-400/40 bg-cyan-400/10 shadow-xl shadow-cyan-950/30"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{plan.description}</p>
                  </div>
                  {plan.badge ? (
                    <span className="rounded-full bg-cyan-300 px-3 py-1 text-xs font-semibold text-slate-950">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
                <div className="mt-6 flex items-end gap-2">
                  <span className="text-4xl font-semibold text-white">{plan.price}</span>
                  <span className="pb-1 text-sm text-slate-400">{plan.cadence}</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-200">
                  {plan.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.featured ? appHref : "#final-cta"}
                  className={`mt-8 inline-flex rounded-full px-5 py-3 text-sm font-semibold transition ${
                    plan.featured
                      ? "bg-white text-slate-950 hover:bg-slate-200"
                      : "border border-white/15 text-white hover:border-white/30 hover:bg-white/5"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10" id="final-cta">
          <div className="mx-auto max-w-5xl px-6 py-20 text-center lg:px-8">
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.22em] text-slate-300">
              Final call to action
            </div>
            <h2 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Stop guessing who’s blocking your pipeline.
            </h2>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              You don’t need more chat threads. You need clear rules, visible bottlenecks, and proof when it matters.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                href={appHref}
                className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Open Revenue OS
              </Link>
              <a
                href="#pricing"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/5"
              >
                View pricing
              </a>
            </div>
            <p className="mt-10 text-sm text-slate-500">
              Revenue OS — Campaign Governance System. Operational control for teams that ship campaigns under pressure.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
