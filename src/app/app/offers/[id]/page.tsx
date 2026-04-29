"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

type Assets = {
  vslScript?: string | null;
  landingCopy?: string | null;
  adAngles?: string | null;
  emailSeq?: string | null;
  callScript?: string | null;
  version?: number;
};

export default function OfferDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [offer, setOffer] = useState<Offer | null>(null);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"offer" | "vsl" | "landing" | "ads" | "email" | "call">("offer");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/app/offers/${id}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/app/offers/${id}/assets`, { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([a, b]) => {
        setOffer(a?.offer ?? null);
        setAssets(b?.assets ?? null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function generateAssets() {
    if (!id) return;
    setGenerating(true);
    try {
      const r = await fetch(`/api/app/offers/${id}/generate-assets`, { method: "POST", credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (j?.assets) setAssets(j.assets);
    } finally {
      setGenerating(false);
    }
  }

  if (loading || !offer) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-white/60">Loading…</div>
      </div>
    );
  }

  const tabs = [
    { id: "offer" as const, label: "Offer" },
    { id: "vsl" as const, label: "VSL" },
    { id: "landing" as const, label: "Landing" },
    { id: "ads" as const, label: "Ads" },
    { id: "email" as const, label: "Email Seq" },
    { id: "call" as const, label: "Call Script" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-cyan-500 blur-[90px]" />
        <div className="absolute top-40 -right-24 h-96 w-96 rounded-full bg-orange-500 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-[900px] px-4 py-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-white/50">
          <Link href="/app/offers" className="hover:text-white">Offers</Link>
          <span>/</span>
          <span>{offer.name}</span>
        </div>

        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{offer.name}</h1>
            <Link
              href={`/app/offers/${id}/edit`}
              className="rounded-xl border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5"
            >
              Edit
            </Link>
          </div>
          <button
            onClick={generateAssets}
            disabled={generating}
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate Assets"}
          </button>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`rounded-xl px-3 py-2 text-sm whitespace-nowrap ${
                activeTab === t.id ? "bg-cyan-500/30 border border-cyan-400/50" : "border border-white/10 bg-black/20"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          {activeTab === "offer" && (
            <div className="space-y-4 text-sm">
              <div><span className="text-white/50">Price:</span> {offer.priceRange || "—"}</div>
              <div><span className="text-white/50">Promise:</span><p className="mt-1">{offer.promise || "—"}</p></div>
              <div><span className="text-white/50">ICP:</span><p className="mt-1">{offer.icp || "—"}</p></div>
              <div><span className="text-white/50">Deliverables:</span><p className="mt-1">{offer.deliverables || "—"}</p></div>
              <div><span className="text-white/50">Guarantee:</span><p className="mt-1">{offer.guarantee || "—"}</p></div>
              <div><span className="text-white/50">Proof:</span><p className="mt-1">{offer.proof || "—"}</p></div>
            </div>
          )}
          {activeTab === "vsl" && (
            <pre className="whitespace-pre-wrap text-sm font-mono max-h-[60vh] overflow-auto">{assets?.vslScript || "No VSL yet. Click Generate Assets."}</pre>
          )}
          {activeTab === "landing" && (
            <pre className="whitespace-pre-wrap text-sm font-mono max-h-[60vh] overflow-auto">{assets?.landingCopy || "No landing copy yet. Click Generate Assets."}</pre>
          )}
          {activeTab === "ads" && (
            <pre className="whitespace-pre-wrap text-sm font-mono max-h-[60vh] overflow-auto">{assets?.adAngles || "No ad angles yet. Click Generate Assets."}</pre>
          )}
          {activeTab === "email" && (
            <pre className="whitespace-pre-wrap text-sm font-mono max-h-[60vh] overflow-auto">{assets?.emailSeq || "No email sequence yet. Click Generate Assets."}</pre>
          )}
          {activeTab === "call" && (
            <pre className="whitespace-pre-wrap text-sm font-mono max-h-[60vh] overflow-auto">{assets?.callScript || "No call script yet. Click Generate Assets."}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
