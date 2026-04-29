"use client";

import { Suspense, startTransition, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  FolderOpen,
  Plus,
  Search,
  Star,
  Tag,
  X,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface NPCInfo {
  id: string;
  name: string;
  avatarEmoji: string;
  role: string;
  knowledgeTopics?: string[];
  buildingId?: string | null;
  floor?: number | null;
}

interface KnowledgeFormEntry {
  topic: string;
  keywords: string;
  content: string;
  priority: number;
  category: string;
}

const EMPTY_ENTRY: KnowledgeFormEntry = {
  topic: "",
  keywords: "",
  content: "",
  priority: 5,
  category: "general",
};

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  world: FolderOpen,
  business: FileText,
  product: Star,
  navigation: Search,
  general: BookOpen,
};

const adminFetchInit = { credentials: "include" as const };

function NPCKnowledgePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedNpcId = searchParams?.get("npcId") ?? "";

  const [selectedNPCId, setSelectedNPCId] = useState<string>(preselectedNpcId);
  const [npcList, setNpcList] = useState<NPCInfo[]>([]);
  const [npcProfile, setNpcProfile] = useState<NPCInfo | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [entries, setEntries] = useState<KnowledgeFormEntry[]>([{ ...EMPTY_ENTRY }]);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/check", { ...adminFetchInit, cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          try {
            localStorage.removeItem("adminLoggedIn");
          } catch {
            /* ignore */
          }
          router.replace("/admin");
          return;
        }
        try {
          localStorage.setItem("adminLoggedIn", "true");
        } catch {
          /* ignore */
        }

        const listRes = await fetch("/api/npc/admin/npcs", adminFetchInit);
        const listData = await listRes.json();
        if (cancelled) return;
        if (!listRes.ok) {
          toast.error(listData?.error || "Failed to load NPCs");
          return;
        }
        setNpcList(Array.isArray(listData.npcs) ? listData.npcs : []);
      } catch {
        if (!cancelled) router.replace("/admin");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const loadProfile = async (npcId: string) => {
    const res = await fetch(`/api/npc/profile/${npcId}`);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data?.error || "Failed to load profile");
      return;
    }
    setNpcProfile(data.profile);
  };

  useEffect(() => {
    let cancelled = false;
    if (!selectedNPCId) {
      startTransition(() => {
        if (!cancelled) setNpcProfile(null);
      });
    } else {
      void (async () => {
        const res = await fetch(`/api/npc/profile/${selectedNPCId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          toast.error(data?.error || "Failed to load profile");
          return;
        }
        setNpcProfile(data.profile);
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [selectedNPCId]);

  const addEntry = () => setEntries((prev) => [...prev, { ...EMPTY_ENTRY }]);

  const removeEntry = (index: number) => {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof KnowledgeFormEntry, value: string | number) => {
    setEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  };

  const handleSubmitKnowledge = async () => {
    const validEntries = entries.filter((e) => e.topic.trim() && e.content.trim());
    if (validEntries.length === 0) {
      toast.error("Please fill in at least one entry with a topic and content");
      return;
    }

    const res = await fetch("/api/npc/admin/knowledge", {
      ...adminFetchInit,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        npcId: selectedNPCId,
        entries: validEntries.map((e) => ({
          topic: e.topic.trim(),
          keywords: e.keywords.split(",").map((k) => k.trim()).filter(Boolean),
          content: e.content.trim(),
          priority: e.priority,
          category: e.category,
        })),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error || "Failed to add knowledge");
      return;
    }

    toast.success("Knowledge entries saved.");
    setShowAddDialog(false);
    setEntries([{ ...EMPTY_ENTRY }]);
    if (selectedNPCId) loadProfile(selectedNPCId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/npc">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                NPC Admin
              </Button>
            </Link>
            <Separator className="h-6 w-px bg-gray-700" />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-blue-400" />
                Knowledge Base Manager
              </h1>
              <p className="text-sm text-gray-400">Add and manage what your NPCs know</p>
            </div>
          </div>
          {selectedNPCId && (
            <Button className="bg-blue-600 hover:bg-blue-700" size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Knowledge
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="bg-gray-800/50 border-gray-700 mb-8">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Label className="text-gray-300 whitespace-nowrap">Select NPC:</Label>
              <Select value={selectedNPCId} onValueChange={setSelectedNPCId}>
                <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white max-w-md">
                  <SelectValue placeholder="Choose an NPC to manage..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {npcList.map((npc) => (
                    <SelectItem key={npc.id} value={npc.id}>
                      <span className="flex items-center gap-2">
                        <span>{npc.avatarEmoji}</span>
                        <span>{npc.name}</span>
                        <span className="text-gray-500 text-xs capitalize">({npc.role})</span>
                        {npc.buildingId && (
                          <span className="text-cyan-400/80 text-xs">
                            · {npc.buildingId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            {npc.floor != null ? ` Floor ${npc.floor}` : ""}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {npcProfile && (
                <div className="flex items-center gap-2 ml-auto">
                  <Badge variant="outline" className="border-blue-800 text-blue-300">
                    {npcProfile.knowledgeTopics?.length || 0} topics
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {!selectedNPCId ? (
          <Card className="bg-gray-800/50 border-gray-700 text-center py-16">
            <CardContent>
              <BookOpen className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">Select an NPC</h3>
              <p className="text-gray-500">Choose an NPC above to view and manage its knowledge base.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white pl-10 placeholder:text-gray-500"
                />
              </div>
              <div className="flex gap-2">
                {["all", "world", "business", "product", "navigation", "general"].map((cat) => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={filterCategory === cat ? "default" : "outline"}
                    className={
                      filterCategory === cat
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "border-gray-600 text-gray-400 hover:text-white"
                    }
                    onClick={() => setFilterCategory(cat)}
                  >
                    {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {npcProfile?.knowledgeTopics && npcProfile.knowledgeTopics.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {npcProfile.knowledgeTopics
                  .filter((topic) => {
                    if (searchQuery) {
                      return topic.toLowerCase().includes(searchQuery.toLowerCase());
                    }
                    return true;
                  })
                  .map((topic, i) => {
                    const Icon = CATEGORY_ICONS[filterCategory] || BookOpen;
                    return (
                      <Card key={i} className="bg-gray-800/50 border-gray-700">
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-blue-400 shrink-0" />
                              <span className="text-white font-medium">{topic}</span>
                            </div>
                            <Badge variant="outline" className="border-gray-600 text-gray-400 text-xs">
                              Topic
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            ) : (
              <Card className="bg-gray-800/50 border-gray-700 text-center py-12">
                <CardContent>
                  <BookOpen className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-300 mb-2">No Knowledge Yet</h3>
                  <p className="text-gray-500 mb-4">
                    This NPC does not have any custom knowledge entries. Add some to make it smarter.
                  </p>
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Knowledge Entry
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-400" />
              Add Knowledge to {npcProfile?.name || "NPC"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Add one or more knowledge entries. Each entry needs a topic, keywords, and content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {entries.map((entry, index) => (
              <div key={index} className="space-y-4 p-4 bg-gray-700/30 rounded-lg relative">
                {entries.length > 1 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400 font-medium">Entry {index + 1}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/30 h-7 w-7 p-0"
                      onClick={() => removeEntry(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Topic *</Label>
                    <Input
                      placeholder="e.g., Office Hours"
                      value={entry.topic}
                      onChange={(e) => updateEntry(index, "topic", e.target.value)}
                      className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Category</Label>
                    <Select value={entry.category} onValueChange={(val) => updateEntry(index, "category", val)}>
                      <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="world">World</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="product">Product</SelectItem>
                        <SelectItem value="navigation">Navigation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">
                    Keywords <span className="text-gray-500 text-xs ml-2">(comma-separated)</span>
                  </Label>
                  <Input
                    placeholder="e.g., office, hours, open, schedule"
                    value={entry.keywords}
                    onChange={(e) => updateEntry(index, "keywords", e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                  />
                  {entry.keywords && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {entry.keywords
                        .split(",")
                        .map((k) => k.trim())
                        .filter(Boolean)
                        .map((k, ki) => (
                          <Badge key={ki} variant="outline" className="border-gray-600 text-gray-400 text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {k}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Content *</Label>
                  <Textarea
                    placeholder="The knowledge content this NPC should know about this topic..."
                    value={entry.content}
                    onChange={(e) => updateEntry(index, "content", e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-gray-300">Priority</Label>
                    <span className="text-xs text-blue-400 font-mono">{entry.priority}/10</span>
                  </div>
                  <Slider
                    value={[entry.priority]}
                    onValueChange={([val]) => updateEntry(index, "priority", val)}
                    min={0}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Low priority</span>
                    <span>High priority</span>
                  </div>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-500"
              onClick={addEntry}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Entry
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-gray-600 text-gray-300" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSubmitKnowledge}>
              <BookOpen className="h-4 w-4 mr-2" />
              Save Entries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function NPCKnowledgePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
          <div className="text-sm text-gray-300">Loading NPC knowledge...</div>
        </div>
      }
    >
      <NPCKnowledgePageInner />
    </Suspense>
  );
}
