"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Play, GitBranch, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationMap } from "@/components/automations/AutomationMap";
import { TRIGGER_LABELS, STEP_LABELS, type TriggerType, type StepType } from "@/lib/automations/types";

type Run = { id: string; contactId: string | null; status: string; triggeredAt: string; completedAt: string | null };

export default function AutomationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [automation, setAutomation] = useState<{
    id: string;
    name: string;
    isActive: boolean;
    triggers: Array<{ id: string; type: string; config: Record<string, unknown> }>;
    steps: Array<{ id: string; sortOrder: number; type: string; config: Record<string, unknown> }>;
    recentRuns: Run[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/app/automations/${id}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed");
        const d = await res.json();
        if (active) setAutomation(d.automation);
      } catch {
        toast.error("Failed to load");
        if (active) router.push("/app/automations");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [id, router]);

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch(`/api/app/automations/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Test failed");
      const d = await res.json();
      toast.success(d.runIds?.length ? "Run completed" : "No runs");
      if (d.runIds?.length) {
        const res2 = await fetch(`/api/app/automations/${id}`, { credentials: "include" });
        if (res2.ok) {
          const d2 = await res2.json();
          setAutomation(d2.automation);
        }
      }
    } catch {
      toast.error("Test failed");
    } finally {
      setTesting(false);
    }
  }

  if (loading || !automation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link
          href="/app/automations"
          className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Automations
        </Link>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{automation.name}</h1>
            <p className="text-sm text-white/60">
              {automation.isActive ? "Active" : "Paused"} • {automation.steps.length} steps
            </p>
          </div>
          <Button
            onClick={handleTest}
            disabled={testing}
            variant="outline"
            className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10"
          >
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run test
          </Button>
        </div>

        <Tabs defaultValue="workflow" className="mt-6">
          <TabsList className="mb-4 border border-white/10 bg-black/40">
            <TabsTrigger value="workflow" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              Workflow
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-1.5 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
              <GitBranch className="h-3.5 w-3.5" /> Map
            </TabsTrigger>
            <TabsTrigger value="runs" className="gap-1.5 data-[state=active]:bg-green-500/20 data-[state=active]:text-green-300">
              <History className="h-3.5 w-3.5" /> Runs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflow">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle>Workflow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xs text-white/50">Trigger</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-lg bg-cyan-500/20 px-3 py-1 text-sm text-cyan-300">
                      {TRIGGER_LABELS[automation.triggers[0]?.type as TriggerType] ?? automation.triggers[0]?.type ?? "—"}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/50">Actions</div>
                  <div className="mt-2 space-y-2">
                    {automation.steps.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                        <span className="text-white/50">{i + 1}.</span>
                        <span className="font-medium">{STEP_LABELS[s.type as StepType] ?? s.type}</span>
                        {s.type === "create_task" && (
                          <span className="text-sm text-white/60">
                            — {(s.config?.titleTemplate as string) || (s.config?.title as string) || "Follow up"}
                            {s.config?.dueInMinutes != null && (
                              <span className="text-white/50"> (due in {Number(s.config.dueInMinutes)}m)</span>
                            )}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="map">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle>Flow map</CardTitle>
                <p className="text-sm text-white/50">Visual graph of trigger → steps</p>
              </CardHeader>
              <CardContent>
                <AutomationMap
                  triggerType={automation.triggers[0]?.type ?? "contact_created"}
                  steps={automation.steps.map((s) => ({ ...s, sortOrder: s.sortOrder ?? 0 }))}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle>Recent runs</CardTitle>
                <p className="text-sm text-white/50">Click a run to see execution trace</p>
              </CardHeader>
              <CardContent>
                {automation.recentRuns.length === 0 ? (
                  <p className="py-4 text-center text-sm text-white/50">No runs yet</p>
                ) : (
                  <div className="space-y-2">
                    {automation.recentRuns.map((r) => (
                      <Link
                        key={r.id}
                        href={`/app/automations/${id}/runs/${r.id}`}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/5"
                      >
                        <span className="text-white/80">{r.contactId ?? "Manual test"}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              r.status === "completed"
                                ? "text-green-400"
                                : r.status === "failed"
                                  ? "text-red-400"
                                  : "text-white/60"
                            }
                          >
                            {r.status}
                          </span>
                          <span className="text-white/50">
                            {new Date(r.triggeredAt).toLocaleString()}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
