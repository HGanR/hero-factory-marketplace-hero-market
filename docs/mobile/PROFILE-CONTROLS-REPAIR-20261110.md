# Mobile profile controls repair

Member reproduction was attempted against the live mobile site. Secure sign-in was declined, so a real signed-in browser failure is not claimed reproduced. The complete member shell is covered by DOM tests; current member controls activate under that fixture. The confirmed administrator failure is a silent client guard: administrator sessions intentionally had no member ID and therefore could not use any profile or Journey handlers.

## Proposed behavior

- Banner, circular avatar, Change Image and setup image actions use native labels bound to rendered file inputs, retaining keyboard access and account-bound selection. File selections are revalidated after a phone picker hides the page. No account image is cached in local storage.
- Profile pictures are optional. Gold, Dawn and Neon remain selectable and can be saved without uploading an avatar.
- Both Journey controls open the in-app World Explorer. A prominent link opens the complete website world gallery at https://troothhurtz.app/worlds. Website sign-in may be separate. Administrator mode can browse this surface; member-owned world data and edit APIs remain restricted to the owning member.
- Administrator profile reads and saves use the username from the verified administrator session and the separate `mobile_administrator_profiles` table. Request bodies cannot specify another identity. Existing member tables, credentials, worlds and assets are preserved.

## Database prerequisite

Before enabling administrator persistence, review and explicitly apply `scripts/sql/mobile-administrator-profiles.sql`. It adds one table and does not copy or alter member accounts. No migration has been executed. Missing administrator storage returns a clear unavailable response; application code never creates schema during a request.

## Terms findings

The live project has no `SMART_TRUST_MOBILE_TERMS_REQUIRED` variable in the inspected metadata. The source candidate is `draft-1.0`, unpublished, and still contains the privacy URL and governing venue placeholders. Therefore new members are not currently forced through an accepted/published terms page. The gate implementation supports sign-in → current terms acceptance → profile, with dated/versioned receipts and administrator exemption. Publishing the final document and enabling the gate remain separate owner decisions. This repair does not invent legal fields or record acceptance.

## Verification

73 local tests passed, including real-shell Journey/photo controls, member/admin profile isolation, forged identity rejection, terms access restrictions, optional-image skin saving, phone picker account revalidation, world save/reload and existing registration/PayPal attribution. Build and preview results are recorded in PR12. Real phone picker persistence and signed-in account testing remain unverified.
