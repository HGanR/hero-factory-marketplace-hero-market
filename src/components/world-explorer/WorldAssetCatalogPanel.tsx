"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { transferTrooToTreasury } from "@/lib/troo-payment";

interface CatalogAsset {
  id: string;
  slug: string;
  name: string;
  category: string;
  tokenPrice: number;
  modelUrl?: string;
}

interface WorldAssetCatalogPanelProps {
  onAssetPurchased?: () => void;
}

export function WorldAssetCatalogPanel({ onAssetPurchased }: WorldAssetCatalogPanelProps) {
  const [catalog, setCatalog] = useState<CatalogAsset[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [ownedLoading, setOwnedLoading] = useState(true);
  const [catalogCategory, setCatalogCategory] = useState<string>("all");
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const { isConnected } = useAccount();

  useEffect(() => {
    setCatalogLoading(true);
    const url =
      catalogCategory === "all"
        ? "/api/world-assets"
        : `/api/world-assets?category=${encodeURIComponent(catalogCategory)}`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : { assets: [] }))
      .then((data) => setCatalog(data.assets ?? []))
      .finally(() => setCatalogLoading(false));
  }, [catalogCategory]);

  useEffect(() => {
    setOwnedLoading(true);
    fetch("/api/world-assets/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { assets: [] }))
      .then((data) => {
        const ids = new Set((data.assets ?? []).map((a: { id: string }) => a.id));
        setOwnedIds(ids);
      })
      .catch(() => setOwnedIds(new Set()))
      .finally(() => setOwnedLoading(false));
  }, [purchasing]); // refetch owned after purchase

  async function handlePurchase(assetId: string, tokenPrice: number) {
    if (purchasing) return;
    setPurchaseError(null);
    setPurchasing(assetId);
    try {
      let txRef: string | undefined;
      if (tokenPrice > 0) {
        if (!isConnected) {
          setPurchaseError("Connect your wallet to purchase with TROO.");
          return;
        }
        const payment = await transferTrooToTreasury(tokenPrice);
        txRef = payment.hash;
      }
      const res = await fetch(`/api/world-assets/${assetId}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ txRef }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setOwnedIds((prev) => new Set([...prev, assetId]));
        onAssetPurchased?.();
      } else {
        setPurchaseError(json.error || "Purchase failed");
      }
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <div
      style={{
        width: 320,
        maxHeight: 360,
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ fontWeight: 700, color: "#e0f4ff", marginBottom: 10, fontSize: 14 }}>
        📦 Asset Catalog
      </div>
      <p style={{ color: "rgba(224,244,255,0.7)", fontSize: 12, marginBottom: 10 }}>
        Buy buildings and meeting nodes. Use them in the world editor after creating a world.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {["all", "building", "venue", "meeting_node", "props"].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCatalogCategory(cat)}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              background: catalogCategory === cat ? "rgba(42,111,189,0.6)" : "rgba(20,40,80,0.5)",
              border: "1px solid rgba(42,111,189,0.4)",
              borderRadius: 6,
              color: "#a0d4ff",
              cursor: "pointer",
            }}
          >
            {cat === "all" ? "All" : cat.replace("_", " ")}
          </button>
        ))}
      </div>
      {catalog.some((a) => a.tokenPrice > 0) && !isConnected && (
        <div style={{ color: "#fbbf24", fontSize: 11, marginBottom: 8 }}>
          Connect wallet (top right) to buy with TROO.
        </div>
      )}
      {purchaseError && (
        <div style={{ color: "#f87171", fontSize: 11, marginBottom: 8 }}>{purchaseError}</div>
      )}
      {catalogLoading || ownedLoading ? (
        <div style={{ color: "rgba(224,244,255,0.5)", fontSize: 12 }}>Loading...</div>
      ) : catalog.length === 0 ? (
        <div style={{ color: "rgba(224,244,255,0.5)", fontSize: 12 }}>No assets in catalog</div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            overflowY: "auto",
            flex: 1,
            paddingRight: 4,
          }}
        >
          {catalog.map((a) => (
            <div
              key={a.id}
              style={{
                padding: "8px 10px",
                background: "rgba(20,40,80,0.5)",
                borderRadius: 8,
                fontSize: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ color: "#e0f4ff", fontWeight: 500 }}>{a.name}</span>
              {ownedIds.has(a.id) ? (
                <span style={{ color: "#10b981", fontSize: 11 }}>Owned</span>
              ) : (
                <button
                  onClick={() => handlePurchase(a.id, a.tokenPrice)}
                  disabled={purchasing === a.id || (a.tokenPrice > 0 && !isConnected)}
                  style={{
                    padding: "4px 12px",
                    background: "rgba(16,185,129,0.4)",
                    border: "1px solid #10b981",
                    borderRadius: 6,
                    color: "#6ee7b7",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: purchasing === a.id ? "wait" : "pointer",
                  }}
                >
                  {purchasing === a.id ? "..." : a.tokenPrice > 0 ? `Buy (${a.tokenPrice} TROO)` : "Get free"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
