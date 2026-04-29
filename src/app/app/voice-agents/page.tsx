"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bot,
  ExternalLink,
  Phone,
  Plus,
  Settings2,
  Trash2,
  Globe,
  User,
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

type VoiceAgent = {
  id: string;
  npcId: string | null;
  name: string;
  type: string;
  phoneNumber: string | null;
  siteId: string | null;
  consultantId: string | null;
  isActive: boolean;
  createdAt: string | null;
};

type NpcOption = { id: string; name: string; role: string; title: string | null; avatarEmoji: string; isActive: boolean };
type ConsultantOption = { userId: number; displayName: string; specialty: string };
type SiteOption = { id: string; name: string; slug: string | null; status: string };

export default function VoiceAgentsPage() {
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [npcs, setNpcs] = useState<NpcOption[]>([]);
  const [consultants, setConsultants] = useState<ConsultantOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createNpcId, setCreateNpcId] = useState<string>("");
  const [createConsultantId, setCreateConsultantId] = useState<string>("");
  const [createSiteId, setCreateSiteId] = useState<string>("");
  const [createPhone, setCreatePhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function loadAgents() {
    try {
      const res = await fetch("/api/app/voice-agents", { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setAgents(d.agents ?? []);
      }
    } catch {
      toast.error("Failed to load voice agents");
    }
  }

  async function loadNpcs() {
    try {
      const res = await fetch("/api/app/npcs", { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setNpcs(d.npcs ?? []);
      }
    } catch {
      // NPCs optional
    }
  }

  async function loadConsultants() {
    try {
      const res = await fetch("/api/consultants");
      if (res.ok) {
        const d = await res.json();
        setConsultants(d.consultants ?? []);
      }
    } catch {
      // Consultants optional
    }
  }

  async function loadSites(consultantId: string) {
    if (!consultantId) {
      setSites([]);
      return;
    }
    try {
      const res = await fetch(`/api/app/consultant-sites?consultantId=${encodeURIComponent(consultantId)}`, {
        credentials: "include",
      });
      if (res.ok) {
        const d = await res.json();
        setSites(d.sites ?? []);
      } else {
        setSites([]);
      }
    } catch {
      setSites([]);
    }
  }

  useEffect(() => {
    loadAgents();
    loadNpcs();
    loadConsultants();
    setLoading(false);
  }, []);

  useEffect(() => {
    if (createConsultantId) loadSites(createConsultantId);
    else setSites([]);
  }, [createConsultantId]);

  async function handleCreate() {
    const name = createName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/app/voice-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          npcId: createNpcId || undefined,
          consultantId: createConsultantId || undefined,
          siteId: createSiteId || undefined,
          phoneNumber: createPhone.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        toast.error(e?.error ?? "Failed to create");
        return;
      }
      await loadAgents();
      setShowCreate(false);
      setCreateName("");
      setCreateNpcId("");
      setCreateConsultantId("");
      setCreateSiteId("");
      setCreatePhone("");
      toast.success("Voice agent created");
    } catch {
      toast.error("Failed to create voice agent");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/app/voice-agents/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      await loadAgents();
      setDeleteId(null);
      toast.success("Voice agent deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }

  const consultantMap = Object.fromEntries(consultants.map((c) => [String(c.userId), c.displayName]));
  const siteMap = Object.fromEntries(sites.map((s) => [s.id, s.name]));
  const npcMap = Object.fromEntries(npcs.map((n) => [n.id, n.name]));

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI / Voice Agents</h1>
            <p className="mt-1 text-sm text-white/60">
              Create voice agents that answer phone calls and can be assigned to consultant websites
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/npc">
              <Button variant="outline" className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10">
                Create NPC (incl. Voice Agent)
              </Button>
            </Link>
            <Button onClick={() => setShowCreate(true)} className="bg-cyan-600 hover:bg-cyan-500">
              <Plus className="mr-2 h-4 w-4" /> New Voice Agent
            </Button>
          </div>
        </div>

        <Card className="mt-6 border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle>Voice Agents</CardTitle>
            <CardDescription>
              Each agent links an NPC (personality) to a consultant or website for phone/SMS handling
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-white/50">Loading…</div>
            ) : agents.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-8 text-center">
                <Bot className="mx-auto h-12 w-12 text-white/30" />
                <p className="mt-3 text-sm text-white/60">No voice agents yet</p>
                <p className="mt-1 text-xs text-white/50">
                  Create an NPC with “Voice Agent” role first, then link it here
                </p>
                <Button className="mt-4" variant="outline" onClick={() => setShowCreate(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Create Voice Agent
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {agents.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.name}</span>
                        {!a.isActive && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">Inactive</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-white/60">
                        {a.npcId && (
                          <span className="flex items-center gap-1">
                            <Bot className="h-3 w-3" /> {npcMap[a.npcId] ?? a.npcId}
                          </span>
                        )}
                        {a.consultantId && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {consultantMap[a.consultantId] ?? a.consultantId}
                          </span>
                        )}
                        {a.siteId && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" /> {siteMap[a.siteId] ?? a.siteId}
                          </span>
                        )}
                        {a.phoneNumber && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {a.phoneNumber}
                          </span>
                        )}
                        {!a.npcId && !a.consultantId && !a.siteId && !a.phoneNumber && (
                          <span>Not assigned</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/admin/npc?npc=${a.npcId ?? ""}`}>
                        <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:bg-red-500/20 hover:text-red-300"
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
            <ExternalLink className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
            <div>
              <div className="font-medium">Create NPCs first</div>
              <p className="mt-1 text-sm text-white/60">
                Voice agents use NPCs for personality and behavior. Go to the NPC admin page to create
                NPCs with the &quot;Voice Agent&quot; role, then link them here and assign to consultant
                websites.
              </p>
              <Link href="/admin/npc" className="mt-2 inline-block text-sm text-cyan-400 hover:text-cyan-300">
                Open NPC Admin →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-white/10 bg-black text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Voice Agent</DialogTitle>
            <DialogDescription>
              Link an NPC to a consultant or website. Phone number and Twilio config can be added later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                placeholder="e.g. Receptionist for Smith Consulting"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="mt-2 bg-white/5 border-white/10"
              />
            </div>
            <div>
              <Label>NPC (personality)</Label>
              <Select value={createNpcId} onValueChange={setCreateNpcId}>
                <SelectTrigger className="mt-2 bg-white/5 border-white/10">
                  <SelectValue placeholder="Select an NPC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {npcs.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.avatarEmoji} {n.name} ({n.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Consultant</Label>
              <Select value={createConsultantId} onValueChange={(v) => { setCreateConsultantId(v); setCreateSiteId(""); }}>
                <SelectTrigger className="mt-2 bg-white/5 border-white/10">
                  <SelectValue placeholder="Assign to consultant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {consultants.map((c) => (
                    <SelectItem key={c.userId} value={String(c.userId)}>
                      {c.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createConsultantId && sites.length > 0 && (
              <div>
                <Label>Website (optional)</Label>
                <Select value={createSiteId} onValueChange={setCreateSiteId}>
                  <SelectTrigger className="mt-2 bg-white/5 border-white/10">
                    <SelectValue placeholder="Specific site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All sites</SelectItem>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="create-phone">Phone number (optional)</Label>
              <Input
                id="create-phone"
                placeholder="+1234567890"
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                className="mt-2 bg-white/5 border-white/10"
              />
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
            <DialogTitle>Delete voice agent</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
