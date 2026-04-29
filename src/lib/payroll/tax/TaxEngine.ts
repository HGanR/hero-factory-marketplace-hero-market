/** Tax engine interface for payroll calculations. Swap implementations as needed. */

export type Money = { cents: number; currency: "USD" };

export type Address = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal: string;
  country: "US";
};

export type WorkerTaxContext = {
  workerId: string;
  type: "employee" | "contractor";
  residentAddress: Address;
  workAddress: Address;
  filingStatus?: string;
  allowances?: number;
  additionalWithholdingCents?: number;
};

export type EarningsLine = {
  code: "regular" | "overtime" | "bonus" | "commission" | "reimbursement";
  amount: Money;
};

export type TaxCalculationInput = {
  userId: number;
  payDate: string;
  periodStart: string;
  periodEnd: string;
  worker: WorkerTaxContext;
  earnings: EarningsLine[];
};

export type TaxLine = {
  jurisdiction: "federal" | "state" | "local";
  name: string;
  amount: Money;
  employerPortion?: Money;
  meta?: Record<string, unknown>;
};

export type TaxCalculationResult = {
  gross: Money;
  taxes: TaxLine[];
  preTaxDeductions?: TaxLine[];
  postTaxDeductions?: TaxLine[];
  net: Money;
};

export interface TaxEngine {
  kind: "manual" | "symmetry" | "embedded_provider";
  calculate(input: TaxCalculationInput): Promise<TaxCalculationResult>;
}

export type TaxEngineKind = "manual" | "symmetry" | "gusto" | "check" | "adp";
