// lib/jurisdictions/dapt/validate.ts
import { DaptJurisdictionListSchema } from "./schema";
import { DAPT_JURISDICTIONS } from "./data";

export function assertDaptDataIntegrity() {
  const parsed = DaptJurisdictionListSchema.safeParse(DAPT_JURISDICTIONS);
  if (!parsed.success) {
    throw new Error("DAPT jurisdiction data failed schema validation.");
  }
}