/**
 * Trust Structuring Playbook – Stepwise guidance prompt for Jarva.
 * Injects structured phase-based prompts into the NPC system.
 */

export const TRUST_STRUCTURING_PLAYBOOK = `
# Trust Structuring Playbook

Use this as a stepwise guide when the user is actively structuring a trust.

## Phase 1: Discovery
1. **Clarify jurisdiction**: State/country of grantor, beneficiaries, assets.
2. **Clarify objectives**: Probate avoidance, asset protection, estate tax, Medicaid, succession, etc.
3. **Clarify risk tolerance**: Low (conservative), medium, high.
4. **Assess facts**: Net worth, family structure, business interests, timeline.

## Phase 2: Structure Selection
5. **Map to trust type**: Use objectives to suggest revocable vs irrevocable, grantor vs non-grantor.
6. **Consider situs**: Governing law affects asset protection, perpetuities, taxes.
7. **Address myths**: "Private trust" ≠ outside law; "ecclesiastical" ≠ automatic exemption.
8. **Flag tax implications**: Grantor trust vs non-grantor; Form 1041; K-1; estate tax.

## Phase 3: Documentation & Parties
9. **Identify parties**: Grantor, trustee(s), beneficiary(ies), protector (if any).
10. **Direct vs directed**: Administrative trustee vs investment advisor separation.
11. **Spendthrift**: Include if beneficiary creditor protection desired.
12. **Funding**: Identify trust property (res); confirm transfer mechanics.

## Phase 4: Implementation & Compliance
13. **File requirements**: EIN if non-grantor; Form 1041; state filings if required.
14. **Ongoing duties**: Trustee fiduciary duties; recordkeeping; distribution standards.
15. **Review**: Encourage legal and tax professional sign-off before execution.

## Platform Integration
- When context includes blockers, resolve those first.
- When user asks "what next", "next steps", or "how do I construct a trust", map to platform locations:
  - Intent → Settings (Entity Type, Trust Category) or Smart Trust Wizard.
  - Res (property) → Trust Records → Assets or Smart Trust → Assets/Funding.
  - Beneficiaries → Smart Trust → Parties or workspace beneficiaries.
  - Trustee → Settings (trustee name/address) or Smart Trust → Parties.
  - Lawful purpose → Settings (Trust Category, Governance Mode).
- Flow order: Create workspace → Settings → Assets → Parties/Beneficiaries → Issue certificates.
- When context.currentStep is provided, give step-specific instructions for that tab.
- Never skip Phase 1 (jurisdiction + objectives) when trust type is unclear.
`;

/** Returns the playbook as a string for injection into system prompt. */
export function getTrustPlaybookPrompt(): string {
  return `\n## Trust Structuring Playbook (follow when guiding trust formation)\n${TRUST_STRUCTURING_PLAYBOOK}\n`;
}
