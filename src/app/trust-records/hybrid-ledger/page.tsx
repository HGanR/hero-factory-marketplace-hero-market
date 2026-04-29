// app/trust-records/hybrid-ledger/page.tsx
import React from "react";

export const metadata = {
  title: "Hybrid Ledger (RFC) | Trust Records",
  description:
    "Hybrid Ledger & Instrument Framework: private authoritative records, public witness notarization, and executable instruments.",
};

type Pillar = {
  title: string;
  purpose: string[];
  whatGoesIn: string[];
  whatDoesNotGoIn: string[];
};

const pillars: Pillar[] = [
  {
    title: "Authoritative Private Ledger (APL)",
    purpose: [
      "Source of legal truth for the trust/entity context",
      "Governance enforcement (authority-before-execution)",
      "Accrual / equity accounting basis and audit trail",
    ],
    whatGoesIn: [
      "Trust Records (instruments, deeds, resolutions, approvals)",
      "GovernanceChain (authority + dependencies)",
      "Accounting events tied to instrument lifecycle",
    ],
    whatDoesNotGoIn: [
      "Public chain transaction data beyond witness references",
      "Any assumption that publicity is required for validity",
    ],
  },
  {
    title: "Public Witness Ledger (PWL)",
    purpose: [
      "Non-repudiation / proof-of-existence (not proof-of-contents)",
      "Timestamped witness for executed instruments",
      "Optional external verifiability without disclosure",
    ],
    whatGoesIn: [
      "Hashes (commitments) derived from instrument execution state",
      "Network + txHash metadata (optional)",
    ],
    whatDoesNotGoIn: [
      "Trust details, PII, asset schedules, or private terms",
      "Full documents or instrument contents",
    ],
  },
  {
    title: "Executable Instrument Layer (EIL)",
    purpose: [
      "Standard representation of legally operative instruments",
      "Lifecycle management: draft → authorized → executed → recorded → witnessed → settled",
      "Bridge between governance, accounting, and (optional) witness",
    ],
    whatGoesIn: [
      "Instrument records (type, status, hashes, authority link)",
      "Settlement hooks (accounting entries, arbitration awards, fee schedules)",
    ],
    whatDoesNotGoIn: [
      "Speculative asset tokenization as a default pattern",
      "Anything that bypasses authority validation",
    ],
  },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6">
      <code>{children}</code>
    </pre>
  );
}

function PillarCard({ pillar }: { pillar: Pillar }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold">{pillar.title}</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <div className="text-sm font-semibold text-neutral-800">Purpose</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {pillar.purpose.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-neutral-800">What goes in</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {pillar.whatGoesIn.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-neutral-800">What does not go in</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {pillar.whatDoesNotGoIn.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function HybridLedgerRfcPage() {
  const witnessFormula = `witnessHash = hash(trustId + instrumentId + executedAt)\n// store witnessHash + (optional) network + txHash back into Trust Records`;

  const schemaSnippet = `Instrument {
  id: UUID
  trustId: UUID
  entityId?: UUID
  type: 'DEED' | 'LIEN' | 'ASSIGNMENT' | 'AWARD' | 'FEE_SCHEDULE'
  resolutionId: UUID
  status: 'DRAFT' | 'AUTHORIZED' | 'EXECUTED' | 'RECORDED' | 'WITNESSED' | 'SETTLED'
  instrumentHash: string
  executedAt?: Date
  recordedAt?: Date
  createdAt: Date
}

PublicWitness {
  instrumentId: UUID
  network: 'ethereum' | 'polygon' | 'other'
  txHash: string
  notarizedAt: Date
}`;

  const apiSnippet = `POST /api/instruments
POST /api/instruments/:id/authorize   // requires valid Resolution & context match
POST /api/instruments/:id/execute     // authority-before-execution
POST /api/instruments/:id/record      // private recording lifecycle
POST /api/instruments/:id/witness     // optional public notarization (hash only)
POST /api/instruments/:id/settle      // accounting + settlement rails`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="space-y-3">
        <div className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-700">
          Trust Records • Governance Standard • RFC
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Hybrid Ledger & Instrument Framework</h1>
        <p className="text-base text-neutral-700">
          This page documents the platform's Hybrid Ledger model: <strong>private authoritative truth</strong>,{" "}
          <strong>public witness notarization</strong>, and an <strong>executable instrument layer</strong> that binds
          governance, accounting, and settlement without public disclosure.
        </p>
      </header>

      <section className="mt-8 grid gap-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Operational intent</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-700">
          <li>
            Keep legal truth and accounting inside the trust jurisdiction (private), while enabling external proof by
            publishing <em>hash commitments</em> only (public).
          </li>
          <li>
            Represent <strong>legal instruments</strong> (not assets) as first-class objects with lifecycle enforcement.
          </li>
          <li>
            Enforce <strong>authority-before-execution</strong> using resolutions and governance chains.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">The three ledger roles</h2>
        <div className="space-y-4">
          {pillars.map((p) => (
            <PillarCard key={p.title} pillar={p} />
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Public witness (hash-only) pattern</h2>
          <p className="mt-2 text-sm text-neutral-700">
            The witness ledger is optional and contains <strong>no trust data</strong>. It stores only a cryptographic
            commitment to the executed instrument state.
          </p>
          <div className="mt-4">
            <CodeBlock>{witnessFormula}</CodeBlock>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Instrument lifecycle</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-700">
            <li>Draft</li>
            <li>Authorized (via Resolution)</li>
            <li>Executed</li>
            <li>Recorded (private)</li>
            <li>Witnessed (public, optional)</li>
            <li>Settled / Enforced (accounting + arbitration outcomes)</li>
          </ol>
          <p className="mt-3 text-sm text-neutral-700">
            Each transition is governed by your existing enforcement matrix and context integrity rules (trustId/entityId
            scoping).
          </p>
        </div>
      </section>

      <section className="mt-10 space-y-6">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Schema extensions (conceptual)</h2>
          <p className="mt-2 text-sm text-neutral-700">
            These additions are intentionally additive and do not require replacing your current Deeds / Resolutions
            tables immediately. You can introduce <code>Instrument</code> as a unifying abstraction and backfill.
          </p>
          <div className="mt-4">
            <CodeBlock>{schemaSnippet}</CodeBlock>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">API surface (conceptual)</h2>
          <p className="mt-2 text-sm text-neutral-700">
            Aligns to your existing action-flow enforcement style: authority checks first, then execution, then optional
            witness, then settlement.
          </p>
          <div className="mt-4">
            <CodeBlock>{apiSnippet}</CodeBlock>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Non-goals</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-700">
            <li>Replacing courts or claiming institutional authority</li>
            <li>Circumventing law or regulatory requirements</li>
            <li>Publishing private trust affairs on-chain</li>
          </ul>
        </div>
      </section>

      <footer className="mt-12 border-t border-neutral-200 pt-6 text-sm text-neutral-600">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>Location: Trust Records → Hybrid Ledger (RFC)</div>
          <div className="text-neutral-500">
            Version: Draft (internal standard). Adopt when your instrument table + witness adapter land.
          </div>
        </div>
      </footer>
    </main>
  );
}
