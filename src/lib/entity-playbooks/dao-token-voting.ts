import type { EntityPlaybook } from "./types";
import { DAO_SCHEMA_VERSION } from "@/lib/governance/constitution/dao-token-voting/bindings";

export const DAO_TOKEN_VOTING_PLAYBOOK: EntityPlaybook = {
  id: "dao_token_voting_constitution_v1",
  title: "DAO Token Voting Constitution",
  structureType: "dao",
  description: "Token-weighted governance constitution with treasury and safety controls.",
  documents: [
    {
      docType: "constitution",
      subtype: "dao_token_voting",
      schemaVersion: DAO_SCHEMA_VERSION,
      bindingsKey: "dao_token_voting",
    },
  ],
  launchPath: "/smart-trust?docs=constitution&constitutionSubtype=dao_token_voting&playbookId=dao_token_voting_constitution_v1",
};
