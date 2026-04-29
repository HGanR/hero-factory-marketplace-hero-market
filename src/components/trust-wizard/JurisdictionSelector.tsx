// components/trust-wizard/JurisdictionSelector.tsx
"use client";

import React from "react";

type Objective = "ASSET_PROTECTION" | "STATE_TAX_MINIMIZATION" | "DIGITAL_ASSET_FIDUCIARY_ACCESS";

type JurisdictionRow = {
  stateCode: string;
  stateName: string;
  tier: "TOP_TIER" | "ADVISORY_ONLY" | "RESTRICTED";
  eligible: boolean;
  ineligibleReason?: string;
  score: number;
  reasons: string[];

  daptLegislation: string;
  protectionStatute: string;
  rufadaaStatute?: string;
  residencyRequirement: string;
  stateTaxStatus: string;
  withdrawalProfile: string;
  notes?: string;
};

function tierLabel(tier: JurisdictionRow["tier"]) {
  if (tier === "TOP_TIER") return "Top Tier";
  if (tier === "ADVISORY_ONLY") return "Advisory Only";
  return "Restricted";
}

export function JurisdictionSelector(props: {
  selfSettled: boolean;
  hasDigitalAssets: boolean;
  objective: Objective;
  value?: string; // stateCode
  onChange: (stateCode: string) => void;
}) {
  const { selfSettled, hasDigitalAssets, objective, value, onChange } = props;

  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<JurisdictionRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          selfSettled: String(selfSettled),
          hasDigitalAssets: String(hasDigitalAssets),
          objective
        });

        const res = await fetch(`/api/jurisdictions/dapt?${qs.toString()}`, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error?.message || "Failed to load jurisdictions.");
        }
        if (!cancelled) setRows(json.rows as JurisdictionRow[]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [selfSettled, hasDigitalAssets, objective]);

  if (loading) return <div className="text-sm text-slate-400">Loading jurisdiction options…</div>;
  if (error) return <div className="text-sm text-red-400">{error}</div>;

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-300">
        Select a jurisdiction (situs) based on your trust profile. Options are ranked automatically.
      </div>

      <div className="space-y-2">
        {rows.map((r) => {
          const selected = value === r.stateCode;
          const disabled = !r.eligible;

          return (
            <button
              key={r.stateCode}
              type="button"
              disabled={disabled}
              onClick={() => onChange(r.stateCode)}
              className={[
                "w-full text-left rounded-xl border p-3 transition",
                selected ? "border-slate-200 bg-slate-900" : "border-slate-700 bg-slate-950",
                disabled ? "opacity-50 cursor-not-allowed" : "hover:border-slate-500"
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-slate-100">
                  {r.stateName} ({r.stateCode})
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs rounded-full border border-slate-600 px-2 py-0.5 text-slate-200">
                    {tierLabel(r.tier)}
                  </span>
                  <span className="text-xs text-slate-400">Score: {r.score}</span>
                </div>
              </div>

              {!r.eligible ? (
                <div className="mt-2 text-xs text-red-300">
                  {r.ineligibleReason?.replace(
                    "RUFADAA citation not present for this jurisdiction record",
                    "Our current dataset does not include a RUFADAA authority reference for this jurisdiction"
                  )}
                </div>
              ) : (
                <>
                  <div className="mt-2 text-xs text-slate-300">
                    <span className="text-slate-400">DAPT:</span> {r.daptLegislation} — {r.protectionStatute}
                  </div>

                  {r.rufadaaStatute ? (
                    <div className="mt-1 text-xs text-slate-300">
                      <span className="text-slate-400">RUFADAA:</span> {r.rufadaaStatute}
                    </div>
                  ) : null}

                  <div className="mt-1 text-xs text-slate-300">
                    <span className="text-slate-400">Nexus:</span> {r.residencyRequirement}
                  </div>

                  <div className="mt-1 text-xs text-slate-300">
                    <span className="text-slate-400">Tax:</span> {r.stateTaxStatus} •{" "}
                    <span className="text-slate-400">Withdrawal:</span> {r.withdrawalProfile}
                  </div>

                  {r.notes ? (
                    <div className="mt-1 text-xs text-slate-400">{r.notes}</div>
                  ) : null}

                  <div className="mt-2 text-xs text-slate-400">
                    <span className="text-slate-500">Why this is ranked here:</span>{" "}
                    {r.reasons.slice(0, 3).join(" • ")}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}