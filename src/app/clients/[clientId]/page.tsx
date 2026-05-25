"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import { ArrowLeft } from "lucide-react";
import { CLIENT_SERVICE_OPTIONS } from "@/lib/clients/clients-create-payload";

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
  existingEntityName?: string | null;
  logoUrl?: string | null;
  requestedServices?: string[];
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

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = String((params?.clientId as string) || "");

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

  const [servicesDraft, setServicesDraft] = useState<string[]>([]);
  const [servicesSaving, setServicesSaving] = useState(false);
  const [servicesSaveErr, setServicesSaveErr] = useState<string | null>(null);
  const servicesSectionRef = useRef<HTMLDivElement | null>(null);

  const showCreatedBanner = (searchParams?.get("created") ?? null) === "1";
  const openServicesSection = (searchParams?.get("services") ?? null) === "1";

  useEffect(() => {
    if (!clientId) {
      setError("Invalid client link.");
      setStatus("error");
      return;
    }
    let cancelled = false;
    (async () => {
      setStatus("loading");
      setError(null);
      try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}`, {
          credentials: "include",
        });
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
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/trusts`, {
          credentials: "include",
        });
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

  useEffect(() => {
    if (!client) return;
    setServicesDraft(Array.isArray(client.requestedServices) ? [...client.requestedServices] : []);
  }, [client]);

  useEffect(() => {
    if (!openServicesSection || status !== "loaded") return;
    const t = window.setTimeout(() => {
      servicesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [openServicesSection, status]);

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
          credentials: "include",
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

  async function saveRequestedServices() {
    if (!clientId) return;
    setServicesSaveErr(null);
    setServicesSaving(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requested_services: servicesDraft }),
      });
      const raw = await res.text().catch(() => "");
      if (!res.ok) {
        let msg = raw || `Failed (${res.status})`;
        try {
          const j = JSON.parse(raw) as { error?: string };
          if (typeof j?.error === "string" && j.error.trim()) msg = j.error.trim();
        } catch {
          /* */
        }
        throw new Error(msg);
      }
      let data: { requestedServices?: string[] } = {};
      try {
        data = raw ? (JSON.parse(raw) as { requestedServices?: string[] }) : {};
      } catch {
        data = {};
      }
      const next = Array.isArray(data.requestedServices) ? data.requestedServices : servicesDraft;
      setClient((prev) => (prev ? { ...prev, requestedServices: next } : null));
      setServicesDraft([...next]);
    } catch (e: unknown) {
      setServicesSaveErr(String((e as { message?: string })?.message || e || "Save failed"));
    } finally {
      setServicesSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="space-y-2">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to dashboard
        </Link>
        <p className="text-xs text-muted-foreground max-w-prose">
          Use the header workspace selector on the dashboard, then pick the trust linked to this client to update the
          micro terminal.
        </p>
      </div>
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
              {client.existingEntityName?.trim() || client.logoUrl?.trim() ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
                  {client.logoUrl?.trim() ? (
                    <div className="shrink-0">
                      <div className="text-sm text-muted-foreground mb-1.5">Business logo</div>
                      {/* eslint-disable-next-line @next/next/no-img-element -- data URL or user-uploaded URL from CRM */}
                      <img
                        src={client.logoUrl.trim()}
                        alt={client.existingEntityName?.trim() || "Client logo"}
                        className="h-20 w-auto max-w-[200px] rounded-lg border border-border bg-muted/30 object-contain p-1"
                      />
                    </div>
                  ) : null}
                  {client.existingEntityName?.trim() ? (
                    <div>
                      <div className="text-sm text-muted-foreground">Entity / business name</div>
                      <div className="font-medium">{client.existingEntityName.trim()}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}
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

          <div ref={servicesSectionRef} id="client-requested-services">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Requested services</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Toggle each service (multi-select). Updates sync to the dashboard Micro Terminal for this client.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Requested services">
                  {CLIENT_SERVICE_OPTIONS.map((label) => {
                    const selected = servicesDraft.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        role="checkbox"
                        aria-checked={selected}
                        onClick={() =>
                          setServicesDraft((prev) =>
                            prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          selected
                            ? "border-primary/70 bg-primary/10 text-foreground shadow-sm"
                            : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {servicesSaveErr ? (
                  <p className="text-sm text-destructive" role="alert">
                    {servicesSaveErr}
                  </p>
                ) : null}
                <Button type="button" onClick={() => void saveRequestedServices()} disabled={servicesSaving}>
                  {servicesSaving ? "Saving…" : "Save services"}
                </Button>
              </CardContent>
            </Card>
          </div>

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


