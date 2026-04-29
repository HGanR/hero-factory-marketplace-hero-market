"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { InAppNotificationApiItem } from "@/lib/notifications/bentley-in-app-notification-api";

function formatRelativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const diffMs = Date.now() - t;
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return new Date(t).toLocaleString();
}

/**
 * Compact in-app notification dropdown (reviewer assignment + autonomous approval-related events).
 */
export function BentleyNotificationCenter() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<InAppNotificationApiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/notifications?limit=25", { credentials: "include" });
      const j = (await r.json().catch(() => ({}))) as { events?: InAppNotificationApiItem[] };
      if (r.ok && Array.isArray(j.events)) setEvents(j.events);
      else setEvents([]);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const unread = events.filter((e) => !e.readAt).length;

  const markRead = async (id: string) => {
    try {
      const r = await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; event?: InAppNotificationApiItem };
      if (r.ok && j.ok && j.event) {
        setEvents((prev) => prev.map((x) => (x.id === id ? j.event! : x)));
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative" ref={wrapRef} data-testid="bentley-notification-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative rounded-lg border border-slate-600/80 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-200",
          "hover:border-cyan-600/50 hover:text-cyan-100/90"
        )}
        aria-expanded={open}
        aria-haspopup="true"
        data-testid="bentley-notification-bell"
      >
        Notifications
        {unread > 0 ? (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-cyan-600 text-[9px] font-semibold text-white flex items-center justify-center"
            data-testid="bentley-notification-unread-badge"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-1 w-[min(100vw-2rem,20rem)] rounded-xl border border-slate-700/90 bg-slate-950 shadow-xl"
          data-testid="bentley-notification-dropdown"
        >
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 border-b border-slate-800">
            Recent
          </p>
          {loading ? (
            <p className="text-[11px] text-slate-500 px-3 py-4" data-testid="bentley-notification-loading">
              Loading…
            </p>
          ) : events.length === 0 ? (
            <p className="text-[11px] text-slate-500 px-3 py-4" data-testid="bentley-notification-empty">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {events.map((ev) => {
                const isUnread = !ev.readAt;
                return (
                  <li
                    key={ev.id}
                    className={cn(
                      "px-3 py-2 border-b border-slate-800/80 last:border-0",
                      isUnread ? "bg-slate-900/60" : "bg-transparent"
                    )}
                    data-testid={`bentley-notification-row-${ev.id}`}
                  >
                    <p
                      className={cn(
                        "text-[11px] leading-snug",
                        isUnread ? "text-slate-100" : "text-slate-400"
                      )}
                    >
                      {ev.message}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[9px] text-slate-500">{formatRelativeTime(ev.createdAt)}</span>
                      {ev.campaignId ? (
                        <span className="text-[9px] text-slate-600 font-mono truncate max-w-[8rem]">
                          {ev.campaignId.slice(0, 8)}…
                        </span>
                      ) : null}
                      {isUnread ? (
                        <button
                          type="button"
                          onClick={() => void markRead(ev.id)}
                          className="text-[9px] text-cyan-400/90 hover:text-cyan-300 underline underline-offset-2"
                          data-testid={`bentley-notification-mark-read-${ev.id}`}
                        >
                          Mark read
                        </button>
                      ) : (
                        <span className="text-[9px] text-slate-600">Read</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
