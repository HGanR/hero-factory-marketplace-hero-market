"use client";

import { useState } from "react";
import type { CommerceNode } from "./CommerceNodeLayer";

interface CommercePanelProps {
  node: CommerceNode | null;
  onClose: () => void;
}

export function CommercePanel({ node, onClose }: CommercePanelProps) {
  const [transacting, setTransacting] = useState(false);
  const [transactError, setTransactError] = useState<string | null>(null);

  if (!node) return null;

  async function handleTransact() {
    const amountToken = node!.priceToken ?? 0;
    const amountUSD = node!.priceUSD ?? 0;
    if (amountToken <= 0 && amountUSD <= 0) return;

    setTransacting(true);
    setTransactError(null);
    try {
      const res = await fetch(
        `/api/worlds/${node!.worldId}/commerce/${node!.id}/transact`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            amountToken: amountToken || undefined,
            amountUSD: amountUSD || undefined,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTransactError(json.error ?? "Transaction failed");
        return;
      }
      onClose();
    } catch {
      setTransactError("Network error");
    } finally {
      setTransacting(false);
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(400px, 90vw)",
        maxHeight: "80vh",
        background: "rgba(10,20,40,0.96)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(42,111,189,0.6)",
        borderRadius: 16,
        padding: 24,
        zIndex: 100,
        fontFamily: "system-ui, sans-serif",
        overflowY: "auto",
        boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "rgba(224,244,255,0.6)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            {node.nodeType.replace("_", " ")}
          </div>
          <h2 style={{ color: "#e0f4ff", fontSize: 20, fontWeight: 700, margin: 0 }}>
            {node.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            padding: "6px 12px",
            color: "#e0f4ff",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>

      {node.description && (
        <p style={{ color: "rgba(224,244,255,0.85)", fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
          {node.description}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, fontSize: 13, marginBottom: 20 }}>
        {node.priceToken != null && node.priceToken > 0 && (
          <span
            style={{
              background: "rgba(42,111,189,0.3)",
              padding: "6px 12px",
              borderRadius: 8,
              color: "#5a9fd4",
              fontWeight: 600,
            }}
          >
            {node.priceToken} tokens
          </span>
        )}
        {node.priceUSD != null && node.priceUSD > 0 && (
          <span
            style={{
              background: "rgba(16,185,129,0.2)",
              padding: "6px 12px",
              borderRadius: 8,
              color: "#10b981",
              fontWeight: 600,
            }}
          >
            ${node.priceUSD}
          </span>
        )}
      </div>

      {transactError && (
        <div style={{ color: "#f87171", fontSize: 13, marginBottom: 10 }}>
          {transactError}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(node.priceToken != null && node.priceToken > 0) ||
        (node.priceUSD != null && node.priceUSD > 0) ? (
          <button
            onClick={handleTransact}
            disabled={transacting}
            style={{
              background: "linear-gradient(135deg, #1a3a6b, #2a6fbd)",
              border: "1px solid rgba(42,111,189,0.5)",
              borderRadius: 10,
              padding: "12px 20px",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: transacting ? "wait" : "pointer",
              opacity: transacting ? 0.7 : 1,
            }}
          >
            {transacting
              ? "Processing..."
              : node.nodeType === "consultation" || node.nodeType === "npc_service"
                ? "Start Consultation"
                : node.nodeType === "store" || node.nodeType === "product_display"
                  ? "Purchase"
                  : node.nodeType === "event_space"
                    ? "Book Event"
                    : node.nodeType === "course"
                      ? "Enroll"
                      : "Proceed"}
          </button>
        ) : (
          <button
            style={{
              background: "linear-gradient(135deg, #1a3a6b, #2a6fbd)",
              border: "1px solid rgba(42,111,189,0.5)",
              borderRadius: 10,
              padding: "12px 20px",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "default",
            }}
          >
            {node.nodeType === "consultation" || node.nodeType === "npc_service"
              ? "Start Consultation"
              : node.nodeType === "store" || node.nodeType === "product_display"
                ? "View Products"
                : node.nodeType === "event_space"
                  ? "Book Event"
                  : node.nodeType === "course"
                    ? "Enroll"
                    : "Learn More"}
          </button>
        )}
        {node.agentId && (
          <div style={{ fontSize: 12, color: "rgba(224,244,255,0.6)" }}>
            AI Agent connected
          </div>
        )}
      </div>
    </div>
  );
}
