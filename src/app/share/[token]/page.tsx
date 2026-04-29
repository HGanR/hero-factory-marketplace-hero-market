"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function ShareTokenPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const token = String(params.token || "");
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("loading");
      setErr(null);
      try {
        const res = await fetch(`/api/disclosures/${encodeURIComponent(token)}`);
        if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
        const j = await res.json();
        if (cancelled) return;
        setData(j);
        setStatus("loaded");
      } catch (e: any) {
        if (cancelled) return;
        setErr(String(e?.message || e || "Failed"));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function downloadJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disclosure-${token.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Disclosure Package</div>
          <div className="text-sm text-muted-foreground">Token: <span className="font-mono">{token}</span></div>
        </div>
        <Button variant="outline" onClick={() => router.push("/")}>Home</Button>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Package</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" ? <div className="text-sm text-muted-foreground">Loading…</div> : null}
          {status === "error" ? <div className="text-sm text-red-400">{err}</div> : null}

          {status === "loaded" ? (
            <>
              <div className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{data?.document?.title || "Document"}</div>
                    <div className="text-xs text-muted-foreground">{data?.document?.docType || "—"}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {data?.document?.classification ? <Badge variant="outline">{String(data.document.classification)}</Badge> : null}
                    {data?.document?.proofState ? <Badge variant="secondary">{String(data.document.proofState)}</Badge> : null}
                  </div>
                </div>

                {data?.document?.hash ? (
                  <>
                    <Separator className="my-3" />
                    <div className="text-xs text-muted-foreground">
                      Hash: <span className="font-mono break-all">{String(data.document.hash)}</span>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">Verification</div>
                <div className="mt-1">{String(data?.verification?.instructions || "")}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={downloadJson}>Download disclosure JSON</Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}




