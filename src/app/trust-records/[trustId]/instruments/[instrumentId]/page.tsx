"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Calculator } from "lucide-react";

type Instrument = {
  id: string;
  trustId: string;
  instrumentKind: string;
  instrumentSubtype?: string | null;
  status: string;
  serialNumber?: string | null;
  issuerName?: string | null;
  governingLaw?: string | null;
  faceValue?: number | null;
  currency?: string | null;
  issueDate?: string | null;
  maturityDate?: string | null;
  ppmDocumentId?: string | null;
  governingResolutionId?: string | null;
  collateralPoolId?: string | null;
  signedAt?: string | null;
  signedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const KIND_LABELS: Record<string, string> = {
  CERTIFICATE: "Trust Certificate",
  BOND: "Bond",
  PROMISSORY_NOTE: "Promissory Note",
  SECURED_NOTE: "Secured Note",
  PPM_SECURITY: "PPM Security",
  OTHER: "Other",
};

function formatMoney(val: number | null | undefined, currency = "USD"): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(val);
}

export default function InstrumentDetailPage() {
  const params = useParams();
  const trustId = String(params?.trustId ?? "");
  const instrumentId = String(params?.instrumentId ?? "");

  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushingToAccounting, setPushingToAccounting] = useState(false);

  useEffect(() => {
    if (!trustId || !instrumentId) return;
    setLoading(true);
    fetch(`/api/trust-records/instruments/${instrumentId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setInstrument(data.instrument ?? null))
      .catch(() => setInstrument(null))
      .finally(() => setLoading(false));
  }, [trustId, instrumentId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!instrument) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-slate-400">Instrument not found</p>
        <Button asChild variant="link" className="mt-2">
          <Link href={`/trust-records/${trustId}/instruments`}>Back to Instruments</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">
                {instrument.serialNumber || instrument.id.slice(0, 8)}
              </CardTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{KIND_LABELS[instrument.instrumentKind] ?? instrument.instrumentKind}</Badge>
                <Badge variant="secondary">{instrument.status.replace(/_/g, " ")}</Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-slate-100">
                {formatMoney(instrument.faceValue, instrument.currency ?? "USD")}
              </div>
              <div className="text-xs text-slate-400">{instrument.currency ?? "USD"}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs text-slate-500">Issuer</div>
              <div className="text-slate-200">{instrument.issuerName || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Governing Law</div>
              <div className="text-slate-200">{instrument.governingLaw || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Issue Date</div>
              <div className="text-slate-200">{instrument.issueDate || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Maturity Date</div>
              <div className="text-slate-200">{instrument.maturityDate || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Signed By</div>
              <div className="text-slate-200">{instrument.signedBy || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Signed At</div>
              <div className="text-slate-200">
                {instrument.signedAt ? new Date(instrument.signedAt).toLocaleString() : "—"}
              </div>
            </div>
          </div>

          {instrument.status === "DRAFT" && (
            <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">
              This instrument is in draft. Attach collateral, link governance approval, then issue.
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {instrument.status === "SIGNED" || instrument.status === "PACKAGED" ? (
              <Button asChild>
                <Link href={`/trust-records/${trustId}/brokerage-deposit?instrumentId=${instrument.id}`}>
                  Start Brokerage Deposit
                </Link>
              </Button>
            ) : null}
            {["ISSUED", "SIGNED", "PACKAGED", "DEPOSIT_INITIATED", "DEPOSIT_COMPLETED"].includes(instrument.status) && (
              <Button
                variant="outline"
                disabled={pushingToAccounting}
                onClick={async () => {
                  setPushingToAccounting(true);
                  try {
                    const res = await fetch(`/api/trust-records/instruments/${instrument.id}/push-to-accounting`, {
                      method: "POST",
                      credentials: "include",
                    });
                    const data = await res.json();
                    if (data.ok) {
                      window.alert(`Sent ${data.publishedEvents} event(s) to Accounting. Review in Accounting → Capital & Instruments.`);
                    } else {
                      window.alert(data.error ?? "Failed to push to Accounting");
                    }
                  } catch {
                    window.alert("Failed to push to Accounting");
                  } finally {
                    setPushingToAccounting(false);
                  }
                }}
                className="gap-2"
              >
                {pushingToAccounting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                Send to Accounting
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
