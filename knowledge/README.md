Jarva Local Knowledge Library
=============================

Drop legal and reference materials here so they can be curated and loaded into Jarva knowledge.

Knowledge-Only Architecture (No External APIs)
-----------------------------------------------

The platform advisor (Jarva) operates without relying on external LLM APIs. Responses are generated from:

1. **Curated knowledge base** – Stored in `oasis_npc_knowledge`; seeded from `JARVA_KNOWLEDGE` in `src/lib/npc/db.ts`
2. **Keyword matching** – User message matched against topic keywords (with synonym expansion)
3. **Rule-based fallbacks** – Trust decision tree, step-aware guidance, blocker resolution
4. **Context** – Current tab, workspace counts, blockers, client record (when bound)

Optional: Set `NPC_LLM_ENABLED=true` and `NPC_LLM_ENDPOINT` to enhance rule-based fallbacks with an LLM. The platform never requires it—all features work in knowledge-only mode.

Folder layout
-------------

- `knowledge/trust/`:
  trust administration guides, trust drafting references, trustee duty checklists.
- `knowledge/family-office/`:
  family office governance, investment policy, operating model references.
- `knowledge/jurisprudence/`:
  case-law summaries, legal treatises, statutory interpretation notes.
- `knowledge/entity-variations/`:
  entity-specific material (LLC, corporation, partnership, nonprofit, foundation, etc.).

Recommended file types
----------------------

- PDF (books, legal references)
- Markdown (curated summaries and rules)
- TXT (quick notes/checklists)

Operational notes
-----------------

- Keep raw source files and a short curated summary for each source.
- Prefer one topic per file to improve retrieval precision.
- Include jurisdiction and year in filenames, for example:
  `delaware-trust-code-2024-summary.md`
  `uniform-trust-code-commentary-2023.pdf`

Important
---------

This folder is the content staging area. To make content available in chat responses,
load curated excerpts into NPC knowledge records (via admin knowledge tooling or import job).
