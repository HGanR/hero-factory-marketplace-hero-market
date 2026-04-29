"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { evaluateOfferingRules } from "@/lib/ppm/rules";
import type { TrustProfile, OfferingWizardState, WizardStep } from "@/lib/ppm/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle } from "lucide-react";

const STEPS: WizardStep[] = ["setup", "disclosures", "authorization", "open", "issuance"];

function stepLabel(step: WizardStep, requiresPPM: boolean) {
  if (step === "disclosures") return requiresPPM ? "PPM & Disclosures" : "Disclosures";
  if (step === "authorization") return "Authorization Minutes";
  if (step === "issuance") return "Issuance";
  return step.charAt(0).toUpperCase() + step.slice(1);
}

function stepStatus(step: WizardStep, currentStep: WizardStep, completedSteps: WizardStep[]) {
  const stepIndex = STEPS.indexOf(step);
  const currentIndex = STEPS.indexOf(currentStep);

  if (completedSteps.includes(step)) return "completed";
  if (stepIndex === currentIndex) return "current";
  if (stepIndex < currentIndex) return "completed";
  return "pending";
}

function PPMWizardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trustId = searchParams?.get("trustId");

  const [profile, setProfile] = useState<TrustProfile | null>(null);
  const [wizard, setWizard] = useState<OfferingWizardState>({
    trustId: trustId || "",
    activeStep: "setup",
    errors: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load trust profile
  useEffect(() => {
    if (!trustId) {
      setError("No trust ID provided");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/profile`);
        if (!res.ok) throw new Error("Failed to load trust profile");
        const data = await res.json();
        setProfile(data.profile);
        setWizard(w => ({ ...w, trustId }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load trust profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [trustId]);

  const rules = useMemo(() => (profile ? evaluateOfferingRules(profile) : null), [profile]);
  const requiresPPM = rules?.requiresPPM ?? true;

  // Persist wizard locally
  useEffect(() => {
    if (trustId) {
      const key = `ppm_wizard_v1:${trustId}`;
      localStorage.setItem(key, JSON.stringify(wizard));
    }
  }, [trustId, wizard]);

  useEffect(() => {
    if (trustId) {
      const key = `ppm_wizard_v1:${trustId}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as OfferingWizardState;
          if (parsed?.trustId === trustId) setWizard(parsed);
        } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trustId]);

  const handleStepClick = (step: WizardStep) => {
    setWizard(w => ({ ...w, activeStep: step, errors: [] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-300 mx-auto mb-4"></div>
            Loading trust profile...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !profile || !rules) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300 mb-4">{error || "Failed to load trust profile"}</p>
            <Button onClick={() => router.back()} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.back()}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-cyan-300">PPM Offering Wizard</h1>
              <p className="text-slate-400">Create and manage private placement offerings</p>
            </div>
          </div>
          <div className="text-right text-sm text-slate-400">
            <div>Trust: {profile.trustKind}</div>
            <div>Status: {profile.status}</div>
          </div>
        </div>

        {/* Trust Info */}
        <Card className="rounded-2xl shadow-sm border-cyan-500/20">
          <CardHeader>
            <CardTitle>Trust Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-200">
            <div className="grid grid-cols-2 gap-4">
              <div>Trust Type: <span className="text-cyan-300">{profile.trustKind}</span></div>
              <div>Jurisdiction: <span className="text-cyan-300">{profile.jurisdictionState}</span></div>
              <div>Status: <span className="text-cyan-300">{profile.status}</span></div>
              <div>Tax Classification: <span className="text-cyan-300">{profile.taxClassification || "Not set"}</span></div>
            </div>
            {profile.executedAt && (
              <div className="text-emerald-400">
                ✓ Executed on {new Date(profile.executedAt).toLocaleDateString()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Warnings */}
        {rules.disallowedReasons.length ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Configuration warnings</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {rules.disallowedReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Stepper */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Wizard Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {STEPS.map((s) => {
                const status = stepStatus(s, wizard.activeStep, []);
                return (
                  <Button
                    key={s}
                    variant={status === "current" ? "default" : status === "completed" ? "secondary" : "outline"}
                    onClick={() => handleStepClick(s)}
                    className="gap-2"
                  >
                    {status === "completed" && <CheckCircle2 className="h-4 w-4" />}
                    {stepLabel(s, requiresPPM)}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card className="rounded-2xl shadow-sm min-h-[400px]">
          <CardContent className="p-6">
            {wizard.activeStep === "setup" ? (
              <SetupStep
                trustId={trustId!}
                allowedOfferingTypes={rules.allowedOfferingTypes}
                onOfferingCreated={(offeringId, computedRequiresPPM) =>
                  setWizard((w) => ({ ...w, offeringId, requiresPPM: computedRequiresPPM, activeStep: "disclosures", errors: [] }))
                }
              />
            ) : (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">
                  {stepLabel(wizard.activeStep, requiresPPM)}
                </h3>
                <p className="text-slate-400 mb-6">
                  This step is not yet implemented. The wizard framework is ready for development.
                </p>
                <Button
                  onClick={() => setWizard(w => ({ ...w, activeStep: "setup" }))}
                  variant="outline"
                >
                  Return to Setup
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Setup Step Component
function SetupStep(props: {
  trustId: string;
  allowedOfferingTypes: string[];
  onOfferingCreated: (offeringId: string, computedRequiresPPM: boolean) => void;
}) {
  const [name, setName] = useState("Series A");
  const [type, setType] = useState<string>(props.allowedOfferingTypes[0] ?? "private_placement");
  const [targetAmount, setTargetAmount] = useState("100000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/trusts/${encodeURIComponent(props.trustId)}/offerings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          targetAmount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create offering");

      props.onOfferingCreated(data.offeringId, Boolean(data.requiresPPM));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create offering");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-cyan-300 mb-2">Offering Setup</h3>
        <p className="text-slate-400">Create a new offering for this trust</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Offering Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100"
          >
            {props.allowedOfferingTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Offering Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100"
            placeholder="Series A Trust Notes"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Target Amount ($)</label>
          <input
            type="number"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100"
            placeholder="100000"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={create} disabled={loading}>
          {loading ? "Creating..." : "Create Offering"}
        </Button>
      </div>
    </div>
  );
}

export default function PPMWizardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-300 mx-auto mb-4"></div>
            Loading wizard...
          </CardContent>
        </Card>
      </div>
    }>
      <PPMWizardPageContent />
    </Suspense>
  );
}
