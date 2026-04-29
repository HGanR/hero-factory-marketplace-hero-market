"use client";

import React, { useState } from "react";
import type { SpringAnswers, OwnershipSplit } from "@/lib/challenge/spring2026/zod";

const PHASES = [
  { key: "phase1" as const, label: "Phase 1: Entity & Purpose" },
  { key: "phase2" as const, label: "Phase 2: Ownership" },
  { key: "phase3" as const, label: "Phase 3: Documents & Readiness" },
  { key: "phase4" as const, label: "Phase 4: Compliance" },
  { key: "phase5" as const, label: "Phase 5: Governance" },
];

type Props = {
  submissionId: string;
  initialAnswers: Record<string, unknown>;
  status: string;
};

export function ChallengeRunnerClient({ submissionId, initialAnswers, status }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => initialAnswers || {});
  const [saving, setSaving] = useState(false);

  const active = PHASES[activeIdx];

  async function saveDraft() {
    setSaving(true);
    try {
      const res = await fetch("/api/challenge/spring-2026/answers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ submissionId, answers }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  function setPhase<K extends string>(k: K, patch: Record<string, unknown>) {
    setAnswers((prev) => ({
      ...prev,
      [k]: { ...(prev[k] as Record<string, unknown> ?? {}), ...patch },
    }));
  }

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
        <div className="text-sm font-medium text-slate-300">Modules</div>
        <nav className="mt-3 space-y-1" aria-label="Challenge phases">
          {PHASES.map((p, idx) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                idx === activeIdx
                  ? "border-cyan-500/60 bg-cyan-500/20 text-cyan-300"
                  : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </nav>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={saveDraft}
            disabled={saving || status === "submitted"}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Draft"}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Skill-based. Deterministic scoring on submit.
        </p>
      </aside>

      <section className="rounded-xl border border-white/10 bg-slate-800/50 p-6">
        <h2 className="text-lg font-medium text-slate-200">{active.label}</h2>
        <div className="mt-4">
          {active.key === "phase1" && (
            <Phase1
              value={(answers.phase1 ?? {}) as Partial<SpringAnswers["phase1"]>}
              onChange={(p) => setPhase("phase1", p)}
            />
          )}
          {active.key === "phase2" && (
            <Phase2
              value={(answers.phase2 ?? {}) as Partial<SpringAnswers["phase2"]>}
              onChange={(p) => setPhase("phase2", p)}
            />
          )}
          {active.key === "phase3" && (
            <Phase3
              value={(answers.phase3 ?? {}) as Partial<SpringAnswers["phase3"]>}
              onChange={(p) => setPhase("phase3", p)}
            />
          )}
          {active.key === "phase4" && (
            <Phase4
              value={(answers.phase4 ?? {}) as Partial<SpringAnswers["phase4"]>}
              onChange={(p) => setPhase("phase4", p)}
            />
          )}
          {active.key === "phase5" && (
            <Phase5
              value={(answers.phase5 ?? {}) as Partial<SpringAnswers["phase5"]>}
              onChange={(p) => setPhase("phase5", p)}
            />
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
            disabled={activeIdx === 0}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setActiveIdx((i) => Math.min(PHASES.length - 1, i + 1))}
            disabled={activeIdx === PHASES.length - 1}
            className="rounded-lg border border-cyan-500/50 px-4 py-2 text-sm text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <input
        className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder:text-slate-500"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <textarea
        className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder:text-slate-500"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-300">
      <input
        type="checkbox"
        className="mt-1 rounded border-slate-500 bg-slate-800 text-cyan-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function Phase1({
  value,
  onChange,
}: {
  value: Partial<SpringAnswers["phase1"]>;
  onChange: (p: Partial<SpringAnswers["phase1"]>) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-400">Entity Type</span>
        <select
          className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
          value={value.entityType ?? "llc"}
          onChange={(e) => onChange({ entityType: e.target.value as SpringAnswers["phase1"]["entityType"] })}
        >
          <option value="llc">LLC</option>
          <option value="c-corp">C-Corp</option>
          <option value="s-corp">S-Corp</option>
          <option value="partnership">Partnership</option>
          <option value="sole-prop">Sole Proprietorship</option>
        </select>
      </label>
      <Input
        label="Jurisdiction"
        value={value.jurisdiction ?? ""}
        onChange={(v) => onChange({ jurisdiction: v })}
        placeholder="e.g. Delaware, Wyoming"
      />
      <TextArea
        label="Business Purpose (10–500 chars)"
        value={value.businessPurpose ?? ""}
        onChange={(v) => onChange({ businessPurpose: v })}
        placeholder="Describe your business purpose…"
      />
    </div>
  );
}

function Phase2({
  value,
  onChange,
}: {
  value: Partial<SpringAnswers["phase2"]>;
  onChange: (p: Partial<SpringAnswers["phase2"]>) => void;
}) {
  const owners = (value.owners ?? []) as OwnershipSplit[];

  function updateOwner(idx: number, patch: Partial<OwnershipSplit>) {
    const next = [...owners];
    next[idx] = { ...(next[idx] ?? { name: "", pct: 0 }), ...patch } as OwnershipSplit;
    onChange({ owners: next });
  }

  function addOwner() {
    onChange({ owners: [...owners, { name: "", pct: 0 }] });
  }

  function removeOwner(idx: number) {
    onChange({ owners: owners.filter((_, i) => i !== idx) });
  }

  const totalPct = owners.reduce((s, o) => s + (o.pct ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">Ownership (total must be 100%)</span>
        <span className={`text-xs ${Math.abs(totalPct - 100) < 1 ? "text-green-400" : "text-amber-400"}`}>
          Total: {totalPct}%
        </span>
      </div>
      {owners.map((o, idx) => (
        <div key={idx} className="flex gap-2 items-end">
          <input
            className="flex-1 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
            placeholder="Name"
            value={o.name ?? ""}
            onChange={(e) => updateOwner(idx, { name: e.target.value })}
          />
          <input
            type="number"
            min={0}
            max={100}
            className="w-20 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
            placeholder="%"
            value={o.pct ?? ""}
            onChange={(e) => updateOwner(idx, { pct: Number(e.target.value) || 0 })}
          />
          <button
            type="button"
            onClick={() => removeOwner(idx)}
            className="text-slate-500 hover:text-red-400 text-sm"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addOwner}
        className="rounded-lg border border-dashed border-white/20 px-3 py-2 text-sm text-slate-400 hover:border-cyan-500/50 hover:text-cyan-400"
      >
        + Add owner
      </button>
    </div>
  );
}

function Phase3({
  value,
  onChange,
}: {
  value: Partial<SpringAnswers["phase3"]>;
  onChange: (p: Partial<SpringAnswers["phase3"]>) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Simulation only. No real EIN filing or bank accounts.
      </p>
      <Checkbox
        label="Operating agreement drafted (simulation)"
        checked={value.operatingAgreement ?? false}
        onChange={(v) => onChange({ operatingAgreement: v })}
      />
      <Checkbox
        label="Cap table created (simulation)"
        checked={value.capTable ?? false}
        onChange={(v) => onChange({ capTable: v })}
      />
      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-400">Banking Readiness (simulation)</span>
        <select
          className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
          value={value.bankAccountSim ?? "pending"}
          onChange={(e) => onChange({ bankAccountSim: e.target.value as SpringAnswers["phase3"]["bankAccountSim"] })}
        >
          <option value="yes">Yes – Ready</option>
          <option value="pending">Pending</option>
          <option value="no">No</option>
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-400">EIN Readiness (simulation)</span>
        <select
          className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
          value={value.einSim ?? "pending"}
          onChange={(e) => onChange({ einSim: e.target.value as SpringAnswers["phase3"]["einSim"] })}
        >
          <option value="yes">Yes – Ready</option>
          <option value="pending">Pending</option>
          <option value="no">No</option>
        </select>
      </label>
    </div>
  );
}

function Phase4({
  value,
  onChange,
}: {
  value: Partial<SpringAnswers["phase4"]>;
  onChange: (p: Partial<SpringAnswers["phase4"]>) => void;
}) {
  const checklist = (value.complianceChecklist ?? []) as string[];
  const filings = (value.filingAwareness ?? []) as string[];

  const complianceOptions = [
    "Entity formation documents",
    "Operating agreement",
    "EIN confirmation",
    "Bank account docs",
    "Licenses / permits",
    "Insurance",
  ];
  const filingOptions = [
    "Annual reports",
    "State tax",
    "Federal tax",
    "Beneficial ownership (FinCEN)",
  ];

  function toggleChecklist(item: string) {
    const next = checklist.includes(item)
      ? checklist.filter((x) => x !== item)
      : [...checklist, item];
    onChange({ complianceChecklist: next });
  }

  function toggleFiling(item: string) {
    const next = filings.includes(item) ? filings.filter((x) => x !== item) : [...filings, item];
    onChange({ filingAwareness: next });
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-medium text-slate-400">Compliance Checklist</span>
        <div className="mt-2 space-y-2">
          {complianceOptions.map((item) => (
            <Checkbox
              key={item}
              label={item}
              checked={checklist.includes(item)}
              onChange={() => toggleChecklist(item)}
            />
          ))}
        </div>
      </div>
      <div>
        <span className="text-xs font-medium text-slate-400">Filing Awareness</span>
        <div className="mt-2 space-y-2">
          {filingOptions.map((item) => (
            <Checkbox
              key={item}
              label={item}
              checked={filings.includes(item)}
              onChange={() => toggleFiling(item)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Phase5({
  value,
  onChange,
}: {
  value: Partial<SpringAnswers["phase5"]>;
  onChange: (p: Partial<SpringAnswers["phase5"]>) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-400">Governance</span>
        <select
          className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
          value={value.governanceChoice ?? "member-managed"}
          onChange={(e) => onChange({ governanceChoice: e.target.value as SpringAnswers["phase5"]["governanceChoice"] })}
        >
          <option value="member-managed">Member-managed</option>
          <option value="manager-managed">Manager-managed</option>
        </select>
      </label>
      <Checkbox
        label="Annual meeting requirement"
        checked={value.annualMeeting ?? false}
        onChange={(v) => onChange({ annualMeeting: v })}
      />
      <Checkbox
        label="Recordkeeping procedures"
        checked={value.recordkeeping ?? false}
        onChange={(v) => onChange({ recordkeeping: v })}
      />
    </div>
  );
}
