# Green Terrain agent assignment reconstruction

## Source of truth
The administrator uploaded `green-terrain-integration-source.zip` on 2026-11-17. Its `src/app/green-terrain/page.tsx` and `src/components/green-terrain/WorldManagementUI.tsx` contain newer GLB placement and editor behavior than the default GitHub branch. Do not replace these files with older remote versions.

## Invariants
- Only a verified administrator session may create, update or unlist a building-agent assignment. Do not reuse the broader `requireAdminOrAuth` placement permission.
- Existing NPCs and AI Agency agents must be referenced, not recreated or mutated.
- AI Agency agents in `draft` state remain non-public; assignment does not activate them.
- Visitor endpoints expose only published assignments, never administrator selection controls.
- `Unlisted` hides the sign without deleting the building or agent.
- Placement & Rotation starts collapsed and retains values when reopened.
- Preserve current GLB placements, world layout, chat integration and assets.
- No production deploy or merge without separate approval.

## Integration locations
- `src/components/green-terrain/WorldManagementUI.tsx`: editor controls
- `src/app/green-terrain/page.tsx`: selected building and scene behavior
- `src/components/green-terrain/AgentChatPanel.tsx`: existing chat UI
- `src/app/api/admin/troo-world/npcs/route.ts`: admin NPC list
- `src/lib/ai-agency/ai-agency-draft-service.ts`: draft activation restriction
- `src/app/api/admin/troo-world/placements/route.ts`: existing broader placement API; keep separate

## Required verification
Admin save success, member and anonymous save rejection, unchanged NPC/AI Agency records, unlisted sign removal, draft nonpublication, visitor chat, dropdown state preservation, and TypeScript/build tests.
