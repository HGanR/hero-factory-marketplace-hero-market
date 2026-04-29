"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type Offer = {
  id: string;
  name: string;
  priceRange?: string | null;
  status?: string | null;
  updatedAt?: string | null;
};

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/app/offers", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        setOffers(j.offers ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-cyan-500 blur-[90px]" />
        <div className="absolute top-40 -right-24 h-96 w-96 rounded-full bg-orange-500 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-[1200px] px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Offer Builder</h1>
            <p className="mt-1 text-sm text-white/60">
              High-ticket offer architect • 60-min flow • deployable assets
            </p>
          </div>
          <Link
            href="/app/offers/new"
            className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold hover:bg-cyan-500/15"
          >
            + New Offer
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-3 text-sm font-semibold">Your Offers</div>
          {loading ? (
            <div className="p-8 text-center text-white/50">Loading…</div>
          ) : offers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-white/60">No offers yet.</p>
              <Link
                href="/app/offers/new"
                className="mt-3 inline-block rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
              >
                Build your first offer
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {offers.map((o) => (
                <Link
                  key={o.id}
                  href={`/app/offers/${o.id}`}
                  className="block px-4 py-3 hover:bg-white/5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{o.name}</div>
                      <div className="text-xs text-white/50">
                        {o.priceRange || "No price"} • {(o.status ?? "draft").toUpperCase()}
                      </div>
                    </div>
                    <span className="text-cyan-400">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
