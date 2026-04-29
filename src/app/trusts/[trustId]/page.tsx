"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { ClassificationBadge, type DocumentClassification } from "@/components/trust/ClassificationBadge";
import { DisclosureBadge, type DisclosureState } from "@/components/trust/DisclosureBadge";
import { ProofChips, type ProofState } from "@/components/trust/ProofChips";
import { ShareModal, type ShareModalDoc } from "@/components/trust/ShareModal";
import { RequestsInbox } from "@/components/trust/RequestsInbox";
import { TransferRequestsInbox } from "@/components/trust/TransferRequestsInbox";

type DocItem = {
  id: string;
  trustId: string;
  docType: string;
  title: string;
  version: number;
  classification: DocumentClassification;
  disclosureState: DisclosureState;
  proofState: ProofState;
  canonicalHashSha256?: string | null;
  archiveId?: string | null;
  anchorTx?: string | null;
  updatedAt?: string | null;
};

export default function TrustDashboardPage({ params }: { params: { trustId: string } }) {
  const router = useRouter();
  const trustId = String(params.trustId || "");

  const [items, setItems] = useState<DocItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [wsSummary, setWsSummary] = useState<any | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDoc, setShareDoc] = useState<ShareModalDoc | null>(null);
  const [controlsStatus, setControlsStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [securitiesEnabled, setSecuritiesEnabled] = useState<boolean>(false);
  const [integrationsBusy, setIntegrationsBusy] = useState(false);
  const [proofStatus, setProofStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [proofNetwork, setProofNetwork] = useState<"none" | "metal_blockchain">("metal_blockchain");
  const [proofMode, setProofMode] = useState<"hash_only">("hash_only");
  const [proofBusy, setProofBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("loading");
      setErr(null);
      try {
        const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/documents`);
        if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setStatus("loaded");
      } catch (e: any) {
        if (cancelled) return;
        setErr(String(e?.message || e || "Failed to load"));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trustId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setWsStatus("loading");
      try {
        const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/workspace/summary`);
        if (!res.ok) {
          if (!cancelled) setWsStatus("error");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setWsSummary(data ?? null);
        setWsStatus("loaded");
      } catch {
        if (cancelled) return;
        setWsStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trustId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setControlsStatus("loading");
      try {
        const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/controls`);
        if (!res.ok) {
          setControlsStatus("error");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setSecuritiesEnabled(Boolean(data?.securitiesEnabled));
        setControlsStatus("loaded");
      } catch {
        if (cancelled) return;
        setControlsStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trustId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setProofStatus("loading");
      try {
        const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/proof/settings`);
        if (!res.ok) {
          setProofStatus("error");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setProofNetwork(data?.network === "none" ? "none" : "metal_blockchain");
        setProofMode("hash_only");
        setProofStatus("loaded");
      } catch {
        if (cancelled) return;
        setProofStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trustId]);

  const grouped = useMemo(() => {
    const out: Record<DocumentClassification, DocItem[]> = { public: [], demandable: [], private: [] };
    for (const d of items) out[d.classification]?.push(d);
    return out;
  }, [items]);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Trust Dashboard</div>
          <div className="text-sm text-muted-foreground">
            Trust ID: <span className="font-mono">{trustId}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/trust-records?trustId=${encodeURIComponent(trustId)}`}>Open Trust Records</Link>
          </Button>
          <Button asChild>
            <Link href={`/trusts/${encodeURIComponent(trustId)}/issue-security`}>Issue Security</Link>
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Guided Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          {wsStatus === "loading" ? <div className="text-sm text-muted-foreground">Loading checklist…</div> : null}
          {wsStatus === "error" ? (
            <div className="text-sm text-muted-foreground">Checklist unavailable for this trust.</div>
          ) : null}

          {wsStatus === "loaded" && wsSummary ? (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Trust:</span>{" "}
                <span className="font-medium">{wsSummary?.trust?.name || "Untitled Trust"}</span>{" "}
                <span className="text-muted-foreground">
                  • {wsSummary?.trust?.trustType || "—"} • {wsSummary?.trust?.jurisdictionState || "—"}
                </span>
              </div>

              <Separator />

              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>Parties &amp; Roles (Grantor, Trustee)</div>
                  <div className={wsSummary?.checklist?.partiesAndRoles ? "text-green-600" : "text-muted-foreground"}>
                    {wsSummary?.checklist?.partiesAndRoles ? "Complete" : "Pending"}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>Beneficiaries</div>
                  <div className={wsSummary?.checklist?.beneficiaries ? "text-green-600" : "text-muted-foreground"}>
                    {wsSummary?.checklist?.beneficiaries ? "Complete" : "Pending"}{" "}
                    <span className="text-xs text-muted-foreground">({Number(wsSummary?.counts?.beneficiaries || 0)})</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>Assets &amp; Funding Plan</div>
                  <div className={wsSummary?.checklist?.assetsAndFundingPlan ? "text-green-600" : "text-muted-foreground"}>
                    {wsSummary?.checklist?.assetsAndFundingPlan ? "Complete" : "Pending"}{" "}
                    <span className="text-xs text-muted-foreground">({Number(wsSummary?.counts?.assets || 0)})</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>Generate Draft Documents</div>
                  <div className={wsSummary?.checklist?.generateDraftDocuments ? "text-green-600" : "text-muted-foreground"}>
                    {wsSummary?.checklist?.generateDraftDocuments ? "Complete" : "Pending"}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {status === "loading" ? <div className="text-sm text-muted-foreground">Loading…</div> : null}
          {status === "error" ? <div className="text-sm text-red-400">{err}</div> : null}

          <Tabs defaultValue="public" className="mt-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="public">Public</TabsTrigger>
              <TabsTrigger value="demandable">Demandable</TabsTrigger>
              <TabsTrigger value="private">Private</TabsTrigger>
            </TabsList>

            {(["public", "demandable", "private"] as const).map((k) => (
              <TabsContent key={k} value={k} className="mt-4">
                {grouped[k].length === 0 ? (
                  <div className="rounded-2xl border p-4 text-sm text-muted-foreground">No documents.</div>
                ) : (
                  <div className="space-y-3">
                    {grouped[k].map((d) => (
                      <div key={d.id} className="rounded-2xl border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-[260px]">
                            <div className="text-base font-semibold">{d.title}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {d.docType} • v{d.version}
                              {d.updatedAt ? ` • ${String(d.updatedAt).slice(0, 10)}` : ""}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <ClassificationBadge classification={d.classification} />
                              <DisclosureBadge state={d.disclosureState} />
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <ProofChips
                              proofState={d.proofState}
                              hasHash={Boolean(d.canonicalHashSha256)}
                              hasArchive={Boolean(d.archiveId)}
                              hasAnchor={Boolean(d.anchorTx)}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setShareDoc({ id: d.id, trustId, title: d.title, docType: d.docType, classification: d.classification });
                                  setShareOpen(true);
                                }}
                              >
                                Share
                              </Button>
                              <Button size="sm" variant="outline" disabled>
                                Download
                              </Button>
                              <Button size="sm" variant="outline" disabled>
                                View proof
                              </Button>
                            </div>
                          </div>
                        </div>

                        {d.canonicalHashSha256 ? (
                          <>
                            <Separator className="my-3" />
                            <div className="text-xs text-muted-foreground">
                              Hash: <span className="font-mono break-all">{d.canonicalHashSha256}</span>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <RequestsInbox trustId={trustId} />

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Trust Settings — Proof Network</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {proofStatus === "loading" ? (
            <div className="rounded-2xl border p-4 text-sm text-muted-foreground">Loading proof settings…</div>
          ) : null}

          <div className="rounded-2xl border p-4 space-y-3">
            <div className="text-sm text-muted-foreground">
              Proof settings control where this trust’s <span className="font-semibold text-foreground">hash-only</span> anchors are recorded. Document contents
              are never published by this setting.
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium">Network</label>
              <select
                className="h-9 rounded-md border border-white/10 bg-black/40 px-3 text-sm text-white"
                value={proofNetwork}
                onChange={(e) => setProofNetwork(e.target.value === "none" ? "none" : "metal_blockchain")}
                disabled={proofBusy}
              >
                <option value="metal_blockchain">Metal Blockchain (Compliance-grade, recommended)</option>
                <option value="none">None (no anchoring)</option>
              </select>

              <label className="text-sm font-medium">Mode</label>
              <select
                className="h-9 rounded-md border border-white/10 bg-black/40 px-3 text-sm text-white"
                value={proofMode}
                onChange={() => setProofMode("hash_only")}
                disabled
              >
                <option value="hash_only">Hash-only</option>
              </select>

              <Button
                variant="outline"
                onClick={async () => {
                  setProofBusy(true);
                  try {
                    await fetch(`/api/trusts/${encodeURIComponent(trustId)}/proof/settings`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ network: proofNetwork, mode: proofMode }),
                    });
                  } finally {
                    setProofBusy(false);
                  }
                }}
                disabled={proofBusy || proofStatus !== "loaded"}
              >
                {proofBusy ? "Saving…" : "Save"}
              </Button>

              <Button asChild variant="outline">
                <Link href="/integrations/metallicus">Metallicus provider details + disclaimer</Link>
              </Button>
            </div>

            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
              <div className="font-semibold">Disclaimer</div>
              <div className="mt-1">
                Anchoring settings relate to proof-of-existence/integrity only. This platform does not initiate payments or connect directly to FedNow.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Enterprise Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-2xl border p-4">
            <div className="font-semibold">Instant Payments via FedNow (via Metallicus)</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Available via provider integration pathway. This platform does not initiate payments; we log the inquiry and provide a compliant handoff.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  try {
                    setIntegrationsBusy(true);
                    await fetch(`/api/trusts/${encodeURIComponent(trustId)}/integrations/metallicus/inquiry`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ channel: "mailto" }),
                    });
                  } finally {
                    setIntegrationsBusy(false);
                    window.open(
                      "mailto:partnerships@metallicus.com?subject=FedNow%20Integration%20Inquiry%20(via%20Hero%20Market)&body=Hello%20Metallicus%20team%2C%0A%0AWe%20would%20like%20to%20discuss%20an%20enterprise%20integration%20pathway%20for%20instant%20payments%20via%20FedNow.%0A%0ATrustId%3A%20" +
                        encodeURIComponent(trustId) +
                        "%0A%0AThanks%2C%0A",
                      "_blank",
                      "noreferrer"
                    );
                  }
                }}
                disabled={integrationsBusy}
              >
                {integrationsBusy ? "Working…" : "Contact Provider"}
              </Button>
              <Button asChild variant="outline">
                <Link href="/integrations/metallicus">Provider details + disclaimer</Link>
              </Button>
            </div>
            <div className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
              <div className="font-semibold">Disclaimer</div>
              <div className="mt-1">
                Inclusion of this provider does not imply any endorsement by the Federal Reserve, nor does it indicate that this platform participates in
                or connects directly to the FedNow Service.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {controlsStatus === "loading" ? (
        <div className="rounded-2xl border p-4 text-sm text-muted-foreground">Loading securities controls…</div>
      ) : null}
      {controlsStatus === "loaded" && securitiesEnabled ? <TransferRequestsInbox trustId={trustId} /> : null}

      <ShareModal open={shareOpen} onOpenChange={setShareOpen} doc={shareDoc} />
    </div>
  );
}


