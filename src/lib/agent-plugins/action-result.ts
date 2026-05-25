export type AgentActionSuccess = {
  actionKey: string;
  agentId: string;
  data: unknown;
};

export function agentActionSuccess(actionKey: string, agentId: string, data: unknown): AgentActionSuccess {
  return { actionKey, agentId, data };
}
