# Digital Asset and Wallet Management integration plan

Status: audit and design only; not implemented.

Current irrevocable wizard stages: state, parties, terms, distributions, powers, funding, review, generate. Insert optional wallet stage after funding and before review. The separate Trust Records guided route uses getWizardSteps from src/lib/trust/wizardConfig and must remain consistent.

Offer Skip / No digital assets, Personal identity wallet, and Separate trust-controlled asset wallet. Reuse verified existing authentication and soulbound credential infrastructure; do not invent a second wallet connection system. Never collect seed phrases or private keys. Authenticate ownership with server-verified signed nonces, expiration and replay protection.

Trust wallet intake: chain, public address, custody model, authorized trustees, multisignature policy, recovery plan, proposed assets, and funding evidence. Distinguish proposed assets from verified transfers; wallet connection alone does not establish trust ownership. Record UCC Article 12 applicability and tax questions for professional review.

Keep wallet details scoped to authenticated trust permissions and out of public token metadata. The review packet must flag missing evidence and unresolved legal questions. Gold step completion must mean saved data or saved Not Applicable, not simply visiting the stage. Preserve certificate preview, document styling, and USB authorization for final printing.

Acceptance tests: optional skip, wallet role separation, signature replay rejection, persistence on reload, authorization checks, incomplete funding flag, review packet integration, and unchanged legacy wizard paths.
