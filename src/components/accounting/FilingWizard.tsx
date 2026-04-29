"use client";

import React, { useMemo, useState } from "react";
import { z } from "zod";

const OrderTypeSchema = z.enum(["FOREIGN_OWNED_SMLLC_5472", "PARTNERSHIP_1065"]);
type OrderType = z.infer<typeof OrderTypeSchema>;

type WizardState = {
  orderPublicId: string | null;
  orderType: OrderType | null;
  taxYear: number;
  // intake
  company: { legalName: string; ein: string; usAddress: string };
  owner: { isForeign: boolean; fullNameOrEntityName: string; country: string };
  partners: { name: string; country: string; ownershipPct: number }[];
  activity: { description: string };
  transactions: { hasReportableTransactions: boolean; details: string };
  ack: { noTaxAdvice: boolean; recordsKept: boolean };
};

const DEFAULT: WizardState = {
  orderPublicId: null,
  orderType: null,
  taxYear: 2025,
  company: { legalName: "", ein: "", usAddress: "" },
  owner: { isForeign: true, fullNameOrEntityName: "", country: "" },
  partners: [],
  activity: { description: "" },
  transactions: { hasReportableTransactions: false, details: "" },
  ack: { noTaxAdvice: false, recordsKept: false },
};

export function FilingWizard() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(DEFAULT);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const steps = useMemo(() => {
    const base = [
      { key: "package", title: "Package" },
      { key: "company", title: "Company Info" },
      { key: "owners", title: state.orderType === "PARTNERSHIP_1065" ? "Partners" : "Owner" },
      { key: "transactions", title: "Transactions / Activity" },
      { key: "review", title: "Review & Handoff" },
    ];
    return base;
  }, [state.orderType]);

  const priceLabel = useMemo(() => {
    if (state.orderType === "FOREIGN_OWNED_SMLLC_5472") return "$499 — Single-member LLC (foreign-owned)";
    if (state.orderType === "PARTNERSHIP_1065") return "$899 — Multi-member LLC (partnership)";
    return "Select a package";
  }, [state.orderType]);

  async function createOrder() {
    setErr(null);
    if (!state.orderType) return setErr("Select a package.");
    setBusy(true);
    try {
      const res = await fetch("/api/filings/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderType: state.orderType, taxYear: state.taxYear }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Failed to create order.");
      setState((s) => ({ ...s, orderPublicId: json.order.publicId }));
      setStep(1);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function autosave(nextState: WizardState) {
    if (!nextState.orderPublicId) return;
    const payload = {
      taxYear: nextState.taxYear,
      orderType: nextState.orderType,
      intake: {
        company: nextState.company,
        owner: nextState.owner,
        partners: nextState.partners,
        activity: nextState.activity,
        transactions: nextState.transactions,
        acknowledgements: nextState.ack,
      },
    };

    await fetch(`/api/filings/orders/${encodeURIComponent(nextState.orderPublicId)}/packets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload }),
    }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j?.error?.message || `Save failed (${r.status})`);
    });
  }

  async function next() {
    setErr(null);
    setBusy(true);
    try {
      await autosave(state);
      setStep((s) => Math.min(s + 1, steps.length - 1));
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function back() {
    setErr(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handoffToAgent() {
    setErr(null);
    if (!state.orderPublicId) return setErr("No order found.");
    if (!state.ack.noTaxAdvice || !state.ack.recordsKept) {
      return setErr("Confirm acknowledgements before handoff.");
    }
    setBusy(true);
    try {
      await autosave(state);
      const res = await fetch(`/api/filings/orders/${encodeURIComponent(state.orderPublicId)}/ready`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Handoff failed.");
      setErr(null);
      alert("Packet queued for filing agent review.");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  // --- Minimal UI (you can replace with shadcn components) ---
  return (
    <div style={{ maxWidth: 860 }}>
      <h2>2025 U.S. LLC Annual Compliance Filing (Foreign Founders)</h2>
      <p>
        This wizard collects required information and assembles a submission-ready packet for our filing agents.
        This is not tax advice.
      </p>

      <div style={{ margin: "12px 0", padding: 12, border: "1px solid #ddd" }}>
        <strong>Step {step + 1} of {steps.length}:</strong> {steps[step].title}
      </div>

      {err ? <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div> : null}

      {steps[step].key === "package" && (
        <div style={{ display: "grid", gap: 12 }}>
          <label>
            Tax year:
            <input
              type="number"
              value={state.taxYear}
              onChange={(e) => setState((s) => ({ ...s, taxYear: Number(e.target.value) }))}
              style={{ marginLeft: 8 }}
            />
          </label>

          <div style={{ display: "grid", gap: 8 }}>
            <label>
              <input
                type="radio"
                name="pkg"
                checked={state.orderType === "FOREIGN_OWNED_SMLLC_5472"}
                onChange={() => setState((s) => ({ ...s, orderType: "FOREIGN_OWNED_SMLLC_5472" }))}
              />
              {" "} $499 — Foreign-owned single-member LLC (Form 5472 + pro forma 1120 packet)
            </label>

            <label>
              <input
                type="radio"
                name="pkg"
                checked={state.orderType === "PARTNERSHIP_1065"}
                onChange={() => setState((s) => ({ ...s, orderType: "PARTNERSHIP_1065" }))}
              />
              {" "} $899 — Multi-member LLC partnership (Form 1065 packet)
            </label>
          </div>

          <div><strong>Selected:</strong> {priceLabel}</div>

          <button disabled={busy || !state.orderType} onClick={createOrder}>
            {busy ? "Creating..." : "Proceed to Intake"}
          </button>
        </div>
      )}

      {steps[step].key === "company" && (
        <div style={{ display: "grid", gap: 10 }}>
          <label>
            Legal LLC name:
            <input
              value={state.company.legalName}
              onChange={(e) => setState((s) => ({ ...s, company: { ...s.company, legalName: e.target.value } }))}
              style={{ marginLeft: 8, width: "100%" }}
            />
          </label>

          <label>
            EIN:
            <input
              value={state.company.ein}
              onChange={(e) => setState((s) => ({ ...s, company: { ...s.company, ein: e.target.value } }))}
              style={{ marginLeft: 8 }}
            />
          </label>

          <label>
            U.S. address (as used on filings):
            <input
              value={state.company.usAddress}
              onChange={(e) => setState((s) => ({ ...s, company: { ...s.company, usAddress: e.target.value } }))}
              style={{ marginLeft: 8, width: "100%" }}
            />
          </label>
        </div>
      )}

      {steps[step].key === "owners" && state.orderType === "FOREIGN_OWNED_SMLLC_5472" && (
        <div style={{ display: "grid", gap: 10 }}>
          <label>
            Owner name (person or entity):
            <input
              value={state.owner.fullNameOrEntityName}
              onChange={(e) => setState((s) => ({ ...s, owner: { ...s.owner, fullNameOrEntityName: e.target.value } }))}
              style={{ marginLeft: 8, width: "100%" }}
            />
          </label>

          <label>
            Owner country:
            <input
              value={state.owner.country}
              onChange={(e) => setState((s) => ({ ...s, owner: { ...s.owner, country: e.target.value } }))}
              style={{ marginLeft: 8 }}
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={state.owner.isForeign}
              onChange={(e) => setState((s) => ({ ...s, owner: { ...s.owner, isForeign: e.target.checked } }))}
            />
            {" "} Owner is non-U.S. person/entity
          </label>
        </div>
      )}

      {steps[step].key === "owners" && state.orderType === "PARTNERSHIP_1065" && (
        <div style={{ display: "grid", gap: 12 }}>
          <button
            type="button"
            onClick={() =>
              setState((s) => ({
                ...s,
                partners: [...s.partners, { name: "", country: "", ownershipPct: 50 }],
              }))
            }
          >
            + Add partner
          </button>

          {state.partners.map((p, idx) => (
            <div key={idx} style={{ border: "1px solid #ddd", padding: 10 }}>
              <label>
                Partner name:
                <input
                  value={p.name}
                  onChange={(e) =>
                    setState((s) => {
                      const next = [...s.partners];
                      next[idx] = { ...next[idx], name: e.target.value };
                      return { ...s, partners: next };
                    })
                  }
                  style={{ marginLeft: 8, width: "100%" }}
                />
              </label>
              <div style={{ height: 8 }} />
              <label>
                Country:
                <input
                  value={p.country}
                  onChange={(e) =>
                    setState((s) => {
                      const next = [...s.partners];
                      next[idx] = { ...next[idx], country: e.target.value };
                      return { ...s, partners: next };
                    })
                  }
                  style={{ marginLeft: 8 }}
                />
              </label>
              <div style={{ height: 8 }} />
              <label>
                Ownership %:
                <input
                  type="number"
                  value={p.ownershipPct}
                  onChange={(e) =>
                    setState((s) => {
                      const next = [...s.partners];
                      next[idx] = { ...next[idx], ownershipPct: Number(e.target.value) };
                      return { ...s, partners: next };
                    })
                  }
                  style={{ marginLeft: 8, width: 90 }}
                />
              </label>
              <div style={{ height: 8 }} />
              <button
                type="button"
                onClick={() =>
                  setState((s) => ({ ...s, partners: s.partners.filter((_, i) => i !== idx) }))
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {steps[step].key === "transactions" && (
        <div style={{ display: "grid", gap: 10 }}>
          {state.orderType === "FOREIGN_OWNED_SMLLC_5472" ? (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={state.transactions.hasReportableTransactions}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      transactions: { ...s.transactions, hasReportableTransactions: e.target.checked },
                    }))
                  }
                />
                {" "} Reportable related-party transactions occurred (loans, capital contributions, payments, etc.)
              </label>

              <label>
                Details (if yes):
                <textarea
                  value={state.transactions.details}
                  onChange={(e) =>
                    setState((s) => ({ ...s, transactions: { ...s.transactions, details: e.target.value } }))
                  }
                  style={{ width: "100%", minHeight: 90 }}
                />
              </label>
            </>
          ) : (
            <label>
              Business activity description:
              <textarea
                value={state.activity.description}
                onChange={(e) => setState((s) => ({ ...s, activity: { description: e.target.value } }))}
                style={{ width: "100%", minHeight: 90 }}
              />
            </label>
          )}
        </div>
      )}

      {steps[step].key === "review" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ padding: 12, border: "1px solid #ddd" }}>
            <strong>Order:</strong> {state.orderPublicId || "—"}<br />
            <strong>Type:</strong> {state.orderType}<br />
            <strong>Tax Year:</strong> {state.taxYear}<br />
          </div>

          <label>
            <input
              type="checkbox"
              checked={state.ack.noTaxAdvice}
              onChange={(e) => setState((s) => ({ ...s, ack: { ...s.ack, noTaxAdvice: e.target.checked } }))}
            />
            {" "} I understand this is a compliance-prep service and not tax advice.
          </label>

          <label>
            <input
              type="checkbox"
              checked={state.ack.recordsKept}
              onChange={(e) => setState((s) => ({ ...s, ack: { ...s.ack, recordsKept: e.target.checked } }))}
            />
            {" "} I confirm I will maintain supporting records for the information provided.
          </label>

          <button disabled={busy} onClick={handoffToAgent}>
            {busy ? "Submitting..." : "Queue for Filing Agent Review"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={back} disabled={busy || step === 0}>Back</button>
        {step > 0 && step < steps.length - 1 ? (
          <button onClick={next} disabled={busy}>Save & Next</button>
        ) : null}
      </div>
    </div>
  );
}


