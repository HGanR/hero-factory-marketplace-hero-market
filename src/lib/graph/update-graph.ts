/**
 * Canonical Business Graph — helper service and event-driven updates.
 * Creates nodes and edges from platform events.
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { graphNodes, graphEdges } from "@/lib/db/schema.graph";
import { v4 as uuidv4 } from "uuid";
import type { WorkflowTriggerEvent } from "@/lib/workflow-engine/execute";
import type { EmitPayload } from "@/lib/workflow-engine/emit-platform-event";

/**
 * Find or create a graph node. Returns node id.
 */
export async function createGraphNode(
  nodeType: string,
  refId: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const db = await getDb();
  const [existing] = await db
    .select({ id: graphNodes.id })
    .from(graphNodes)
    .where(and(eq(graphNodes.nodeType, nodeType), eq(graphNodes.refId, refId)))
    .limit(1);

  if (existing) return existing.id;

  const id = uuidv4();
  await db.insert(graphNodes).values({
    id,
    nodeType,
    refId,
    metadata: metadata ?? null,
  });
  return id;
}

/**
 * Create a graph edge. Skips if edge already exists.
 */
export async function createGraphEdge(
  fromNodeId: string,
  toNodeId: string,
  relationType: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const db = await getDb();
  const [existing] = await db
    .select({ id: graphEdges.id })
    .from(graphEdges)
    .where(
      and(
        eq(graphEdges.fromNodeId, fromNodeId),
        eq(graphEdges.toNodeId, toNodeId),
        eq(graphEdges.relationType, relationType)
      )
    )
    .limit(1);

  if (existing) return existing.id;

  const id = uuidv4();
  await db.insert(graphEdges).values({
    id,
    fromNodeId,
    toNodeId,
    relationType,
    metadata: metadata ?? null,
  });
  return id;
}

/**
 * Update graph from platform event. Called after emitPlatformEvent.
 * Does not throw — failures are logged but don't affect main flow.
 */
export async function updateGraphFromEvent(
  triggerEvent: WorkflowTriggerEvent,
  payload: EmitPayload,
  userId?: number
): Promise<void> {
  const uid = userId ?? (payload.userId as number);
  if (uid == null) return;

  try {
    switch (triggerEvent) {
      case "world_published": {
        const worldId = payload.worldId as string;
        const ownerId = (payload.ownerId ?? uid) as number;
        if (!worldId) break;

        const userNodeId = await createGraphNode("user", `user_${ownerId}`);
        const worldNodeId = await createGraphNode("world", `world_${worldId}`, {
          worldId,
          name: payload.worldName,
        });
        await createGraphEdge(userNodeId, worldNodeId, "OWNS");
        break;
      }

      case "commerce_node_created": {
        const worldId = payload.worldId as string;
        const nodeId = payload.nodeId as string;
        const ownerId = (payload.ownerId ?? uid) as number;
        if (!worldId || !nodeId) break;

        const userNodeId = await createGraphNode("user", `user_${ownerId}`);
        const worldNodeId = await createGraphNode("world", `world_${worldId}`);
        const commerceNodeId = await createGraphNode("commerce_node", `commerce_${nodeId}`, {
          nodeId,
          worldId,
          nodeType: payload.nodeType,
        });

        await createGraphEdge(userNodeId, commerceNodeId, "OWNS");
        await createGraphEdge(commerceNodeId, worldNodeId, "LOCATED_IN");
        break;
      }

      case "app_published": {
        const appId = payload.appId as string;
        const creatorId = (payload.creatorId ?? uid) as number;
        if (!appId) break;

        const userNodeId = await createGraphNode("user", `user_${creatorId}`);
        const appNodeId = await createGraphNode("app", `app_${appId}`, {
          appId,
          slug: payload.appSlug,
          name: payload.appName,
        });
        await createGraphEdge(userNodeId, appNodeId, "CREATED");
        break;
      }

      case "app_installed": {
        const appId = payload.appId as string;
        const installUserId = (payload.userId ?? uid) as number;
        if (!appId) break;

        const userNodeId = await createGraphNode("user", `user_${installUserId}`);
        const appNodeId = await createGraphNode("app", `app_${appId}`);
        await createGraphEdge(userNodeId, appNodeId, "USES", {
          scope: payload.scope,
          worldId: payload.worldId,
          entityId: payload.entityId,
        });
        break;
      }

      case "entity_created": {
        const entityId = payload.entityId as string;
        const workspaceId = payload.workspaceId as string;
        if (!entityId || !uid) break;

        const userNodeId = await createGraphNode("user", `user_${uid}`);
        const entityNodeId = await createGraphNode("entity", `entity_${entityId}`, {
          entityId,
          workspaceId,
        });
        await createGraphEdge(userNodeId, entityNodeId, "OWNS");
        break;
      }

      case "asset_purchased": {
        const assetId = payload.assetId as string;
        const purchaserId = (payload.userId ?? uid) as number;
        if (!assetId || !purchaserId) break;

        const userNodeId = await createGraphNode("user", `user_${purchaserId}`);
        const assetNodeId = await createGraphNode("asset", `asset_${assetId}`, {
          assetId,
          ownershipId: payload.ownershipId,
        });
        await createGraphEdge(userNodeId, assetNodeId, "OWNS", {
          licenseScope: payload.licenseScope,
        });
        break;
      }

      case "commerce_transaction": {
        const payerId = payload.payerId as number;
        const payeeId = payload.payeeId as number;
        const transactionId = payload.transactionId as string;
        const nodeId = payload.nodeId as string;
        const worldId = payload.worldId as string;
        if (!payerId || !payeeId || !transactionId) break;

        const payerNodeId = await createGraphNode("user", `user_${payerId}`);
        const payeeNodeId = await createGraphNode("user", `user_${payeeId}`);
        await createGraphEdge(payerNodeId, payeeNodeId, "PAYS", {
          transactionId,
          nodeId,
          worldId,
          amountToken: payload.amountToken,
          amountUSD: payload.amountUSD,
        });
        break;
      }

      default:
        // Other events: certificate_issued, instrument_issued, etc. — extend as needed
        break;
    }
  } catch (e) {
    console.error("[CBG] updateGraphFromEvent error", triggerEvent, e);
  }
}

