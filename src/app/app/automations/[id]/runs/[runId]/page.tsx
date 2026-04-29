"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, ExternalLink, RotateCcw, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STEP_LABELS, type StepType } from "@/lib/automations/types";

type Step = { stepId: string; type: string; config: Record<string, unknown>; status: string; result: Record<string, unknown> | null; executedAt: string | null };
type Run = { id: string; contactId: string | null; status: string; triggeredAt: string; completedAt: string | null; metadata: Record<string, unknown> };

export default function RunTracePage() {
  const params = useParams();
  const router = useRouter();
  const automationId = params?.id as string;
  const runId = params?.runId as string;
  const [run, setRun] = useState<Run | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null); // stepId or "replay"

  useEffect(() => {
    if (!automationId || !runId) return;
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/app/automations/${automationId}/runs/${runId}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed");
        const d = await res.json();
        if (active) {
          setRun(d.run);
          setSteps(d.steps ?? []);
        }
      } catch {
        toast.error("Failed to load run");
        if (active) router.push(`/app/automations/${automationId}`);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [automationId, runId, router]);

  async function handleRetry(stepId?: string) {
    const key = stepId ?? "replay";
    setRetrying(key);
    try {
      const res = await fetch(`/api/app/automations/${automationId}/runs/${runId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(stepId ? { stepId } : {}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Retry failed");
      toast.success(stepId ? "Step retried" : "Run replayed");
      const r2 = await fetch(`/api/app/automations/${automationId}/runs/${runId}`, { credentials: "include" });
      if (r2.ok) {
        const d2 = await r2.json();
        setRun(d2.run);
        setSteps(d2.steps ?? []);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setRetrying(null);
    }
  }

  if (loading || !run) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  const statusIcon = run.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : run.status === "failed" ? <XCircle className="h-4 w-4 text-red-400" /> : <Loader2 className="h-4 w-4 animate-spin text-white/50" />;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link
          href={`/app/automations/${automationId}`}
          className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Automation
        </Link>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Run trace</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-white/60">
              {statusIcon}
              {run.status} • {new Date(run.triggeredAt).toLocaleString()}
              {run.contactId && (
                <Link href={`/app/contacts/${run.contactId}`} className="ml-2 inline-flex items-center gap-0.5 text-cyan-400 hover:underline">
                  Contact <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
              disabled={retrying !== null}
              onClick={() => handleRetry()}
            >
              {retrying === "replay" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Replay run
            </Button>
          </div>
        </div>

        <Card className="mt-6 border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle>Execution timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400">
                  <span className="text-xs font-bold">T</span>
                </div>
                <div className="flex-1 pb-4">
                  <div className="font-medium text-white">Trigger fired</div>
                  <div className="text-xs text-white/50">{new Date(run.triggeredAt).toLocaleString()}</div>
                  {Object.keys(run.metadata ?? {}).length > 0 && (
                    <pre className="mt-1 max-h-24 overflow-auto rounded bg-black/30 p-2 text-xs text-white/70">
                      {JSON.stringify(run.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              </div>

              {steps.map((s, i) => (
                <div key={s.stepId} className="flex gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      s.status === "completed" ? "bg-green-500/20 text-green-400" : s.status === "failed" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white/50"
                    }`}
                  >
                    {s.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : s.status === "failed" ? <XCircle className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                  </div>
                  <div className="flex-1 border-l-2 border-white/10 pl-4 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-white">{STEP_LABELS[s.type as StepType] ?? s.type}</div>
                      {s.status === "failed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
                          disabled={!!retrying}
                          onClick={() => handleRetry(s.stepId)}
                        >
                          {retrying === s.stepId ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />}
                          Retry
                        </Button>
                      )}
                    </div>
                    <div className="text-xs text-white/50">{s.executedAt ? new Date(s.executedAt).toLocaleString() : "—"}</div>
                    {s.status === "failed" && s.result?.error != null ? (
                      <pre className="mt-1 rounded bg-red-950/40 p-2 text-xs text-red-300">{String(s.result.error)}</pre>
                    ) : null}
                    {s.status === "completed" && (s.result?.taskId != null || s.result?.contactId != null) ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link href="/app/tasks" className="inline-flex items-center gap-1 rounded bg-purple-500/20 px-2 py-1 text-xs text-purple-300 hover:bg-purple-500/30">
                          {s.result?.reused ? "Reused task" : "Task"} <ExternalLink className="h-3 w-3" />
                        </Link>
                        {s.result?.contactId != null ? (
                          <Link href={`/app/contacts/${String(s.result.contactId)}`} className="inline-flex items-center gap-1 rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-500/30">
                            Contact <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
