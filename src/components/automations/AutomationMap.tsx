"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import { TRIGGER_LABELS, STEP_LABELS, type TriggerType, type StepType } from "@/lib/automations/types";

type TriggerNodeData = { type: "trigger"; label: string };
type StepNodeData = { type: "step"; label: string; config: Record<string, unknown> };

function TriggerNode({ data }: NodeProps<TriggerNodeData>) {
  return (
    <div className="min-w-[140px] rounded-lg border-2 border-cyan-500/60 bg-cyan-950/40 px-4 py-3 shadow-lg shadow-cyan-500/20">
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 !border-cyan-400 !bg-cyan-600" />
      <div className="text-xs font-medium uppercase tracking-wider text-cyan-400">Trigger</div>
      <div className="mt-0.5 text-sm font-semibold text-white">{data.label}</div>
    </div>
  );
}

function StepNode({ data }: NodeProps<StepNodeData>) {
  const sub = data.config?.titleTemplate || data.config?.title;
  return (
    <div className="min-w-[160px] rounded-lg border-2 border-purple-500/50 bg-purple-950/30 px-4 py-3 shadow-lg shadow-purple-500/15">
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-2 !border-purple-400 !bg-purple-600" />
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 !border-purple-400 !bg-purple-600" />
      <div className="text-xs font-medium uppercase tracking-wider text-purple-400">Action</div>
      <div className="mt-0.5 text-sm font-semibold text-white">{data.label}</div>
      {sub != null ? <div className="mt-1 truncate text-xs text-white/60">{String(sub).slice(0, 40)}{String(sub).length > 40 ? "…" : ""}</div> : null}
    </div>
  );
}

const nodeTypes = { trigger: TriggerNode, step: StepNode };

type Props = {
  triggerType: string;
  steps: Array<{ id: string; sortOrder: number; type: string; config: Record<string, unknown> }>;
};

export function AutomationMap({ triggerType, steps }: Props) {
  const nodeId = useCallback((prefix: string, i: number) => `${prefix}-${i}`, []);

  const { nodes, edges } = useMemo(() => {
    const n: Node[] = [];
    const e: Edge[] = [];

    const triggerLabel = TRIGGER_LABELS[triggerType as TriggerType] ?? triggerType ?? "Trigger";
    n.push({
      id: "trigger",
      type: "trigger",
      data: { type: "trigger", label: triggerLabel },
      position: { x: 120, y: 0 },
    });

    const sortedSteps = [...steps].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    sortedSteps.forEach((s, i) => {
      const id = nodeId("step", i);
      const label = STEP_LABELS[s.type as StepType] ?? s.type ?? "Step";
      n.push({
        id,
        type: "step",
        data: { type: "step", label, config: s.config ?? {} },
        position: { x: 80, y: 120 + i * 100 },
      });
      e.push({
        id: `e-${i}`,
        source: i === 0 ? "trigger" : nodeId("step", i - 1),
        target: id,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#a855f7", strokeWidth: 2 },
      });
    });

    return { nodes: n, edges: e };
  }, [triggerType, steps, nodeId]);

  return (
    <div className="h-[420px] w-full rounded-lg border border-white/10 bg-black/40">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: "#a855f7", strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#a855f7" },
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background color="#4f46e5" gap={16} size={1} style={{ opacity: 0.15 }} />
        <Controls className="!border-white/10 !bg-black/60 !text-white [&>button]:!border-white/10 [&>button]:!bg-white/5 [&>button]:!text-white/80 [&>button:hover]:!bg-white/10" />
        <MiniMap
          nodeColor="#7c3aed"
          maskColor="rgba(0,0,0,0.7)"
          className="!bg-black/40 !border-white/10"
        />
      </ReactFlow>
    </div>
  );
}
