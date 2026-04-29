import { z } from "zod";

/**
 * Canonical consultant-led intake for mapping into Smart Trust / Trust Records.
 * Versioned for audit and forward compatibility.
 */
export const TRUST_INTAKE_SCHEMA_VERSION = 1 as const;

export const JarvaPartyIntakeSchema = z.object({
  name: z.string().max(500).optional(),
  email: z.union([z.string().email().max(320), z.literal("")]).optional(),
  phone: z.string().max(80).optional(),
  addressLine1: z.string().max(500).optional(),
  addressLine2: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  state: z.string().max(40).optional(),
  postalCode: z.string().max(40).optional(),
  country: z.string().max(120).optional(),
});

export const JarvaTrustIntakeSchema = z.object({
  schemaVersion: z.number().int().min(1).max(100).default(TRUST_INTAKE_SCHEMA_VERSION),
  /** Matter / engagement label (consultant-facing) */
  matterLabel: z.string().max(500).optional(),
  /** High-level trust purpose / objectives (free text; maps to draft.objectives) */
  objectives: z.string().max(20000).optional(),
  /** Governing / situs state code when known */
  governingState: z.string().max(10).optional(),
  /** Display name for trust instrument */
  trustName: z.string().max(500).optional(),
  grantor: JarvaPartyIntakeSchema.optional(),
  trustee: JarvaPartyIntakeSchema.optional(),
  successorTrusteeNote: z.string().max(5000).optional(),
  /** Primary beneficiary description (MVP: single text block) */
  beneficiariesSummary: z.string().max(20000).optional(),
  /** Pour-over will / testamentary coordination flag */
  pourOverWillNeeded: z.boolean().optional(),
  /** When situs / domicile / governing law conflict or are unclear in chat — draft note only */
  jurisdictionAmbiguityNote: z.string().max(2000).optional(),
  /** Non-authoritative asset / schedule notes (chat references); not a substitute for the asset registry */
  assetScheduleNotesDraft: z.string().max(20000).optional(),
  /** Spiritual / ecclesiastical selections — only populated when consultant indicates */
  spiritualOrEcclesiasticalNotes: z.string().max(20000).optional(),
  /** Consultant firm snapshot for draft headers */
  firm: z
    .object({
      name: z.string().max(500).optional(),
      address: z.string().max(2000).optional(),
      phone: z.string().max(80).optional(),
      email: z.string().max(320).optional(),
    })
    .optional(),
  /** Issuance / securities intent — informational; does not authorize issuance */
  securitiesIntentNotes: z.string().max(10000).optional(),
  /** Source metadata for audit */
  collectedAt: z.string().datetime().optional(),
  collectedByUserId: z.number().int().optional(),
});

export type JarvaTrustIntake = z.infer<typeof JarvaTrustIntakeSchema>;

export function parseJarvaTrustIntake(raw: unknown): { ok: true; data: JarvaTrustIntake } | { ok: false; error: string } {
  const r = JarvaTrustIntakeSchema.safeParse(raw);
  if (!r.success) return { ok: false, error: r.error.message };
  return { ok: true, data: r.data };
}

/** Dot-path keys with values present — for apply lineage / audit hints. */
export function listPopulatedJarvaIntakeFieldKeys(intake: JarvaTrustIntake): string[] {
  const keys: string[] = [];
  if (intake.matterLabel?.trim()) keys.push("matterLabel");
  if (intake.objectives?.trim()) keys.push("objectives");
  if (intake.governingState?.trim()) keys.push("governingState");
  if (intake.trustName?.trim()) keys.push("trustName");
  if (intake.grantor?.name?.trim()) keys.push("grantor.name");
  if (intake.grantor?.email?.trim()) keys.push("grantor.email");
  if (intake.grantor?.phone?.trim()) keys.push("grantor.phone");
  if (intake.grantor?.addressLine1?.trim()) keys.push("grantor.addressLine1");
  if (intake.grantor?.city?.trim()) keys.push("grantor.city");
  if (intake.grantor?.state?.trim()) keys.push("grantor.state");
  if (intake.grantor?.postalCode?.trim()) keys.push("grantor.postalCode");
  if (intake.trustee?.name?.trim()) keys.push("trustee.name");
  if (intake.trustee?.email?.trim()) keys.push("trustee.email");
  if (intake.trustee?.phone?.trim()) keys.push("trustee.phone");
  if (intake.successorTrusteeNote?.trim()) keys.push("successorTrusteeNote");
  if (intake.beneficiariesSummary?.trim()) keys.push("beneficiariesSummary");
  if (intake.pourOverWillNeeded === true || intake.pourOverWillNeeded === false) keys.push("pourOverWillNeeded");
  if (intake.jurisdictionAmbiguityNote?.trim()) keys.push("jurisdictionAmbiguityNote");
  if (intake.assetScheduleNotesDraft?.trim()) keys.push("assetScheduleNotesDraft");
  if (intake.spiritualOrEcclesiasticalNotes?.trim()) keys.push("spiritualOrEcclesiasticalNotes");
  if (intake.securitiesIntentNotes?.trim()) keys.push("securitiesIntentNotes");
  if (intake.firm?.name?.trim()) keys.push("firm.name");
  if (intake.firm?.email?.trim()) keys.push("firm.email");
  if (intake.firm?.phone?.trim()) keys.push("firm.phone");
  if (intake.firm?.address?.trim()) keys.push("firm.address");
  return keys;
}
