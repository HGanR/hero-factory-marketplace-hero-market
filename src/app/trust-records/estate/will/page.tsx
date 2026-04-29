"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { IdentityStrip } from "@/components/IdentityStrip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseJarvaHandoff } from "@/lib/jarva/jarva-handoff";
import { cn } from "@/lib/utils";

const WillDraftSchema = z.object({
  testator: z.object({
    fullName: z.string().min(2),
    address: z.string().min(5),
  }),
  executor: z.object({
    fullName: z.string().min(2),
    relationship: z.string().optional(),
  }),
  guardianship: z.object({
    hasMinorChildren: z.boolean().default(false),
    guardianName: z.string().optional(),
  }),
  pourOver: z.object({
    enabled: z.boolean().default(true),
    trustName: z.string().optional(),
    trustPublicId: z.string().optional(),
  }),
  specialInstructions: z.string().optional(),
});

type WillDraft = z.infer<typeof WillDraftSchema>;

function WillWizardPageContent() {
  const searchParams = useSearchParams();
  const jarvaEstateEmphasis = useMemo(() => {
    const h = parseJarvaHandoff(new URLSearchParams(searchParams?.toString() ?? ""));
    return h?.lane === "trust_estate";
  }, [searchParams]);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WillDraft>({
    testator: { fullName: "", address: "" },
    executor: { fullName: "", relationship: "" },
    guardianship: { hasMinorChildren: false, guardianName: "" },
    pourOver: { enabled: true, trustName: "", trustPublicId: "" },
    specialInstructions: "",
  });

  const canCreate = useMemo(() => draft.testator.fullName.length > 1, [draft]);

  useEffect(() => {
    // no-op: you can prefill from active context or profile later
  }, []);

  async function createDraft() {
    const res = await fetch("/api/estate-instruments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "WILL",
        title: "Last Will and Testament (Draft)",
        jurisdiction: "NY", // replace with a state picker later
        payload: draft,
      }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error?.message ?? "Failed to create draft.");
    setPublicId(json.instrument.publicId);
  }

  async function saveVersion() {
    if (!publicId) return;
    const payload = WillDraftSchema.parse(draft);

    const res = await fetch(`/api/estate-instruments/${publicId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error?.message ?? "Failed to save.");
  }

  async function finalize() {
    if (!publicId) return;
    await saveVersion();
    const res = await fetch(`/api/estate-instruments/${publicId}/finalize`, {
      method: "POST",
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error?.message ?? "Failed to finalize.");
    // route to instrument view page later
    alert("Finalized.");
  }

  return (
    <div className="space-y-4">
      <IdentityStrip />

      <Card
        data-jarva-target="will_wizard_main"
        className={cn(
          jarvaEstateEmphasis && "ring-2 ring-violet-500/30 ring-offset-2 ring-offset-background",
        )}
      >
        <CardHeader>
          <CardTitle>Pour-Over Will / Last Will & Testament</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            This instrument is probate-based and is intended as a fallback to support your Trust plan (e.g., pour-over).
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Testator Full Name</div>
              <input
                className="w-full rounded-md border p-2"
                value={draft.testator.fullName}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, testator: { ...d.testator, fullName: e.target.value } }))
                }
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Testator Address</div>
              <input
                className="w-full rounded-md border p-2"
                value={draft.testator.address}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, testator: { ...d.testator, address: e.target.value } }))
                }
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Executor Full Name</div>
              <input
                className="w-full rounded-md border p-2"
                value={draft.executor.fullName}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, executor: { ...d.executor, fullName: e.target.value } }))
                }
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Executor Relationship (optional)</div>
              <input
                className="w-full rounded-md border p-2"
                value={draft.executor.relationship ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, executor: { ...d.executor, relationship: e.target.value } }))
                }
              />
            </div>
          </div>

          <div className="flex gap-2">
            {!publicId ? (
              <Button onClick={createDraft} disabled={!canCreate}>
                Create Draft
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={saveVersion}>
                  Save
                </Button>
                <Button onClick={finalize}>
                  Finalize
                </Button>
              </>
            )}
          </div>

          {publicId && (
            <div className="text-xs text-muted-foreground">
              Draft ID: {publicId}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function WillWizardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
          Loading will wizard…
        </div>
      }
    >
      <WillWizardPageContent />
    </Suspense>
  );
}