"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ResolutionPicker } from "./ResolutionPicker";
import { getTransferToolAvailability } from "@/lib/deeds/transfer-tools";

type Step = "PROPERTY" | "PARTIES" | "APPROVAL" | "PDF";

type DeedType = "QUITCLAIM" | "WARRANTY_GENERAL" | "WARRANTY_SPECIAL" | "GRANT" | "TRUST_TRANSFER" | "OTHER";
type DeedTool =
  | "TRUST_TRANSFER"
  | "QUITCLAIM"
  | "WARRANTY_GENERAL"
  | "WARRANTY_SPECIAL"
  | "GRANT"
  | "TOD_DEED"
  | "LADY_BIRD"
  | "OTHER";

const TOOL_LABELS: Record<DeedTool, string> = {
  TRUST_TRANSFER: "Transfer to Trust",
  QUITCLAIM: "Quitclaim Deed",
  WARRANTY_GENERAL: "Warranty Deed (General)",
  WARRANTY_SPECIAL: "Warranty Deed (Special)",
  GRANT: "Grant Deed",
  TOD_DEED: "Transfer on Death (TOD) Deed",
  LADY_BIRD: "Enhanced Life Estate (Lady Bird) Deed",
  OTHER: "Other / Custom",
};

const TOOL_TO_DEED_TYPE: Record<DeedTool, DeedType> = {
  TRUST_TRANSFER: "TRUST_TRANSFER",
  QUITCLAIM: "QUITCLAIM",
  WARRANTY_GENERAL: "WARRANTY_GENERAL",
  WARRANTY_SPECIAL: "WARRANTY_SPECIAL",
  GRANT: "GRANT",
  TOD_DEED: "OTHER",
  LADY_BIRD: "OTHER",
  OTHER: "OTHER",
};

export function NewDeedWizard(props: { trustId?: string; entityId?: string; clientId?: string }) {
  const { trustId, entityId, clientId: propClientId } = props;
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("PROPERTY");
  const [creating, setCreating] = useState(false);
  const [deedId, setDeedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Get clientId from context or prop
  const [clientId, setClientId] = useState<string | null>(propClientId || null);

  useEffect(() => {
    if (!propClientId) {
      // Try to get from API
      fetch("/api/clients/me", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          if (data?.clientId) setClientId(data.clientId);
        })
        .catch(() => {});
    }
  }, [propClientId]);

  // Deed basics
  const [tool, setTool] = useState<DeedTool>("TRUST_TRANSFER");
  const deedType = TOOL_TO_DEED_TYPE[tool];
  const [lastSavedDeedType, setLastSavedDeedType] = useState<DeedType | null>(null);

  // Property
  const [property, setProperty] = useState({
    street1: "",
    city: "",
    state: "",
    postalCode: "",
    county: "",
    parcelNumber: "",
    legalDescription: "",
  });

  // Parties
  const [grantor, setGrantor] = useState({ displayName: "", address: "", capacityLine: "" });
  const [grantee, setGrantee] = useState({ displayName: "", address: "", capacityLine: "" });

  // Approval
  const [approvingResolutionId, setApprovingResolutionId] = useState<string | null>(null);

  // PDF result
  const [draftPdfExhibitId, setDraftPdfExhibitId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [hasMortgage, setHasMortgage] = useState(false);
  const [hasTitlePolicy, setHasTitlePolicy] = useState(false);
  const [hasHomestead, setHasHomestead] = useState(false);
  const [medicaidPlanning, setMedicaidPlanning] = useState(false);

  const availability = useMemo(() => getTransferToolAvailability(property.state), [property.state]);
  const toolBlocked =
    (tool === "LADY_BIRD" && !availability.ladyBirdAvailable) ||
    (tool === "TOD_DEED" && !availability.todAvailable);
  const citations = availability.rules;

  useEffect(() => {
    const toolParam = (searchParams?.get("tool") || "").toLowerCase();
    if (!toolParam) return;
    if (toolParam === "lady_bird") return setTool("LADY_BIRD");
    if (toolParam === "tod_deed" || toolParam === "tod") return setTool("TOD_DEED");
    if (toolParam === "quitclaim") return setTool("QUITCLAIM");
    if (toolParam === "warranty_general") return setTool("WARRANTY_GENERAL");
    if (toolParam === "warranty_special") return setTool("WARRANTY_SPECIAL");
    if (toolParam === "grant") return setTool("GRANT");
    if (toolParam === "trust_transfer") return setTool("TRUST_TRANSFER");
  }, [searchParams]);

  useEffect(() => {
    if (!trustId && !entityId) return;
    if (!clientId) return;

    async function createDraft() {
      if (deedId || creating) return;
      setCreating(true);
      setErr(null);
      try {
        const res = await fetch("/api/assets/deeds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            clientId,
            trustId,
            entityId,
            deedType,
          }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data?.error?.message ?? "Failed to create deed.");
        setDeedId(data.deed.id);
        setLastSavedDeedType(deedType);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setCreating(false);
      }
    }

    createDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trustId, entityId, clientId, deedType]);

  useEffect(() => {
    if (!deedId || !lastSavedDeedType || deedType === lastSavedDeedType) return;
    (async () => {
      try {
        const res = await fetch(`/api/assets/deeds/${deedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ deedType }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data?.error?.message ?? "Failed to update deed type.");
        setLastSavedDeedType(deedType);
      } catch (e: any) {
        setErr(e.message);
      }
    })();
  }, [deedId, deedType, lastSavedDeedType]);

  async function saveProperty() {
    if (!deedId) return;
    setErr(null);
    try {
      if (toolBlocked) {
        throw new Error("Selected deed tool is not available in this state.");
      }
      const res = await fetch(`/api/assets/deeds/${deedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ property, deedType }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data?.error?.message ?? "Failed to save property.");
    } catch (e: any) {
      setErr(e.message);
      throw e;
    }
  }

  async function saveParties() {
    if (!deedId) return;
    setErr(null);
    try {
      const res = await fetch(`/api/assets/deeds/${deedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          parties: [
            { role: "GRANTOR", ...grantor },
            { role: "GRANTEE", ...grantee },
          ],
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data?.error?.message ?? "Failed to save parties.");
    } catch (e: any) {
      setErr(e.message);
      throw e;
    }
  }

  async function linkApproval() {
    if (!deedId || !approvingResolutionId) return;
    setErr(null);
    try {
      const res = await fetch(`/api/assets/deeds/${deedId}/link-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ approvingResolutionId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data?.error?.message ?? "Failed to link approval.");
    } catch (e: any) {
      setErr(e.message);
      throw e;
    }
  }

  async function generateDraftPdf() {
    if (!deedId) return;
    setGeneratingPdf(true);
    setErr(null);
    try {
      const res = await fetch(`/api/assets/deeds/${deedId}/generate-draft-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data?.error?.message ?? "Failed to generate PDF.");
      setDraftPdfExhibitId(data.draftPdfExhibitId);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setGeneratingPdf(false);
    }
  }

  if (creating || !deedId) {
    return <div className="rounded-2xl border p-4 text-sm text-muted-foreground">Creating deed draft...</div>;
  }

  if (!clientId) {
    return <div className="rounded-2xl border p-4 text-sm text-red-600">Client ID required. Please set active context.</div>;
  }

  return (
    <div className="space-y-4">
      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>}

      <div className="rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Wizard</div>
          <div className="text-xs text-muted-foreground">Deed ID: {deedId}</div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["PROPERTY", "PARTIES", "APPROVAL", "PDF"] as Step[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              className={`rounded-xl border px-3 py-1 text-sm ${step === s ? "bg-muted" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {step === "PROPERTY" && (
        <div className="rounded-2xl border p-4 space-y-3">
          <div className="text-sm font-semibold">Property</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Transfer Tool</div>
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={tool}
                onChange={(e) => setTool(e.target.value as DeedTool)}
              >
                <option value="TRUST_TRANSFER">{TOOL_LABELS.TRUST_TRANSFER}</option>
                <option value="QUITCLAIM">{TOOL_LABELS.QUITCLAIM}</option>
                <option value="WARRANTY_GENERAL">{TOOL_LABELS.WARRANTY_GENERAL}</option>
                <option value="WARRANTY_SPECIAL">{TOOL_LABELS.WARRANTY_SPECIAL}</option>
                <option value="GRANT">{TOOL_LABELS.GRANT}</option>
                <option value="TOD_DEED">{TOOL_LABELS.TOD_DEED}</option>
                <option value="LADY_BIRD">{TOOL_LABELS.LADY_BIRD}</option>
                <option value="OTHER">{TOOL_LABELS.OTHER}</option>
              </select>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">County</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={property.county}
                onChange={(e) => setProperty({ ...property, county: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <div className="text-xs text-muted-foreground">Street Address</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={property.street1}
                onChange={(e) => setProperty({ ...property, street1: e.target.value })}
              />
            </div>

            <div>
              <div className="text-xs text-muted-foreground">City</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={property.city}
                onChange={(e) => setProperty({ ...property, city: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">State</div>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={property.state}
                  onChange={(e) => setProperty({ ...property, state: e.target.value })}
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Postal Code</div>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={property.postalCode}
                  onChange={(e) => setProperty({ ...property, postalCode: e.target.value })}
                />
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Parcel / APN</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={property.parcelNumber}
                onChange={(e) => setProperty({ ...property, parcelNumber: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <div className="text-xs text-muted-foreground">Legal Description</div>
              <textarea
                className="w-full rounded-xl border px-3 py-2 text-sm min-h-32"
                value={property.legalDescription}
                onChange={(e) => setProperty({ ...property, legalDescription: e.target.value })}
              />
            </div>
          </div>

          {(tool === "LADY_BIRD" || tool === "TOD_DEED") && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {tool === "LADY_BIRD" && !availability.ladyBirdAvailable
                ? "Lady Bird deeds are not recognized in the selected state. Choose another tool."
                : tool === "TOD_DEED" && !availability.todAvailable
                  ? "TOD deeds are not recognized in the selected state. Choose another tool."
                  : "State gating passed for the selected tool. Confirm county recorder requirements before recording."}
            </div>
          )}

          {property.state && (tool === "LADY_BIRD" || tool === "TOD_DEED") && (
            <div className="rounded-xl border p-3 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">State references</div>
              <div className="mt-2 space-y-2">
                <div>
                  <div className="font-medium">Recorder directory</div>
                  {citations.recorderDirectoryUrl ? (
                    <a className="underline" href={citations.recorderDirectoryUrl} target="_blank" rel="noreferrer">
                      {citations.recorderDirectoryUrl}
                    </a>
                  ) : (
                    <div>No recorder directory on file.</div>
                  )}
                  {citations.recorderLinkPending ? (
                    <div className="text-[11px] text-muted-foreground">Recorder link pending for this state.</div>
                  ) : null}
                </div>
                {tool === "TOD_DEED" ? (
                  <div>
                    {citations.todDeed.citations.length > 0 ? (
                      <ul className="list-disc pl-4">
                        {citations.todDeed.citations.map((c) => (
                          <li key={c.url}>
                            <a className="underline" href={c.url} target="_blank" rel="noreferrer">
                              {c.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : citations.todDeed.citationsPending ? (
                      <div>Citation pending for this state. Verify local law.</div>
                    ) : (
                      <div>No citations on file. Verify local law.</div>
                    )}
                  </div>
                ) : (
                  <div>
                    {citations.ladyBirdDeed.citations.length > 0 ? (
                      <ul className="list-disc pl-4">
                        {citations.ladyBirdDeed.citations.map((c) => (
                          <li key={c.url}>
                            <a className="underline" href={c.url} target="_blank" rel="noreferrer">
                              {c.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : citations.ladyBirdDeed.citationsPending ? (
                      <div>Citation pending for this state. Verify local law.</div>
                    ) : (
                      <div>No citations on file. Verify local law.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-2 rounded-xl border p-3 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground">Title / lender checks</div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={hasMortgage} onChange={(e) => setHasMortgage(e.target.checked)} />
              Mortgage or deed of trust exists
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={hasTitlePolicy} onChange={(e) => setHasTitlePolicy(e.target.checked)} />
              Title policy or escrow instructions required
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={hasHomestead} onChange={(e) => setHasHomestead(e.target.checked)} />
              Homestead or property tax exemption in place
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={medicaidPlanning} onChange={(e) => setMedicaidPlanning(e.target.checked)} />
              Medicaid planning intent
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm"
              onClick={async () => {
                try {
                  await saveProperty();
                  setStep("PARTIES");
                } catch {
                  // error already set
                }
              }}
            >
              Save & Continue
            </button>
          </div>
        </div>
      )}

      {step === "PARTIES" && (
        <div className="rounded-2xl border p-4 space-y-4">
          <div className="text-sm font-semibold">Parties</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Grantor</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="Grantor name"
                value={grantor.displayName}
                onChange={(e) => setGrantor({ ...grantor, displayName: e.target.value })}
              />
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="Grantor address"
                value={grantor.address}
                onChange={(e) => setGrantor({ ...grantor, address: e.target.value })}
              />
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder='Capacity line (optional) e.g. "John Doe, Trustee of..."'
                value={grantor.capacityLine}
                onChange={(e) => setGrantor({ ...grantor, capacityLine: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Grantee</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="Grantee name"
                value={grantee.displayName}
                onChange={(e) => setGrantee({ ...grantee, displayName: e.target.value })}
              />
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="Grantee address"
                value={grantee.address}
                onChange={(e) => setGrantee({ ...grantee, address: e.target.value })}
              />
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder='Capacity line (recommended) e.g. "Jane Roe, Trustee of X Trust"'
                value={grantee.capacityLine}
                onChange={(e) => setGrantee({ ...grantee, capacityLine: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setStep("PROPERTY")}>
              Back
            </button>
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm"
              onClick={async () => {
                try {
                  await saveParties();
                  setStep("APPROVAL");
                } catch {
                  // error already set
                }
              }}
            >
              Save & Continue
            </button>
          </div>
        </div>
      )}

      {step === "APPROVAL" && (
        <div className="space-y-3">
          <ResolutionPicker
            trustId={trustId}
            entityId={entityId}
            value={approvingResolutionId}
            onChange={(id) => setApprovingResolutionId(id)}
          />

          <div className="flex gap-2">
            <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setStep("PARTIES")}>
              Back
            </button>
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm"
              disabled={!approvingResolutionId}
              onClick={async () => {
                try {
                  await linkApproval();
                  setStep("PDF");
                } catch {
                  // error already set
                }
              }}
            >
              Link Approval & Continue
            </button>
          </div>
        </div>
      )}

      {step === "PDF" && (
        <div className="rounded-2xl border p-4 space-y-3">
          <div className="text-sm font-semibold">Generate Draft PDF</div>
          <div className="text-sm text-muted-foreground">
            Draft PDF generation is blocked unless the approving resolution is approved and its minutes are approved/locked.
          </div>

          <div className="flex gap-2">
            <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setStep("APPROVAL")}>
              Back
            </button>
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm"
              disabled={generatingPdf}
              onClick={generateDraftPdf}
            >
              {generatingPdf ? "Generating..." : "Generate Draft PDF"}
            </button>
          </div>

          {draftPdfExhibitId && (
            <div className="text-sm">
              Draft PDF exhibit created: <span className="font-mono">{draftPdfExhibitId}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
