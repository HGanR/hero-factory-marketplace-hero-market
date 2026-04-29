"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { transferTrooToTreasury } from "@/lib/troo-payment";

export interface OwnedAsset {
  id: string;
  slug: string;
  name: string;
  category: string;
  modelUrl?: string;
  previewImageUrl?: string;
}

interface CatalogAsset {
  id: string;
  slug: string;
  name: string;
  category: string;
  tokenPrice: number;
  modelUrl?: string;
}

interface OwnedAssetLibraryProps {
  assets: OwnedAsset[];
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string | null) => void;
  loading?: boolean;
  onAssetPurchased?: () => void;
  /** When true, renders without absolute positioning (for nav dropdown) */
  embedded?: boolean;
}

export function OwnedAssetLibrary({
  assets,
  selectedAssetId,
  onSelectAsset,
  loading,
  onAssetPurchased,
  embedded,
}: OwnedAssetLibraryProps) {
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalog, setCatalog] = useState<CatalogAsset[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const { isConnected } = useAccount();

  const [catalogCategory, setCatalogCategory] = useState<string>("all");

  useEffect(() => {
    if (!showCatalog) return;
    setCatalogLoading(true);
    const url = catalogCategory === "all"
      ? "/api/world-assets"
      : `/api/world-assets?category=${encodeURIComponent(catalogCategory)}`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : { assets: [] }))
      .then((data) => setCatalog(data.assets ?? []))
      .finally(() => setCatalogLoading(false));
  }, [showCatalog, catalogCategory]);

  const ownedIds = new Set(assets.map((a) => a.id));

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
        onAssetPurchased?.();
        setShowCatalog(false);
      } else {
        setPurchaseError(json.error || "Purchase failed");
      }
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setPurchasing(null);
    }
  }

  const wrapperStyle: React.CSSProperties = embedded
    ? { width: 280, fontFamily: "system-ui, sans-serif" }
    : {
        position: "absolute",
        top: 60,
        left: 12,
        width: 200,
        maxHeight: "calc(100vh - 140px)",
        background: "rgba(10,20,40,0.92)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(42,111,189,0.5)",
        borderRadius: 12,
        padding: 12,
        overflowY: "auto",
        zIndex: 10,
        fontFamily: "system-ui, sans-serif",
      };

  return (
    <div style={wrapperStyle}>
      {!embedded && (
        <div style={{ fontWeight: 700, color: "#e0f4ff", marginBottom: 8, fontSize: 13 }}>
          📦 Owned Assets
        </div>
      )}
      {loading ? (
        <div style={{ color: "rgba(224,244,255,0.6)", fontSize: 12 }}>Loading...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onClick={() => setShowCatalog(!showCatalog)}
            style={{
              padding: "6px 10px",
              background: showCatalog ? "rgba(16,185,129,0.3)" : "rgba(42,111,189,0.2)",
              border: `1px solid ${showCatalog ? "#10b981" : "rgba(42,111,189,0.5)"}`,
              borderRadius: 6,
              color: showCatalog ? "#6ee7b7" : "#a0d4ff",
              fontSize: 11,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {showCatalog ? "▼ Hide catalog" : "Browse & buy assets"}
          </button>
          {purchaseError && (
            <div style={{ color: "#f87171", fontSize: 11, marginBottom: 4 }}>{purchaseError}</div>
          )}
          {showCatalog && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                {["all", "building", "venue", "meeting_node", "props"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogCategory(cat)}
                    style={{
                      padding: "2px 6px",
                      fontSize: 10,
                      background: catalogCategory === cat ? "rgba(42,111,189,0.6)" : "rgba(20,40,80,0.5)",
                      border: "1px solid rgba(42,111,189,0.4)",
                      borderRadius: 4,
                      color: "#a0d4ff",
                      cursor: "pointer",
                    }}
                  >
                    {cat === "all" ? "All" : cat.replace("_", " ")}
                  </button>
                ))}
              </div>
              {catalog.some((a) => a.tokenPrice > 0) && !isConnected && (
                <div style={{ color: "#fbbf24", fontSize: 11, marginBottom: 4 }}>
                  Connect wallet (top right) to buy with TROO.
                </div>
              )}
              {catalogLoading ? (
                <div style={{ color: "rgba(224,244,255,0.5)", fontSize: 11 }}>Loading...</div>
              ) : catalog.length === 0 ? (
                <div style={{ color: "rgba(224,244,255,0.5)", fontSize: 11 }}>No assets in catalog</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
                  {catalog.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: "6px 8px",
                        background: "rgba(20,40,80,0.5)",
                        borderRadius: 6,
                        fontSize: 11,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#e0f4ff" }}>{a.name}</span>
                      {ownedIds.has(a.id) ? (
                        <span style={{ color: "#10b981", fontSize: 10 }}>Owned</span>
                      ) : (
                        <button
                          onClick={() => handlePurchase(a.id, a.tokenPrice)}
                          disabled={purchasing === a.id || (a.tokenPrice > 0 && !isConnected)}
                          style={{
                            padding: "2px 8px",
                            background: "rgba(16,185,129,0.4)",
                            border: "1px solid #10b981",
                            borderRadius: 4,
                            color: "#6ee7b7",
                            fontSize: 10,
                            cursor: purchasing === a.id ? "wait" : "pointer",
                          }}
                        >
                          {purchasing === a.id ? "..." : a.tokenPrice > 0 ? `Buy (${a.tokenPrice})` : "Get free"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => onSelectAsset(null)}
            style={{
              padding: "6px 10px",
              background: selectedAssetId ? "rgba(42,111,189,0.2)" : "rgba(42,111,189,0.5)",
              border: "1px solid rgba(42,111,189,0.5)",
              borderRadius: 6,
              color: "#a0d4ff",
              fontSize: 11,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            None (deselect)
          </button>
          {assets.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelectAsset(a.id)}
              style={{
                padding: "8px 10px",
                background: selectedAssetId === a.id ? "rgba(42,111,189,0.5)" : "rgba(20,40,80,0.6)",
                border: `1px solid ${selectedAssetId === a.id ? "#5a9fd4" : "rgba(42,111,189,0.3)"}`,
                borderRadius: 8,
                color: "#e0f4ff",
                fontSize: 12,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  background: "#2a6fbd",
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 600 }}>{a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
