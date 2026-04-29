"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UI_COPY } from "@/config/uiCopy";
import { US_STATES } from "@/config/usStates";

type Client = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  email: string;
  phone: string | null;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
};

type TrustListItem = {
  id: string;
  name: string | null;
  trustType: string | null;
  jurisdictionState: string | null;
  workspaceStatus: string | null;
  createdAt: string | null;
};

const TRUST_TYPES: Array<{ value: any; label: string }> = [
  { value: "revocable_living_trust", label: "Revocable Living Trust" },
  { value: "irrevocable_trust", label: "Irrevocable Trust" },
  { value: "testamentary_trust", label: "Testamentary Trust" },
  { value: "special_purpose_trust", label: "Special Purpose Trust" },
];

function formatFullName(c: Client): string {
  return [c.firstName, c.middleName, c.lastName, c.suffix].filter(Boolean).join(" ");
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function ClientProfilePage({ params }: { params: { clientId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = String(params.clientId || "");

  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [trusts, setTrusts] = useState<TrustListItem[]>([]);

  const [trustDialogOpen, setTrustDialogOpen] = useState(false);
  const [createBusy, startCreateTransition] = useTransition();
  const [trustType, setTrustType] = useState<string>("revocable_living_trust");
  const [jurisdictionState, setJurisdictionState] = useState<string>("TX");
  const [trustName, setTrustName] = useState<string>("");
  const [createErr, setCreateErr] = useState<string | null>(null);

  const showCreatedBanner = (searchParams?.get("created") ?? null) === "1";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("loading");
      setError(null);
      try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}`);
        if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setClient(data?.client ?? null);
        setStatus("loaded");
      } catch (e: any) {
        if (cancelled) return;
        setError(String(e?.message || e || "Failed to load"));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/trusts`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setTrusts(Array.isArray(data?.items) ? data.items : []);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const fullName = useMemo(() => {
    return client ? formatFullName(client) : "";
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const today = formatLongDate(new Date());
    const label = TRUST_TYPES.find((t) => t.value === trustType)?.label ?? "Trust";
    const typePart =
      label === "Revocable Living Trust"
        ? "Revocable Living Trust"
        : label === "Irrevocable Trust"
          ? "Irrevocable Trust"
          : label;
    setTrustName(`The ${fullName} ${typePart} dated ${today}`);
  }, [client, fullName, trustType]);

  async function createTrustWorkspace() {
    if (!client) return;
    if (createBusy) return;
    setCreateErr(null);
    const name = trustName.trim();
    if (!name) {
      setCreateErr("Trust name is required.");
      return;
    }
    if (!jurisdictionState.trim()) {
      setCreateErr("State / jurisdiction is required.");
      return;
    }

    startCreateTransition(async () => {
      try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/trusts`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            trust_type: trustType,
            jurisdiction_state: jurisdictionState,
            name,
          }),
        });
        if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
        const data = await res.json();
        const trustId = String(data?.trustId || "");
        if (!trustId) throw new Error("Trust creation succeeded but no trustId was returned");
        setTrustDialogOpen(false);
        router.push(`/trusts/${encodeURIComponent(trustId)}`);
      } catch (e: any) {
        setCreateErr(String(e?.message || e || "Failed to create trust workspace"));
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Client</div>
          <div className="text-sm text-muted-foreground">Client ID: <span className="font-mono">{clientId}</span></div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/clients/new">New Client</Link>
          </Button>
          <Button onClick={() => setTrustDialogOpen(true)} disabled={status !== "loaded" || !client}>
            Create Trust
          </Button>
        </div>
      </div>

      {showCreatedBanner ? (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{UI_COPY.clientOnboardingSaved}</AlertDescription>
        </Alert>
      ) : null}

      {status === "loading" ? <div className="text-sm text-muted-foreground">Loading…</div> : null}
      {status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load client</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {client ? (
        <>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Client Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Name</div>
                  <div className="font-medium">{fullName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div className="font-medium">{client.email}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Phone</div>
                  <div className="font-medium">{client.phone || "—"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Address</div>
                  <div className="font-medium">
                    {client.address.line1}
                    {client.address.line2 ? `, ${client.address.line2}` : ""}
                    <br />
                    {client.address.city}, {client.address.state} {client.address.postalCode} • {client.address.country}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Trust Workspaces</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {trusts.length === 0 ? (
                <div className="rounded-2xl border p-4 text-sm text-muted-foreground">No trusts yet.</div>
              ) : (
                trusts.map((t) => (
                  <div key={t.id} className="rounded-2xl border p-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{t.name || "Untitled Trust"}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.trustType || "—"} • {t.jurisdictionState || "—"} • {t.workspaceStatus || "draft"}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/trusts/${encodeURIComponent(t.id)}`}>Open</Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={trustDialogOpen} onOpenChange={setTrustDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Trust Workspace</DialogTitle>
            <DialogDescription>
              We’re now creating a draft revocable living trust under your state’s default rules. This workspace lets us tailor trustees,
              beneficiaries, and funding instructions before anything is executed.
            </DialogDescription>
          </DialogHeader>

          {createErr ? (
            <Alert variant="destructive">
              <AlertTitle>Could not create trust</AlertTitle>
              <AlertDescription>{createErr}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Trust Type</Label>
              <Select value={trustType} onValueChange={setTrustType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trust type" />
                </SelectTrigger>
                <SelectContent>
                  {TRUST_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>State / Jurisdiction</Label>
              <Select value={jurisdictionState} onValueChange={setJurisdictionState}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Trust Name</Label>
              <Input value={trustName} onChange={(e) => setTrustName(e.target.value)} />
            </div>
          </div>

          <Separator className="my-2" />

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setTrustDialogOpen(false)} disabled={createBusy}>
              Cancel
            </Button>
            <Button onClick={createTrustWorkspace} disabled={createBusy}>
              {createBusy ? "Creating…" : "Create Trust Workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


