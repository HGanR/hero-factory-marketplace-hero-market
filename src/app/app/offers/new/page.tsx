"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  { id: "basics", title: "Basics", fields: ["name", "priceRange"] },
  { id: "promise", title: "Promise & ICP", fields: ["promise", "icp"] },
  { id: "deliverables", title: "Deliverables & Guarantee", fields: ["deliverables", "guarantee", "riskReversal"] },
  { id: "proof", title: "Proof & Objections", fields: ["positioning", "proof", "objections"] },
  { id: "review", title: "Review & Generate", fields: [] },
];

export default function NewOfferPage() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [form, setForm] = useState({
    name: "",
    priceRange: "",
    promise: "",
    icp: "",
    deliverables: "",
    guarantee: "",
    riskReversal: "",
    positioning: "",
    proof: "",
    objections: "",
  });
  const [saving, setSaving] = useState(false);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [assets, setAssets] = useState<Record<string, string> | null>(null);

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  function updateField(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function saveAndNext() {
    if (stepIdx === 0) {
      setSaving(true);
      try {
        const r = await fetch("/api/app/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: form.name || "New Offer" }),
        });
        const j = await r.json().catch(() => ({}));
        if (j?.offer?.id) {
          setOfferId(j.offer.id);
          setStepIdx(1);
        }
      } finally {
        setSaving(false);
      }
    } else if (!isLast) {
      setSaving(true);
      try {
        if (offerId) {
          await fetch(`/api/app/offers/${offerId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(form),
          });
        }
        setStepIdx(stepIdx + 1);
      } finally {
        setSaving(false);
      }
    } else {
      setStepIdx(stepIdx + 1);
    }
  }

  async function generateAssets() {
    if (!offerId) return;
    setGenerating(true);
    try {
      await fetch(`/api/app/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const r = await fetch(`/api/app/offers/${offerId}/generate-assets`, {
        method: "POST",
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (j?.assets) setAssets(j.assets);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-cyan-500 blur-[90px]" />
        <div className="absolute top-40 -right-24 h-96 w-96 rounded-full bg-orange-500 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-[720px] px-4 py-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-white/50">
          <a href="/app/offers" className="hover:text-white">Offers</a>
          <span>/</span>
          <span>New</span>
        </div>

        <div className="mb-6 flex gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => i <= stepIdx && setStepIdx(i)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium ${
                i === stepIdx ? "bg-cyan-500/30 border border-cyan-400/50" : i < stepIdx ? "bg-white/10" : "bg-white/5 text-white/40"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold mb-4">{step?.title}</h2>

          {step?.id === "basics" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/60">Offer name</label>
                <input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  placeholder="e.g. 90-Day Trust Setup Intensive"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Price range</label>
                <input
                  value={form.priceRange}
                  onChange={(e) => updateField("priceRange", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  placeholder="e.g. $5,000 - $15,000"
                />
              </div>
            </div>
          )}

          {step?.id === "promise" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/60">Core promise</label>
                <textarea
                  value={form.promise}
                  onChange={(e) => updateField("promise", e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  placeholder="What transformation do you deliver?"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Ideal client profile (ICP)</label>
                <textarea
                  value={form.icp}
                  onChange={(e) => updateField("icp", e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  placeholder="Who is this for? Demographics, pain points, goals."
                />
              </div>
            </div>
          )}

          {step?.id === "deliverables" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/60">Deliverables</label>
                <textarea
                  value={form.deliverables}
                  onChange={(e) => updateField("deliverables", e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  placeholder="What they get (calls, templates, documents, etc.)"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Guarantee</label>
                <textarea
                  value={form.guarantee}
                  onChange={(e) => updateField("guarantee", e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  placeholder="e.g. 30-day money-back guarantee"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Risk reversal</label>
                <textarea
                  value={form.riskReversal}
                  onChange={(e) => updateField("riskReversal", e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  placeholder="Additional safety (pay in installments, etc.)"
                />
              </div>
            </div>
          )}

          {step?.id === "proof" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/60">Positioning</label>
                <textarea
                  value={form.positioning}
                  onChange={(e) => updateField("positioning", e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  placeholder="How you're positioned vs alternatives"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Proof (testimonials, results)</label>
                <textarea
                  value={form.proof}
                  onChange={(e) => updateField("proof", e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  placeholder="Social proof, case studies, before/after"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Objections to address</label>
                <textarea
                  value={form.objections}
                  onChange={(e) => updateField("objections", e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  placeholder="Price, timing, trust - how you handle them"
                />
              </div>
            </div>
          )}

          {step?.id === "review" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
                <div className="font-semibold">{form.name}</div>
                <div className="mt-1 text-white/60">{form.priceRange}</div>
                <div className="mt-2 text-xs text-white/50 line-clamp-2">{form.promise}</div>
              </div>
              <button
                type="button"
                onClick={generateAssets}
                disabled={generating || !offerId}
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
              >
                {generating ? "Generating…" : "Generate Assets"}
              </button>
              {assets && (
                <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-semibold text-cyan-400">Generated</div>
                  {assets.vslScript && (
                    <div>
                      <div className="text-xs text-white/50">VSL Script</div>
                      <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-xs">{assets.vslScript.slice(0, 400)}…</pre>
                    </div>
                  )}
                  {assets.landingCopy && (
                    <div>
                      <div className="text-xs text-white/50">Landing Copy</div>
                      <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-xs">{assets.landingCopy.slice(0, 400)}…</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex gap-2">
            {stepIdx > 0 && (
              <button
                type="button"
                onClick={() => setStepIdx(stepIdx - 1)}
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm hover:bg-white/5"
              >
                Back
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={saveAndNext}
                disabled={saving || (step?.id === "basics" && !form.name.trim())}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Next"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/app/offers")}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
