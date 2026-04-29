"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export function DeedsCard(props: { trustId: string }) {
  const { trustId } = props;
  const [stats, setStats] = useState({ draft: 0, executed: 0, recorded: 0 });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/assets/deeds?trustId=${trustId}`, { credentials: "include" });
        const data = await res.json();
        if (data.ok && data.items) {
          const items = data.items;
          setStats({
            draft: items.filter((d: any) => d.status === "draft").length,
            executed: items.filter((d: any) => d.status === "executed").length,
            recorded: items.filter((d: any) => d.status === "recorded").length,
          });
        }
      } catch (error) {
        console.error("Failed to load deed stats:", error);
      }
    })();
  }, [trustId]);

  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold">Deeds & Recording</div>
          <div className="text-sm text-muted-foreground">
            Prepare deed drafts, link governance approvals, and track execution/recording.
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/trust-records/${trustId}/assets/deeds/new`}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-muted"
          >
            Create deed
          </Link>
          <Link
            href={`/trust-records/${trustId}/assets/deeds`}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-muted"
          >
            View dashboard
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-muted-foreground">Draft</div>
          <div className="font-semibold">{stats.draft}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Awaiting execution</div>
          <div className="font-semibold">{stats.executed}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Recorded</div>
          <div className="font-semibold">{stats.recorded}</div>
        </div>
      </div>

      <div className="mt-4 text-xs text-muted-foreground">
        Recommended: approve a Real Property Transfer resolution before generating the deed PDF.
      </div>
    </div>
  );
}
