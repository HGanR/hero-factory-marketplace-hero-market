"use client";

/* eslint-disable react-hooks/set-state-in-effect -- localStorage subscription and name fetch need effect-scoped resets */
import React, { useEffect, useState } from "react";
import {
  getSelectedClientId,
  subscribeToSelectedClientChange,
  SELECTED_CLIENT_STORAGE_KEY,
} from "@/lib/client-context/selected-client";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

type Props = {
  /** When provided, skips fetch for display name (caller supplies resolved name). */
  clientId?: string | null;
  clientName?: string | null;
  compact?: boolean;
};

/**
 * Shows the globally selected CRM client (`hf:selected-client-id`), resolving name via GET /api/clients/:id when needed.
 */
export function ActiveClientIndicator(props: Props) {
  const [id, setId] = useState<string | null>(() =>
    props.clientId != null ? (coerceTrimmedString(props.clientId) || null) : null,
  );
  const [name, setName] = useState<string | null>(() =>
    props.clientName != null ? coerceTrimmedString(props.clientName) || null : null,
  );

  useEffect(() => {
    if (props.clientId != null) {
      setId(coerceTrimmedString(props.clientId) || null);
      if (props.clientName != null) setName(coerceTrimmedString(props.clientName) || null);
      return;
    }
    const sync = () => setId(getSelectedClientId());
    sync();
    const unsub = subscribeToSelectedClientChange(() =>
      setId(getSelectedClientId()),
    );
    const onStorage = (e: StorageEvent) => {
      if (e.key === SELECTED_CLIENT_STORAGE_KEY || e.key === null) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [props.clientId, props.clientName]);

  useEffect(() => {
    if (props.clientName != null) return;
    const cid = coerceTrimmedString(id) || "";
    if (!cid) {
      setName(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/clients/${encodeURIComponent(cid)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { client?: Record<string, unknown> } | null) => {
        if (cancelled || !d?.client) return;
        const c = d.client;
        const person = [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ").trim();
        const entity =
          typeof c.existingEntityName === "string" && c.existingEntityName.trim()
            ? c.existingEntityName.trim()
            : "";
        setName(entity || person || null);
      })
      .catch(() => {
        if (!cancelled) setName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id, props.clientName]);

  const compact = props.compact ?? false;

  if (!id) {
    return (
      <div
        className={
          compact
            ? "rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95"
            : "rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50"
        }
        role="status"
      >
        No active client selected. Select a client from the dashboard.
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-50"
          : "rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50"
      }
      role="status"
    >
      <div className="font-semibold text-white">
        Active Client:{" "}
        <span className="font-normal text-cyan-100/95">{name ?? "—"}</span>
      </div>
      <div className={`font-mono text-slate-400 ${compact ? "mt-0.5 text-[10px]" : "mt-1 text-xs"}`}>
        Client ID: {id}
      </div>
    </div>
  );
}
