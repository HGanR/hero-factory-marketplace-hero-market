"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { US_STATE_CODES, type StateCode } from "@/lib/irrevocableTrust/schema";
import { RevocableStepSchemas, type RevocableStepKey } from "@/lib/revocableTrust/schema";

const steps: { key: RevocableStepKey; label: string }[] = [
  { key: "state", label: "State & Date" }, { key: "parties", label: "People" },
  { key: "terms", label: "Trust Instructions" }, { key: "funding", label: "Funding" },
  { key: "review", label: "Review" },
];
type Person = { fullName: string; addressLine1: string; addressLine2?: string; city: string; state: StateCode; postalCode: string; email?: string; phone?: string };
const blankPerson = (): Person => ({ fullName: "", addressLine1: "", city: "", state: "NY", postalCode: "" });
const blank = {
  state: { governingState: "NY", county: "", proposedEffectiveDate: "" },
  parties: { settlor: blankPerson(), initialTrustees: [blankPerson()], successorTrustees: [] as Person[], beneficiaries: [blankPerson()] },
  terms: { trustName: "", revocationAndAmendmentNotes: "", incapacityInstructions: "", distributionInstructions: "" },
  funding: { assetSchedule: "", transferPlanAcknowledged: false },
  review: { confirmAccuracy: false, confirmProfessionalReview: false },
};
type FormData = typeof blank;
const textInput = "w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-slate-100";
function PersonFields({ title, value, onChange }: { title: string; value: Person; onChange: (v: Person) => void }) {
  const update = (field: keyof Person, val: string) => onChange({ ...value, [field]: val });
  return <div className="space-y-3 rounded-xl border border-slate-700 p-4">
    <h3 className="font-semibold">{title}</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      {([["fullName", "Full legal name"], ["addressLine1", "Street address"], ["addressLine2", "Apartment / suite (optional)"], ["city", "City"], ["postalCode", "ZIP / postal code"], ["email", "Email (optional)"], ["phone", "Phone (optional)"]] as const).map(([field, label]) =>
        <label key={field} className="block space-y-1 text-sm"><span>{label}</span><input className={textInput} value={value[field] ?? ""} onChange={e => update(field, e.target.value)} /></label>)}
      <label className="block space-y-1 text-sm"><span>State</span><select className={textInput} value={value.state} onChange={e => update("state", e.target.value)}>{US_STATE_CODES.map(state => <option key={state} value={state}>{state}</option>)}</select></label>
    </div>
  </div>;
}
export default function RevocableTrustWizard() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState<RevocableStepKey>("state");
  const [data, setData] = useState<FormData>(blank);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wizard/revocable/session", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
        const result = await res.json();
        if (!res.ok || !result.ok) throw new Error(result.error?.message || "Unable to open draft");
        if (cancelled) return;
        const existing = JSON.parse(result.session.dataJson || "{}");
        setData(prev => ({ ...prev, ...existing }));
        setStep(steps.some(s => s.key === result.session.currentStep) ? result.session.currentStep : "state");
        setSessionId(result.sessionId);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to open draft"); }
      finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  const change = <K extends RevocableStepKey>(key: K, value: FormData[K]) => { setData(prev => ({ ...prev, [key]: value })); setSaved(false); setError(""); };
  const save = async () => {
    if (!sessionId) return;
    const result = RevocableStepSchemas[step].safeParse(data[step]);
    if (!result.success) { setError("Please complete the required fields before continuing. Check names, addresses and instructions."); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/wizard/revocable/save-step", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, stepKey: step, stepData: result.data }) });
      const response = await res.json();
      if (!res.ok || !response.ok) throw new Error(response.error?.message || "Unable to save");
      setSaved(true); setStep(response.nextStep);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save"); }
    finally { setBusy(false); }
  };
  const parties = data.parties;
  const editPeople = (field: "initialTrustees" | "successorTrustees" | "beneficiaries", people: Person[]) => change("parties", { ...parties, [field]: people });
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 text-slate-100">
    <Link href="/trust-records/choose-trust" className="text-sm text-cyan-300 underline">Choose a different trust type</Link>
    <h1 className="text-3xl font-bold">Revocable Living Trust preparation</h1>
    <p className="text-sm text-slate-300">A guided intake for preparing drafting instructions. This does not create an executed trust or replace review by a qualified legal professional.</p>
    <nav aria-label="Trust preparation progress" className="flex flex-wrap gap-2">{steps.map((s, i) => <span key={s.key} aria-current={step === s.key ? "step" : undefined} className={"rounded-lg border px-3 py-2 text-xs " + (step === s.key ? "border-cyan-400 bg-cyan-950" : "border-slate-700")}>{i + 1}. {s.label}</span>)}</nav>
    {error && <div role="alert" className="rounded-lg border border-red-500 p-4 text-sm text-red-200">{error}</div>}
    {saved && <p role="status" className="text-sm text-emerald-300">Your previous step was saved.</p>}
    {!sessionId ? <p>{busy ? "Loading your saved draft…" : "Draft unavailable. Please sign in or contact support if the problem continues."}</p> :
    <div className="space-y-5 rounded-xl border border-slate-700 bg-slate-900 p-5">
      {step === "state" && <>
        <h2 className="text-xl font-semibold">State and proposed date</h2>
        <label className="block space-y-1"><span>Governing state</span><select className={textInput} value={data.state.governingState} onChange={e => change("state", { ...data.state, governingState: e.target.value })}>{US_STATE_CODES.map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="block space-y-1"><span>Proposed effective date</span><input type="date" className={textInput} value={data.state.proposedEffectiveDate} onChange={e => change("state", { ...data.state, proposedEffectiveDate: e.target.value })}/></label>
        <label className="block space-y-1"><span>County (optional)</span><input className={textInput} value={data.state.county} onChange={e => change("state", { ...data.state, county: e.target.value })}/></label>
      </>}
      {step === "parties" && <>
        <h2 className="text-xl font-semibold">People involved</h2>
        <p className="text-sm text-slate-300">The settlor creates the trust. Trustees manage it. Successor trustees may take over when needed.</p>
        <PersonFields title="Settlor" value={parties.settlor} onChange={v => change("parties", { ...parties, settlor: v })}/>
        {(["initialTrustees", "successorTrustees", "beneficiaries"] as const).map(field => <section key={field} className="space-y-3">
          <h3 className="font-semibold">{field === "initialTrustees" ? "Initial trustees" : field === "successorTrustees" ? "Successor trustees (optional)" : "Beneficiaries"}</h3>
          {parties[field].map((p, i) => <div key={i} className="space-y-2">
            <PersonFields title={(field === "initialTrustees" ? "Trustee" : field === "successorTrustees" ? "Successor trustee" : "Beneficiary") + " " + (i + 1)} value={p} onChange={v => editPeople(field, parties[field].map((person, j) => j === i ? v : person))}/>
            {(field === "successorTrustees" || parties[field].length > 1) && <button type="button" className="text-sm text-cyan-300 underline" onClick={() => editPeople(field, parties[field].filter((_, j) => i !== j))}>Remove</button>}
          </div>)}
          <button type="button" className="rounded-lg border border-slate-600 px-4 py-2" onClick={() => editPeople(field, [...parties[field], blankPerson()])}>Add {field === "initialTrustees" ? "trustee" : field === "successorTrustees" ? "successor trustee" : "beneficiary"}</button>
        </section>)}
      </>}
      {step === "terms" && <>
        <h2 className="text-xl font-semibold">Trust instructions</h2>
        <p className="text-sm text-slate-300">Describe your wishes for legal drafting and professional review. Do not assume these notes themselves create enforceable provisions.</p>
        {([["trustName", "Proposed trust name"], ["revocationAndAmendmentNotes", "How should amendment or revocation be handled?"], ["incapacityInstructions", "Instructions if the settlor becomes incapacitated (optional)"], ["distributionInstructions", "How should beneficiaries receive distributions?"]] as const).map(([field, label]) =>
          <label key={field} className="block space-y-1"><span>{label}</span>{field === "trustName" ? <input className={textInput} value={data.terms[field]} onChange={e => change("terms", { ...data.terms, [field]: e.target.value })}/> : <textarea rows={3} className={textInput} value={data.terms[field]} onChange={e => change("terms", { ...data.terms, [field]: e.target.value })}/>}</label>)}
      </>}
      {step === "funding" && <>
        <h2 className="text-xl font-semibold">Assets and funding</h2>
        <label className="block space-y-1"><span>List assets you intend to transfer or title to the trust</span><textarea rows={6} className={textInput} value={data.funding.assetSchedule} onChange={e => change("funding", { ...data.funding, assetSchedule: e.target.value })}/></label>
        <label className="flex items-start gap-3"><input type="checkbox" checked={data.funding.transferPlanAcknowledged} onChange={e => change("funding", { ...data.funding, transferPlanAcknowledged: e.target.checked })}/><span>Asset transfers, beneficiary designations, and titling require separate review and completion.</span></label>
      </>}
      {step === "review" && <>
        <h2 className="text-xl font-semibold">Review your preparation summary</h2>
        <dl className="space-y-3 text-sm">
          {([["Trust name", data.terms.trustName], ["Governing state", data.state.governingState], ["Proposed date", data.state.proposedEffectiveDate], ["Settlor", parties.settlor.fullName], ["Initial trustees", parties.initialTrustees.map(p => p.fullName).join(", ")], ["Successor trustees", parties.successorTrustees.map(p => p.fullName).join(", ")], ["Beneficiaries", parties.beneficiaries.map(p => p.fullName).join(", ")], ["Amendment and revocation", data.terms.revocationAndAmendmentNotes], ["Incapacity instructions", data.terms.incapacityInstructions], ["Distribution instructions", data.terms.distributionInstructions], ["Funding plan", data.funding.assetSchedule]] as [string, string][]).map(([label, value]) => <div key={label} className="rounded-lg border border-slate-700 p-3"><dt className="text-slate-400">{label}</dt><dd className="mt-1 whitespace-pre-wrap">{value || "Not provided"}</dd></div>)}
        </dl>
        <label className="flex gap-3"><input type="checkbox" checked={data.review.confirmAccuracy} onChange={e => change("review", { ...data.review, confirmAccuracy: e.target.checked })}/><span>I have reviewed the information for accuracy.</span></label>
        <label className="flex gap-3"><input type="checkbox" checked={data.review.confirmProfessionalReview} onChange={e => change("review", { ...data.review, confirmProfessionalReview: e.target.checked })}/><span>I understand this is an intake summary and professional legal review and execution may be required.</span></label>
        <p className="rounded-lg border border-amber-600 p-3 text-sm text-amber-200">Document generation and legal execution are not enabled. Saving this review does not create or execute a trust.</p>
      </>}
      <div className="flex flex-wrap justify-between gap-3 border-t border-slate-700 pt-4">
        <button type="button" className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50" disabled={busy || step === "state"} onClick={() => { setError(""); setStep(steps[Math.max(0, steps.findIndex(s => s.key === step) - 1)].key); }}>Back</button>
        <button type="button" className="rounded-lg bg-cyan-500 px-5 py-2 font-semibold text-slate-950 disabled:opacity-50" disabled={busy || (step === "review" && saved)} onClick={save}>{busy ? "Saving…" : step === "review" ? "Save review" : "Save and continue"}</button>
      </div>
    </div>}
  </main>;
}
