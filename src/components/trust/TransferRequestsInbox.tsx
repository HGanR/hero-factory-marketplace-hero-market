"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type HydratedItem = {
  request: {
    id: string;
    offeringId: string;
    certificateId: string;
    fromHolderId: string;
    toHolderId: string;
    reason?: string | null;
    effectiveDate?: string | null;
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  holders: {
    from: { id: string; displayName: string } | null;
    to: { id: string; displayName: string } | null;
  } | null;
  certificate:
    | {
        id: string;
        certificateNo: string;
        amount: string;
        offeringId: string;
      }
    | null;
};

export function TransferRequestsInbox({ trustId }: { trustId: string }) {
  const [items, setItems] = useState<HydratedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReasonById, setRejectReasonById] = useState<Record<string, string>>({});

  const pending = useMemo(() => items.filter((i) => i.request.status === "PENDING"), [items]);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/trusts/${encodeURIComponent(trustId)}/securities/transfer-requests?status=PENDING&include=holder,certificate`
      );
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setErr(String(e?.message || e || "Failed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trustId]);

  async function approve(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/securities/transfer-requests/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
      await refresh();
    } catch (e: any) {
      setErr(String(e?.message || e || "Failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/securities/transfer-requests/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReasonById[id] || undefined }),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
      await refresh();
    } catch (e: any) {
      setErr(String(e?.message || e || "Failed"));
    } finally {
      setBusyId(null);
    }
  }

  function holderLabel(holderId: string) {
    if (!holderId) return "—";
    return `${holderId.slice(0, 8)}…`;
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Transfer Requests</span>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {err ? <div className="text-sm text-red-400 mb-3">{err}</div> : null}
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}

        {pending.length === 0 ? (
          <div className="rounded-2xl border p-4 text-sm text-muted-foreground">No pending transfer requests.</div>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => {
              const req = r.request;
              const cert = r.certificate;
              const fromName = r.holders?.from?.displayName || null;
              const toName = r.holders?.to?.displayName || null;
              return (
                <div key={req.id} className="rounded-2xl border p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">PENDING</Badge>
                        <div className="font-semibold">Transfer request</div>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {cert ? (
                          <>
                            Cert: <span className="font-mono">{cert.certificateNo}</span> • Amount: {cert.amount}
                          </>
                        ) : (
                          <>Certificate: <span className="font-mono">{req.certificateId}</span></>
                        )}
                      </div>
                      <div className="mt-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">From:</span> {fromName ? `${fromName} (${req.fromHolderId.slice(0, 8)}…)` : holderLabel(req.fromHolderId)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">To:</span> {toName ? `${toName} (${req.toHolderId.slice(0, 8)}…)` : holderLabel(req.toHolderId)}
                        </div>
                        {req.effectiveDate ? (
                          <div>
                            <span className="text-muted-foreground">Effective:</span> {req.effectiveDate}
                          </div>
                        ) : null}
                      </div>
                      {req.reason ? (
                        <>
                          <Separator className="my-3" />
                          <div className="text-sm">
                            <div className="font-medium">Reason</div>
                            <div className="mt-1 text-muted-foreground">{req.reason}</div>
                          </div>
                        </>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Button size="sm" onClick={() => approve(req.id)} disabled={busyId === req.id}>
                        {busyId === req.id ? "Working…" : "Approve"}
                      </Button>
                      <div className="w-[260px] space-y-2">
                        <Label className="text-xs text-muted-foreground">Reject reason (optional)</Label>
                        <Input
                          value={rejectReasonById[req.id] || ""}
                          onChange={(e) => setRejectReasonById((p) => ({ ...p, [req.id]: e.target.value }))}
                          placeholder="e.g., missing documentation"
                          disabled={busyId === req.id}
                        />
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => reject(req.id)} disabled={busyId === req.id}>
                        Reject
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/trusts/${encodeURIComponent(trustId)}/securities/certificates/${encodeURIComponent(req.certificateId)}`}>
                          View timeline
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


