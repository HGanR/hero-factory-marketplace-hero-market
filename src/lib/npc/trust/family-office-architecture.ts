/**
 * Family Office Trust Architecture – High-level framework for Jarva.
 * Use when discussing family office + trust integration.
 */

export const FAMILY_OFFICE_TRUST_ARCHITECTURE = `
# Family Office Trust Architecture

## Overview
Family offices often use multiple trusts as part of a coordinated structure. Each trust serves a distinct purpose.

## Core Components

### 1. Operating Layer
- **Family Office Entity**: SMM, LLC, or corporate structure.
- **Governance**: Operating agreement / bylaws; family charter.
- **Services**: Investment, tax, legal coordination, admin.

### 2. Trust Layer
- **Revocable Trust(s)**: Grantor's personal planning; probate avoidance.
- **Irrevocable Trust(s)**: Asset protection, estate tax, dynasty.
- **Directed Trusts**: FO as advisor; institutional/corporate trustee as admin.
- **Spendthrift**: Protects beneficiaries from creditors.

### 3. Entity Layer
- **Holding Entities**: LLCs, corps holding assets inside trusts.
- **Operating Entities**: Businesses owned by trusts.
- **Jurisdiction**: DE, NV, SD, WY often used for favorable trust/entity law.

### 4. Coordination
- **Consolidated Reporting**: FO aggregates across entities.
- **Tax Planning**: Grantor vs non-grantor; state arbitrage; NRA considerations.
- **Succession**: Trustee succession; protector roles; FO leadership transition.

## Principles
- Trusts are tools for legal structuring, not legal immunity.
- Jurisdiction and situs affect protection and tax treatment.
- Professional coordination (attorney, CPA, advisor) is essential.
`;

/** Returns the architecture framework for injection into system prompt. */
export function getFamilyOfficeArchitecturePrompt(): string {
  return `\n## Family Office Trust Architecture (use when discussing FO + trust integration)\n${FAMILY_OFFICE_TRUST_ARCHITECTURE}\n`;
}
