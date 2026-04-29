/**
 * Optional fields written by Jarva (`mergeTrustRecordsStoreFromIntake`) into the
 * `trust-records-state` draft `config` JSON. Consultant / draft use only — not authoritative legal facts.
 */
export type TrustRecordsJarvaDraftFields = {
  jarvaObjectivesDraft?: string;
  jarvaBeneficiariesSummaryDraft?: string;
  jarvaSuccessorTrusteeNote?: string;
  jarvaJurisdictionAmbiguityNote?: string;
  jarvaAssetScheduleNotesDraft?: string;
  jarvaPourOverWillIntentFlag?: boolean;
  /** ISO timestamp of last Jarva → Trust Records store merge */
  jarvaTrustRecordsSyncedAt?: string;
};
