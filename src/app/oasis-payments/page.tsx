"use client";

import { useEffect, useState } from "react";
import Web3PaymentSystem, { type PaymentElement } from "@/components/oasis/Web3PaymentSystem";

type ElementRow = {
  id: number;
  name: string;
  description?: string | null;
  price?: string | null;
  currency?: string | null;
};

export default function OasisPaymentsPage() {
  const [element, setElement] = useState<PaymentElement | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/oasis/elements");
        const data = await res.json().catch(() => ({}));
        const first: ElementRow | undefined = Array.isArray(data?.elements) ? data.elements[0] : undefined;
        if (first) {
          setElement({
            id: String(first.id),
            name: first.name,
            description: first.description,
            priceEth: first.currency?.toUpperCase() === "ETH" ? String(first.price ?? "0") : "0.01",
          });
        } else {
          setElement({
            id: "demo",
            name: "Sample Oasis Element",
            description: "Demo payment element (configure pricing via admin).",
            priceEth: "0.01",
          });
        }
      } catch {
        setElement({
          id: "demo",
          name: "Sample Oasis Element",
          description: "Demo payment element (configure pricing via admin).",
          priceEth: "0.01",
        });
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-2xl font-semibold">OASIS Payments</div>
        <div className="text-sm text-slate-400 mt-2">
          Web3 payment demo for Oasis elements. Configure the contract with `NEXT_PUBLIC_OASIS_PAYMENT_CONTRACT`.
        </div>

        <div className="mt-6">
          {element ? (
            <Web3PaymentSystem element={element} />
          ) : (
            <div className="text-sm text-slate-300">Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}
