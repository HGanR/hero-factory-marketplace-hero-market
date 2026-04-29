/**
 * Jarva Trust Module – Decision tree, schemas, playbook, architecture, guardrails.
 */

export {
  matchTrustObjectives,
  formatDecisionTreeOutput,
  type TrustObjective,
  type TrustType,
  type TrustRecommendation,
  type DecisionNode,
} from "./decision-tree";

export {
  KnowledgeEntrySchema,
  KnowledgeCategorySchema,
  TrustTypeSchema,
  UserTrustObjectiveSchema,
  JurisdictionSchema,
  NPCResponseContextSchema,
  TrustNPCStructuredResponseSchema,
  validateKnowledgeEntry,
  validateKnowledgeEntries,
  type KnowledgeEntryValidated,
  type NPCResponseContext,
  type TrustNPCStructuredResponse,
} from "./schema";

export {
  TRUST_STRUCTURING_PLAYBOOK,
  getTrustPlaybookPrompt,
} from "./playbook";

export {
  FAMILY_OFFICE_TRUST_ARCHITECTURE,
  getFamilyOfficeArchitecturePrompt,
} from "./family-office-architecture";

export {
  BANNED_CLAIMS,
  SAFE_ALTERNATIVES,
  passesGuardrails,
  detectBannedClaim,
  sanitizeResponse,
} from "./guardrails";
