import type { EntityPlaybook } from "./types";

export const FAMILY_OFFICE_PLAYBOOK: EntityPlaybook = {
  id: "family_office_v1",
  title: "Family Office",
  structureType: "company",
  description: "Jurisdiction, entity stack, governance, and service modules for family offices.",
  documents: [
    {
      docType: "policy",
      subtype: "family_office_playbook",
      schemaVersion: "1.0.0",
      bindingsKey: "family_office_v1",
    },
  ],
  launchPath: "/smart-trust?playbookId=family_office_v1",
};
