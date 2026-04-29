/**
 * Tax engine factory. Select engine via PAYROLL_TAX_ENGINE env.
 * - manual: estimates (no API)
 * - symmetry: Symmetry Tax Engine (SYMMETRY_API_KEY)
 * - gusto: Gusto Embedded (GUSTO_CLIENT_ID, GUSTO_CLIENT_SECRET, GUSTO_COMPANY_UUID)
 * - check: Check Payroll (CHECK_API_KEY, CHECK_COMPANY_ID)
 * - adp: ADP Embedded (ADP_CLIENT_ID, ADP_CLIENT_SECRET)
 */
import type { TaxEngine, TaxEngineKind } from "./TaxEngine";
import { ManualTaxEngine } from "./manual";
import { SymmetryTaxEngine } from "./symmetry";
import { GustoEmbeddedTaxEngine } from "./gusto";
import { CheckTaxEngine } from "./check";
import { ADPEmbeddedTaxEngine } from "./adp";

export type { TaxEngine, TaxEngineKind, TaxCalculationInput, TaxCalculationResult } from "./TaxEngine";
export { ManualTaxEngine } from "./manual";
export { SymmetryTaxEngine } from "./symmetry";
export { GustoEmbeddedTaxEngine } from "./gusto";
export { CheckTaxEngine } from "./check";
export { ADPEmbeddedTaxEngine } from "./adp";

export function getTaxEngine(kind?: TaxEngineKind): TaxEngine {
  const k = (kind ?? process.env.PAYROLL_TAX_ENGINE ?? "manual") as TaxEngineKind;
  switch (k) {
    case "symmetry":
      return new SymmetryTaxEngine();
    case "gusto":
      return new GustoEmbeddedTaxEngine();
    case "check":
      return new CheckTaxEngine();
    case "adp":
      return new ADPEmbeddedTaxEngine();
    default:
      return new ManualTaxEngine();
  }
}
