"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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

const NEON_BLUE = "#00E5FF";

type EntityType =
  | "Trust"
  | "LLC"
  | "LP"
  | "HoldingCo"
  | "Bank"
  | "RealEstate"
  | "IP"
  | "Other";

type EntityNodeData = {
  label: string;
  entityType: EntityType;
  subtitle?: string;
};

type MapListItem = {
  id: string;
  title: string;
  updatedAt: string;
};

type PaletteItem = {
  type: EntityType;
  label: string;
  subtitle?: string;
};

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

function NeonEntityNode({ data, selected }: NodeProps<EntityNodeData>) {
  return (
    <div
      style={{
        minWidth: 220,
        borderRadius: 14,
        padding: "14px 14px 12px",
        border: "2px solid rgba(255,120,0,0.95)",
        boxShadow: selected
          ? "0 0 0 2px rgba(255,120,0,0.35), 0 0 20px rgba(255,120,0,0.45)"
          : "0 0 14px rgba(255,120,0,0.2)",
        background:
          "linear-gradient(180deg, rgba(0,200,255,0.18) 0%, rgba(0,140,255,0.08) 60%, rgba(0,0,0,0.60) 100%)",
        color: "rgba(232,250,255,0.96)",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 12,
          height: 12,
          background: NEON_BLUE,
          border: `2px solid ${NEON_BLUE}`,
          boxShadow: `0 0 12px ${NEON_BLUE}`,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 12,
          height: 12,
          background: NEON_BLUE,
          border: `2px solid ${NEON_BLUE}`,
          boxShadow: `0 0 12px ${NEON_BLUE}`,
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs opacity-90">{data.entityType}</span>
        <span
          style={{
            height: 8,
            width: 8,
            borderRadius: 999,
            background: NEON_BLUE,
            boxShadow: `0 0 12px ${NEON_BLUE}`,
          }}
        />
      </div>
      <div className="mt-1 text-[15px] font-bold">{data.label}</div>
      {data.subtitle ? <div className="mt-1 text-[11px] opacity-80">{data.subtitle}</div> : null}
    </div>
  );
}

const nodeTypes = { neonEntity: NeonEntityNode };
const defaultEdgeOptions = {
  animated: true,
  style: {
    stroke: NEON_BLUE,
    strokeWidth: 3,
  },
};

const palette: PaletteItem[] = [
  { type: "Trust", label: "Trust", subtitle: "Governance + beneficiaries" },
  { type: "HoldingCo", label: "Holding Co", subtitle: "Ownership layer" },
  { type: "LLC", label: "Operating LLC", subtitle: "Revenue ops" },
  { type: "LP", label: "Limited Partnership", subtitle: "Capital + allocations" },
  { type: "RealEstate", label: "Real Estate", subtitle: "Property entity" },
  { type: "IP", label: "IP Vehicle", subtitle: "Copyright, trademark, code" },
  { type: "Bank", label: "Bank / Treasury", subtitle: "Cash control node" },
  { type: "Other", label: "Other", subtitle: "Custom entity" },
];

function templateNodes(name: string): Node<EntityNodeData>[] {
  if (name === "trust-stack") {
    return [
      { id: makeId("n"), type: "neonEntity", position: { x: 100, y: 120 }, data: { label: "Family Trust", entityType: "Trust", subtitle: "Settlor / Trustee" } },
      { id: makeId("n"), type: "neonEntity", position: { x: 460, y: 80 }, data: { label: "Holding Co", entityType: "HoldingCo", subtitle: "Owns operating entities" } },
      { id: makeId("n"), type: "neonEntity", position: { x: 460, y: 260 }, data: { label: "Operating LLC", entityType: "LLC", subtitle: "Commerce + contracts" } },
    ];
  }
  if (name === "real-estate") {
    return [
      { id: makeId("n"), type: "neonEntity", position: { x: 100, y: 170 }, data: { label: "Real Estate HoldCo", entityType: "HoldingCo", subtitle: "Master owner" } },
      { id: makeId("n"), type: "neonEntity", position: { x: 470, y: 70 }, data: { label: "Property LLC A", entityType: "RealEstate" } },
      { id: makeId("n"), type: "neonEntity", position: { x: 470, y: 200 }, data: { label: "Property LLC B", entityType: "RealEstate" } },
      { id: makeId("n"), type: "neonEntity", position: { x: 470, y: 330 }, data: { label: "Property LLC C", entityType: "RealEstate" } },
    ];
  }
  return [
    { id: makeId("n"), type: "neonEntity", position: { x: 100, y: 150 }, data: { label: "IP HoldCo", entityType: "HoldingCo", subtitle: "Licensing parent" } },
    { id: makeId("n"), type: "neonEntity", position: { x: 470, y: 90 }, data: { label: "IP Portfolio", entityType: "IP", subtitle: "Copyright / TM / software" } },
    { id: makeId("n"), type: "neonEntity", position: { x: 470, y: 260 }, data: { label: "Operating LLC", entityType: "LLC", subtitle: "Licensee" } },
  ];
}

export default function EntityMapsPage() {
  const [maps, setMaps] = useState<MapListItem[]>([]);
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [title, setTitle] = useState("New Entity Map");
  const [status, setStatus] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<EntityNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const flowRef = useRef<ReactFlowInstance | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId]
  );

  const loadMaps = useCallback(async () => {
    const res = await fetch("/api/entity-maps", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    const next = Array.isArray(data?.maps) ? data.maps : [];
    setMaps(next);
    if (!activeMapId && next.length) setActiveMapId(next[0].id);
  }, [activeMapId]);

  useEffect(() => {
    void loadMaps();
  }, [loadMaps]);

  useEffect(() => {
    if (!activeMapId) return;
    (async () => {
      setStatus("Loading...");
      const res = await fetch(`/api/entity-maps/${activeMapId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.error || "Failed to load map");
        return;
      }
      setTitle(String(data?.title || "Untitled"));
      setNodes(Array.isArray(data?.nodes) ? data.nodes : []);
      setEdges(Array.isArray(data?.edges) ? data.edges : []);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setStatus("");
    })();
  }, [activeMapId, setEdges, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge({ ...connection, id: makeId("e"), ...defaultEdgeOptions }, current)
      );
    },
    [setEdges]
  );

  const applyTemplate = (template: "trust-stack" | "real-estate" | "ip-structure") => {
    const tNodes = templateNodes(template);
    const [a, b, c, d] = tNodes;
    const tEdges: Edge[] = [];
    if (template === "trust-stack" && a && b && c) {
      tEdges.push(
        { id: makeId("e"), source: a.id, target: b.id, label: "Ownership", ...defaultEdgeOptions },
        { id: makeId("e"), source: b.id, target: c.id, label: "Control", ...defaultEdgeOptions }
      );
    } else if (template === "real-estate" && a && b && c && d) {
      tEdges.push(
        { id: makeId("e"), source: a.id, target: b.id, label: "Owns", ...defaultEdgeOptions },
        { id: makeId("e"), source: a.id, target: c.id, label: "Owns", ...defaultEdgeOptions },
        { id: makeId("e"), source: a.id, target: d.id, label: "Owns", ...defaultEdgeOptions }
      );
    } else if (template === "ip-structure" && a && b && c) {
      tEdges.push(
        { id: makeId("e"), source: a.id, target: b.id, label: "Owns IP", ...defaultEdgeOptions },
        { id: makeId("e"), source: a.id, target: c.id, label: "License", ...defaultEdgeOptions }
      );
    }
    setNodes(tNodes);
    setEdges(tEdges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setTitle(
      template === "trust-stack"
        ? "Trust Stack"
        : template === "real-estate"
        ? "Real Estate Structure"
        : "IP Structure"
    );
  };

  const addPaletteNode = (item: PaletteItem) => {
    const viewport = flowRef.current?.getViewport();
    const baseX = viewport ? (Math.abs(viewport.x) + 140) / Math.max(0.5, viewport.zoom) : 240;
    const baseY = viewport ? (Math.abs(viewport.y) + 120) / Math.max(0.5, viewport.zoom) : 180;
    const n: Node<EntityNodeData> = {
      id: makeId("n"),
      type: "neonEntity",
      position: { x: baseX + Math.random() * 130, y: baseY + Math.random() * 140 },
      data: { label: item.label, entityType: item.type, subtitle: item.subtitle },
    };
    setNodes((cur) => [...cur, n]);
  };

  const saveMap = async () => {
    setStatus("Saving...");
    const payload = { title, nodes, edges };
    const res = await fetch(activeMapId ? `/api/entity-maps/${activeMapId}` : "/api/entity-maps", {
      method: activeMapId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data?.error || "Save failed");
      return;
    }
    if (!activeMapId && data?.id) setActiveMapId(String(data.id));
    await loadMaps();
    setStatus("Saved ✓");
    setTimeout(() => setStatus(""), 1200);
  };

  const createNewMap = () => {
    setActiveMapId(null);
    setTitle("New Entity Map");
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  const resetCurrentMap = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setStatus("Map cleared. Save to persist.");
    setTimeout(() => setStatus(""), 2000);
  };

  const deleteCurrent = async () => {
    if (!activeMapId) return;
    const res = await fetch(`/api/entity-maps/${activeMapId}`, { method: "DELETE" });
    if (!res.ok) return;
    setActiveMapId(null);
    createNewMap();
    await loadMaps();
  };

  const handleSelection = (params: OnSelectionChangeParams) => {
    setSelectedNodeId(params.nodes?.[0]?.id ?? null);
    setSelectedEdgeId(params.edges?.[0]?.id ?? null);
  };

  const updateSelectedNode = (patch: Partial<EntityNodeData>) => {
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
    setEdges((cur) => cur.map((e) => (e.id === selectedEdgeId ? { ...e, ...patch } : e)));
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "grid",
        gridTemplateColumns: "300px 1fr 320px",
        background:
          "radial-gradient(circle at 22% 16%, rgba(0,180,255,0.22), rgba(0,0,0,0.94) 56%)",
      }}
    >
      <aside className="border-r border-orange-400/25 p-3 overflow-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-100 mb-2"
        >
          ← Back to Dashboard
        </Link>
        <div className="text-cyan-200 font-extrabold text-sm tracking-wide">ENTITY MAPS</div>
        <div className="text-[11px] text-cyan-400/90 mt-1">
          Drag from a node&apos;s right handle to another&apos;s left handle to connect
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={createNewMap} className="rounded-xl px-3 py-2 text-xs border border-cyan-400/40 bg-cyan-500/10 text-cyan-100">+ New</button>
          <button onClick={saveMap} className="rounded-xl px-3 py-2 text-xs border border-orange-400/50 bg-orange-500/10 text-orange-100">Save</button>
          <button onClick={resetCurrentMap} className="rounded-xl px-3 py-2 text-xs border border-amber-400/50 bg-amber-500/10 text-amber-100">Reset</button>
          {activeMapId ? (
            <button onClick={deleteCurrent} className="rounded-xl px-3 py-2 text-xs border border-red-400/50 bg-red-500/10 text-red-100">Delete</button>
          ) : null}
        </div>
        <div className="mt-2 text-[11px] text-slate-300">{status}</div>

        <label className="mt-4 block text-[11px] text-slate-300">Map title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
        />

        <div className="mt-4 text-[11px] text-orange-100 font-semibold">Templates</div>
        <div className="mt-2 grid gap-2">
          <button onClick={() => applyTemplate("trust-stack")} className="rounded-xl border border-orange-400/40 bg-black/30 px-3 py-2 text-left text-xs text-cyan-50">Trust Stack</button>
          <button onClick={() => applyTemplate("real-estate")} className="rounded-xl border border-orange-400/40 bg-black/30 px-3 py-2 text-left text-xs text-cyan-50">Real Estate HoldCo</button>
          <button onClick={() => applyTemplate("ip-structure")} className="rounded-xl border border-orange-400/40 bg-black/30 px-3 py-2 text-left text-xs text-cyan-50">IP Structure</button>
        </div>

        <div className="mt-4 text-[11px] text-orange-100 font-semibold">Entity palette</div>
        <div className="mt-2 grid gap-2">
          {palette.map((item) => (
            <button
              key={item.type}
              onClick={() => addPaletteNode(item)}
              className="rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-left text-xs text-cyan-50"
            >
              <div className="font-semibold">{item.label}</div>
              <div className="opacity-75">{item.subtitle || "Custom entity node"}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 text-[11px] text-orange-100 font-semibold">Recent maps</div>
        <div className="mt-2 grid gap-2">
          {maps.length === 0 ? (
            <div className="text-xs text-slate-400">No saved maps yet.</div>
          ) : (
            maps.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveMapId(m.id)}
                className={`rounded-xl border px-3 py-2 text-left text-xs ${
                  activeMapId === m.id
                    ? "border-orange-300/70 bg-orange-500/10 text-orange-100"
                    : "border-white/15 bg-black/25 text-cyan-50"
                }`}
              >
                <div className="font-semibold">{m.title}</div>
              </button>
            ))
          )}
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
          <MiniMap pannable zoomable />
          <Controls />
          <Background gap={18} size={1} />
        </ReactFlow>
      </main>

      <aside className="border-l border-orange-400/25 p-3 overflow-auto bg-black/25">
        <div className="text-cyan-200 font-extrabold text-sm tracking-wide">PROPERTIES</div>
        {selectedNode ? (
          <div className="mt-3 space-y-2">
            <div className="text-xs text-orange-100 font-semibold">Selected node</div>
            <label className="block text-[11px] text-slate-300">Label</label>
            <input
              value={selectedNode.data.label}
              onChange={(e) => updateSelectedNode({ label: e.target.value })}
              className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
            />
            <label className="block text-[11px] text-slate-300">Entity type</label>
            <select
              value={selectedNode.data.entityType}
              onChange={(e) => updateSelectedNode({ entityType: e.target.value as EntityType })}
              className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
            >
              {["Trust", "LLC", "LP", "HoldingCo", "Bank", "RealEstate", "IP", "Other"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="block text-[11px] text-slate-300">Subtitle</label>
            <textarea
              rows={4}
              value={selectedNode.data.subtitle || ""}
              onChange={(e) => updateSelectedNode({ subtitle: e.target.value })}
              className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
            />
          </div>
        ) : selectedEdge ? (
          <div className="mt-3 space-y-2">
            <div className="text-xs text-orange-100 font-semibold">Selected connection</div>
            <label className="block text-[11px] text-slate-300">Label</label>
            <input
              value={String(selectedEdge.label || "")}
              onChange={(e) => updateSelectedEdge({ label: e.target.value })}
              className="w-full rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm text-cyan-50 outline-none"
            />
            <label className="inline-flex items-center gap-2 text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(selectedEdge.animated)}
                onChange={(e) => updateSelectedEdge({ animated: e.target.checked })}
              />
              Animated connector
            </label>
          </div>
        ) : (
          <div className="mt-3 text-xs text-slate-400">
            Select a node or connection to edit its properties.
          </div>
        )}
      </aside>
    </div>
  );
}
