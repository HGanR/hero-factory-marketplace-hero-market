export type PlaybookDocument = {
  docType: "constitution" | "bylaws" | "trust_agreement" | "operating_agreement" | "charter" | "minutes" | "resolutions" | "policy";
  subtype?: string;
  schemaVersion: string;
  bindingsKey: string;
};

export type EntityPlaybook = {
  id: string;
  title: string;
  structureType: "trust" | "association" | "dao" | "foundation" | "company";
  description: string;
  documents: PlaybookDocument[];
  launchPath: string;
};
