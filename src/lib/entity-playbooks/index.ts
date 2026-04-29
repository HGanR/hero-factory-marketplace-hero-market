import type { EntityPlaybook } from "./types";
import { DAO_TOKEN_VOTING_PLAYBOOK } from "./dao-token-voting";
import { FAMILY_OFFICE_PLAYBOOK } from "./family-office";

export const ENTITY_PLAYBOOKS: EntityPlaybook[] = [
  DAO_TOKEN_VOTING_PLAYBOOK,
  FAMILY_OFFICE_PLAYBOOK,
];

export function getPlaybookById(id: string): EntityPlaybook | undefined {
  return ENTITY_PLAYBOOKS.find((p) => p.id === id);
}
