"use client";

import type { WorldActivityEvent } from "@/hooks/useWorldActivityStream";

const EVENT_LABELS: Record<string, string> = {
  commerce_transaction: "Service purchased",
  commerce_node_created: "Commerce node added",
  world_published: "World published",
  app_published: "App published",
  app_installed: "Template installed",
  asset_purchased: "Asset purchased",
  entity_created: "Business created",
};

function formatEvent(event: WorldActivityEvent): string {
  const label = EVENT_LABELS[event.eventType] ?? event.eventType;
  const payload = event.payload ?? {};
  if (event.eventType === "commerce_transaction" && payload.amountUSD) {
    return `${label} — $${((payload.amountUSD as number) / 100).toFixed(0)}`;
  }
  if (event.eventType === "commerce_node_created" && payload.title) {
    return `${label} — ${payload.title}`;
  }
  if (event.eventType === "world_published" && payload.worldName) {
    return `${label} — ${payload.worldName}`;
  }
  if (event.eventType === "app_installed" && payload.appSlug) {
    return `${label} — ${payload.appSlug}`;
  }
  return label;
}

interface ActivityFeedHUDProps {
  events: WorldActivityEvent[];
  connected: boolean;
  maxItems?: number;
  style?: React.CSSProperties;
}

export function ActivityFeedHUD({
  events,
  connected,
  maxItems = 8,
  style = {},
}: ActivityFeedHUDProps) {
  const display = events.slice(0, maxItems);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 48,
        left: 12,
        width: 220,
        maxHeight: 180,
        background: "rgba(5,15,35,0.9)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(78,205,196,0.5)",
        borderRadius: 12,
        padding: 10,
        overflowY: "auto",
        zIndex: 10,
        fontFamily: "system-ui, sans-serif",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
          fontSize: 11,
          color: connected ? "#4ecdc4" : "rgba(78,205,196,0.5)",
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: connected ? "#4ecdc4" : "rgba(78,205,196,0.5)",
            animation: connected ? "pulse 2s infinite" : "none",
          }}
        />
        Live Activity
      </div>
      {display.length === 0 ? (
        <div style={{ fontSize: 11, color: "rgba(224,244,255,0.4)" }}>
          Activity will appear here as it happens
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {display.map((e) => (
            <div
              key={e.id}
              style={{
                fontSize: 11,
                color: "#e0f4ff",
                padding: "4px 0",
                borderBottom: "1px solid rgba(78,205,196,0.15)",
              }}
            >
              {formatEvent(e)}
            </div>
          ))}
        </div>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
