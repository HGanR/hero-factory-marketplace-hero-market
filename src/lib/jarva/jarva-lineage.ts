/**
 * Audit lineage for Jarva: chat → extracted fields → draft application.
 * Stored inside jarva-trust-intake draft payload JSON (trust_drafts.payloadJson, draftType jarva-trust-intake).
 */

export type JarvaLineageEntry = {
  id: string;
  at: string;
  /** oasis_npc_messages.id when available */
  sourceMessageId?: number;
  /** Client-side NPC session UUID */
  npcSessionId?: string;
  sourceRole?: "user" | "npc";
  /** Short user message snippet */
  messageSnippet: string;
  /** Field keys touched by extraction (e.g. grantor.name, governingState) */
  extractedFieldKeys: string[];
  /** Where data was written */
  targets: Array<"jarva_intake" | "smart_trust_draft" | "trust_records_state">;
  /** Hints for Smart Trust / records mapping */
  mappedDestinationHints?: string[];
  /** chat_extraction | manual_save | auto_apply | manual_apply */
  applyKind?: "chat_extraction" | "manual_save" | "auto_apply" | "manual_apply";
  /** actorUserId for apply/save (when not chat) — optional */
  actorUserId?: number;
  /** Optional note */
  note?: string;
  /** Per-field confidence for this extraction row */
  fieldConfidence?: Record<string, "high" | "medium" | "low">;
};

export function newLineageId(): string {
  return `jl_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function appendJarvaLineage(
  existing: JarvaLineageEntry[] | undefined,
  entry: Omit<JarvaLineageEntry, "id"> & { id?: string }
): JarvaLineageEntry[] {
  const next = [...(existing ?? [])];
  next.push({
    id: entry.id ?? newLineageId(),
    at: entry.at,
    sourceMessageId: entry.sourceMessageId,
    npcSessionId: entry.npcSessionId,
    sourceRole: entry.sourceRole,
    messageSnippet: entry.messageSnippet.slice(0, 500),
    extractedFieldKeys: entry.extractedFieldKeys,
    targets: entry.targets,
    mappedDestinationHints: entry.mappedDestinationHints,
    applyKind: entry.applyKind,
    actorUserId: entry.actorUserId,
    note: entry.note,
    fieldConfidence: entry.fieldConfidence,
  });
  const max = 80;
  if (next.length > max) return next.slice(next.length - max);
  return next;
}

/** Default mapping hints when intake merges into Smart Trust draft (orchestrator paths). */
export function defaultMappedHintsFromFieldKeys(keys: string[]): string[] {
  const hints: string[] = [];
  for (const k of keys) {
    if (k.startsWith("grantor.") || k === "grantor") hints.push("smart_trust_draft.parties[Grantor/Settlor]");
    if (k.startsWith("trustee.") || k === "trustee") hints.push("smart_trust_draft.parties[Trustee]");
    if (k === "objectives" || k === "governingState" || k === "trustName" || k === "matterLabel") {
      hints.push("smart_trust_draft." + k);
    }
    if (k.startsWith("firm.")) hints.push("smart_trust_draft.firmHeader");
    if (k === "beneficiariesSummary") hints.push("trust_records_state.jarvaBeneficiariesSummaryDraft");
    if (k === "successorTrusteeNote") hints.push("trust_records_state.jarvaSuccessorTrusteeNote");
    if (k === "jurisdictionAmbiguityNote") hints.push("trust_records_state.jarvaJurisdictionAmbiguityNote");
    if (k === "assetScheduleNotesDraft") hints.push("trust_records_state.jarvaAssetScheduleNotesDraft");
    if (k === "pourOverWillNeeded") hints.push("trust_records_state.jarvaPourOverWillIntentFlag");
  }
  return [...new Set(hints)];
}

export type JarvaFieldSource = {
  fieldKey: string;
  sourceMessageId?: number;
  messageSnippet: string;
  at: string;
  confidence?: "high" | "medium" | "low";
  lineageEntryId: string;
};

/** Latest wins per field key — reverse lookup for “View source”. */
export function buildFieldSourceMap(lineage: JarvaLineageEntry[] | undefined): Record<string, JarvaFieldSource> {
  const out: Record<string, JarvaFieldSource> = {};
  if (!lineage?.length) return out;
  for (const e of lineage) {
    /** Apply rows list populated keys for audit but must not overwrite chat/form capture sources. */
    if (e.applyKind === "auto_apply" || e.applyKind === "manual_apply") continue;
    for (const fk of e.extractedFieldKeys) {
      const confidence = e.fieldConfidence?.[fk];
      out[fk] = {
        fieldKey: fk,
        sourceMessageId: e.sourceMessageId,
        messageSnippet: e.messageSnippet,
        at: e.at,
        confidence,
        lineageEntryId: e.id,
      };
    }
  }
  return out;
}

/** Consultant-facing: per-field explanation beyond the flat source table. */
export type JarvaFieldExplain = JarvaFieldSource & {
  inferredFromLlm: boolean;
  destinationHints: string[];
  /**
   * Latest workspace apply (auto or manual) — shared across fields when per-field lineage
   * is missing (legacy rows). Prefer lastApplyTimestampForField when set.
   */
  applyTimestamp?: string;
  /** Kind of the source lineage row (usually chat_extraction for chat-derived fields). */
  sourceApplyKind?: JarvaLineageEntry["applyKind"];
  /** Most recent apply event that listed this field in extractedFieldKeys (when lineage supports it). */
  lastApplyTimestampForField?: string;
  lastApplyKindForField?: Extract<JarvaLineageEntry["applyKind"], "auto_apply" | "manual_apply">;
  lastApplyLineageEntryId?: string;
};

/** Walk newest → oldest apply rows; first hit where the row lists this field key wins. */
export function findLastApplyMetadataForField(
  lineage: JarvaLineageEntry[] | undefined,
  fieldKey: string
): { at: string; kind: "auto_apply" | "manual_apply"; id: string } | undefined {
  if (!lineage?.length) return undefined;
  for (let i = lineage.length - 1; i >= 0; i--) {
    const e = lineage[i]!;
    if (e.applyKind !== "auto_apply" && e.applyKind !== "manual_apply") continue;
    const keys = e.extractedFieldKeys ?? [];
    if (keys.length === 0) continue;
    if (keys.includes(fieldKey)) {
      return { at: e.at, kind: e.applyKind, id: e.id };
    }
  }
  return undefined;
}

export function buildFieldExplainabilityMap(lineage: JarvaLineageEntry[] | undefined): Record<string, JarvaFieldExplain> {
  const base = buildFieldSourceMap(lineage);
  const applyEntries = (lineage ?? []).filter(
    (e) => e.applyKind === "auto_apply" || e.applyKind === "manual_apply"
  );
  const lastApplyAt = applyEntries.length ? applyEntries[applyEntries.length - 1]!.at : undefined;

  const out: Record<string, JarvaFieldExplain> = {};
  for (const [k, v] of Object.entries(base)) {
    const entry = (lineage ?? []).find((e) => e.id === v.lineageEntryId);
    const inferredFromLlm = Boolean(
      entry?.applyKind === "chat_extraction" &&
        (v.confidence === "low" || Boolean(entry.note && /LLM|inferred/i.test(entry.note)))
    );
    const destinationHints =
      entry?.mappedDestinationHints?.length ? entry.mappedDestinationHints : defaultMappedHintsFromFieldKeys([k]);
    const perFieldApply = findLastApplyMetadataForField(lineage, k);
    out[k] = {
      ...v,
      inferredFromLlm,
      destinationHints,
      applyTimestamp: lastApplyAt,
      sourceApplyKind: entry?.applyKind,
      lastApplyTimestampForField: perFieldApply?.at,
      lastApplyKindForField: perFieldApply?.kind,
      lastApplyLineageEntryId: perFieldApply?.id,
    };
  }
  return out;
}
