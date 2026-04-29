"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Brain,
  Clock,
  Eye,
  MessageSquare,
  SmilePlus,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const SENTIMENT_COLORS = {
  positive: "#22c55e",
  neutral: "#6b7280",
  negative: "#ef4444",
};

const SOURCE_COLORS = {
  rule: "#eab308",
  knowledge: "#3b82f6",
  llm: "#a855f7",
};

const CHART_COLORS = ["#6366f1", "#a855f7", "#3b82f6", "#22c55e", "#eab308", "#ef4444", "#06b6d4", "#f97316"];

const adminFetchInit = { credentials: "include" as const };

type NpcListItem = {
  id: string;
  name: string;
  avatarEmoji: string;
};

type SystemAnalytics = {
  totalNPCs: number;
  totalSessions: number;
  totalMessages: number;
  activeSessions: number;
  npcBreakdown: Array<{ npcId: string; name: string; sessions: number }>;
};

type NpcAnalytics = {
  totalSessions: number;
  totalMessages: number;
  avgMessagesPerSession: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  responseSourceBreakdown: { rule: number; knowledge: number; llm: number };
  topIntents: Array<{ intent: string; count: number }>;
};

type SessionRow = {
  sessionId: string;
  npcNpcId: string;
  messageCount: number;
  currentTopic?: string | null;
  startedAt?: string | null;
};

type MessageRow = {
  id: number;
  role: "user" | "npc";
  content: string;
  intent?: string | null;
  responseSource?: string | null;
  sentiment?: string | null;
  createdAt?: string | null;
};

function NPCAnalyticsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const npcIdFromQuery = searchParams?.get("npcId")?.trim() || null;

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
      } catch {
        if (!cancelled) router.replace("/admin");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const [npcList, setNpcList] = useState<NpcListItem[]>([]);
  const [selectedNPCId, setSelectedNPCId] = useState("");
  const [systemAnalytics, setSystemAnalytics] = useState<SystemAnalytics | null>(null);
  const [npcAnalytics, setNpcAnalytics] = useState<NpcAnalytics | null>(null);
  const [npcSessions, setNpcSessions] = useState<SessionRow[]>([]);
  const [viewSessionId, setViewSessionId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<MessageRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const listRes = await fetch("/api/npc/admin/npcs", adminFetchInit);
      const listData = await listRes.json();
      if (listRes.ok && !cancelled) {
        const list: NpcListItem[] = listData.npcs || [];
        list.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
        setNpcList(list);
        if (npcIdFromQuery && list.some((n) => n.id === npcIdFromQuery)) {
          setSelectedNPCId(npcIdFromQuery);
        }
      }

      const sysRes = await fetch("/api/npc/admin/analytics", adminFetchInit);
      const sysData = await sysRes.json();
      if (sysRes.ok && !cancelled) setSystemAnalytics(sysData.analytics);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [npcIdFromQuery]);

  useEffect(() => {
    if (!selectedNPCId) return;
    const loadNpcAnalytics = async () => {
      const res = await fetch(`/api/npc/admin/analytics?npcId=${encodeURIComponent(selectedNPCId)}`, adminFetchInit);
      const data = await res.json();
      if (res.ok) setNpcAnalytics(data.analytics);

      const sessionsRes = await fetch(
        `/api/npc/admin/sessions?npcId=${encodeURIComponent(selectedNPCId)}`,
        adminFetchInit,
      );
      const sessionsData = await sessionsRes.json();
      if (sessionsRes.ok) setNpcSessions(sessionsData.sessions || []);
    };
    loadNpcAnalytics();
  }, [selectedNPCId]);

  useEffect(() => {
    if (!viewSessionId) return;
    const loadSession = async () => {
      const res = await fetch(`/api/npc/admin/session/${viewSessionId}`, adminFetchInit);
      const data = await res.json();
      if (res.ok) {
        setConversation(data.messages || []);
      }
    };
    loadSession();
  }, [viewSessionId]);

  const sentimentData = npcAnalytics
    ? [
        { name: "Positive", value: npcAnalytics.sentimentBreakdown.positive, fill: SENTIMENT_COLORS.positive },
        { name: "Neutral", value: npcAnalytics.sentimentBreakdown.neutral, fill: SENTIMENT_COLORS.neutral },
        { name: "Negative", value: npcAnalytics.sentimentBreakdown.negative, fill: SENTIMENT_COLORS.negative },
      ].filter((d) => d.value > 0)
    : [];

  const sourceData = npcAnalytics
    ? [
        { name: "Pattern", value: npcAnalytics.responseSourceBreakdown.rule, fill: SOURCE_COLORS.rule },
        { name: "Knowledge", value: npcAnalytics.responseSourceBreakdown.knowledge, fill: SOURCE_COLORS.knowledge },
        { name: "AI Brain", value: npcAnalytics.responseSourceBreakdown.llm, fill: SOURCE_COLORS.llm },
      ].filter((d) => d.value > 0)
    : [];

  const intentData =
    npcAnalytics?.topIntents?.slice(0, 8).map((item, i) => ({
      intent: item.intent.length > 12 ? item.intent.slice(0, 12) + "..." : item.intent,
      count: item.count,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })) || [];

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
                <BarChart3 className="h-6 w-6 text-green-400" />
                Conversation Analytics
              </h1>
              <p className="text-sm text-gray-400">Track NPC interactions and conversation patterns</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-3 bg-purple-900/30 rounded-lg">
                <Bot className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{systemAnalytics?.totalNPCs || 0}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Active NPCs</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-3 bg-blue-900/30 rounded-lg">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{systemAnalytics?.totalSessions || 0}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Total Sessions</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-3 bg-green-900/30 rounded-lg">
                <MessageSquare className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{systemAnalytics?.totalMessages || 0}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Total Messages</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-3 bg-yellow-900/30 rounded-lg">
                <TrendingUp className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{systemAnalytics?.activeSessions || 0}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Active Sessions</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {systemAnalytics?.npcBreakdown && systemAnalytics.npcBreakdown.length > 0 && (
          <Card className="bg-gray-800/50 border-gray-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white text-lg">NPC Session Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {systemAnalytics.npcBreakdown.map((npc) => (
                  <div
                    key={npc.npcId}
                    className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors"
                    onClick={() => setSelectedNPCId(npc.npcId)}
                  >
                    <span className="text-white font-medium">{npc.name}</span>
                    <Badge variant="outline" className="border-gray-600 text-gray-300">
                      {npc.sessions} sessions
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gray-800/50 border-gray-700 mb-8">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <span className="text-gray-300 font-medium whitespace-nowrap">Drill into NPC:</span>
              <Select value={selectedNPCId} onValueChange={setSelectedNPCId}>
                <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white max-w-md">
                  <SelectValue placeholder="Select an NPC for detailed analytics..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {npcList.map((npc) => (
                    <SelectItem key={npc.id} value={npc.id}>
                      <span className="flex items-center gap-2">
                        <span>{npc.avatarEmoji}</span>
                        <span>{npc.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedNPCId && npcAnalytics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold text-white">{npcAnalytics.totalSessions}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Sessions</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold text-white">{npcAnalytics.totalMessages}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Messages</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold text-white">{npcAnalytics.avgMessagesPerSession}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Avg per Session</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <Card className="bg-gray-800/50 border-gray-700 lg:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-400" />
                    Top Intents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {intentData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={intentData} layout="vertical" margin={{ left: 0, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                        <YAxis type="category" dataKey="intent" tick={{ fill: "#9ca3af", fontSize: 11 }} width={90} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                          labelStyle={{ color: "#fff" }}
                          itemStyle={{ color: "#a78bfa" }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {intentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">No intent data yet</div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <SmilePlus className="h-4 w-4 text-green-400" />
                    Sentiment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sentimentData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                          {sentimentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }} labelStyle={{ color: "#fff" }} />
                        <Legend wrapperStyle={{ color: "#9ca3af", fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">No sentiment data yet</div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    Response Sources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sourceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={sourceData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                          {sourceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }} labelStyle={{ color: "#fff" }} />
                        <Legend wrapperStyle={{ color: "#9ca3af", fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">No response data yet</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-400" />
                  Conversation Sessions
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Click a session to view the full conversation transcript
                </CardDescription>
              </CardHeader>
              <CardContent>
                {npcSessions.length > 0 ? (
                  <div className="space-y-2">
                    {npcSessions.map((session) => (
                      <div
                        key={session.sessionId}
                        className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors"
                        onClick={() => setViewSessionId(session.sessionId)}
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-white text-sm font-medium">Session {session.sessionId.slice(0, 12)}...</p>
                            <p className="text-gray-500 text-xs">
                              {session.startedAt ? new Date(session.startedAt).toLocaleString() : "Unknown"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {session.currentTopic && (
                            <Badge variant="outline" className="border-purple-800 text-purple-300 text-xs">
                              {session.currentTopic}
                            </Badge>
                          )}
                          <Badge variant="outline" className="border-gray-600 text-gray-400 text-xs">
                            {session.messageCount} msgs
                          </Badge>
                          <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white h-7">
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No conversation sessions yet for this NPC.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="bg-gray-800/50 border-gray-700 text-center py-16">
            <CardContent>
              <BarChart3 className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">Select an NPC</h3>
              <p className="text-gray-500">Choose an NPC above to view detailed conversation analytics.</p>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={!!viewSessionId} onOpenChange={() => setViewSessionId(null)}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-400" />
              Conversation Transcript
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[60vh] pr-4">
            {conversation.length > 0 ? (
              <div className="space-y-4">
                {conversation.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "npc" && (
                      <div className="w-8 h-8 rounded-full bg-purple-900/50 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-purple-400" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.role === "user"
                          ? "bg-blue-600/30 border border-blue-700/50"
                          : "bg-gray-700/50 border border-gray-600/50"
                      }`}
                    >
                      <p className="text-sm text-gray-200">{msg.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-gray-500">
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ""}
                        </span>
                        {msg.intent && (
                          <Badge variant="outline" className="border-gray-600 text-gray-400 text-[10px] h-4">
                            {msg.intent}
                          </Badge>
                        )}
                        {msg.responseSource && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-4 ${
                              msg.responseSource === "rule"
                                ? "border-yellow-800 text-yellow-400"
                                : msg.responseSource === "knowledge"
                                ? "border-blue-800 text-blue-400"
                                : "border-purple-800 text-purple-400"
                            }`}
                          >
                            {msg.responseSource}
                          </Badge>
                        )}
                        {msg.sentiment && (
                          <span className="text-[10px]">
                            {msg.sentiment === "positive" ? "😊" : msg.sentiment === "negative" ? "😟" : "😐"}
                          </span>
                        )}
                      </div>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center shrink-0">
                        <Users className="h-4 w-4 text-blue-400" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No messages in this session.</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function NPCAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-8 text-muted-foreground">
          Loading analytics…
        </div>
      }
    >
      <NPCAnalyticsPageContent />
    </Suspense>
  );
}
