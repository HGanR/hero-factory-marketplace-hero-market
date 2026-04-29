"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilePlus2, Landmark, Loader2, ChevronRight } from "lucide-react";

type Instrument = {
  id: string;
  trustId: string;
  instrumentKind: string;
  instrumentSubtype?: string | null;
  status: string;
  serialNumber?: string | null;
  issuerName?: string | null;
  faceValue?: number | null;
  currency?: string | null;
  issueDate?: string | null;
  maturityDate?: string | null;
  createdAt?: string | null;
};

const STATUS_GROUPS: { label: string; statuses: string[] }[] = [
  { label: "Drafts", statuses: ["DRAFT", "AUTHORITY_REVIEW", "COLLATERALIZED"] },
  { label: "Ready to Issue", statuses: ["GOVERNANCE_APPROVED", "READY_TO_ISSUE"] },
  { label: "Awaiting Signature", statuses: ["ISSUED"] },
  { label: "Ready for Packaging", statuses: ["SIGNED"] },
  { label: "Ready for Deposit", statuses: ["PACKAGED"] },
  { label: "Deposit In Progress", statuses: ["DEPOSIT_INITIATED"] },
  { label: "Completed / Closed", statuses: ["DEPOSIT_COMPLETED", "MATURED", "REDEEMED"] },
  { label: "Voided / Defaulted", statuses: ["VOIDED", "DEFAULTED"] },
];

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

export function InstrumentsSection({ trustId }: { trustId: string | null }) {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!trustId) {
      setInstruments([]);
      return;
    }
    setLoading(true);
    fetch(`/api/trust-records/instruments?trustId=${encodeURIComponent(trustId)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        setInstruments(data.instruments ?? []);
      })
      .catch(() => setInstruments([]))
      .finally(() => setLoading(false));
  }, [trustId]);

  if (!trustId) {
    return (
      <Card className="border-slate-800 bg-slate-950/50">
        <CardContent className="py-8 text-center text-slate-400">
          Select a trust workspace to view instruments.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-slate-800 bg-slate-950/50">
        <CardContent className="py-12 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading instruments…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Instrument Lifecycle</h2>
          <p className="text-sm text-slate-400">
            Manage certificates, bonds, notes, and securities through issuance to deposit.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href={`/trust-records/${trustId}/instruments/new`}>
            <FilePlus2 className="h-4 w-4" />
            New Instrument
          </Link>
        </Button>
      </div>

      {instruments.length === 0 ? (
        <Card className="border-slate-800 bg-slate-950/50">
          <CardContent className="py-12 text-center">
            <Landmark className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-3 text-slate-300">No instruments yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Create a draft instrument to start the issuance-to-deposit pipeline.
            </p>
            <Button asChild className="mt-4 gap-2">
              <Link href={`/trust-records/${trustId}/instruments/new`}>
                <FilePlus2 className="h-4 w-4" />
                Create Instrument
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {STATUS_GROUPS.map((group) => {
            const items = instruments.filter((i) => group.statuses.includes(i.status));
            if (items.length === 0) return null;
            return (
              <Card key={group.label} className="border-slate-800 bg-slate-950/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium text-slate-200">
                    {group.label} ({items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {items.map((inst) => (
                      <Link
                        key={inst.id}
                        href={`/trust-records/${trustId}/instruments/${inst.id}`}
                        className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/50 p-3 transition hover:bg-slate-800/50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-100">
                              {inst.serialNumber || inst.id.slice(0, 8)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {KIND_LABELS[inst.instrumentKind] ?? inst.instrumentKind}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {inst.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-400">
                            {inst.issuerName && <span>{inst.issuerName}</span>}
                            {inst.faceValue != null && (
                              <span>{formatMoney(inst.faceValue, inst.currency ?? "USD")}</span>
                            )}
                            {inst.maturityDate && <span>Matures {inst.maturityDate}</span>}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
