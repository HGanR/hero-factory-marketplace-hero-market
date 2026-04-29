"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

type SecurityType = "debt" | "participation" | "equity_like";
type ExemptionTag = "506b" | "506c" | "other";
type CustodyMode = "holder_possession" | "trustee_or_custodian_possession";
type ValuationApproach = "appraisal" | "internal" | "third_party";
type ValuationMemoClass = "private" | "demandable";

type OfferingDraft = {
  issuer: { trustName: string; governingLaw: string };
  securityType: SecurityType;
  exemptionTag: ExemptionTag;
  offeringName: string;
  aggregateAmountOrFormula: string;
  paymentTerms: { details: string };
  transferRestrictions: { restricted: boolean; trusteeConsentRequired: boolean };
  legends: { text: string };
  backingAssets: { assetIds: string[]; valuationApproach: ValuationApproach; valuationMemoDocClass: ValuationMemoClass; valuationMemoNote?: string };
  approvals: { requireAttestation: boolean; attestationName: string };
  package: { includePPM: boolean; includeSubscription: boolean; includeSpecimen: boolean; includeRiskAnnex: boolean };
  custody: { mode: CustodyMode; custodianName: string };
  finalize: { counselApproved: boolean; holderName: string; possessionAcknowledged: boolean };
};

export default function IssueSecurityWizard({ params }: { params: { trustId: string } }) {
  const router = useRouter();
  const trustId = String(params.trustId || "");

  const [step, setStep] = useState<"A" | "B" | "C" | "D" | "E" | "F">("A");
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [assetChoices, setAssetChoices] = useState<Array<{ id: string; name: string }>>([]);
  const [finalized, setFinalized] = useState(false);
  const [issuedCertId, setIssuedCertId] = useState<string | null>(null);

  const [holders, setHolders] = useState<Array<{ id: string; displayName: string }>>([]);
  const [selectedHolderId, setSelectedHolderId] = useState<string>("");
  const [newHolderDisplayName, setNewHolderDisplayName] = useState("");
  const [newHolderRef, setNewHolderRef] = useState("");

  const [issueAmount, setIssueAmount] = useState("");
  const [issueCustodyMode, setIssueCustodyMode] = useState<CustodyMode>("holder_possession");
  const [issueCustodianName, setIssueCustodianName] = useState("");

  const [draft, setDraft] = useState<OfferingDraft>(() => ({
    issuer: { trustName: "", governingLaw: "" },
    securityType: "participation",
    exemptionTag: "506b",
    offeringName: "Series A Participation Certificate",
    aggregateAmountOrFormula: "",
    paymentTerms: { details: "" },
    transferRestrictions: { restricted: true, trusteeConsentRequired: true },
    legends: { text: "RESTRICTED SECURITIES. NO RESALE ABSENT REGISTRATION OR EXEMPTION." },
    backingAssets: { assetIds: [], valuationApproach: "internal", valuationMemoDocClass: "private", valuationMemoNote: "" },
    approvals: { requireAttestation: true, attestationName: "" },
    package: { includePPM: true, includeSubscription: true, includeSpecimen: true, includeRiskAnnex: true },
    custody: { mode: "holder_possession", custodianName: "" },
    finalize: { counselApproved: false, holderName: "", possessionAcknowledged: false },
  }));

  // Load asset choices from trust-records draft (references only).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/draft?draftType=trust-records-state`);
        if (!res.ok) return;
        const data = await res.json();
        const payload = data?.draft?.payload;
        const assets: any[] = Array.isArray(payload?.assets) ? payload.assets : [];
        if (cancelled) return;
        setAssetChoices(
          assets.map((a) => ({ id: String(a?.id || ""), name: String(a?.name || a?.description || "Asset") })).filter((x) => x.id)
        );
        const entityName = String(payload?.config?.entityName || "");
        setDraft((p) => ({ ...p, issuer: { ...p.issuer, trustName: p.issuer.trustName || entityName } }));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trustId]);

  const stepLabel = useMemo(() => {
    const map: Record<string, string> = {
      A: "Define the Security",
      B: "Backing Assets & Valuation",
      C: "Approvals (Governance)",
      D: "Offering Package Generation",
      E: "Custody & Issuance Method",
      F: "Finalize",
    };
    return map[step];
  }, [step]);

  async function ensureOffering() {
    if (offeringId) return offeringId;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/securities/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offeringName: draft.offeringName,
          securityType: draft.securityType,
          exemptionTag: draft.exemptionTag,
          draft,
        }),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
      const data = await res.json();
      const id = String(data?.offeringId || "");
      setOfferingId(id);
      return id;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    const id = await ensureOffering();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/securities/offers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, counselApproved: draft.finalize.counselApproved }),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
    } catch (e: any) {
      setErr(String(e?.message || e || "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    const id = await ensureOffering();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/trusts/${encodeURIComponent(trustId)}/securities/offers/${encodeURIComponent(id)}/finalize`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmNoArchive: true }) }
      );
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
      await res.json();
      setFinalized(true);
    } catch (e: any) {
      setErr(String(e?.message || e || "Finalize failed"));
    } finally {
      setBusy(false);
    }
  }

  async function refreshHolders() {
    try {
      const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/securities/holders`, { method: "GET" });
      if (!res.ok) return;
      const data = await res.json();
      const items: any[] = Array.isArray(data?.items) ? data.items : [];
      setHolders(items.map((h) => ({ id: String(h.id), displayName: String(h.displayName) })));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (step === "F" && finalized) refreshHolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, finalized]);

  async function issueCertificateNow() {
    if (!finalized) {
      setErr("Finalize the offering package first.");
      return;
    }
    const id = await ensureOffering();
    setBusy(true);
    setErr(null);
    try {
      const payload: any = {
        amount: issueAmount,
        custodyMode: issueCustodyMode,
        custodianName: issueCustodyMode === "trustee_or_custodian_possession" ? issueCustodianName : undefined,
      };
      if (selectedHolderId) {
        payload.holderId = selectedHolderId;
      } else {
        payload.createHolder = { displayName: newHolderDisplayName, holderRef: newHolderRef || undefined };
      }

      const res = await fetch(
        `/api/trusts/${encodeURIComponent(trustId)}/securities/offers/${encodeURIComponent(id)}/certificates/issue`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
      const data = await res.json();
      const certId = String(data?.certificate?.id || "");
      setIssuedCertId(certId || null);
    } catch (e: any) {
      setErr(String(e?.message || e || "Issue failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Issue Security from Trust</div>
          <div className="text-sm text-muted-foreground">Trust: <span className="font-mono">{trustId}</span></div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/trusts/${encodeURIComponent(trustId)}`}>Back to Trust Dashboard</Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>{step}. {stepLabel}</span>
            <Badge variant="outline">Securities Module (Admin/Counsel)</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {err ? <div className="text-sm text-red-400">{err}</div> : null}

          {/* Step navigation */}
          <div className="flex flex-wrap gap-2">
            {(["A","B","C","D","E","F"] as const).map((s) => (
              <Button key={s} size="sm" variant={step === s ? "default" : "outline"} onClick={() => setStep(s)} disabled={busy}>
                {s}
              </Button>
            ))}
          </div>

          <Separator />

          {step === "A" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Issuer (Trust legal name)</Label>
                <Input value={draft.issuer.trustName} onChange={(e) => setDraft((p) => ({ ...p, issuer: { ...p.issuer, trustName: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Governing law</Label>
                <Input value={draft.issuer.governingLaw} onChange={(e) => setDraft((p) => ({ ...p, issuer: { ...p.issuer, governingLaw: e.target.value } }))} placeholder="e.g., NY" />
              </div>
              <div className="space-y-2">
                <Label>Security type</Label>
                <Select value={draft.securityType} onValueChange={(v) => setDraft((p) => ({ ...p, securityType: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debt">Debt</SelectItem>
                    <SelectItem value="participation">Participation</SelectItem>
                    <SelectItem value="equity_like">Equity-like</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Offering exemption (label only)</Label>
                <Select value={draft.exemptionTag} onValueChange={(v) => setDraft((p) => ({ ...p, exemptionTag: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="506b">Reg D 506(b)</SelectItem>
                    <SelectItem value="506c">Reg D 506(c)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Offering name</Label>
                <Input value={draft.offeringName} onChange={(e) => setDraft((p) => ({ ...p, offeringName: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Aggregate offering amount or formula</Label>
                <Input value={draft.aggregateAmountOrFormula} onChange={(e) => setDraft((p) => ({ ...p, aggregateAmountOrFormula: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Payment / distribution terms (structured)</Label>
                <Textarea className="min-h-[100px]" value={draft.paymentTerms.details} onChange={(e) => setDraft((p) => ({ ...p, paymentTerms: { details: e.target.value } }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Legends (counsel-controlled)</Label>
                <Textarea className="min-h-[90px]" value={draft.legends.text} onChange={(e) => setDraft((p) => ({ ...p, legends: { text: e.target.value } }))} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={draft.transferRestrictions.restricted} onCheckedChange={(v) => setDraft((p) => ({ ...p, transferRestrictions: { ...p.transferRestrictions, restricted: Boolean(v) } }))} />
                <div className="text-sm">Restricted transfer (no public resale)</div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={draft.transferRestrictions.trusteeConsentRequired} onCheckedChange={(v) => setDraft((p) => ({ ...p, transferRestrictions: { ...p.transferRestrictions, trusteeConsentRequired: Boolean(v) } }))} />
                <div className="text-sm">Trustee consent required for transfers</div>
              </div>
            </div>
          ) : null}

          {step === "B" ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">Select assets that support the security (references only).</div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {assetChoices.length === 0 ? <div className="text-sm text-muted-foreground">No assets found in Trust Records draft.</div> : null}
                {assetChoices.map((a) => {
                  const checked = draft.backingAssets.assetIds.includes(a.id);
                  return (
                    <label key={a.id} className="flex items-center justify-between gap-3 rounded-2xl border p-3">
                      <div className="text-sm">{a.name}</div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            backingAssets: {
                              ...p.backingAssets,
                              assetIds: e.target.checked ? [...p.backingAssets.assetIds, a.id] : p.backingAssets.assetIds.filter((x) => x !== a.id),
                            },
                          }))
                        }
                      />
                    </label>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Valuation approach</Label>
                  <Select value={draft.backingAssets.valuationApproach} onValueChange={(v) => setDraft((p) => ({ ...p, backingAssets: { ...p.backingAssets, valuationApproach: v as any } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="appraisal">Appraisal</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="third_party">Third-party</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valuation memo classification</Label>
                  <Select value={draft.backingAssets.valuationMemoDocClass} onValueChange={(v) => setDraft((p) => ({ ...p, backingAssets: { ...p.backingAssets, valuationMemoDocClass: v as any } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="demandable">Demandable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valuation memo note (upload pointer later)</Label>
                <Textarea value={draft.backingAssets.valuationMemoNote || ""} onChange={(e) => setDraft((p) => ({ ...p, backingAssets: { ...p.backingAssets, valuationMemoNote: e.target.value } }))} className="min-h-[90px]" />
              </div>
            </div>
          ) : null}

          {step === "C" ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">Generate governance artifacts (resolution + authority certificate) and capture attestation.</div>
              <div className="flex items-center gap-2">
                <Checkbox checked={draft.approvals.requireAttestation} onCheckedChange={(v) => setDraft((p) => ({ ...p, approvals: { ...p.approvals, requireAttestation: Boolean(v) } }))} />
                <div className="text-sm">Require trustee/corporate officer attestation</div>
              </div>
              <div className="space-y-2">
                <Label>Attestation name</Label>
                <Input value={draft.approvals.attestationName} onChange={(e) => setDraft((p) => ({ ...p, approvals: { ...p.approvals, attestationName: e.target.value } }))} placeholder="Trustee / Officer name" />
              </div>
            </div>
          ) : null}

          {step === "D" ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Select which package components to generate (all default Demandable; verification page is Public).</div>
              {[
                ["includePPM", "PPM (Demandable)"],
                ["includeSubscription", "Subscription Agreement (Demandable)"],
                ["includeSpecimen", "Specimen Certificate (Demandable)"],
                ["includeRiskAnnex", "Risk Factors Annex (Demandable)"],
              ].map(([k, label]) => (
                <label key={k} className="flex items-center gap-3 rounded-2xl border p-3">
                  <input
                    type="checkbox"
                    checked={(draft.package as any)[k]}
                    onChange={(e) => setDraft((p) => ({ ...p, package: { ...p.package, [k]: e.target.checked } as any }))}
                  />
                  <div className="text-sm">{label}</div>
                </label>
              ))}
            </div>
          ) : null}

          {step === "E" ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                MVP supports certificated security workflows. Uncertificated/book-entry is deferred.
              </div>
              <div className="space-y-2">
                <Label>Custody mode</Label>
                <Select value={draft.custody.mode} onValueChange={(v) => setDraft((p) => ({ ...p, custody: { ...p.custody, mode: v as any } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="holder_possession">Holder possession</SelectItem>
                    <SelectItem value="trustee_or_custodian_possession">Trustee / Custodian possession</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {draft.custody.mode === "trustee_or_custodian_possession" ? (
                <div className="space-y-2">
                  <Label>Custodian identity</Label>
                  <Input value={draft.custody.custodianName} onChange={(e) => setDraft((p) => ({ ...p, custody: { ...p.custody, custodianName: e.target.value } }))} placeholder="Corporate trustee / custodian name" />
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "F" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border p-4">
                <div className="font-medium">Integrity & Preservation</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Default policy: <span className="font-semibold">hash-only</span>. Archive and on-chain anchor are disabled by default for securities materials.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={draft.finalize.counselApproved} onCheckedChange={(v) => setDraft((p) => ({ ...p, finalize: { ...p.finalize, counselApproved: Boolean(v) } }))} />
                <div className="text-sm">Counsel sign-off required: approve final package (blocks finalize)</div>
              </div>
              <div className="rounded-2xl border p-4 space-y-3">
                <div className="font-medium">Step 1: Finalize offering package</div>
                <div className="text-sm text-muted-foreground">
                  Generates PPM / Subscription / Specimen / Authority docs. Executed certificates are generated at issuance.
                </div>
                <Button onClick={finalize} disabled={busy || finalized}>
                  {finalized ? "Finalized" : busy ? "Finalizing…" : "Finalize (Generate docs)"}
                </Button>
              </div>

              <div className="rounded-2xl border p-4 space-y-4">
                <div className="font-medium">Step 2: Issue executed certificate</div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input value={issueAmount} onChange={(e) => setIssueAmount(e.target.value)} placeholder="e.g., 100000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Custody mode</Label>
                    <Select value={issueCustodyMode} onValueChange={(v) => setIssueCustodyMode(v as CustodyMode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="holder_possession">Holder possession</SelectItem>
                        <SelectItem value="trustee_or_custodian_possession">Trustee / Custodian possession</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {issueCustodyMode === "trustee_or_custodian_possession" ? (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Custodian identity</Label>
                      <Input value={issueCustodianName} onChange={(e) => setIssueCustodianName(e.target.value)} placeholder="Corporate trustee / custodian name" />
                    </div>
                  ) : null}
                </div>

                <Separator />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Select holder (optional)</Label>
                    <Select value={selectedHolderId} onValueChange={(v) => setSelectedHolderId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select holder" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— Create new —</SelectItem>
                        {holders.map((h) => (
                          <SelectItem key={h.id} value={h.id}>{h.displayName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!selectedHolderId ? (
                    <div className="space-y-2">
                      <Label>New holder display name</Label>
                      <Input value={newHolderDisplayName} onChange={(e) => setNewHolderDisplayName(e.target.value)} placeholder="e.g., Acme SPV LLC" />
                    </div>
                  ) : null}
                  {!selectedHolderId ? (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Holder ref (optional pointer)</Label>
                      <Input value={newHolderRef} onChange={(e) => setNewHolderRef(e.target.value)} placeholder="e.g., CRM:contact_123 or vault://..." />
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={issueCertificateNow} disabled={busy || !finalized}>Issue Certificate</Button>
                  <Button variant="outline" onClick={() => router.push(`/trusts/${encodeURIComponent(trustId)}`)} disabled={busy}>
                    Back to Trust Dashboard
                  </Button>
                  {issuedCertId ? (
                    <Button asChild variant="outline">
                      <Link href={`/trusts/${encodeURIComponent(trustId)}/securities/certificates/${encodeURIComponent(issuedCertId)}`}>
                        View Certificate Timeline
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={saveDraft} disabled={busy}>Save Draft</Button>
              </div>
            </div>
          ) : null}

          <Separator />
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const order: any = ["A","B","C","D","E","F"];
                setStep(order[Math.max(0, order.indexOf(step) - 1)]);
              }}
              disabled={busy || step === "A"}
            >
              Back
            </Button>
            <Button
              onClick={async () => {
                await saveDraft();
                const order: any = ["A","B","C","D","E","F"];
                setStep(order[Math.min(order.length - 1, order.indexOf(step) + 1)]);
              }}
              disabled={busy || step === "F"}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


