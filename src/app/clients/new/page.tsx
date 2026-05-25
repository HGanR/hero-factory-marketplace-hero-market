"use client";

import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UI_COPY } from "@/config/uiCopy";
import { CLIENT_SERVICE_OPTIONS } from "@/lib/clients/clients-create-payload";
import { setSelectedClientId } from "@/lib/client-context/selected-client";
import {
  CRM_ONLY_WORKSPACE_PREFIX,
  saveSmartTrustPlatformBinding,
} from "@/lib/smart-trust-platform-binding";

type FormState = {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  phone: string;
  /** Business / entity display name; creates a Client Hub `client_accounts` row when set (see `POST /api/revenue-os/clients` docs). */
  entity_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

const LOGO_MAX_BYTES = 1_200_000;

function NewClientPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const origin = (searchParams?.get("origin") ?? null) as string | null;
  const returnToRaw = (searchParams?.get("returnTo") ?? null) as string | null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessLogoDataUrl, setBusinessLogoDataUrl] = useState<string | null>(null);
  const [requestedServices, setRequestedServices] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    phone: "",
    entity_name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "US",
  });
  const hydratedPrefill = useRef(false);
  /** Synchronous guard so double-submit in one tick cannot fire two POSTs before React state updates. */
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (hydratedPrefill.current) return;
    hydratedPrefill.current = true;

    const first = (searchParams?.get("first_name") ?? "").trim();
    const last = (searchParams?.get("last_name") ?? "").trim();
    const email = (searchParams?.get("email") ?? "").trim();
    const phone = (searchParams?.get("phone") ?? "").trim();
    setForm((s) => ({
      ...s,
      first_name: first || s.first_name,
      last_name: last || s.last_name,
      email: email || s.email,
      phone: phone || s.phone,
    }));
  }, [searchParams]);

  const canSubmit = useMemo(() => {
    return (
      form.first_name.trim().length > 0 &&
      form.last_name.trim().length > 0 &&
      form.email.trim().length > 0 &&
      form.address_line1.trim().length > 0 &&
      form.city.trim().length > 0 &&
      form.state.trim().length > 0 &&
      form.postal_code.trim().length > 0
    );
  }, [form]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || isSubmitting || submitLockRef.current) return;
    submitLockRef.current = true;
    setError(null);
    setIsSubmitting(true);
    try {
      const phoneRaw = form.phone.trim();
      const phonePayload = phoneRaw.length >= 3 ? phoneRaw : null;

      const payload = {
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim() || null,
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: phonePayload,
        entity_name: form.entity_name.trim() || null,
        business_logo_data_url: businessLogoDataUrl,
        requested_services: requestedServices,
        address: {
          line1: form.address_line1.trim(),
          line2: form.address_line2.trim() || null,
          city: form.city.trim(),
          state: form.state.trim(),
          postal_code: form.postal_code.trim(),
          country: (form.country || "US").trim(),
        },
      };

      if (process.env.NEXT_PUBLIC_CLIENT_CREATE_DEBUG === "1") {
        const keys = [
          ...Object.keys(payload).filter((k) => k !== "address" && k !== "requested_services"),
          ...Object.keys(payload.address).map((k) => `address.${k}`),
          `requested_services (${requestedServices.length})`,
        ];
        console.info("[clients/new] POST /api/clients payload keys:", keys.join(", "));
      }

      const res = await fetch("/api/clients", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        let msg = t;
        try {
          const j = JSON.parse(t) as { error?: string };
          if (typeof j?.error === "string" && j.error.trim()) msg = j.error.trim();
        } catch {
          if (!msg) msg = `Failed (${res.status})`;
        }
        throw new Error(msg || `Failed (${res.status})`);
      }
      const data = await res.json();
      const clientId = String(data?.clientId || "");
      if (!clientId) throw new Error("Client creation succeeded but no clientId was returned");

      try {
        setSelectedClientId(clientId);
      } catch {
        /* ignore */
      }

      try {
        saveSmartTrustPlatformBinding({
          clientId,
          trustId: `${CRM_ONLY_WORKSPACE_PREFIX}${clientId}`,
        });
      } catch {
        /* ignore */
      }

      try {
        window.dispatchEvent(new Event("hf-clients-created"));
      } catch {
        /* ignore */
      }

      // Auto-add internal onboarding note (step 2C)
      const note =
        origin === "ecclesiastical"
          ? UI_COPY.ecclesiasticalInternalOnboardingNote
          : UI_COPY.defaultInternalOnboardingNote;
      await fetch(`/api/clients/${encodeURIComponent(clientId)}/notes`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visibility: "internal", note }),
      }).catch(() => {});

      const returnTo = (returnToRaw || "").trim();
      if (returnTo && returnTo.startsWith("/")) {
        const [pathOnly, existingQuery = ""] = returnTo.split("?");
        const sp = new URLSearchParams(existingQuery);
        sp.set("clientId", clientId);
        sp.set("createdClient", "1");
        if (origin) sp.set("origin", origin);
        router.push(`${pathOnly}?${sp.toString()}`);
      } else {
        router.push(`/clients/${encodeURIComponent(clientId)}?created=1`);
      }
    } catch (err: unknown) {
      setError(String((err as { message?: string })?.message || err || "Failed to create client"));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="space-y-3">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to dashboard
        </Link>
        <p className="text-xs text-muted-foreground max-w-prose">
          On the dashboard, open the <span className="font-medium text-foreground/90">workspace</span> selector in the
          header and pick the trust or client workspace tied to this person — the micro terminal will show their name
          and logo when a workspace with a bound client is selected.
        </p>
        <div>
          <div className="text-2xl font-semibold">New Client</div>
          <div className="text-sm text-muted-foreground">Create a client record to start onboarding.</div>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not create client</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Legal Name</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={form.first_name} onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Middle Name</Label>
                <Input value={form.middle_name} onChange={(e) => setForm((s) => ({ ...s, middle_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={form.last_name} onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Business / entity (optional)</CardTitle>
            <p className="text-sm text-muted-foreground">
              If provided, we also create a Client Hub record with this name and logo (aligned with{" "}
              <code className="text-xs">POST /api/revenue-os/clients</code>).
            </p>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="entity_name">Entity or business name</Label>
              <Input
                id="entity_name"
                value={form.entity_name}
                onChange={(e) => setForm((s) => ({ ...s, entity_name: e.target.value }))}
                placeholder="e.g. Acme Holdings LLC"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_logo">Business logo</Label>
              <Input
                id="business_logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="cursor-pointer"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) {
                    setBusinessLogoDataUrl(null);
                    return;
                  }
                  if (f.size > LOGO_MAX_BYTES) {
                    setError(`Logo is too large (max ~${Math.round(LOGO_MAX_BYTES / 1024)} KB).`);
                    setBusinessLogoDataUrl(null);
                    return;
                  }
                  setError(null);
                  const reader = new FileReader();
                  reader.onload = () => {
                    const s = typeof reader.result === "string" ? reader.result : null;
                    setBusinessLogoDataUrl(s);
                  };
                  reader.readAsDataURL(f);
                }}
              />
              {businessLogoDataUrl ? (
                <div className="flex items-center gap-3 pt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={businessLogoDataUrl}
                    alt="Logo preview"
                    className="h-14 w-14 rounded-md border object-contain bg-muted/40"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setBusinessLogoDataUrl(null)}>
                    Remove logo
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Requested Services</CardTitle>
            <p className="text-sm text-muted-foreground">
              Select the services this client is interested in. These will appear in the dashboard Micro Terminal.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Requested services">
              {CLIENT_SERVICE_OPTIONS.map((label) => {
                const selected = requestedServices.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      setRequestedServices((prev) =>
                        prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? "border-cyan-500/70 bg-cyan-500/15 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-cyan-500/35 hover:bg-muted/50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Optional — you can add or change services later.</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label>Address Line 1</Label>
              <Input value={form.address_line1} onChange={(e) => setForm((s) => ({ ...s, address_line1: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Address Line 2</Label>
              <Input value={form.address_line2} onChange={(e) => setForm((s) => ({ ...s, address_line2: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm((s) => ({ ...s, state: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Postal Code</Label>
                <Input value={form.postal_code} onChange={(e) => setForm((s) => ({ ...s, postal_code: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label>Country</Label>
                <Input value={form.country} onChange={(e) => setForm((s) => ({ ...s, country: e.target.value }))} />
              </div>
              <div className="sm:col-span-2" />
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const returnTo = (returnToRaw || "").trim();
              if (returnTo && returnTo.startsWith("/")) router.push(returnTo);
              else router.push("/dashboard");
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Creating…" : "Create Client"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewClientPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl p-6">Loading...</div>}>
      <NewClientPageInner />
    </Suspense>
  );
}

