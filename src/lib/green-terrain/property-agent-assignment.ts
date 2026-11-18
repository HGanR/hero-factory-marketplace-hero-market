/** Pure policy for Green Terrain property agent assignments. */
export type AgentSource = "npc" | "ai-agency";
export type ListingStatus = "published" | "unlisted";
export interface PropertyAgentAssignment {
  worldId: string;
  buildingId: string;
  source: AgentSource;
  agentId: string;
  status: ListingStatus;
}
export function canManagePropertyAssignments(session: { isAdmin?: boolean } | null | undefined): boolean {
  return session?.isAdmin === true;
}
export function canPublishAssignedAgent(agent: { source: AgentSource; activationStatus?: string }): boolean {
  // AI Agency drafts may be previewed by administrators, but never publicly published.
  return agent.source === "npc" || agent.activationStatus === "active";
}
export function visiblePropertyAssignment(
  assignment: PropertyAgentAssignment | null | undefined,
  agent: { source: AgentSource; activationStatus?: string } | null | undefined,
): PropertyAgentAssignment | null {
  if (!assignment || !agent || assignment.status !== "published") return null;
  if (assignment.source !== agent.source || !canPublishAssignedAgent(agent)) return null;
  return assignment;
}
export function validateAssignment(input: unknown): PropertyAgentAssignment {
  if (!input || typeof input !== "object") throw new Error("Invalid assignment");
  const value = input as Record<string, unknown>;
  const identifier = (key: string) => {
    const field = value[key];
    if (typeof field !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(field)) throw new Error("Invalid " + key);
    return field;
  };
  const worldId = identifier("worldId");
  const buildingId = identifier("buildingId");
  const source = value.source;
  const status = value.status;
  if (source !== "npc" && source !== "ai-agency") throw new Error("Invalid source");
  if (status !== "published" && status !== "unlisted") throw new Error("Invalid status");
  return { worldId, buildingId, source, agentId: identifier("agentId"), status };
}
