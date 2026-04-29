"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

const NEON_CYAN = "#00E5FF";
const BINDING_KEY = "smart_trust_platform_binding_v1";

function loadWorkspaceFromBinding(): { workspaceId: string | null; consultantId: string | null } {
  if (typeof window === "undefined") return { workspaceId: null, consultantId: null };
  try {
    const raw = window.localStorage.getItem(BINDING_KEY);
    if (!raw) return { workspaceId: null, consultantId: null };
    const parsed = JSON.parse(raw) as { trustId?: string | null; clientId?: string | null };
    return {
      workspaceId: typeof parsed?.trustId === "string" && parsed.trustId.trim() ? parsed.trustId.trim() : null,
      consultantId: typeof parsed?.clientId === "string" && parsed.clientId.trim() ? parsed.clientId.trim() : null,
    };
  } catch {
    return { workspaceId: null, consultantId: null };
  }
}

type AgentNodeType =
  | "Agent"
  | "NPC"
  | "Knowledge"
  | "Tool"
  | "Site"
  | "Widget"
  | "API"
  | "Trigger"
  | "Perception"
  | "KnowledgeBase"
  | "ReasoningEngine"
  | "Goals"
  | "Learning"
  | "Actuator"
  | "Critic"
  | "Memory"
  | "Environment"
  | "ExternalKnowledge";

/** Trigger types for AI agent workflows (n8n-style). */
export type TriggerKind =
  | "manual"
  | "on_message"
  | "on_chat_message"
  | "on_schedule"
  | "on_webhook"
  | "on_form_submission"
  | "on_app_event"
  | "on_workflow_call";

/** Platform integrations (Telegram, etc.). */
export type PlatformKind = "telegram" | "slack" | "discord" | "webhook" | "custom";

type AgentNodeData = {
  label: string;
  nodeType: AgentNodeType;
  subtitle?: string;
  agentId?: string | null;
  npcId?: string | null;
  name?: string;
  description?: string;
  systemPrompt?: string;
  // API / Tool / Trigger credentials
  baseUrl?: string | null;
  apiKey?: string | null;
  accessToken?: string | null;
  // Trigger config
  triggerKind?: TriggerKind | null;
  platform?: PlatformKind | null;
  triggerEvent?: string | null;
  webhookKey?: string | null;
};

type PaletteItem = {
  type: AgentNodeType;
  label: string;
  subtitle?: string;
};

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

const NODE_COLORS: Record<AgentNodeType, string> = {
  Agent: "#00E5FF",
  NPC: "#A855F7",
  Knowledge: "#10B981",
  Tool: "#EC4899",
  Site: "#8B5CF6",
  Widget: "#F59E0B",
  API: "#6366F1",
  Trigger: "#F97316",
  Perception: "#3B82F6",
  KnowledgeBase: "#059669",
  ReasoningEngine: "#7C3AED",
  Goals: "#EAB308",
  Learning: "#06B6D4",
  Actuator: "#F97316",
  Critic: "#EF4444",
  Memory: "#A855F7",
  Environment: "#22C55E",
  ExternalKnowledge: "#14B8A6",
};

function AgentArchNode({ data, selected }: NodeProps<AgentNodeData>) {
  const accent = NODE_COLORS[data.nodeType] ?? "#6366F1";

  return (
    <div
      style={{
        minWidth: 200,
        borderRadius: 14,
        padding: "14px 14px 12px",
        border: `2px solid ${accent}`,
        boxShadow: selected
          ? `0 0 0 2px ${accent}35, 0 0 20px ${accent}45`
          : `0 0 14px ${accent}20`,
        background:
          "linear-gradient(180deg, rgba(0,200,255,0.12) 0%, rgba(0,0,0,0.60) 100%)",
        color: "rgba(232,250,255,0.96)",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 12,
          height: 12,
          background: accent,
          border: `2px solid ${accent}`,
          boxShadow: `0 0 12px ${accent}`,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 12,
          height: 12,
          background: accent,
          border: `2px solid ${accent}`,
          boxShadow: `0 0 12px ${accent}`,
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs opacity-90">{data.nodeType}</span>
        <span
          style={{
            height: 8,
            width: 8,
            borderRadius: 999,
            background: accent,
            boxShadow: `0 0 12px ${accent}`,
          }}
        />
      </div>
      <div className="mt-1 text-[15px] font-bold">{data.label}</div>
      {data.subtitle ? (
        <div className="mt-1 text-[11px] opacity-80">{data.subtitle}</div>
      ) : null}
    </div>
  );
}

const nodeTypes = { agentArch: AgentArchNode };
const defaultEdgeOptions = {
  animated: true,
  style: {
    stroke: NEON_CYAN,
    strokeWidth: 2,
  },
};

/** Trigger types for workflow start (AI agent dev patterns). */
const TRIGGER_OPTIONS: Array<{ kind: TriggerKind; label: string; subtitle: string; platform?: PlatformKind }> = [
  { kind: "manual", label: "Trigger manually", subtitle: "Run flow on button click. Good for testing.", platform: "custom" },
  { kind: "on_message", label: "On message", subtitle: "When a user sends a chat message. Use with AI nodes.", platform: "telegram" },
  { kind: "on_chat_message", label: "On chat message", subtitle: "Runs when user sends a chat message.", platform: "custom" },
  { kind: "on_schedule", label: "On a schedule", subtitle: "Runs every day, hour, or custom interval.", platform: "custom" },
  { kind: "on_webhook", label: "On webhook call", subtitle: "Runs on receiving an HTTP request.", platform: "webhook" },
  { kind: "on_form_submission", label: "On form submission", subtitle: "Webforms pass responses to the workflow.", platform: "custom" },
  { kind: "on_app_event", label: "On app event", subtitle: "Runs when something happens in Telegram, Notion, etc.", platform: "custom" },
  { kind: "on_workflow_call", label: "When executed by another workflow", subtitle: "Called by Execute Workflow from another flow.", platform: "custom" },
];

/** Platform nodes for connecting agents to external services. */
const PLATFORM_OPTIONS: Array<{ type: AgentNodeType; label: string; subtitle: string; platform: PlatformKind }> = [
  { type: "Trigger", label: "Telegram", subtitle: "On message, callback, channel post…", platform: "telegram" },
  { type: "Trigger", label: "Slack", subtitle: "Messages, reactions, app events", platform: "slack" },
  { type: "Trigger", label: "Discord", subtitle: "Messages, member events", platform: "discord" },
  { type: "API", label: "Webhook", subtitle: "Receive HTTP requests as trigger", platform: "webhook" },
];

const palette: PaletteItem[] = [
  { type: "Agent", label: "Agent", subtitle: "AI agent / assistant" },
  { type: "NPC", label: "Platform NPC", subtitle: "Jarva, Ava, Bentley, etc." },
  { type: "Knowledge", label: "Knowledge", subtitle: "FAQs, docs, tables" },
  { type: "Tool", label: "Tool", subtitle: "External tool or API" },
  { type: "Site", label: "Site", subtitle: "Website / embed host" },
  { type: "Widget", label: "Widget", subtitle: "Chat widget instance" },
  { type: "API", label: "API", subtitle: "Backend or external API" },
  { type: "Trigger", label: "Trigger", subtitle: "Starts the workflow" },
  // Agentic architecture (Brain)
  { type: "Perception", label: "Perception", subtitle: "Sensors, input processing" },
  { type: "KnowledgeBase", label: "Knowledge Base", subtitle: "Vector DB, docs, graph" },
  { type: "ReasoningEngine", label: "Reasoning Engine", subtitle: "Plan, retrieve, infer, generate" },
  { type: "Goals", label: "Goals & Utility", subtitle: "Objectives, reward metrics" },
  { type: "Learning", label: "Learning Element", subtitle: "Training, adaptation" },
  { type: "Critic", label: "Critic", subtitle: "Performance evaluation" },
  { type: "Actuator", label: "Actuator", subtitle: "Physical or digital output" },
  // Interaction layer
  { type: "Memory", label: "Memory", subtitle: "Persistent / shared store" },
  { type: "Environment", label: "Environment", subtitle: "Operational context" },
  { type: "ExternalKnowledge", label: "External Knowledge", subtitle: "Multi-agent sources" },
];

function templateNodes(
  name: "single-agent" | "agent-knowledge-site" | "full-stack" | "agentic-architecture"
): Node<AgentNodeData>[] {
  if (name === "single-agent") {
    return [
      {
        id: makeId("n"),
        type: "agentArch",
        position: { x: 180, y: 140 },
        data: {
          label: "My Agent",
          nodeType: "Agent",
          subtitle: "System prompt + model",
        },
      },
      {
        id: makeId("n"),
        type: "agentArch",
        position: { x: 480, y: 140 },
        data: {
          label: "Chat Widget",
          nodeType: "Widget",
          subtitle: "Embed on site",
        },
      },
    ];
  }
  if (name === "agentic-architecture") {
    return [
      { id: makeId("n"), type: "agentArch", position: { x: 60, y: 80 }, data: { label: "Perception", nodeType: "Perception", subtitle: "Sensors, input formatter, tokenization" } },
      { id: makeId("n"), type: "agentArch", position: { x: 60, y: 200 }, data: { label: "Knowledge Base", nodeType: "KnowledgeBase", subtitle: "Vector DB, graph, documents" } },
      { id: makeId("n"), type: "agentArch", position: { x: 280, y: 60 }, data: { label: "Reasoning Engine", nodeType: "ReasoningEngine", subtitle: "Plan, Retrieve, Infer, Generate" } },
      { id: makeId("n"), type: "agentArch", position: { x: 280, y: 180 }, data: { label: "Goals & Utility", nodeType: "Goals", subtitle: "Objectives, reward metrics, MOO" } },
      { id: makeId("n"), type: "agentArch", position: { x: 280, y: 300 }, data: { label: "Learning Element", nodeType: "Learning", subtitle: "Data acquisition, model training" } },
      { id: makeId("n"), type: "agentArch", position: { x: 280, y: 400 }, data: { label: "Critic", nodeType: "Critic", subtitle: "Performance evaluation" } },
      { id: makeId("n"), type: "agentArch", position: { x: 520, y: 180 }, data: { label: "Actuators", nodeType: "Actuator", subtitle: "Chatbot, automation, digital/physical" } },
      { id: makeId("n"), type: "agentArch", position: { x: 140, y: 480 }, data: { label: "Memory", nodeType: "Memory", subtitle: "Persistent shared store" } },
      { id: makeId("n"), type: "agentArch", position: { x: 340, y: 480 }, data: { label: "Environment", nodeType: "Environment", subtitle: "Operational context" } },
      { id: makeId("n"), type: "agentArch", position: { x: 540, y: 480 }, data: { label: "External Knowledge", nodeType: "ExternalKnowledge", subtitle: "Multi-agent sources" } },
    ];
  }
  if (name === "agent-knowledge-site") {
    return [
      {
        id: makeId("n"),
        type: "agentArch",
        position: { x: 240, y: 160 },
        data: {
          label: "Consultant Agent",
          nodeType: "Agent",
          subtitle: "RAG + system prompt",
        },
      },
      {
        id: makeId("n"),
        type: "agentArch",
        position: { x: 80, y: 80 },
        data: {
          label: "FAQs",
          nodeType: "Knowledge",
          subtitle: "Q&A knowledge base",
        },
      },
      {
        id: makeId("n"),
        type: "agentArch",
        position: { x: 80, y: 240 },
        data: {
          label: "Tables",
          nodeType: "Knowledge",
          subtitle: "CSV / structured data",
        },
      },
      {
        id: makeId("n"),
        type: "agentArch",
        position: { x: 480, y: 160 },
        data: {
          label: "Consultant Site",
          nodeType: "Site",
          subtitle: "Widget embedded",
        },
      },
    ];
  }
  return [
    {
      id: makeId("n"),
      type: "agentArch",
      position: { x: 300, y: 140 },
      data: {
        label: "Agent",
        nodeType: "Agent",
        subtitle: "Central orchestrator",
      },
    },
    {
      id: makeId("n"),
      type: "agentArch",
      position: { x: 80, y: 60 },
      data: { label: "Knowledge Base", nodeType: "Knowledge" },
    },
    {
      id: makeId("n"),
      type: "agentArch",
      position: { x: 80, y: 200 },
      data: { label: "Tool / API", nodeType: "Tool" },
    },
    {
      id: makeId("n"),
      type: "agentArch",
      position: { x: 520, y: 60 },
      data: { label: "Widget A", nodeType: "Widget", subtitle: "Site 1" },
    },
    {
      id: makeId("n"),
      type: "agentArch",
      position: { x: 520, y: 220 },
      data: { label: "Widget B", nodeType: "Widget", subtitle: "Site 2" },
    },
  ];
}

type AgentListItem = { id: string; name: string; description?: string | null; status?: string | null };

export default function AgentMappingPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [consultantId, setConsultantId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [npcs, setNpcs] = useState<{ id: string; name: string; role?: string; title?: string | null }[]>([]);
  const [title, setTitle] = useState("Agent Architecture Map");
  const [status, setStatus] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<AgentNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [testInput, setTestInput] = useState("");
  const [testLog, setTestLog] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [testLoading, setTestLoading] = useState(false);
  const [testOutputData, setTestOutputData] = useState<unknown>(null);
  const [testOutputView, setTestOutputView] = useState<"json" | "table">("json");
  const flowRef = useRef<ReactFlowInstance | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId]
  );

  const loadAgents = useCallback(async () => {
    if (!workspaceId) return;
    const url = `/api/app/agents?workspaceId=${encodeURIComponent(workspaceId)}`;
    const r = await fetch(url, { credentials: "include" });
    const j = await r.json().catch(() => ({}));
    setAgents(j.items ?? []);
  }, [workspaceId]);

  const loadNpcs = useCallback(async () => {
    const r = await fetch("/api/npc/list", { credentials: "include" });
    const j = await r.json().catch(() => ({}));
    const list = (j.npcs ?? []).map((n: { id?: string; npcId?: string; name?: string; role?: string; title?: string | null }) => ({
      id: n.id ?? n.npcId ?? "",
      name: n.name ?? "Unknown",
      role: n.role,
      title: n.title,
    }));
    setNpcs(list);
  }, []);

  const loadFromApi = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const r = await fetch(
        `/api/app/agent-maps?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: "include" }
      );
      const data = await r.json().catch(() => ({}));
      if (data?.title) setTitle(String(data.title));
      if (Array.isArray(data?.nodes) && data.nodes.length > 0) setNodes(data.nodes);
      if (Array.isArray(data?.edges) && data.edges.length > 0) setEdges(data.edges);
    } catch (_) {
      // ignore
    }
  }, [workspaceId, setNodes, setEdges]);

  useEffect(() => {
    const { workspaceId: wid, consultantId: cid } = loadWorkspaceFromBinding();
    setWorkspaceId(wid);
    setConsultantId(cid);
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    loadNpcs();
  }, [loadNpcs]);

  useEffect(() => {
    if (workspaceId) loadFromApi();
  }, [workspaceId, loadFromApi]);

  useEffect(() => {
    const refresh = () => {
      const { workspaceId: wid, consultantId: cid } = loadWorkspaceFromBinding();
      setWorkspaceId(wid);
      setConsultantId(cid);
    };
    window.addEventListener("smart_trust_platform_binding_updated", refresh);
    return () => window.removeEventListener("smart_trust_platform_binding_updated", refresh);
  }, []);

  const saveToApi = useCallback(async () => {
    if (!workspaceId) {
      toast.error("Select a workspace (open a trust from Trust Records) to save.");
      return;
    }
    setStatus("Saving...");
    try {
      const r = await fetch("/api/app/agent-maps", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          workspaceId,
          consultantId,
          title,
          nodes,
          edges,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("Save failed");
        toast.error(j?.error ?? "Save failed");
        return;
      }
      if (Array.isArray(j.nodes) && j.nodes.length > 0) setNodes(j.nodes);
      setStatus("Saved ✓");
      toast.success("Map saved to workspace.");
      if (Array.isArray(j.webhookUrls) && j.webhookUrls.length > 0) {
        const tg = j.webhookUrls.filter((w: { telegramOk?: boolean }) => w.telegramOk === true);
        if (tg.length > 0) toast.success(`Telegram webhook registered. Messages to your bot will trigger the workflow.`);
        else toast.info(`${j.webhookUrls.length} webhook(s) registered. Copy URL from the trigger properties.`);
      }
      setTimeout(() => setStatus(""), 1200);
    } catch (_) {
      setStatus("Save failed");
      toast.error("Save failed");
    }
  }, [workspaceId, consultantId, title, nodes, edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          { ...connection, id: makeId("e"), ...defaultEdgeOptions },
          current
        )
      );
    },
    [setEdges]
  );

  const applyTemplate = (
    template: "single-agent" | "agent-knowledge-site" | "full-stack" | "agentic-architecture"
  ) => {
    const tNodes = templateNodes(template);
    const tEdges: Edge[] = [];
    if (template === "single-agent" && tNodes.length >= 2) {
      tEdges.push({
        id: makeId("e"),
        source: tNodes[0].id,
        target: tNodes[1].id,
        label: "powers",
        ...defaultEdgeOptions,
      });
    } else if (template === "agent-knowledge-site" && tNodes.length >= 4) {
      tEdges.push(
        {
          id: makeId("e"),
          source: tNodes[1].id,
          target: tNodes[0].id,
          label: "feeds",
          ...defaultEdgeOptions,
        },
        {
          id: makeId("e"),
          source: tNodes[2].id,
          target: tNodes[0].id,
          label: "feeds",
          ...defaultEdgeOptions,
        },
        {
          id: makeId("e"),
          source: tNodes[0].id,
          target: tNodes[3].id,
          label: "embeds",
          ...defaultEdgeOptions,
        }
      );
    } else if (template === "full-stack" && tNodes.length >= 5) {
      tEdges.push(
        { id: makeId("e"), source: tNodes[1].id, target: tNodes[0].id, label: "RAG", ...defaultEdgeOptions },
        { id: makeId("e"), source: tNodes[2].id, target: tNodes[0].id, label: "tools", ...defaultEdgeOptions },
        { id: makeId("e"), source: tNodes[0].id, target: tNodes[3].id, label: "powers", ...defaultEdgeOptions },
        { id: makeId("e"), source: tNodes[0].id, target: tNodes[4].id, label: "powers", ...defaultEdgeOptions }
      );
    } else if (template === "agentic-architecture" && tNodes.length >= 10) {
      const [perception, knowledge, reasoning, goals, learning, critic, actuators, memory, env, external] = tNodes;
      tEdges.push(
        { id: makeId("e"), source: perception!.id, target: knowledge!.id, label: "a", ...defaultEdgeOptions },
        { id: makeId("e"), source: perception!.id, target: reasoning!.id, label: "a", ...defaultEdgeOptions },
        { id: makeId("e"), source: knowledge!.id, target: reasoning!.id, label: "b", ...defaultEdgeOptions },
        { id: makeId("e"), source: reasoning!.id, target: goals!.id, label: "c", ...defaultEdgeOptions },
        { id: makeId("e"), source: reasoning!.id, target: actuators!.id, label: "d", ...defaultEdgeOptions },
        { id: makeId("e"), source: goals!.id, target: learning!.id, label: "i", ...defaultEdgeOptions },
        { id: makeId("e"), source: goals!.id, target: critic!.id, label: "h", ...defaultEdgeOptions },
        { id: makeId("e"), source: learning!.id, target: knowledge!.id, label: "New insights", ...defaultEdgeOptions },
        { id: makeId("e"), source: critic!.id, target: learning!.id, label: "Feedback", ...defaultEdgeOptions },
        { id: makeId("e"), source: critic!.id, target: reasoning!.id, label: "New insights", ...defaultEdgeOptions },
        { id: makeId("e"), source: actuators!.id, target: env!.id, label: "f", ...defaultEdgeOptions },
        { id: makeId("e"), source: memory!.id, target: reasoning!.id, label: "g", ...defaultEdgeOptions },
        { id: makeId("e"), source: external!.id, target: knowledge!.id, label: "Multi-agent", ...defaultEdgeOptions },
      );
    }
    setNodes(tNodes);
    setEdges(tEdges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setTitle(
      template === "single-agent"
        ? "Single Agent + Widget"
        : template === "agent-knowledge-site"
          ? "Agent + Knowledge + Site"
          : template === "agentic-architecture"
            ? "AI Agentic Architecture"
            : "Full Agent Stack"
    );
  };

  const addTriggerNode = (opt: (typeof TRIGGER_OPTIONS)[0]) => {
    const viewport = flowRef.current?.getViewport();
    const baseX = viewport ? (Math.abs(viewport.x) + 140) / Math.max(0.5, viewport.zoom) : 80;
    const baseY = viewport ? (Math.abs(viewport.y) + 120) / Math.max(0.5, viewport.zoom) : 100;
    const n: Node<AgentNodeData> = {
      id: makeId("n"),
      type: "agentArch",
      position: { x: baseX, y: baseY },
      data: {
        label: opt.label,
        nodeType: "Trigger",
        subtitle: opt.subtitle,
        triggerKind: opt.kind,
        platform: opt.platform ?? "custom",
      },
    };
    setNodes((cur) => [...cur, n]);
  };

  const addPlatformNode = (opt: (typeof PLATFORM_OPTIONS)[0]) => {
    const viewport = flowRef.current?.getViewport();
    const baseX = viewport ? (Math.abs(viewport.x) + 140) / Math.max(0.5, viewport.zoom) : 80;
    const baseY = viewport ? (Math.abs(viewport.y) + 120) / Math.max(0.5, viewport.zoom) : 100;
    const n: Node<AgentNodeData> = {
      id: makeId("n"),
      type: "agentArch",
      position: { x: baseX, y: baseY },
      data: {
        label: opt.label,
        nodeType: opt.type,
        subtitle: opt.subtitle,
        platform: opt.platform,
        triggerKind: opt.type === "Trigger" ? "on_message" : undefined,
      },
    };
    setNodes((cur) => [...cur, n]);
  };

  const addPaletteNode = (item: PaletteItem) => {
    const viewport = flowRef.current?.getViewport();
    const baseX = viewport
      ? (Math.abs(viewport.x) + 140) / Math.max(0.5, viewport.zoom)
      : 240;
    const baseY = viewport
      ? (Math.abs(viewport.y) + 120) / Math.max(0.5, viewport.zoom)
      : 180;
    const n: Node<AgentNodeData> = {
      id: makeId("n"),
      type: "agentArch",
      position: {
        x: baseX + Math.random() * 130,
        y: baseY + Math.random() * 140,
      },
      data: {
        label: item.label,
        nodeType: item.type,
        subtitle: item.subtitle,
      },
    };
    setNodes((cur) => [...cur, n]);
  };

  const createNewMap = () => {
    setTitle("Agent Architecture Map");
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setTestLog([]);
    setStatus("New map. Drag to connect nodes.");
    setTimeout(() => setStatus(""), 2000);
  };

  const resetCurrentMap = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setStatus("Map cleared. Save to persist.");
    setTimeout(() => setStatus(""), 2000);
  };

  const handleSelection = (params: OnSelectionChangeParams) => {
    setSelectedNodeId(params.nodes?.[0]?.id ?? null);
    setSelectedEdgeId(params.edges?.[0]?.id ?? null);
  };

  const updateSelectedNode = (patch: Partial<AgentNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((cur) =>
      cur.map((n) =>
        n.id === selectedNodeId
          ? { ...n, data: { ...n.data, ...patch } }
          : n
      )
    );
  };

  const updateSelectedEdge = (patch: Partial<Edge>) => {
    if (!selectedEdgeId) return;
    setEdges((cur) =>
      cur.map((e) => (e.id === selectedEdgeId ? { ...e, ...patch } : e))
    );
  };

  const linkAgentToNode = (agentId: string) => {
    if (!selectedNodeId) return;
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    setNodes((cur) =>
      cur.map((n) =>
        n.id === selectedNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                agentId,
                label: agent.name,
                name: agent.name,
                description: agent.description ?? "",
                systemPrompt: "",
              },
            }
          : n
      )
    );
    fetch(`/api/app/agents/${encodeURIComponent(agentId)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        const prompt = j?.item?.systemPrompt;
        if (prompt && selectedNodeId) {
          setNodes((cur) =>
            cur.map((n) =>
              n.id === selectedNodeId
                ? { ...n, data: { ...n.data, systemPrompt: prompt } }
                : n
            )
          );
        }
      })
      .catch(() => {});
  };

  const createAgentFromNode = async () => {
    if (!selectedNodeId || !workspaceId) {
      toast.error("Select a workspace first (open a trust from Trust Records).");
      return;
    }
    const node = nodes.find((n) => n.id === selectedNodeId);
    const name = node?.data?.label?.trim() || "New Agent";
    try {
      const r = await fetch("/api/app/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          description: node?.data?.description ?? "",
          systemPrompt: node?.data?.systemPrompt ?? "You are a helpful assistant.",
          status: "draft",
          workspaceId,
          consultantId,
          toolsJson: { crm: true, tasks: true, automations: false, siteContext: true },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.id) {
        updateSelectedNode({
          agentId: j.id,
          name,
          description: node?.data?.description ?? "",
          systemPrompt: node?.data?.systemPrompt ?? "You are a helpful assistant.",
        });
        await loadAgents();
        toast.success("Agent created. Configure below and save to agent.");
      } else {
        toast.error(j?.error ?? "Failed to create agent");
      }
    } catch {
      toast.error("Failed to create agent");
    }
  };

  const saveAgentFromNode = async () => {
    const node = nodes.find((n) => n.id === selectedNodeId);
    const agentId = node?.data?.agentId;
    if (!agentId || !node) {
      toast.error("Link or create an agent first.");
      return;
    }
    try {
      const r = await fetch(`/api/app/agents/${encodeURIComponent(agentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: (node.data.name ?? node.data.label ?? "").trim() || "New Agent",
          description: (node.data.description ?? "").trim() || null,
          systemPrompt: node.data.systemPrompt ?? "You are a helpful assistant.",
          workspaceId: workspaceId || null,
          consultantId,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j?.error ?? "Save failed");
        return;
      }
      setNodes((cur) =>
        cur.map((n) =>
          n.id === selectedNodeId
            ? { ...n, data: { ...n.data, label: node.data.name ?? node.data.label } }
            : n
        )
      );
      await loadAgents();
      toast.success("Saved to agent.");
    } catch {
      toast.error("Save failed");
    }
  };

  const sendTest = async () => {
    const text = testInput.trim();
    if (!text) return;

    if (selectedNode?.data?.nodeType === "Agent") {
      const agentId = selectedNode.data.agentId;
      if (!agentId) {
        toast.error("Select an Agent node linked to an agent first.");
        return;
      }
      const historyForRequest = testLog.map((m) => ({
        role: m.role,
        content: m.text,
      }));
      setTestLog((l) => [...l, { role: "user", text }]);
      setTestInput("");
      setTestLoading(true);
      setTestOutputData(null);
      try {
        const r = await fetch(`/api/app/agents/${encodeURIComponent(agentId)}/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: text, history: historyForRequest }),
        });
        const j = await r.json().catch(() => ({}));
        const reply = j?.reply ?? "No response.";
        setTestLog((l) => [...l, { role: "assistant", text: reply }]);
        setTestOutputData({ reply, raw: j });
      } catch {
        setTestLog((l) => [...l, { role: "assistant", text: "Request failed." }]);
        setTestOutputData({ error: "Request failed" });
        toast.error("Test request failed");
      } finally {
        setTestLoading(false);
      }
      return;
    }

    if (selectedNode?.data?.nodeType === "NPC") {
      const npcId = selectedNode.data.npcId;
      if (!npcId) {
        toast.error("Select an NPC first.");
        return;
      }
      setTestLog((l) => [...l, { role: "user", text }]);
      setTestInput("");
      setTestLoading(true);
      setTestOutputData(null);
      try {
        const r = await fetch("/api/npc/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: text, npcId }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error ?? "NPC chat failed");
        const reply = j?.response ?? "No response.";
        setTestLog((l) => [...l, { role: "assistant", text: reply }]);
        setTestOutputData({ reply, raw: j });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Request failed";
        setTestLog((l) => [...l, { role: "assistant", text: msg }]);
        setTestOutputData({ error: msg });
        toast.error(msg);
      } finally {
        setTestLoading(false);
      }
    }
  };

  const runTriggerTest = async () => {
    if (!selectedNode || selectedNode.data.nodeType !== "Trigger" || !workspaceId) {
      toast.error("Select a Trigger node and ensure workspace is set.");
      return;
    }
    setTestLoading(true);
    setTestOutputData(null);
    try {
      const triggerKind = selectedNode.data.triggerKind ?? "manual";
      const payload: Record<string, unknown> =
        triggerKind === "on_message" || triggerKind === "on_chat_message"
          ? { message: testInput.trim() || "Test message", text: testInput.trim() || "Test message" }
          : { event: "manual_test", message: testInput.trim() || "Manual trigger", timestamp: new Date().toISOString() };

      const r = await fetch("/api/app/agent-maps/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          workspaceId,
          triggerNodeId: selectedNode.id,
          payload,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.error ?? "Workflow run failed");
      }
      setTestOutputData({
        success: j.success,
        triggerNodeId: j.triggerNodeId,
        outputs: j.outputs,
        error: j.error,
      });
      if (j.outputs?.length) {
        const firstReply = j.outputs.find(
          (o: { nodeType: string; result?: { reply?: string } }) =>
            (o.nodeType === "Agent" || o.nodeType === "NPC") && o.result?.reply
        );
        if (firstReply?.result?.reply) {
          setTestLog((l) => [...l, { role: "assistant", text: firstReply.result.reply }]);
        }
      }
      toast.success(j.outputs?.length ? "Workflow ran successfully." : "Trigger ran (no connected agents).");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Trigger test failed";
      setTestOutputData({ error: msg });
      toast.error(msg);
    } finally {
      setTestLoading(false);
    }
  };

  const canRunTest = Boolean(
    (selectedNode?.data?.nodeType === "Agent" && selectedNode?.data?.agentId && testInput.trim()) ||
    (selectedNode?.data?.nodeType === "NPC" && selectedNode?.data?.npcId && testInput.trim()) ||
    (selectedNode?.data?.nodeType === "Trigger" && workspaceId)
  );

  return (
    <div
      style={{
        height: "calc(100vh - 56px)",
        display: "grid",
        gridTemplateColumns: "280px 1fr 300px",
        background:
          "radial-gradient(circle at 22% 16%, rgba(0,180,255,0.15), rgba(0,0,0,0.94) 56%)",
      }}
    >
      <aside className="border-r border-cyan-400/25 p-3 overflow-auto">
        <Link
          href="/app/agents"
          className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-100 mb-2"
        >
          ← Back to AI Agents
        </Link>
        <div className="text-cyan-200 font-extrabold text-sm tracking-wide">
          AGENT MAPPING
        </div>
        <div className="text-[11px] text-cyan-400/90 mt-1">
          Map agents, knowledge, tools, and sites. Saves to current workspace.
        </div>
        {workspaceId ? (
          <p className="mt-1 text-xs text-cyan-300/80">
            Workspace: {workspaceId.slice(0, 8)}…{workspaceId.slice(-4)}
          </p>
        ) : (
          <p className="mt-1 text-xs text-amber-300/80">
            Open a trust from Trust Records to save.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={createNewMap}
            className="rounded-xl px-3 py-2 text-xs border border-cyan-400/40 bg-cyan-500/10 text-cyan-100"
          >
            + New
          </button>
          <button
            onClick={saveToApi}
            className="rounded-xl px-3 py-2 text-xs border border-orange-400/50 bg-orange-500/10 text-orange-100"
          >
            Save
          </button>
          <button
            onClick={resetCurrentMap}
            className="rounded-xl px-3 py-2 text-xs border border-amber-400/50 bg-amber-500/10 text-amber-100"
          >
            Reset
          </button>
          <button
            onClick={async () => {
              await loadAgents();
              const linked = new Set(
                nodes.filter((n) => n.data?.agentId).map((n) => n.data!.agentId)
              );
              const toAdd = agents.filter((a) => !linked.has(a.id));
              if (toAdd.length === 0) {
                toast.info("All agents already in map.");
                return;
              }
              const baseX = 400;
              const newNodes: Node<AgentNodeData>[] = toAdd.map((a, i) => ({
                id: makeId("n"),
                type: "agentArch",
                position: { x: baseX + (i % 2) * 180, y: 100 + Math.floor(i / 2) * 120 },
                data: {
                  label: a.name,
                  nodeType: "Agent" as const,
                  agentId: a.id,
                  name: a.name,
                  description: a.description ?? "",
                },
              }));
              setNodes((cur) => [...cur, ...newNodes]);
              toast.success(`Added ${toAdd.length} agent(s) to map.`);
            }}
            disabled={!workspaceId || agents.length === 0}
            className="rounded-xl px-3 py-2 text-xs border border-emerald-400/50 bg-emerald-500/10 text-emerald-100 disabled:opacity-50"
          >
            Sync from agents
          </button>
        </div>
        <div className="mt-2 text-[11px] text-slate-300">{status}</div>

        <label className="mt-4 block text-[11px] text-slate-300">
          Map title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
        />

        <div className="mt-4 text-[11px] text-orange-100 font-semibold">
          Templates
        </div>
        <div className="mt-2 grid gap-2">
          <button
            onClick={() => applyTemplate("single-agent")}
            className="rounded-xl border border-cyan-400/40 bg-black/30 px-3 py-2 text-left text-xs text-cyan-50"
          >
            Single Agent + Widget
          </button>
          <button
            onClick={() => applyTemplate("agent-knowledge-site")}
            className="rounded-xl border border-cyan-400/40 bg-black/30 px-3 py-2 text-left text-xs text-cyan-50"
          >
            Agent + Knowledge + Site
          </button>
          <button
            onClick={() => applyTemplate("full-stack")}
            className="rounded-xl border border-cyan-400/40 bg-black/30 px-3 py-2 text-left text-xs text-cyan-50"
          >
            Full Agent Stack
          </button>
          <button
            onClick={() => applyTemplate("agentic-architecture")}
            className="rounded-xl border border-violet-400/50 bg-violet-500/15 px-3 py-2 text-left text-xs text-violet-100"
          >
            AI Agentic Architecture
          </button>
        </div>

        <div className="mt-4 text-[11px] text-orange-100 font-semibold">
          What triggers this workflow?
        </div>
        <div className="mt-0.5 text-[10px] text-slate-400">
          A trigger starts your workflow.
        </div>
        <div className="mt-1 max-h-[200px] overflow-auto space-y-1">
          {TRIGGER_OPTIONS.map((opt) => (
            <button
              key={opt.kind}
              onClick={() => addTriggerNode(opt)}
              className="w-full rounded-lg border border-orange-400/35 bg-orange-500/10 px-2.5 py-2 text-left text-xs text-orange-50 hover:bg-orange-500/20"
            >
              <div className="font-semibold">{opt.label}</div>
              <div className="mt-0.5 opacity-75 text-[10px]">{opt.subtitle}</div>
            </button>
          ))}
        </div>

        <div className="mt-3 text-[11px] text-orange-100 font-semibold">
          Connect to platforms
        </div>
        <div className="mt-0.5 text-[10px] text-slate-400">
          Telegram, Slack, webhooks, etc.
        </div>
        <div className="mt-1 grid gap-1">
          {PLATFORM_OPTIONS.map((opt) => (
            <button
              key={`${opt.platform}-${opt.label}`}
              onClick={() => addPlatformNode(opt)}
              className="rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-2 text-left text-xs text-cyan-50 hover:bg-cyan-500/20"
            >
              <div className="font-semibold">{opt.label}</div>
              <div className="mt-0.5 opacity-75 text-[10px]">{opt.subtitle}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 text-[11px] text-orange-100 font-semibold">
          Add nodes
        </div>
        <div className="mt-1 text-[10px] text-slate-400">Simple</div>
        <div className="mt-1 grid gap-2">
          {palette.slice(0, 6).map((item) => (
            <button
              key={item.type}
              onClick={() => addPaletteNode(item)}
              className="rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-left text-xs text-cyan-50"
            >
              <div className="font-semibold">{item.label}</div>
              <div className="opacity-75">{item.subtitle || "Node"}</div>
            </button>
          ))}
        </div>
        <div className="mt-3 text-[10px] text-slate-400">Agentic Architecture</div>
        <div className="mt-1 grid gap-2">
          {palette.slice(6).map((item) => (
            <button
              key={item.type}
              onClick={() => addPaletteNode(item)}
              className="rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-left text-xs text-cyan-50"
            >
              <div className="font-semibold">{item.label}</div>
              <div className="opacity-75">{item.subtitle || "Node"}</div>
            </button>
          ))}
        </div>
      </aside>

      <main className="relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={handleSelection}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          onInit={(inst) => {
            flowRef.current = inst;
          }}
        >
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => {
              const d = n.data as AgentNodeData;
              return NODE_COLORS[d.nodeType] ?? "#6366F1";
            }}
          />
          <Controls />
          <Background gap={18} size={1} />
        </ReactFlow>
      </main>

      <aside className="border-l border-cyan-400/25 p-3 overflow-auto bg-black/25 flex flex-col">
        <div className="text-cyan-200 font-extrabold text-sm tracking-wide">
          PROPERTIES
        </div>
        {selectedNode ? (
          <div className="mt-3 space-y-2 flex-1 min-h-0 overflow-auto">
            <div className="text-xs text-orange-100 font-semibold">
              Selected node
            </div>
            {selectedNode.data.nodeType === "Agent" ? (
              <>
                <div className="flex gap-2">
                  <select
                    value={selectedNode.data.agentId ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) linkAgentToNode(v);
                    }}
                    className="flex-1 rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
                  >
                    <option value="">Link to agent…</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={createAgentFromNode}
                    className="rounded-xl px-2 py-2 text-xs border border-cyan-400/40 bg-cyan-500/15 text-cyan-100 whitespace-nowrap"
                  >
                    + New
                  </button>
                </div>
                {selectedNode.data.agentId ? (
                  <>
                    <label className="block text-[11px] text-slate-300">Name</label>
                    <input
                      value={selectedNode.data.name ?? selectedNode.data.label}
                      onChange={(e) => updateSelectedNode({ name: e.target.value, label: e.target.value })}
                      className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
                    />
                    <label className="block text-[11px] text-slate-300">Description</label>
                    <input
                      value={selectedNode.data.description ?? ""}
                      onChange={(e) => updateSelectedNode({ description: e.target.value })}
                      className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
                    />
                    <label className="block text-[11px] text-slate-300">System prompt</label>
                    <textarea
                      rows={4}
                      value={selectedNode.data.systemPrompt ?? ""}
                      onChange={(e) => updateSelectedNode({ systemPrompt: e.target.value })}
                      className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none resize-none"
                    />
                    <button
                      onClick={saveAgentFromNode}
                      className="w-full rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
                    >
                      Save to Agent
                    </button>
                  </>
                ) : null}
              </>
            ) : selectedNode.data.nodeType === "NPC" ? (
              <>
                <label className="block text-[11px] text-slate-300">Platform NPC</label>
                <select
                  value={selectedNode.data.npcId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      const npc = npcs.find((n) => n.id === v);
                      updateSelectedNode({
                        npcId: v,
                        label: npc?.name ?? v,
                      });
                    } else {
                      updateSelectedNode({ npcId: null, label: "Platform NPC" });
                    }
                  }}
                  className="w-full rounded-xl border border-violet-400/30 bg-black/30 px-3 py-2 text-sm text-violet-50 outline-none"
                >
                  <option value="">Select NPC…</option>
                  {npcs.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} {n.title ? `(${n.title})` : ""}
                    </option>
                  ))}
                </select>
                {selectedNode.data.npcId ? (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Jarva, Ava, Bentley, etc. respond using knowledge + rules. Use in workflows like Trigger → NPC.
                  </p>
                ) : null}
              </>
            ) : selectedNode.data.nodeType === "Trigger" ? (
              <>
                <label className="block text-[11px] text-slate-300">Label</label>
                <input
                  value={selectedNode.data.label}
                  onChange={(e) => updateSelectedNode({ label: e.target.value })}
                  className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
                />
                <label className="block text-[11px] text-slate-300">Trigger type</label>
                <select
                  value={selectedNode.data.triggerKind ?? "manual"}
                  onChange={(e) => updateSelectedNode({ triggerKind: e.target.value as TriggerKind })}
                  className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
                >
                  {TRIGGER_OPTIONS.map((o) => (
                    <option key={o.kind} value={o.kind}>{o.label}</option>
                  ))}
                </select>
                <label className="block text-[11px] text-slate-300">Platform</label>
                <select
                  value={selectedNode.data.platform ?? "custom"}
                  onChange={(e) => updateSelectedNode({ platform: e.target.value as PlatformKind })}
                  className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
                >
                  <option value="custom">Custom</option>
                  <option value="telegram">Telegram</option>
                  <option value="slack">Slack</option>
                  <option value="discord">Discord</option>
                  <option value="webhook">Webhook</option>
                </select>
                {(selectedNode.data.platform === "telegram" || selectedNode.data.platform === "slack" || selectedNode.data.platform === "discord") && selectedNode.data.platform !== "telegram" ? (
                  <>
                    <label className="block text-[11px] text-slate-300">Base URL (optional)</label>
                    <input
                      type="url"
                      placeholder="https://api.example.com"
                      value={selectedNode.data.baseUrl ?? ""}
                      onChange={(e) => updateSelectedNode({ baseUrl: e.target.value || null })}
                      className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 placeholder-white/40 outline-none"
                    />
                    <label className="block text-[11px] text-slate-300">API Key / Access Token</label>
                    <input
                      type="password"
                      placeholder="Bot token or API key"
                      value={selectedNode.data.apiKey ?? selectedNode.data.accessToken ?? ""}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        updateSelectedNode({ apiKey: v, accessToken: v });
                      }}
                      className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 placeholder-white/40 outline-none"
                    />
                  </>
                ) : null}
                {selectedNode.data.platform === "telegram" ? (
                  <>
                    <label className="block text-[11px] text-slate-300">Bot Token (required)</label>
                    <input
                      type="password"
                      placeholder="From @BotFather"
                      value={selectedNode.data.apiKey ?? selectedNode.data.accessToken ?? ""}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        updateSelectedNode({ apiKey: v, accessToken: v });
                      }}
                      className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 placeholder-white/40 outline-none"
                    />
                    {selectedNode.data.webhookKey ? (
                      <>
                        <label className="block text-[11px] text-slate-300 mt-2">Webhook URL</label>
                        <div className="flex gap-1">
                          <input
                            readOnly
                            value={typeof window !== "undefined" ? `${window.location.origin}/api/app/webhooks/${selectedNode.data.webhookKey}` : ""}
                            className="flex-1 rounded-xl border border-cyan-400/30 bg-black/50 px-3 py-2 text-xs text-cyan-100 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const url = `${window.location.origin}/api/app/webhooks/${selectedNode.data.webhookKey}`;
                              navigator.clipboard.writeText(url);
                              toast.success("Copied to clipboard");
                            }}
                            className="rounded-xl px-2 py-2 text-xs border border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                          >
                            Copy
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500">Save to register with Telegram. Messages to your bot will trigger this workflow.</p>
                      </>
                    ) : (
                      <p className="text-[10px] text-amber-300 mt-1">Add bot token, then Save to register with Telegram.</p>
                    )}
                  </>
                ) : null}
                {(selectedNode.data.triggerKind === "on_webhook" || selectedNode.data.platform === "webhook") && selectedNode.data.webhookKey ? (
                  <>
                    <label className="block text-[11px] text-slate-300">Webhook URL</label>
                    <div className="flex gap-1">
                      <input
                        readOnly
                        value={typeof window !== "undefined" ? `${window.location.origin}/api/app/webhooks/${selectedNode.data.webhookKey}` : ""}
                        className="flex-1 rounded-xl border border-cyan-400/30 bg-black/50 px-3 py-2 text-xs text-cyan-100 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/api/app/webhooks/${selectedNode.data.webhookKey}`;
                          navigator.clipboard.writeText(url);
                          toast.success("Copied to clipboard");
                        }}
                        className="rounded-xl px-2 py-2 text-xs border border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">Save the map to register. POST JSON here to trigger.</p>
                  </>
                ) : null}
                <label className="block text-[11px] text-slate-300">Subtitle</label>
                <input
                  value={selectedNode.data.subtitle ?? ""}
                  onChange={(e) => updateSelectedNode({ subtitle: e.target.value })}
                  className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
                />
              </>
            ) : (selectedNode.data.nodeType === "API" || selectedNode.data.nodeType === "Tool") ? (
              <>
                <label className="block text-[11px] text-slate-300">Label</label>
                <input
                  value={selectedNode.data.label}
                  onChange={(e) => updateSelectedNode({ label: e.target.value })}
                  className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
                />
                <label className="block text-[11px] text-slate-300">Base URL</label>
                <input
                  type="url"
                  placeholder="https://api.example.com"
                  value={selectedNode.data.baseUrl ?? ""}
                  onChange={(e) => updateSelectedNode({ baseUrl: e.target.value || null })}
                  className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 placeholder-white/40 outline-none"
                />
                <label className="block text-[11px] text-slate-300">API Key</label>
                <input
                  type="password"
                  placeholder="Optional"
                  value={selectedNode.data.apiKey ?? ""}
                  onChange={(e) => updateSelectedNode({ apiKey: e.target.value || null })}
                  className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 placeholder-white/40 outline-none"
                />
                <label className="block text-[11px] text-slate-300">Access Token</label>
                <input
                  type="password"
                  placeholder="Optional (OAuth, Bearer)"
                  value={selectedNode.data.accessToken ?? ""}
                  onChange={(e) => updateSelectedNode({ accessToken: e.target.value || null })}
                  className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 placeholder-white/40 outline-none"
                />
                <label className="block text-[11px] text-slate-300">Node type</label>
                <select
                  value={selectedNode.data.nodeType}
                  onChange={(e) => updateSelectedNode({ nodeType: e.target.value as AgentNodeType })}
                  className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
                >
                  <option value="API">API</option>
                  <option value="Tool">Tool</option>
                </select>
                <label className="block text-[11px] text-slate-300">Subtitle</label>
                <input
                  value={selectedNode.data.subtitle ?? ""}
                  onChange={(e) => updateSelectedNode({ subtitle: e.target.value })}
                  className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
                />
              </>
            ) : (
              <>
                <label className="block text-[11px] text-slate-300">Label</label>
                <input
                  value={selectedNode.data.label}
                  onChange={(e) => updateSelectedNode({ label: e.target.value })}
                  className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
                />
                <label className="block text-[11px] text-slate-300">Node type</label>
                <select
                  value={selectedNode.data.nodeType}
                  onChange={(e) =>
                    updateSelectedNode({
                      nodeType: e.target.value as AgentNodeType,
                    })
                  }
                  className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
                >
                  {[
                    "Agent",
                    "Knowledge",
                    "Tool",
                    "Site",
                    "Widget",
                    "API",
                    "Trigger",
                    "Perception",
                    "KnowledgeBase",
                    "ReasoningEngine",
                    "Goals",
                    "Learning",
                    "Actuator",
                    "Critic",
                    "Memory",
                    "Environment",
                    "ExternalKnowledge",
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="block text-[11px] text-slate-300">Subtitle</label>
                <textarea
                  rows={3}
                  value={selectedNode.data.subtitle || ""}
                  onChange={(e) =>
                    updateSelectedNode({ subtitle: e.target.value })
                  }
                  className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
                />
              </>
            )}
          </div>
        ) : selectedEdge ? (
          <div className="mt-3 space-y-2">
            <div className="text-xs text-orange-100 font-semibold">
              Selected connection
            </div>
            <label className="block text-[11px] text-slate-300">Label</label>
            <input
              value={String(selectedEdge.label || "")}
              onChange={(e) =>
                updateSelectedEdge({ label: e.target.value })
              }
              className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
            />
            <label className="inline-flex items-center gap-2 text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(selectedEdge.animated)}
                onChange={(e) =>
                  updateSelectedEdge({ animated: e.target.checked })
                }
              />
              Animated connector
            </label>
          </div>
        ) : (
          <div className="mt-3 text-xs text-slate-400">
            Select a node or connection to edit its properties.
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-cyan-400/20">
          <div className="text-cyan-200 font-extrabold text-sm tracking-wide">
            RUN / TEST
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            Trigger the workflow or test the selected node.
          </div>
          <button
            onClick={selectedNode?.data?.nodeType === "Trigger" ? runTriggerTest : sendTest}
            disabled={!canRunTest || testLoading}
            className="mt-2 w-full rounded-xl bg-orange-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testLoading ? "Running…" : "Test step"}
          </button>
          {(selectedNode?.data?.nodeType === "Agent" && selectedNode?.data?.agentId) ||
          (selectedNode?.data?.nodeType === "NPC" && selectedNode?.data?.npcId) ||
          selectedNode?.data?.nodeType === "Trigger" ? (
            <div className="mt-2">
              <input
                placeholder={selectedNode?.data?.nodeType === "Trigger" ? "Optional: test message for workflow…" : "Type a message to test…"}
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (selectedNode?.data?.nodeType === "Trigger" ? runTriggerTest() : sendTest())}
                className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 placeholder-white/40 outline-none"
              />
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-500">
              Select an Agent node (with message) or Trigger node to test.
            </div>
          )}

          <div className="mt-3 text-cyan-200 font-semibold text-xs">OUTPUT</div>
          <div className="mt-1 flex gap-1">
            <button
              onClick={() => setTestOutputView("json")}
              className={`rounded-lg px-2 py-1 text-[10px] ${testOutputView === "json" ? "bg-cyan-500/40 text-cyan-100" : "text-slate-400 hover:text-slate-200"}`}
            >
              JSON
            </button>
            <button
              onClick={() => setTestOutputView("table")}
              className={`rounded-lg px-2 py-1 text-[10px] ${testOutputView === "table" ? "bg-cyan-500/40 text-cyan-100" : "text-slate-400 hover:text-slate-200"}`}
            >
              Table
            </button>
          </div>
          <div className="mt-1 max-h-[200px] overflow-auto rounded-xl border border-cyan-400/20 bg-black/40 p-2">
            {testOutputData != null ? (
              testOutputView === "json" ? (
                <pre className="text-[10px] text-emerald-200 whitespace-pre-wrap break-words">
                  {JSON.stringify(testOutputData, null, 2)}
                </pre>
              ) : (
                <div className="text-[10px]">
                  {Array.isArray(testOutputData) ? (
                    <table className="w-full text-left">
                      <tbody>
                        {(testOutputData as Record<string, unknown>[]).slice(0, 10).map((row, i) => (
                          <tr key={i}>
                            {Object.entries(row).map(([k, v]) => (
                              <td key={k} className="pr-2 py-0.5 border-b border-slate-700">
                                <span className="text-slate-400">{k}:</span> {String(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : typeof testOutputData === "object" ? (
                    <table className="w-full text-left text-emerald-200">
                      <tbody>
                        {Object.entries(testOutputData as Record<string, unknown>).map(([k, v]) => (
                          <tr key={k}>
                            <td className="pr-2 py-0.5 border-b border-slate-700 text-slate-400 w-24">{k}</td>
                            <td className="py-0.5">{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <pre className="text-emerald-200">{String(testOutputData)}</pre>
                  )}
                </div>
              )
            ) : testLog.length > 0 ? (
              <div className="space-y-2">
                {testLog.map((m, i) => (
                  <div key={i} className={`text-xs ${m.role === "user" ? "text-cyan-200" : "text-emerald-200"}`}>
                    <span className="opacity-70">{m.role}:</span> {m.text}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">Run a test to see output here.</div>
            )}
          </div>

          <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-1.5 text-[10px] text-emerald-200">
            Knowledge added in this map is shared across the AI Agents page. Add Knowledge nodes and link agents for RAG.
          </div>
        </div>
      </aside>
    </div>
  );
}
