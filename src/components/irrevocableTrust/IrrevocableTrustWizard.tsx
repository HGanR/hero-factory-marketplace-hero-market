"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { US_STATE_CODES, type StepStateData, type StepPartiesData, type StepTrustTermsData, type StepDistributionsData, type StepPowersData, type StepFundingData, type StepReviewData } from "@/lib/irrevocableTrust/schema";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

type StepKey = "state" | "parties" | "terms" | "distributions" | "powers" | "funding" | "review" | "generate";

const STEPS: { key: StepKey; title: string }[] = [
  { key: "state", title: "State & Effective Date" },
  { key: "parties", title: "Parties" },
  { key: "terms", title: "Trust Terms" },
  { key: "distributions", title: "Distributions" },
  { key: "powers", title: "Powers & Protections" },
  { key: "funding", title: "Funding" },
  { key: "review", title: "Review & Acknowledgements" },
  { key: "generate", title: "Generate" },
];

async function apiPost<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Request failed");
  return json as T;
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET", credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Request failed");
  return json as T;
}

export default function IrrevocableTrustWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trustId = searchParams?.get("trustId") || null;
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<StepKey>("state");
  const [data, setData] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const stepIndex = useMemo(() => STEPS.findIndex(s => s.key === currentStep), [currentStep]);

  useEffect(() => {
    (async () => {
      setErr(null);
      try {
        const created = await apiPost<{ ok: true; sessionId: string; session: any }>("/api/wizard/irrevocable/session", { trustId });
        setSessionId(created.sessionId);
        const sessionData = created.session.dataJson ? JSON.parse(created.session.dataJson) : {};
        setData(sessionData);
        setCurrentStep((created.session.currentStep as StepKey) ?? "state");
      } catch (e: any) {
        setErr(e.message);
      }
    })();
  }, [trustId]);

  async function saveStep(stepKey: StepKey, stepData: any, next?: StepKey) {
    if (!sessionId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await apiPost<{ ok: true; session: any }>("/api/wizard/irrevocable/save-step", {
        sessionId,
        stepKey,
        stepData,
        nextStep: next,
      });
      const sessionData = res.session.dataJson ? JSON.parse(res.session.dataJson) : {};
      setData(sessionData);
      if (next) setCurrentStep(next);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!sessionId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await apiPost<{ ok: true; documentId: string }>("/api/wizard/irrevocable/generate", { sessionId });
      alert(`Generated document: ${res.documentId}. In production, this would download the document.`);
      router.push(`/trust-records${trustId ? `?trustId=${trustId}` : ""}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Irrevocable Trust Wizard</h1>
        <p className="text-sm text-muted-foreground">
          This wizard collects information to assemble draft documents. It is not legal advice. Consider attorney review before execution.
        </p>
        {trustId && (
          <p className="text-xs text-muted-foreground">
            Linked to Trust: {trustId}
          </p>
        )}
      </header>

      {err && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-6">
        <aside className="w-72 shrink-0 border rounded-lg p-4">
          <div className="text-sm font-medium mb-3">Steps</div>
          <ol className="space-y-2">
            {STEPS.map((s, idx) => (
              <li key={s.key}>
                <button
                  className={`w-full text-left text-sm rounded-md px-3 py-2 ${
                    idx === stepIndex ? "bg-neutral-100 font-medium" : "hover:bg-neutral-50"
                  }`}
                  onClick={() => setCurrentStep(s.key)}
                  disabled={!sessionId || busy}
                >
                  {idx + 1}. {s.title}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <main className="flex-1 border rounded-lg p-6">
          {currentStep === "state" && (
            <StateStep
              defaultValue={data.state}
              busy={busy}
              onNext={(v) => saveStep("state", v, "parties")}
            />
          )}

          {currentStep === "parties" && (
            <PartiesStep
              defaultValue={data.parties}
              busy={busy}
              onBack={() => setCurrentStep("state")}
              onNext={(v) => saveStep("parties", v, "terms")}
            />
          )}

          {currentStep === "terms" && (
            <TermsStep
              defaultValue={data.terms}
              busy={busy}
              onBack={() => setCurrentStep("parties")}
              onNext={(v) => saveStep("terms", v, "distributions")}
            />
          )}

          {currentStep === "distributions" && (
            <DistributionsStep
              defaultValue={data.distributions}
              busy={busy}
              onBack={() => setCurrentStep("terms")}
              onNext={(v) => saveStep("distributions", v, "powers")}
            />
          )}

          {currentStep === "powers" && (
            <PowersStep
              defaultValue={data.powers}
              busy={busy}
              onBack={() => setCurrentStep("distributions")}
              onNext={(v) => saveStep("powers", v, "funding")}
            />
          )}

          {currentStep === "funding" && (
            <FundingStep
              defaultValue={data.funding}
              busy={busy}
              onBack={() => setCurrentStep("powers")}
              onNext={(v) => saveStep("funding", v, "review")}
            />
          )}

          {currentStep === "review" && (
            <ReviewStep
              snapshot={data}
              defaultValue={data.review}
              busy={busy}
              onBack={() => setCurrentStep("funding")}
              onNext={(v) => saveStep("review", v, "generate")}
            />
          )}

          {currentStep === "generate" && (
            <GenerateStep busy={busy} onBack={() => setCurrentStep("review")} onGenerate={generate} />
          )}
        </main>
      </div>
    </div>
  );
}

// Step Components

function StateStep({ defaultValue, busy, onNext }: { defaultValue?: StepStateData; busy: boolean; onNext: (data: StepStateData) => void }) {
  const [governingState, setState] = useState<typeof US_STATE_CODES[number]>(defaultValue?.governingState ?? "NY");
  const [effectiveDate, setDate] = useState(defaultValue?.effectiveDate ?? new Date().toISOString().slice(0, 10));
  const [county, setCounty] = useState(defaultValue?.county ?? "");

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">State & Effective Date</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Governing State</Label>
          <Select value={governingState} onValueChange={(v) => setState(v as typeof US_STATE_CODES[number])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {US_STATE_CODES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Effective Date</Label>
          <Input type="date" value={effectiveDate} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>County (optional)</Label>
        <Input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="County name" />
      </div>
      <div className="flex justify-end">
        <Button disabled={busy} onClick={() => onNext({ governingState, effectiveDate, county: county || undefined })}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function PartiesStep({ defaultValue, busy, onBack, onNext }: { defaultValue?: StepPartiesData; busy: boolean; onBack: () => void; onNext: (data: StepPartiesData) => void }) {
  const [raw, setRaw] = useState(JSON.stringify(defaultValue ?? { grantor: { fullName: "", addressLine1: "", city: "", state: "NY", postalCode: "" }, trustees: [], beneficiaries: [] }, null, 2));
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Parties</h2>
      <p className="text-sm text-muted-foreground">
        Replace this JSON editor with proper form fields (Grantor, Trustees, Beneficiaries). This is a scaffolding hook.
      </p>
      <Textarea className="w-full h-64 font-mono text-xs" value={raw} onChange={(e) => setRaw(e.target.value)} />
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button disabled={busy} onClick={() => onNext(JSON.parse(raw))}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function TermsStep({ defaultValue, busy, onBack, onNext }: { defaultValue?: StepTrustTermsData; busy: boolean; onBack: () => void; onNext: (data: StepTrustTermsData) => void }) {
  const [trustName, setTrustName] = useState(defaultValue?.trustName ?? "");
  const [trustType, setTrustType] = useState<"IrrevocableLivingTrust" | "ILIT" | "SpecialNeeds" | "AssetProtection" | "Charitable" | "PrivateExpressTrust">(defaultValue?.trustType ?? "IrrevocableLivingTrust");
  const [trustCategory, setTrustCategory] = useState<"private" | "charitable" | "statutory">(defaultValue?.trustCategory ?? "private");
  const [formationMode, setFormationMode] = useState<"express" | "resulting" | "constructive">(defaultValue?.formationMode ?? "express");
  const [governanceMode, setGovernanceMode] = useState<"simple" | "complex">(defaultValue?.governanceMode ?? "simple");
  const [commercialEnabled, setCommercialEnabled] = useState(defaultValue?.commercialEnabled ?? false);
  const [sCorpEligible, setSCorpEligible] = useState(defaultValue?.sCorpEligible ?? false);
  const [trustSubtype, setTrustSubtype] = useState<"standard" | "grantor" | "QSST" | "ESBT">(defaultValue?.trustSubtype ?? "standard");
  const [irsElectionConfirmed, setIrsElectionConfirmed] = useState(defaultValue?.irsElectionConfirmed ?? false);
  const [noAmendmentAcknowledgement, setAck] = useState(!!defaultValue?.noAmendmentAcknowledgement);
  const [spendthrift, setSpendthrift] = useState(defaultValue?.spendthrift ?? true);
  const [purposeNotes, setPurposeNotes] = useState(defaultValue?.purposeNotes ?? "");
  const [taxNotes, setTaxNotes] = useState(defaultValue?.taxNotes ?? "");

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Trust Terms</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Trust Name</Label>
          <Input value={trustName} onChange={(e) => setTrustName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Trust Type</Label>
          <Select value={trustType} onValueChange={(v) => setTrustType(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IrrevocableLivingTrust">Irrevocable Living Trust</SelectItem>
              <SelectItem value="ILIT">Irrevocable Life Insurance Trust (ILIT)</SelectItem>
              <SelectItem value="SpecialNeeds">Special Needs Trust</SelectItem>
              <SelectItem value="AssetProtection">Asset Protection Trust</SelectItem>
              <SelectItem value="Charitable">Charitable Trust</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Purpose Notes (optional)</Label>
        <Textarea value={purposeNotes} onChange={(e) => setPurposeNotes(e.target.value)} placeholder="Additional notes about the trust purpose" />
      </div>
      <div className="flex items-start gap-2">
        <Checkbox checked={spendthrift} onCheckedChange={(checked) => setSpendthrift(!!checked)} />
        <Label className="text-sm">Include spendthrift provision (default)</Label>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox checked={noAmendmentAcknowledgement} onCheckedChange={(checked) => setAck(!!checked)} />
        <Label className="text-sm">I understand irrevocable trusts generally cannot be amended or revoked without strict conditions and/or required consents.</Label>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button disabled={busy || !noAmendmentAcknowledgement || !trustName} onClick={() => onNext({
          trustName,
          trustType,
          trustCategory,
          formationMode,
          governanceMode,
          commercialEnabled,
          sCorpEligible,
          trustSubtype,
          irsElectionConfirmed,
          noAmendmentAcknowledgement,
          spendthrift,
          purposeNotes: purposeNotes || undefined,
          taxNotes: taxNotes || undefined
        })}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function DistributionsStep({ defaultValue, busy, onBack, onNext }: { defaultValue?: StepDistributionsData; busy: boolean; onBack: () => void; onNext: (data: StepDistributionsData) => void }) {
  const [distributionStandard, setStandard] = useState<"HEMS" | "Discretionary" | "MandatorySchedule" | "Hybrid">(defaultValue?.distributionStandard ?? "HEMS");
  const [scheduleNotes, setScheduleNotes] = useState(defaultValue?.scheduleNotes ?? "");
  
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Distributions</h2>
      <div className="space-y-2">
        <Label>Distribution Standard</Label>
        <Select value={distributionStandard} onValueChange={(v) => setStandard(v as any)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HEMS">HEMS (Health, Education, Maintenance, Support)</SelectItem>
            <SelectItem value="Discretionary">Discretionary</SelectItem>
            <SelectItem value="MandatorySchedule">Mandatory Schedule</SelectItem>
            <SelectItem value="Hybrid">Hybrid</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Schedule Notes (optional)</Label>
        <Textarea value={scheduleNotes} onChange={(e) => setScheduleNotes(e.target.value)} placeholder="Additional distribution details" />
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button disabled={busy} onClick={() => onNext({ distributionStandard, scheduleNotes: scheduleNotes || undefined, ageStaging: [] })}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function PowersStep({ defaultValue, busy, onBack, onNext }: { defaultValue?: StepPowersData; busy: boolean; onBack: () => void; onNext: (data: StepPowersData) => void }) {
  const [trusteePowersBroad, setBroad] = useState(defaultValue?.trusteePowersBroad ?? true);
  const [includeRealEstatePowers, setRealEstate] = useState(defaultValue?.includeRealEstatePowers ?? true);
  const [includeInvestmentPowers, setInvestment] = useState(defaultValue?.includeInvestmentPowers ?? true);
  const [includeBusinessPowers, setBusiness] = useState(defaultValue?.includeBusinessPowers ?? false);
  const [protectorEnabled, setProtectorEnabled] = useState(defaultValue?.protectorEnabled ?? false);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Powers & Protections</h2>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox checked={trusteePowersBroad} onCheckedChange={(checked) => setBroad(!!checked)} />
          <Label className="text-sm">Broad trustee powers (default)</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={includeRealEstatePowers} onCheckedChange={(checked) => setRealEstate(!!checked)} />
          <Label className="text-sm">Include real estate powers</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={includeInvestmentPowers} onCheckedChange={(checked) => setInvestment(!!checked)} />
          <Label className="text-sm">Include investment powers</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={includeBusinessPowers} onCheckedChange={(checked) => setBusiness(!!checked)} />
          <Label className="text-sm">Include business powers</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={protectorEnabled} onCheckedChange={(checked) => setProtectorEnabled(!!checked)} />
          <Label className="text-sm">Enable Trust Protector (advanced)</Label>
        </div>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button disabled={busy} onClick={() => onNext({ trusteePowersBroad, includeRealEstatePowers, includeInvestmentPowers, includeBusinessPowers, protectorEnabled })}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function FundingStep({ defaultValue, busy, onBack, onNext }: { defaultValue?: StepFundingData; busy: boolean; onBack: () => void; onNext: (data: StepFundingData) => void }) {
  const [initialFundingSummary, setSummary] = useState(defaultValue?.initialFundingSummary ?? "");
  const [transferPlanAcknowledgement, setAck] = useState(!!defaultValue?.transferPlanAcknowledgement);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Funding</h2>
      <div className="space-y-2">
        <Label>Initial Funding Summary</Label>
        <Textarea value={initialFundingSummary} onChange={(e) => setSummary(e.target.value)} placeholder="Describe the initial assets to be funded into the trust" />
      </div>
      <div className="flex items-start gap-2">
        <Checkbox checked={transferPlanAcknowledgement} onCheckedChange={(checked) => setAck(!!checked)} />
        <Label className="text-sm">I understand a trust must be funded (assets transferred/titled) for the plan to function.</Label>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button disabled={busy || !initialFundingSummary || !transferPlanAcknowledgement} onClick={() => onNext({ initialFundingSummary, transferPlanAcknowledgement, assets: [] })}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ReviewStep({ snapshot, defaultValue, busy, onBack, onNext }: { snapshot: any; defaultValue?: StepReviewData; busy: boolean; onBack: () => void; onNext: (data: StepReviewData) => void }) {
  const [confirmAccuracy, setA] = useState(!!defaultValue?.confirmAccuracy);
  const [confirmIrrevocable, setB] = useState(!!defaultValue?.confirmIrrevocable);
  const [confirmNotLegalAdvice, setC] = useState(!!defaultValue?.confirmNotLegalAdvice);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Review & Acknowledgements</h2>
      <div className="border rounded-md p-3 text-xs overflow-auto max-h-64 bg-neutral-50">
        <pre>{JSON.stringify(snapshot, null, 2)}</pre>
      </div>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <Checkbox checked={confirmAccuracy} onCheckedChange={(checked) => setA(!!checked)} />
          <Label className="text-sm">I confirm the information is accurate to the best of my knowledge.</Label>
        </div>
        <div className="flex items-start gap-2">
          <Checkbox checked={confirmIrrevocable} onCheckedChange={(checked) => setB(!!checked)} />
          <Label className="text-sm">I understand irrevocable trusts have long-term consequences and may be difficult or impossible to unwind.</Label>
        </div>
        <div className="flex items-start gap-2">
          <Checkbox checked={confirmNotLegalAdvice} onCheckedChange={(checked) => setC(!!checked)} />
          <Label className="text-sm">I understand this platform provides document assembly, not legal advice.</Label>
        </div>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button disabled={busy || !(confirmAccuracy && confirmIrrevocable && confirmNotLegalAdvice)} onClick={() => onNext({ confirmAccuracy, confirmIrrevocable, confirmNotLegalAdvice })}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function GenerateStep({ busy, onBack, onGenerate }: { busy: boolean; onBack: () => void; onGenerate: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Generate</h2>
      <p className="text-sm text-muted-foreground">
        This will validate all steps, lock the draft, and produce a generated output (DOCX/PDF once wired).
      </p>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button disabled={busy} onClick={onGenerate}>
          Generate Document
        </Button>
      </div>
    </div>
  );
}
