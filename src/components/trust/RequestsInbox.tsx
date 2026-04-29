"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type RequestItem = {
  id: string;
  trustId: string;
  requestorRole: string;
  requestorEmail?: string | null;
  purpose: string;
  requestedDocumentIds: string[];
  status: "pending" | "approved" | "denied" | "more_info";
  createdAt?: string | null;
};

export function RequestsInbox({ trustId }: { trustId: string }) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/requests`);
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setErr(String(e?.message || e || "Failed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trustId]);

  async function decide(id: string, decision: "approve" | "deny" | "more_info") {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/requests/${encodeURIComponent(id)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
      await refresh();
    } catch (e: any) {
      setErr(String(e?.message || e || "Failed"));
    } finally {
      setBusyId(null);
    }
  }

  const pending = items.filter((i) => i.status === "pending");

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Sharing & Requests</span>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {err ? <div className="text-sm text-red-400 mb-3">{err}</div> : null}
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}

        {pending.length === 0 ? (
          <div className="rounded-2xl border p-4 text-sm text-muted-foreground">No pending requests.</div>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{r.requestorRole}</Badge>
                      <div className="font-semibold">Demandable request</div>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {r.requestorEmail ? `Email: ${r.requestorEmail} • ` : ""}
                      Requested docs: {r.requestedDocumentIds.length}
                    </div>
                    <Separator className="my-3" />
                    <div className="text-sm">
                      <div className="font-medium">Purpose</div>
                      <div className="mt-1 text-muted-foreground">{r.purpose}</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={() => decide(r.id, "approve")}
                      disabled={busyId === r.id}
                    >
                      {busyId === r.id ? "Working…" : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decide(r.id, "more_info")}
                      disabled={busyId === r.id}
                    >
                      More info
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => decide(r.id, "deny")}
                      disabled={busyId === r.id}
                    >
                      Deny
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}




