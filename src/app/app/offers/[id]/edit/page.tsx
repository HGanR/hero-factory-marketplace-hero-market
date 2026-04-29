"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Offer = {
  id: string;
  name: string;
  priceRange?: string | null;
  promise?: string | null;
  icp?: string | null;
  deliverables?: string | null;
  guarantee?: string | null;
  riskReversal?: string | null;
  positioning?: string | null;
  proof?: string | null;
  objections?: string | null;
  status?: string | null;
};

export default function OfferEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [form, setForm] = useState<Partial<Offer>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/app/offers/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        const o = j?.offer;
        if (o) {
          setForm({
            name: o.name ?? "",
            priceRange: o.priceRange ?? "",
            promise: o.promise ?? "",
            icp: o.icp ?? "",
            deliverables: o.deliverables ?? "",
            guarantee: o.guarantee ?? "",
            riskReversal: o.riskReversal ?? "",
            positioning: o.positioning ?? "",
            proof: o.proof ?? "",
            objections: o.objections ?? "",
            status: o.status ?? "draft",
          });
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/app/offers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (r.ok) router.push(`/app/offers/${id}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-white/60">Loading…</div>
      </div>
    );
  }

  const fields: { key: keyof Offer; label: string; multiline?: boolean }[] = [
    { key: "name", label: "Offer name" },
    { key: "priceRange", label: "Price range" },
    { key: "promise", label: "Promise", multiline: true },
    { key: "icp", label: "Ideal client profile", multiline: true },
    { key: "deliverables", label: "Deliverables", multiline: true },
    { key: "guarantee", label: "Guarantee", multiline: true },
    { key: "riskReversal", label: "Risk reversal", multiline: true },
    { key: "positioning", label: "Positioning", multiline: true },
    { key: "proof", label: "Proof", multiline: true },
    { key: "objections", label: "Objections", multiline: true },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-cyan-500 blur-[90px]" />
        <div className="absolute top-40 -right-24 h-96 w-96 rounded-full bg-orange-500 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-[700px] px-4 py-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-white/50">
          <Link href="/app/offers" className="hover:text-white">Offers</Link>
          <span>/</span>
          <Link href={`/app/offers/${id}`} className="hover:text-white">{form.name || "Offer"}</Link>
          <span>/</span>
          <span>Edit</span>
        </div>

        <h1 className="text-xl font-semibold mb-6">Edit Offer</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(({ key, label, multiline }) => (
            <div key={key}>
              <label className="block text-sm text-white/60 mb-1">{label}</label>
              {multiline ? (
                <textarea
                  value={(form[key] as string) ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/30 min-h-[80px]"
                  placeholder={label}
                />
              ) : (
                <input
                  type="text"
                  value={(form[key] as string) ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/30"
                  placeholder={label}
                />
              )}
            </div>
          ))}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <Link
              href={`/app/offers/${id}`}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/5"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
