"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UI_COPY } from "@/config/uiCopy";

type FormState = {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

function NewClientPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const origin = (searchParams?.get("origin") ?? null) as string | null;
  const returnToRaw = (searchParams?.get("returnTo") ?? null) as string | null;

  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "US",
  });
  const hydratedPrefill = useRef(false);

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
    if (!canSubmit || busy) return;
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            first_name: form.first_name.trim(),
            middle_name: form.middle_name.trim() || null,
            last_name: form.last_name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || null,
            address: {
              line1: form.address_line1.trim(),
              line2: form.address_line2.trim() || null,
              city: form.city.trim(),
              state: form.state.trim(),
              postal_code: form.postal_code.trim(),
              country: (form.country || "US").trim(),
            },
          }),
        });
        if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
        const data = await res.json();
        const clientId = String(data?.clientId || "");
        if (!clientId) throw new Error("Client creation succeeded but no clientId was returned");

        // Auto-add internal onboarding note (step 2C)
        const note =
          origin === "ecclesiastical"
            ? UI_COPY.ecclesiasticalInternalOnboardingNote
            : UI_COPY.defaultInternalOnboardingNote;
        await fetch(`/api/clients/${encodeURIComponent(clientId)}/notes`, {
          method: "POST",
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
      } catch (err: any) {
        setError(String(err?.message || err || "Failed to create client"));
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div>
        <div className="text-2xl font-semibold">New Client</div>
        <div className="text-sm text-muted-foreground">Create a client record to start onboarding.</div>
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
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || busy}>
            {busy ? "Creating…" : "Create Client"}
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

