"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  ChevronRight,
  Loader2,
  Play,
  Plus,
  Settings2,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TRIGGER_TYPES,
  STEP_TYPES,
  TRIGGER_LABELS,
  STEP_LABELS,
  type TriggerType,
  type StepType,
} from "@/lib/automations/types";

type Automation = {
  id: string;
  name: string;
  isActive: boolean;
  triggerType: string | null;
  stepCount: number;
  createdAt: string | null;
};

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createTrigger, setCreateTrigger] = useState<TriggerType>("contact_created");
  const [createSteps, setCreateSteps] = useState<Array<{ type: StepType; config: Record<string, unknown> }>>([
    { type: "create_task", config: { title: "Follow up with new lead", priority: "Med" } },
  ]);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  async function loadAutomations() {
    try {
      const res = await fetch("/api/app/automations", { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setAutomations(d.automations ?? []);
      }
    } catch {
      toast.error("Failed to load automations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAutomations();
  }, []);

  async function handleCreate() {
    const name = createName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/app/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          triggerType: createTrigger,
          steps: createSteps.map((s) => ({ type: s.type, config: s.config })),
        }),
      });
      if (!res.ok) throw new Error("Create failed");
      await loadAutomations();
      setShowCreate(false);
      setCreateName("");
      setCreateTrigger("contact_created");
      setCreateSteps([{ type: "create_task", config: { title: "Follow up with new lead", priority: "normal" } }]);
      toast.success("Automation created");
    } catch {
      toast.error("Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/app/automations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      await loadAutomations();
      setDeleteId(null);
      toast.success("Automation deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const res = await fetch(`/api/app/automations/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ contactId: null }),
      });
      if (!res.ok) throw new Error("Test failed");
      const d = await res.json();
      toast.success(d.runIds?.length ? "Automation ran" : "No runs (create a contact to test with contactId)");
    } catch {
      toast.error("Test failed");
    } finally {
      setTestingId(null);
    }
  }

  async function handleCreateCallFollowUpTemplate() {
    setCreatingTemplate(true);
    try {
      const res = await fetch("/api/app/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: "Call follow-up",
          triggerType: "call_completed",
          steps: [
            {
              type: "create_task",
              config: {
                titleTemplate: "Call follow-up: {{contact.phone}}",
                dueInMinutes: 30,
                priority: "normal",
              },
            },
          ],
        }),
      });
      if (!res.ok) throw new Error("Create failed");
      await loadAutomations();
      toast.success("Call follow-up automation created");
    } catch {
      toast.error("Failed to create template");
    } finally {
      setCreatingTemplate(false);
    }
  }

  async function handleCreateLaunchOfferTemplate() {
    setCreatingTemplate(true);
    try {
      const res = await fetch("/api/app/automations/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ templateId: "launch_high_ticket_offer" }),
      });
      if (!res.ok) throw new Error("Create failed");
      await loadAutomations();
      toast.success("Launch High-Ticket Offer automation created");
    } catch {
      toast.error("Failed to create template");
    } finally {
      setCreatingTemplate(false);
    }
  }

  function addStep() {
    setCreateSteps((prev) => [...prev, { type: "create_task", config: { title: "New step", priority: "Med" } }]);
  }

  function removeStep(i: number) {
    setCreateSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateStep(i: number, type: StepType, config: Record<string, unknown>) {
    setCreateSteps((prev) => {
      const next = [...prev];
      next[i] = { type, config };
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
            <p className="mt-1 text-sm text-white/60">
              Triggers → Actions • Contact created, call completed, pipeline stage changed
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleCreateCallFollowUpTemplate}
              disabled={creatingTemplate}
              className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10"
            >
              {creatingTemplate ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Call follow-up
            </Button>
            <Button
              variant="outline"
              onClick={handleCreateLaunchOfferTemplate}
              disabled={creatingTemplate}
              className="border-orange-500/50 text-orange-300 hover:bg-orange-500/10"
            >
              {creatingTemplate ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Launch High-Ticket Offer
            </Button>
            <Button onClick={() => setShowCreate(true)} className="bg-cyan-600 hover:bg-cyan-500">
              <Plus className="mr-2 h-4 w-4" /> New Automation
            </Button>
          </div>
        </div>

        <Card className="mt-6 border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle>Workflows</CardTitle>
            <CardDescription>
              When a trigger fires, run actions in order. Runs are logged for audit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-white/50">Loading…</div>
            ) : automations.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-8 text-center">
                <Zap className="mx-auto h-12 w-12 text-white/20" />
                <p className="mt-3 text-sm text-white/60">No automations yet</p>
                <p className="mt-1 text-xs text-white/50">
                  Create one to run actions when contacts are created, calls complete, or pipeline stages change
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCreateCallFollowUpTemplate}
                    disabled={creatingTemplate}
                    className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10"
                  >
                    {creatingTemplate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                    Call follow-up
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCreateLaunchOfferTemplate}
                    disabled={creatingTemplate}
                    className="border-orange-500/50 text-orange-300 hover:bg-orange-500/10"
                  >
                    {creatingTemplate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                    Launch High-Ticket Offer
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreate(true)} className="border-white/15 text-white/80">
                    <Plus className="mr-2 h-4 w-4" /> Custom automation
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {automations.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.name}</span>
                        {!a.isActive && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">Paused</span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-white/60">
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          {TRIGGER_LABELS[a.triggerType as TriggerType] ?? a.triggerType ?? "—"}
                        </span>
                        <span>→ {a.stepCount} step{a.stepCount !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTest(a.id)}
                        disabled={!!testingId}
                        className="text-cyan-400 hover:bg-cyan-500/10"
                      >
                        {testingId === a.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Link href={`/app/automations/${a.id}`}>
                        <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:bg-red-500/20"
                        onClick={() => setDeleteId(a.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
            <div>
              <div className="font-medium">Triggers fire automatically</div>
              <p className="mt-1 text-sm text-white/60">
                <strong>Contact created</strong> — when a new contact is added (e.g. from an inbound call).{" "}
                <strong>Call completed</strong> — when a call ends. More triggers (pipeline stage, tag added,
                form submitted) coming soon.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-white/10 bg-black text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Automation</DialogTitle>
            <DialogDescription>Define trigger and actions. You can edit steps after creating.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                placeholder="e.g. Follow up new leads"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="mt-2 bg-white/5 border-white/10"
              />
            </div>
            <div>
              <Label>When (trigger)</Label>
              <Select value={createTrigger} onValueChange={(v) => setCreateTrigger(v as TriggerType)}>
                <SelectTrigger className="mt-2 bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TRIGGER_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Then (actions)</Label>
              <div className="mt-2 space-y-2">
                {createSteps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
                    <Select
                      value={s.type}
                      onValueChange={(v) => updateStep(i, v as StepType, { ...s.config })}
                    >
                      <SelectTrigger className="w-[160px] shrink-0 bg-black/30 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STEP_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {STEP_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {s.type === "create_task" && (
                      <Input
                        placeholder="Task title"
                        value={(s.config?.title as string) ?? ""}
                        onChange={(e) => updateStep(i, s.type, { ...s.config, title: e.target.value })}
                        className="flex-1 bg-black/30 border-white/10"
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-red-400 hover:bg-red-500/20"
                      onClick={() => removeStep(i)}
                      disabled={createSteps.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addStep} className="border-white/15 text-white/80">
                  <Plus className="mr-2 h-4 w-4" /> Add action
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="border-white/10 bg-black text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete automation</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
