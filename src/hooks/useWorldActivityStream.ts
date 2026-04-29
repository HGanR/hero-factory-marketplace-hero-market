"use client";

import { useEffect, useState, useCallback } from "react";

export interface WorldActivityEvent {
  id: string;
  eventType: string;
  sourceModule: string;
  payload: Record<string, unknown>;
  trustId?: string;
  createdAt?: string;
}

export function useWorldActivityStream(worldId: string | null, enabled = true) {
  const [events, setEvents] = useState<WorldActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!worldId || !enabled) return;

    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/worlds/${worldId}/activity-stream`;
    const es = new EventSource(url, { withCredentials: true });

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as WorldActivityEvent;
        setEvents((prev) => [data, ...prev].slice(0, 50));
      } catch {
        // ignore parse errors
      }
    };

    es.onmessage = handler;

    const eventTypes = [
      "world_published",
      "commerce_node_created",
      "commerce_transaction",
      "app_published",
      "app_installed",
      "asset_purchased",
      "entity_created",
    ];
    for (const et of eventTypes) {
      es.addEventListener(et, handler as EventListener);
    }

    return () => {
      es.close();
      setConnected(false);
    };
  }, [worldId, enabled]);

  const clear = useCallback(() => setEvents([]), []);

  return { events, connected, clear };
}
