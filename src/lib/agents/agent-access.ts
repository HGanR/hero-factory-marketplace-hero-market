import { getDb } from "@/lib/db";
import { aiAgents, aiAgentCollaborators } from "@/lib/db/schema";
import { and, eq, or } from "drizzle-orm";

/**
 * Returns true if the user can access the agent (owner or collaborator).
 */
export async function canAccessAgent(
  agentId: string,
  userId: number
): Promise<boolean> {
  const db = await getDb();

  const [agent] = await db
    .select({ id: aiAgents.id, userId: aiAgents.userId })
    .from(aiAgents)
    .where(eq(aiAgents.id, agentId))
    .limit(1);

  if (!agent) return false;
  if (agent.userId === userId) return true;

  const [collab] = await db
    .select()
    .from(aiAgentCollaborators)
    .where(
      and(
        eq(aiAgentCollaborators.agentId, agentId),
        eq(aiAgentCollaborators.userId, userId)
      )
    )
    .limit(1);

  return !!collab;
}
