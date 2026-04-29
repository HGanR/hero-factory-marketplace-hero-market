import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { agentArchitectureMaps } from "@/lib/db/schema";
import { ensureAgentArchitectureMapsTable } from "@/lib/agent-maps/db";
import { runAgentTest } from "@/lib/agents/run-agent-test";
import { runNpcChat } from "@/lib/npc/run-npc-chat";

type NodeData = {
  nodeType?: string;
  agentId?: string | null;
  npcId?: string | null;
  label?: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  accessToken?: string | null;
  [key: string]: unknown;
};

type MapNode = { id: string; data: NodeData };
type MapEdge = { id: string; source: string; target: string };

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    const parsed = JSON.parse(value) as unknown;
    return (Array.isArray(parsed) ? parsed : fallback) as T;
  } catch {
    return fallback;
  }
}

function extractMessage(payload: Record<string, unknown>): string {
  // Telegram: { message: { text, from, chat } }
  const tgMsg = payload.message as Record<string, unknown> | undefined;
  if (tgMsg && typeof tgMsg.text === "string" && tgMsg.text.trim()) return tgMsg.text.trim();
  if (typeof payload.message === "string" && payload.message.trim()) return payload.message.trim();
  if (typeof payload.text === "string" && payload.text.trim()) return payload.text.trim();
  if (typeof payload.body === "string" && payload.body.trim()) return payload.body.trim();
  const msg = payload.msg ?? payload.content ?? payload.input;
  if (typeof msg === "string" && msg.trim()) return msg.trim();
  return JSON.stringify(payload);
}

async function executeApiNode(
  node: MapNode,
  inputPayload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const baseUrl = (node.data.baseUrl ?? "").trim();
  if (!baseUrl) return { error: "Base URL not configured", input: inputPayload };

  const accessToken = (node.data.accessToken ?? "").trim();
  const apiKey = (node.data.apiKey ?? "").trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : apiKey ? { "X-API-Key": apiKey } : {}),
  };

  const res = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(inputPayload),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text, status: res.status };
  }
  return { status: res.status, data, nodeId: node.id };
}

export type WorkflowRunResult = {
  success: boolean;
  triggerNodeId: string;
  outputs: Array<{ nodeId: string; nodeType: string; result: unknown }>;
  error?: string;
};

type FrontierItem = { nodeId: string; message: string; payload: Record<string, unknown> };

/**
 * Run a workflow from a trigger node. Executes connected Agent and API/Tool nodes
 * in topological order, supporting agent-to-agent chaining (e.g. Trigger → Agent A → Agent B).
 * Each node runs at most once; the first incoming edge provides its input.
 */
export async function runWorkflow(
  userId: number,
  workspaceId: string,
  triggerNodeId: string,
  inputPayload: Record<string, unknown>
): Promise<WorkflowRunResult> {
  const db = await getDb();
  await ensureAgentArchitectureMapsTable(db);

  const [row] = await db
    .select()
    .from(agentArchitectureMaps)
    .where(and(eq(agentArchitectureMaps.workspaceId, workspaceId), eq(agentArchitectureMaps.userId, userId)))
    .limit(1);

  if (!row) throw new Error("Map not found");

  const nodes: MapNode[] = safeJsonParse(row.nodesJson, []);
  const edges: MapEdge[] = safeJsonParse(row.edgesJson, []);

  const triggerNode = nodes.find((n) => n.id === triggerNodeId);
  if (!triggerNode) throw new Error("Trigger node not found");

  const outputs: WorkflowRunResult["outputs"] = [];
  const executed = new Set<string>();
  const initialMessage = extractMessage(inputPayload);
  let frontier: FrontierItem[] = edges
    .filter((e) => e.source === triggerNodeId)
    .map((e) => ({
      nodeId: e.target,
      message: initialMessage,
      payload: inputPayload,
    }));

  while (frontier.length > 0) {
    const nextFrontier: FrontierItem[] = [];
    for (const { nodeId, message, payload } of frontier) {
      if (executed.has(nodeId)) continue;
      executed.add(nodeId);

      const targetNode = nodes.find((n) => n.id === nodeId);
      if (!targetNode) continue;

      const nodeType = String(targetNode.data?.nodeType ?? "");
      let outMessage = message;
      let outPayload = payload;

      if (nodeType === "Agent") {
        const agentId = targetNode.data?.agentId;
        if (!agentId) {
          outputs.push({ nodeId, nodeType, result: { error: "Agent not linked" } });
          continue;
        }
        try {
          const result = await runAgentTest(userId, agentId, message);
          outputs.push({ nodeId, nodeType, result });
          outMessage = result.reply;
          outPayload = { message: result.reply, reply: result.reply, previousOutput: result };
        } catch (err) {
          outputs.push({
            nodeId,
            nodeType,
            result: { error: err instanceof Error ? err.message : "Agent run failed" },
          });
          continue;
        }
      } else if (nodeType === "NPC") {
        const npcId = targetNode.data?.npcId;
        if (!npcId) {
          outputs.push({ nodeId, nodeType, result: { error: "NPC not selected" } });
          continue;
        }
        try {
          const context = workspaceId
            ? { workspaceId, trustId: workspaceId }
            : undefined;
          const result = await runNpcChat(npcId, message, context);
          outputs.push({ nodeId, nodeType, result });
          outMessage = result.reply;
          outPayload = { message: result.reply, reply: result.reply, previousOutput: result };
        } catch (err) {
          outputs.push({
            nodeId,
            nodeType,
            result: { error: err instanceof Error ? err.message : "NPC run failed" },
          });
          continue;
        }
      } else if (nodeType === "API" || nodeType === "Tool") {
        try {
          const result = await executeApiNode(targetNode, payload);
          outputs.push({ nodeId, nodeType, result });
          const data = (result.data as Record<string, unknown>) ?? {};
          outMessage = extractMessage(data);
          outPayload = { ...data, status: result.status, nodeId };
        } catch (err) {
          outputs.push({
            nodeId,
            nodeType,
            result: { error: err instanceof Error ? err.message : "API call failed" },
          });
          continue;
        }
      } else {
        continue;
      }

      for (const outEdge of edges.filter((e) => e.source === nodeId)) {
        if (!executed.has(outEdge.target)) {
          nextFrontier.push({ nodeId: outEdge.target, message: outMessage, payload: outPayload });
        }
      }
    }
    frontier = nextFrontier;
  }

  return {
    success: outputs.length > 0 && outputs.every((o) => !(o.result as { error?: string })?.error),
    triggerNodeId,
    outputs,
  };
}
