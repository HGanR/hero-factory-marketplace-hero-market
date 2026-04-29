"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";

const INSTRUMENT_KINDS = [
  { value: "CERTIFICATE", label: "Trust Certificate" },
  { value: "BOND", label: "Bond" },
  { value: "PROMISSORY_NOTE", label: "Promissory Note" },
  { value: "SECURED_NOTE", label: "Secured Note" },
  { value: "PPM_SECURITY", label: "PPM Security" },
  { value: "OTHER", label: "Other" },
];

export default function NewInstrumentPage() {
  const params = useParams();
  const router = useRouter();
  const trustId = String(params?.trustId ?? "");

  const [instrumentKind, setInstrumentKind] = useState("CERTIFICATE");
  const [instrumentSubtype, setInstrumentSubtype] = useState("");
  const [faceValue, setFaceValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [maturityDate, setMaturityDate] = useState("");
  const [issuerName, setIssuerName] = useState("");
  const [governingLaw, setGoverningLaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/trust-records/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          trustId,
          instrumentKind,
          instrumentSubtype: instrumentSubtype || undefined,
          faceValue: faceValue ? Number(faceValue) : undefined,
          currency,
          maturityDate: maturityDate || undefined,
          issuerName: issuerName || undefined,
          governingLaw: governingLaw || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create instrument");
      const id = data.instrument?.id;
      if (id) router.push(`/trust-records/${trustId}/instruments/${id}`);
      else router.push(`/trust-records/${trustId}/instruments`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="gap-2 text-slate-400 hover:text-slate-200">
          <Link href={`/trust-records/${trustId}/instruments`}>
            <ArrowLeft className="h-4 w-4" />
            Back to Instruments
          </Link>
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-950/50">
        <CardHeader>
          <CardTitle className="text-xl">Create Instrument</CardTitle>
          <p className="text-sm text-slate-400">
            Start a new draft instrument. You can attach collateral and link governance approval before issuing.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Instrument Family</Label>
              <Select value={instrumentKind} onValueChange={setInstrumentKind}>
                <SelectTrigger className="bg-slate-900 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTRUMENT_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subtype (optional)</Label>
              <Input
                value={instrumentSubtype}
                onChange={(e) => setInstrumentSubtype(e.target.value)}
                placeholder="e.g. unitized_interest, senior_bond"
                className="bg-slate-900 border-slate-700"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Face Value</Label>
                <Input
                  type="number"
                  value={faceValue}
                  onChange={(e) => setFaceValue(e.target.value)}
                  placeholder="100000"
                  className="bg-slate-900 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="bg-slate-900 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Maturity Date (optional)</Label>
              <Input
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
                className="bg-slate-900 border-slate-700"
              />
            </div>

            <div className="space-y-2">
              <Label>Issuer Name (optional)</Label>
              <Input
                value={issuerName}
                onChange={(e) => setIssuerName(e.target.value)}
                placeholder="Trust or entity name"
                className="bg-slate-900 border-slate-700"
              />
            </div>

            <div className="space-y-2">
              <Label>Governing Law (optional)</Label>
              <Input
                value={governingLaw}
                onChange={(e) => setGoverningLaw(e.target.value)}
                placeholder="e.g. State of Delaware"
                className="bg-slate-900 border-slate-700"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create Draft"
                )}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/trust-records/${trustId}/instruments`}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
