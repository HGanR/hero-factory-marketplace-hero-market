"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type CustodyMode = "holder_possession" | "trustee_or_custodian_possession";

type Certificate = {
  id: string;
  offeringId: string;
  certificateNo: string;
  holderId: string;
  holderName: string;
  amount: string;
  custodyMode: CustodyMode;
  custodianName: string | null;
  possessionAcknowledgedAt: string | null;
  possessionAcknowledgedMethod: string | null;
  executedDocumentId: string | null;
  issuedAt: string | null;
  status: string;
};

type EventItem = {
  id: string;
  eventType: string;
  actorRole: string | null;
  createdAt: string | null;
  payload: any;
};

export default function SecurityCertificatePage({ params }: { params: { trustId: string; certificateId: string } }) {
  const router = useRouter();
  const trustId = String(params.trustId || "");
  const certificateId = String(params.certificateId || "");

  const [cert, setCert] = useState<Certificate | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Possession acknowledgement
  const [ackMethod, setAckMethod] = useState<"wet_sign_attestation" | "e_sign" | "wallet_sig">("wet_sign_attestation");
  const [ackCustodianIdentity, setAckCustodianIdentity] = useState("");
  const [ackNote, setAckNote] = useState("");

  // Transfer request
  const [holders, setHolders] = useState<Array<{ id: string; displayName: string }>>([]);
  const [toHolderId, setToHolderId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferEffectiveDate, setTransferEffectiveDate] = useState("");

  const timeline = useMemo(() => {
    return events.map((e) => ({
      ...e,
      label: e.eventType
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/(^\w)/, (m) => m.toUpperCase()),
    }));
  }, [events]);

  async function loadAll() {
    setErr(null);
    try {
      const [cRes, eRes, hRes] = await Promise.all([
        fetch(`/api/trusts/${encodeURIComponent(trustId)}/securities/certificates/${encodeURIComponent(certificateId)}`),
        fetch(`/api/trusts/${encodeURIComponent(trustId)}/securities/certificates/${encodeURIComponent(certificateId)}/events`),
        fetch(`/api/trusts/${encodeURIComponent(trustId)}/securities/holders`),
      ]);
      if (!cRes.ok) throw new Error((await cRes.text().catch(() => "")) || `Certificate load failed (${cRes.status})`);
      if (!eRes.ok) throw new Error((await eRes.text().catch(() => "")) || `Events load failed (${eRes.status})`);
      const cData = await cRes.json();
      const eData = await eRes.json();
      const hData = hRes.ok ? await hRes.json().catch(() => ({})) : {};

      setCert(cData?.certificate ?? null);
      setEvents(Array.isArray(eData?.items) ? eData.items : []);
      setHolders(
        Array.isArray(hData?.items)
          ? hData.items.map((h: any) => ({ id: String(h.id), displayName: String(h.displayName) }))
          : []
      );
    } catch (e: any) {
      setErr(String(e?.message || e || "Load failed"));
    }
  }

  useEffect(() => {
    if (trustId && certificateId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trustId, certificateId]);

  async function acknowledgePossession() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/trusts/${encodeURIComponent(trustId)}/securities/certificates/${encodeURIComponent(certificateId)}/acknowledge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: ackMethod,
            custodianIdentity: ackCustodianIdentity || undefined,
            note: ackNote || undefined,
          }),
        }
      );
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Acknowledge failed (${res.status})`);
      await loadAll();
    } catch (e: any) {
      setErr(String(e?.message || e || "Acknowledge failed"));
    } finally {
      setBusy(false);
    }
  }

  async function requestTransfer() {
    if (!toHolderId) {
      setErr("Select a target holder.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/trusts/${encodeURIComponent(trustId)}/securities/certificates/${encodeURIComponent(certificateId)}/transfer-requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toHolderId,
            reason: transferReason || undefined,
            effectiveDate: transferEffectiveDate || undefined,
          }),
        }
      );
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Transfer request failed (${res.status})`);
      await loadAll();
      setTransferReason("");
      setTransferEffectiveDate("");
    } catch (e: any) {
      setErr(String(e?.message || e || "Transfer request failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Security Certificate</div>
          <div className="text-sm text-muted-foreground">
            Trust: <span className="font-mono">{trustId}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/trusts/${encodeURIComponent(trustId)}`}>Back to Trust Dashboard</Link>
          </Button>
          <Button variant="outline" onClick={() => router.refresh()}>
            Refresh
          </Button>
        </div>
      </div>

      {err ? <div className="text-sm text-red-400">{err}</div> : null}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Certificate details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!cert ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div><span className="text-muted-foreground">Certificate No:</span> <span className="font-mono">{cert.certificateNo}</span></div>
              <div><span className="text-muted-foreground">Amount:</span> {cert.amount}</div>
              <div><span className="text-muted-foreground">Holder:</span> {cert.holderName}</div>
              <div><span className="text-muted-foreground">Custody:</span> {cert.custodyMode}{cert.custodianName ? ` — ${cert.custodianName}` : ""}</div>
              <div><span className="text-muted-foreground">Issued:</span> {cert.issuedAt ? new Date(cert.issuedAt).toLocaleString() : "—"}</div>
              <div><span className="text-muted-foreground">Possession acknowledged:</span> {cert.possessionAcknowledgedAt ? new Date(cert.possessionAcknowledgedAt).toLocaleString() : "Not yet"}</div>
              {cert.executedDocumentId ? (
                <div className="md:col-span-2">
                  <span className="text-muted-foreground">Executed document id:</span>{" "}
                  <span className="font-mono text-xs break-all">{cert.executedDocumentId}</span>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Timeline (append-only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {timeline.length === 0 ? (
            <div className="text-sm text-muted-foreground">No events yet.</div>
          ) : (
            <div className="space-y-2">
              {timeline.map((e) => (
                <div key={e.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{e.label}</div>
                    <div className="text-xs text-muted-foreground">{e.createdAt ? new Date(e.createdAt).toLocaleString() : "—"}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">Actor: {e.actorRole || "—"}</div>
                  {e.payload ? (
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(e.payload, null, 2)}</pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border p-4 space-y-3">
            <div className="font-medium">Acknowledge possession</div>
            <div className="text-sm text-muted-foreground">
              Creates a <span className="font-mono">POSSESSION_ACKNOWLEDGED</span> event (cannot be toggled off).
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={ackMethod} onValueChange={(v) => setAckMethod(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wet_sign_attestation">Wet-sign attestation</SelectItem>
                    <SelectItem value="e_sign">E-sign</SelectItem>
                    <SelectItem value="wallet_sig">Wallet signature</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Custodian identity (optional)</Label>
                <Input value={ackCustodianIdentity} onChange={(e) => setAckCustodianIdentity(e.target.value)} placeholder="If not holder possession" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Note (optional)</Label>
                <Textarea value={ackNote} onChange={(e) => setAckNote(e.target.value)} className="min-h-[80px]" />
              </div>
            </div>
            <Button onClick={acknowledgePossession} disabled={busy}>Acknowledge possession</Button>
          </div>

          <Separator />

          <div className="rounded-xl border p-4 space-y-3">
            <div className="font-medium">Request transfer</div>
            <div className="text-sm text-muted-foreground">
              Creates a <span className="font-mono">TRANSFER_REQUESTED</span> event and an approvals workflow (trustee/counsel depending on controls).
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>To holder</Label>
                <Select value={toHolderId} onValueChange={(v) => setToHolderId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select holder" /></SelectTrigger>
                  <SelectContent>
                    {holders.map((h) => (
                      <SelectItem key={h.id} value={h.id}>{h.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Effective date (optional)</Label>
                <Input value={transferEffectiveDate} onChange={(e) => setTransferEffectiveDate(e.target.value)} placeholder="YYYY-MM-DD" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Reason (optional)</Label>
                <Textarea value={transferReason} onChange={(e) => setTransferReason(e.target.value)} className="min-h-[80px]" />
              </div>
            </div>
            <Button onClick={requestTransfer} disabled={busy}>Create transfer request</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}




