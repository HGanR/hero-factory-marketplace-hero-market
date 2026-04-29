"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

const INSTRUMENT_TYPES = [
  "Promissory Note",
  "Corporate Bond",
  "Trust Certificate",
  "Stock",
  "Security",
  "Negotiable Instrument",
  "Cash",
  "Private Security",
];

const BROKERAGE_INSTITUTIONS = [
  "Fidelity",
  "Charles Schwab",
  "Interactive Brokers",
  "TD Ameritrade",
  "E*TRADE",
  "Other",
];

type Step = 1 | 2 | 3 | 4 | 5;

export default function BrokerageDepositWizardPage() {
  const params = useParams();
  const trustId = String(params?.trustId ?? "");

  const [step, setStep] = useState<Step>(1);
  const [assets, setAssets] = useState<{ id: string; type: string; name: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; institution?: string; accountNumber?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());

  // Step 2
  const [instrumentType, setInstrumentType] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [faceValue, setFaceValue] = useState("");
  const [transferability, setTransferability] = useState("");
  const [cusip, setCusip] = useState("");
  const [transferAgent, setTransferAgent] = useState("");

  // Step 3
  const [institution, setInstitution] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("");
  const [authorizedBroker, setAuthorizedBroker] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");

  // Step 4
  const [depositDate, setDepositDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("");
  const [settlementMethod, setSettlementMethod] = useState("");
  const [notes, setNotes] = useState("");

  const loadAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/trusts/${trustId}/assets`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets ?? []);
      }
    } catch {
      setAssets([]);
    }
  }, [trustId]);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/trusts/${trustId}/brokerage-accounts`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts ?? []);
      }
    } catch {
      setAccounts([]);
    }
  }, [trustId]);

  useEffect(() => {
    if (!trustId) return;
    setLoading(true);
    Promise.all([loadAssets(), loadAccounts()]).finally(() => setLoading(false));
  }, [trustId, loadAssets, loadAccounts]);

  const selectedAssetId = Array.from(selectedAssetIds)[0] ?? null;

  const handleCreateAccount = async () => {
    if (!institution.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/trusts/${trustId}/brokerage-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution: institution.trim(),
          accountNumber: accountNumber.trim() || undefined,
          accountType: accountType.trim() || undefined,
          authorizedBroker: authorizedBroker.trim() || undefined,
        }),
      });
      if (res.ok) {
        await loadAccounts();
        const data = await res.json();
        setSelectedAccountId(data.id);
        setInstitution("");
        setAccountNumber("");
        setAccountType("");
        setAuthorizedBroker("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDeposit = async () => {
    const accountId = selectedAccountId || (accounts[0]?.id);
    if (!selectedAssetId || !accountId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/trusts/${trustId}/brokerage-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: selectedAssetId,
          brokerageAccountId: accountId,
          instrumentType: instrumentType || undefined,
          issuer: issuer || undefined,
          issueDate: issueDate || undefined,
          faceValue: faceValue ? parseFloat(faceValue) : undefined,
          transferability: transferability || undefined,
          cusip: cusip || undefined,
          transferAgent: transferAgent || undefined,
          depositDate: depositDate || undefined,
          quantity: quantity ? parseFloat(quantity) : undefined,
          settlementMethod: settlementMethod || undefined,
          notes: notes || undefined,
        }),
      });
      if (res.ok) {
        setStep(5);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneratePack = async () => {
    const accountId = selectedAccountId || accounts[0]?.id;
    if (!trustId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/trust-records/compliance-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trustId,
          assetId: selectedAssetId || undefined,
          brokerageAccountId: accountId || undefined,
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!trustId) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Invalid trust.</p>
        <Button asChild variant="link" className="mt-4">
          <Link href="/trust-records">Back to Trust Records</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/trust-records?trustId=${trustId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Brokerage Deposit Wizard</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      ) : (
        <>
          {/* Step indicator */}
          <div className="flex gap-2">
            {([1, 2, 3, 4] as Step[]).map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full ${step >= s ? "bg-cyan-600" : "bg-slate-700"}`}
              />
            ))}
          </div>

          {/* Step 1 — Select Asset */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 1 — Select Asset</CardTitle>
                <p className="text-sm text-slate-400">Choose an asset from the Trust Asset Registry.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {assets.length === 0 ? (
                  <p className="text-slate-400">No assets in registry. Add assets in the Assets tab first.</p>
                ) : (
                  <div className="space-y-2">
                    {assets.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 hover:bg-slate-800/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedAssetIds.has(a.id)}
                          onCheckedChange={(c) =>
                            setSelectedAssetIds((prev) => {
                              const next = new Set(prev);
                              if (c) next.add(a.id);
                              else next.delete(a.id);
                              return next;
                            })
                          }
                        />
                        <span className="font-medium">{a.name}</span>
                        <span className="text-slate-400 text-sm">({a.type})</span>
                      </label>
                    ))}
                  </div>
                )}
                <Button
                  onClick={() => setStep(2)}
                  disabled={selectedAssetIds.size === 0}
                  className="w-full"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2 — Instrument Metadata */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 2 — Instrument Metadata</CardTitle>
                <p className="text-sm text-slate-400">Optional details for the instrument.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Instrument Type</Label>
                    <Select value={instrumentType} onValueChange={setInstrumentType}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {INSTRUMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Issuer</Label>
                    <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Issuer" />
                  </div>
                  <div className="space-y-2">
                    <Label>Issue Date</Label>
                    <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Face Value</Label>
                    <Input value={faceValue} onChange={(e) => setFaceValue(e.target.value)} placeholder="0.00" type="number" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Transferability</Label>
                    <Input value={transferability} onChange={(e) => setTransferability(e.target.value)} placeholder="e.g., Transferable" />
                  </div>
                  <div className="space-y-2">
                    <Label>CUSIP (optional)</Label>
                    <Input value={cusip} onChange={(e) => setCusip(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Transfer Agent (optional)</Label>
                    <Input value={transferAgent} onChange={(e) => setTransferAgent(e.target.value)} />
                  </div>
                </div>
                <Button onClick={() => setStep(3)} className="w-full">
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 3 — Brokerage Account */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 3 — Brokerage Account</CardTitle>
                <p className="text-sm text-slate-400">Select existing account or add a new one.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {accounts.length > 0 && (
                  <div className="space-y-2">
                    <Label>Select Account</Label>
                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                      <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.institution ?? "Account"} — {a.accountNumber ?? a.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Separator />
                <div className="space-y-4">
                  <Label>Or Add New Account</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Institution</Label>
                      <Select value={institution} onValueChange={setInstitution}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {BROKERAGE_INSTITUTIONS.map((b) => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Account Number</Label>
                      <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Last 4 digits only" />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Type</Label>
                      <Input value={accountType} onChange={(e) => setAccountType(e.target.value)} placeholder="e.g., Trust" />
                    </div>
                    <div className="space-y-2">
                      <Label>Authorized Broker</Label>
                      <Input value={authorizedBroker} onChange={(e) => setAuthorizedBroker(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={handleCreateAccount} disabled={submitting || !institution.trim()}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Account"}
                  </Button>
                </div>
                <Button
                  onClick={() => setStep(4)}
                  disabled={accounts.length === 0 && !selectedAccountId}
                  className="w-full mt-4"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 4 — Deposit Record */}
          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 4 — Deposit Record</CardTitle>
                <p className="text-sm text-slate-400">Record the deposit event (append-only).</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Deposit Date</Label>
                    <Input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" placeholder="1" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Settlement Method</Label>
                    <Input value={settlementMethod} onChange={(e) => setSettlementMethod(e.target.value)} placeholder="e.g., DTC, DWAC" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                  </div>
                </div>
                <Button onClick={handleSubmitDeposit} disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Deposit"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 5 — Success + Generate Pack */}
          {step === 5 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="h-6 w-6" />
                  Deposit Recorded
                </CardTitle>
                <p className="text-sm text-slate-400">
                  The deposit event has been recorded. Generate a compliance pack for your broker.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleGeneratePack} disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate Compliance Pack"}
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/trust-records?trustId=${trustId}`}>Done</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

