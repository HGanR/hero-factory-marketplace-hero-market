# Save and share member worlds

Members can place owned library assets, press **Save My World**, and reopen the same world to restore persisted placement IDs, positions, rotations and scales. Saving is private draft storage; publishing updates the visitor snapshot. The editor saves its current placement snapshot before requesting publication.

The existing UUID primary key and `/worlds/{worldId}` route already provide a different persistent address for each world, even when names match. Saving, renaming or publishing does not regenerate this address. A persistent, selectable address and Copy world link control now replace the short-lived publication toast. Private worlds remain private; members explicitly select visitor access. Copying a private address does not grant access. Token-gated visitor support is unchanged.

## Repairs

- Draft and published placement replacement now use an isolated database connection and transaction, serialized by a world row lock. A failed write rolls back rather than leaving deleted or partially inserted placements. No migration or runtime schema change is required.
- Missing/invalid chunks are rejected; an explicit empty array saves an intentionally empty world.
- Storage read errors or missing versions fail instead of returning a misleading successful empty world. Editor load failures do not open a blank editable replacement.
- A failed save leaves the editable scene available with retry feedback. Unsaved placements remain dirty when edits happen during a request. Exit and browser unload warn about unsaved changes.
- Buying an asset refreshes the owned library without reloading and discarding current scene edits.
- Sharing controls wrap horizontally on narrow viewports and offer a selectable address when clipboard access fails.
- Workflow events are emitted after database commit. Ownership validation uses the world's owner when an authorized editor saves on their behalf.

## Validation

18 focused tests pass locally: actual route handlers run with a simulated transactional storage adapter; React controls run in jsdom. These cover save/reload, transforms, rollback after insert failure, empty worlds, malformed chunks, owner-only writes, read failure, published snapshot persistence/rollback, unique IDs for identically named worlds, save controls, persistent addresses, clipboard failure, busy/retry states explicit sharing access, save-before-publish ordering, failed-save publication blocking, in-flight edits and duplicate-click protection.

TypeScript transpilation reports zero syntax diagnostics for the affected files. An isolated CI job checks the transaction helper against real Drizzle/MySQL types and runs the focused tests. The isolated transaction helper type check passes locally against Drizzle 0.45.0 and mysql2 3.15.3. These checks do not establish a live database or physical-phone acceptance result.

## Remaining acceptance

Use an approved member in a protected preview: create two worlds with the same name, place an owned asset, save, sign out/in and reopen; verify position/rotation/scale. Open the two world links separately; explicitly publish an unlisted world, then view it signed out. Confirm private drafts are inaccessible to visitors and other members cannot write. Exercise failed saves, wallet-owner access, touch controls and simultaneous requests against the actual database.

The mobile preview's saved-world-only explorer still needs integration with the website editor and session flow. This PR repairs the existing `/worlds/{worldId}/edit` pipeline, not the absent mobile wallet/library interface. Paid TROO verification identified by the mobile audit remains a separate blocker before enabling paid acquisition. No real purchase, catalog publication, merge, migration, or production change was performed.
