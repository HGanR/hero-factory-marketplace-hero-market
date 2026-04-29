"use client";

import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import type { DocumentClassification } from "@/components/trust/ClassificationBadge";

export type ShareModalDoc = {
  id: string;
  trustId: string;
  title: string;
  docType: string;
  classification: DocumentClassification;
};

export function ShareModal({
  open,
  onOpenChange,
  doc,
  onShared,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doc: ShareModalDoc | null;
  onShared?: (info: { shareUrl?: string; requestId?: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [requestorRole, setRequestorRole] = useState<"bank" | "auditor" | "regulator" | "court" | "counterparty" | "other">("bank");
  const [purpose, setPurpose] = useState("");
  const [requestorEmail, setRequestorEmail] = useState("");
  const [expiresDays, setExpiresDays] = useState("14");

  const expiresAt = useMemo(() => {
    const days = Number(expiresDays);
    if (!Number.isFinite(days) || days <= 0) return undefined;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }, [expiresDays]);

  async function createPublicShare() {
    if (!doc) return;
    setBusy(true);
    setErr(null);
    setShareUrl(null);
    try {
      const res = await fetch(`/api/trusts/${encodeURIComponent(doc.trustId)}/documents/${encodeURIComponent(doc.id)}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresAt }),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
      const data = await res.json();
      const url = String(data?.shareUrl || "");
      setShareUrl(url);
      onShared?.({ shareUrl: url });
    } catch (e: any) {
      setErr(String(e?.message || e || "Failed to share"));
    } finally {
      setBusy(false);
    }
  }

  async function submitDemandableRequest() {
    if (!doc) return;
    if (!purpose.trim()) {
      setErr("Purpose is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    setRequestId(null);
    try {
      const res = await fetch(`/api/trusts/${encodeURIComponent(doc.trustId)}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestorRole,
          requestorEmail: requestorEmail.trim() || undefined,
          purpose: purpose.trim(),
          requestedDocumentIds: [doc.id],
          expiresAt,
        }),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
      const data = await res.json();
      const rid = String(data?.requestId || "");
      setRequestId(rid);
      onShared?.({ requestId: rid });
    } catch (e: any) {
      setErr(String(e?.message || e || "Failed to submit request"));
    } finally {
      setBusy(false);
    }
  }

  const mode = doc?.classification ?? "private";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-xl">
        <DialogHeader>
          <DialogTitle>Sharing</DialogTitle>
        </DialogHeader>

        {!doc ? <div className="text-sm text-muted-foreground">No document selected.</div> : null}
        {doc ? (
          <div className="text-sm">
            <div className="font-medium">{doc.title}</div>
            <div className="text-xs text-muted-foreground">{doc.docType} • {doc.classification}</div>
          </div>
        ) : null}

        <Separator />

        {mode === "public" ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Shareable authority document. Anyone with link (MVP).</div>
            <div className="space-y-2">
              <Label>Expiry (days)</Label>
              <Input value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} placeholder="14" />
            </div>
            <Button disabled={busy || !doc} onClick={createPublicShare}>
              {busy ? "Creating link…" : "Create share link"}
            </Button>
            {shareUrl ? (
              <div className="rounded-xl border p-3 text-sm">
                Share link: <span className="font-mono">{shareUrl}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "demandable" ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Demandable documents require a request workflow (role + purpose + expiry). Trustee approval required.
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Recipient role</Label>
                <Select value={requestorRole} onValueChange={(v) => setRequestorRole(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="auditor">Auditor</SelectItem>
                    <SelectItem value="regulator">Regulator</SelectItem>
                    <SelectItem value="court">Court</SelectItem>
                    <SelectItem value="counterparty">Counterparty</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expiry (days)</Label>
                <Input value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} placeholder="14" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Purpose (required)</Label>
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g., account opening due diligence" />
            </div>
            <div className="space-y-2">
              <Label>Recipient email (optional)</Label>
              <Input value={requestorEmail} onChange={(e) => setRequestorEmail(e.target.value)} placeholder="name@bank.com" />
            </div>
            <Button disabled={busy || !doc} onClick={submitDemandableRequest}>
              {busy ? "Submitting…" : "Submit request"}
            </Button>
            {requestId ? (
              <div className="rounded-xl border p-3 text-sm">
                Request submitted: <span className="font-mono">{requestId}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "private" ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Private documents are not shareable by default. Trustee + counsel override required (not yet enabled).
            </div>
            <Button variant="outline" disabled>
              Sharing disabled
            </Button>
          </div>
        ) : null}

        {err ? <div className="text-sm text-red-400">{err}</div> : null}
      </DialogContent>
    </Dialog>
  );
}




