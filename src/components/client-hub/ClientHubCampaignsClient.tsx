"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ClientStatusBadge } from "./ClientStatusBadge";
import { ClientPrimaryActionBar } from "./ClientPrimaryActionBar";
import type { ClientCampaignListItem } from "@/lib/revenue-os/client-hub-types";

type Props = {
  clientId: string;
  initialItems: ClientCampaignListItem[];
};

async function j<T>(r: Response): Promise<T> {
  const t = await r.text();
  try {
    return JSON.parse(t) as T;
  } catch {
    throw new Error(t || "Invalid JSON");
  }
}

export function ClientHubCampaignsClient({ clientId, initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [busyCreate, setBusyCreate] = useState(false);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/revenue-os/clients/${encodeURIComponent(clientId)}/campaigns`);
    if (!r.ok) {
      toast.error("Could not refresh the campaign list");
      return;
    }
    const d = (await r.json()) as { campaigns: ClientCampaignListItem[] };
    setItems(d.campaigns);
  }, [clientId]);

  const create = useCallback(async () => {
    const name = window.prompt("Campaign name?");
    if (!name?.trim()) return;
    setBusyCreate(true);
    try {
      const r = await fetch(`/api/revenue-os/clients/${encodeURIComponent(clientId)}/campaigns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const d = (await j<{ id?: string; error?: string }>(r)) as { id?: string; error?: string };
      if (!r.ok) {
        toast.error(d.error || "Create failed");
        return;
      }
      toast.success("Campaign created for this client");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusyCreate(false);
    }
  }, [clientId, refresh]);

  const run = useCallback(
    async (cmpId: string, op: "launch" | "sync" | "promote") => {
      setWorkingId(cmpId);
      try {
        const base = `/api/revenue-os/clients/${encodeURIComponent(clientId)}/campaigns/${encodeURIComponent(cmpId)}`;
        if (op === "launch") {
          const r = await fetch(`${base}/launch`, { method: "POST" });
          const d = (await r.json().catch(() => ({}))) as { error?: string; state?: string };
          if (!r.ok) {
            toast.error(d.error || "Launch failed");
            return;
          }
          toast.success(d.state === "already" ? "Already live" : "Campaign set to LIVE");
        } else if (op === "sync") {
          const r = await fetch(`${base}/sync-analytics`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });
          const d = (await r.json().catch(() => ({}))) as { error?: string; attemptedCount?: number; succeededCount?: number };
          if (!r.ok) {
            toast.error(d.error || "Sync failed");
            return;
          }
          toast.success(
            `Analytics refresh: ${d.succeededCount ?? 0} ok / ${d.attemptedCount ?? 0} attempted`
          );
        } else {
          const r = await fetch(`${base}/promote-post`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });
          const d = (await r.json().catch(() => ({}))) as {
            error?: string;
            message?: string;
            existingName?: string;
          };
          if (r.status === 409) {
            toast.info(
              d.existingName
                ? `A paid draft already exists: ${d.existingName}`
                : d.message || "Paid draft may already exist for a post",
            );
            return;
          }
          if (!r.ok) {
            toast.error(d.message || d.error || "Promote failed");
            return;
          }
          toast.success("Paid promotion draft created (if supported by the account)");
        }
        await refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Request failed");
      } finally {
        setWorkingId(null);
      }
    },
    [clientId, refresh],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busyCreate}
          onClick={() => void create()}
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 hover:border-cyan-400/50 disabled:opacity-50"
        >
          {busyCreate ? "Creating…" : "Create campaign for this client"}
        </button>
        <Link
          className="text-xs text-cyan-400/90 hover:underline"
          href={`/revenue-os/dashboard?clientId=${encodeURIComponent(clientId)}#campaign-launch`}
          target="_blank"
          rel="noreferrer"
        >
          Open Revenue OS campaign workspace →
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-slate-900/60 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Platform</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Posts</th>
              <th className="px-3 py-2">Posted</th>
              <th className="px-3 py-2">Last sync</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No client-scoped campaigns yet — create one or backfill <code className="text-cyan-300/90">clientId</code> on
                  existing rows.
                </td>
              </tr>
            ) : null}
            {items.map((c) => (
              <tr key={c.id} className="border-t border-white/5">
                <td className="px-3 py-2 font-medium text-slate-100">{c.name}</td>
                <td className="px-3 py-2 text-slate-400">{c.platform}</td>
                <td className="px-3 py-2">
                  <ClientStatusBadge status={c.status} />
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-300">{c.postsCount}</td>
                <td className="px-3 py-2 tabular-nums text-slate-300">{c.postedCount}</td>
                <td className="px-3 py-2 text-slate-500">
                  {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  <div className="space-y-2">
                    <ClientPrimaryActionBar>
                      <button
                        type="button"
                        disabled={workingId === c.id}
                        onClick={() => void run(c.id, "launch")}
                        className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-slate-200"
                      >
                        {workingId === c.id ? "…" : "Launch"}
                      </button>
                      <Link
                        className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-cyan-300/90 hover:border-cyan-500/30"
                        href={`/revenue-os/dashboard?clientId=${encodeURIComponent(clientId)}#campaign-launch`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View posts
                      </Link>
                      <button
                        type="button"
                        disabled={workingId === c.id}
                        onClick={() => void run(c.id, "sync")}
                        className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-slate-200"
                      >
                        Sync analytics
                      </button>
                      <button
                        type="button"
                        disabled={workingId === c.id || c.postedCount < 1}
                        title={c.postedCount < 1 ? "Need at least one published post" : "Create paid draft from a published post"}
                        onClick={() => void run(c.id, "promote")}
                        className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-slate-200 disabled:opacity-40"
                      >
                        Promote
                      </button>
                    </ClientPrimaryActionBar>
                    <code className="text-[10px] text-slate-600" title="Campaign id">
                      {c.id}
                    </code>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
