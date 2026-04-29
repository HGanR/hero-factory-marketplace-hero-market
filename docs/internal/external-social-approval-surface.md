# External / client social publish approval (Part 39)

**Purpose:** Let a **client or outside reviewer** approve or reject **governed** social posts for a **single campaign** using a **narrow, token-based** surface. There is **no second approval state machine**: decisions flow through the same UTM/governance merge and **`campaign_audit_events`** as internal Revenue OS reviewers.

## Access model

- **Table:** `campaign_external_social_review_tokens` (migration `drizzle/0089_campaign_external_social_review_tokens.sql`).
- **Stored value:** **SHA-256 hash** of the raw secret token; the raw token is shown **once** when minted and is embedded only in the review URL.
- **Scope:** One row is tied to **`campaign_id`**. Listing and decisions are limited to posts in that campaign.
- **`allowed_roles_json`:** Subset of `editor` | `approver` | `owner`. The external queue only surfaces posts where the **current** pending chain step’s required role is covered by this set (same semantics as internal multi-step chains).
- **Expiration / revocation:** Optional `expires_at`; `revoked_at` clears access. Invalid/expired tokens return **`401 INVALID_TOKEN`**.
- **Mint (internal):** `POST /api/social/external-review-tokens` — requires **authenticated user**, **Revenue OS API access** (`enforceRevenueOsApiAccess`), and **campaign reviewer access** (`getCampaignReviewerAccess`). Response includes `reviewUrl` (`/review/social-publish?t=...`), `token` (raw, one-time display), `expiresAt`, `allowedRoles`.
- **Revoke (internal):** `POST /api/social/external-review-tokens/[id]/revoke` — same gates as mint.

External reviewers **do not** get the full operator UI or Revenue OS surfaces; they only use the public review route and external APIs below.

## Approval mechanics (same as internal)

- Decisions call **`applyCampaignPostPublishApprovalWrite`** with an actor that uses **label-only governance** where needed so client actions still merge UTM correctly without impersonating a specific internal user ID for governance identity.
- **Audit:** `details` include `reviewSurface: "external_social_review"`, `externalReviewTokenId`, and the usual publish-approval audit fields. **`userId` on the audit row** is the token’s **`created_by_user_id`** (operator who minted the link), so attribution stays traceable while the **decided-by label** reflects the external/client context in notifications and summaries.
- **Planner / timeline:** The same `publish_approval_approved` / `publish_approval_rejected` (and chain-advanced) events appear in **`activityTimeline`**. Timeline labels append **“(client review link)”** when `reviewSurface === "external_social_review"` (`social-publish-observability.ts`).
- **Notifications:** When enabled, owner follow-ups can treat **external** decisions distinctly (`externalClientReview` flag in publish-approval notification helpers).

## Staleness (`approvalReviewSnapshot`)

Clients **must** send the snapshot returned with each post on **every decision** (`POST .../decision`):

- `expectedApprovalStatus` — parsed UTM status at load time.
- `postUpdatedAt` — post row `updated_at` at load time.
- `expectedApprovalStepIndex` — when a multi-step chain is pending, the clamped step index awaiting action.

The server rejects decisions when the snapshot no longer matches (post edited, resubmitted, or decided elsewhere), so reviewers cannot silently approve **stale** content.

## External API (no Revenue OS gate on these routes)

Auth: **`Authorization: Bearer <token>`** or **`?token=`** on GET; **POST** body includes `token` (see `external-social-review-http.ts`).

| Method | Path | Role |
|--------|------|------|
| GET | `/api/external/social-publish-approval/posts` | List governed campaign posts with **external-safe** fields + `approvalReviewSnapshot` + `canDecide`. |
| GET | `/api/external/social-publish-approval/posts/[postId]` | Single post detail (same shape, **404** if wrong campaign). |
| POST | `/api/external/social-publish-approval/posts/[postId]/decision` | Body: `token`, `decision` (`approve` \| `reject`), `reason` (**required** on reject), `approvalReviewSnapshot`. |

Responses intentionally omit internal-only campaign/client payloads.

## UI

- **Route:** `/review/social-publish` — query `t` optional; client can paste token (`SocialPublishExternalReviewClient`).
- **Layout:** Queue of posts (pending/decidable first) + detail panel + approve / reject (reason on reject) + feedback and empty/error states (invalid token, nothing pending, not actionable after refresh).

## Tests (non-exhaustive pointers)

- `src/lib/social/external-social-review-token.spec.ts` — hash / verify helpers.
- `src/lib/revenue-os/apply-campaign-post-publish-approval-write.spec.ts` — stale vs fresh approval writes.
- `src/app/api/external/social-publish-approval/posts/[postId]/decision/route.spec.ts` — validation (e.g. reject without reason).
- `src/lib/revenue-os/publish-approval-notification.spec.ts` — external notification flag.
- `src/lib/social/external-social-review-operator-summary.spec.ts` — token status + audit scan helper.
- `src/app/api/social/external-review-tokens/route.spec.ts` — operator GET summary.
- `src/components/revenue-os/RevenueOsPublishingPlanner.spec.tsx` — client review section + list hint.
- `src/components/revenue-os/ClientReviewLinkOperatorSection.spec.tsx` — token list + mint payload.
- `src/lib/social/client-review-share-message.spec.ts` — share text + email subject/HTML helpers.
- `src/app/api/social/external-review-link-email/route.spec.ts` — mint + send + audit.

## Part 40 — operator UX (Revenue OS publishing planner)

- **Detail panel:** `ClientReviewLinkOperatorSection` in **`RevenueOsPublishingPlanner`** (governed providers only) loads **`GET /api/social/external-review-tokens?campaignId=&postId=`** (Revenue OS + campaign reviewer access). Operators see primary summary, post signal, last client decision, and mint controls (see **Part 41** for full token history and share helpers).
- **Planner list:** Items include **`hasActiveClientReviewLink`** when **`GET /api/social/planner`** finds any **active** (unrevoked, unexpired) token for that post’s campaign. Pending rows show a short **“Active client review link (campaign)”** hint.
- **Multi-token behavior:** Minting does **not** auto-revoke older links; several active tokens can coexist. The UI treats the **newest active** token as “primary” for eligibility hints.
- **Staleness:** Editing/resubmitting a post does **not** revoke tokens; the external **snapshot** still blocks stale approvals. Operators should ask clients to **refresh** after material edits.

## Part 41 — token management + share workflow

- **GET tokens:** Each row includes **`createdByUserId`** (minting operator), **`label`**, **`allowedRoles`**, dates, and **`status`** (`active` \| `expired` \| `revoked`). No raw token secret; no historic URL unless the browser still holds it from mint.
- **Mint `POST /api/social/external-review-tokens`:** Optional **`label`**, **`allowedRoles`** (`editor` \| `approver` \| `owner`), **`expiresInDays`**, **`contextPostId`**. When **`contextPostId`** is a post in the same campaign, an audit row is stored with that **`post_id`** so it appears on the post activity timeline. Response includes **`label`**, **`reviewUrl`**, etc.
- **Revoke `POST .../revoke`:** Optional JSON body **`{ contextPostId?: string }`** — same timeline attachment rule. Only that token row is revoked.
- **Audit (timeline):** Actions **`external_review_link_minted`**, **`external_review_link_revoked`**, **`external_review_link_email_sent`**, **`external_review_links_bulk_revoked`** (`platform: ext_review`, `details.reviewSurface: operator_token_lifecycle`, token metadata). Included in **`SOCIAL_POST_TIMELINE_AUDIT_ACTIONS`**; mapped in **`social-publish-observability.ts`** as **`other`** with readable labels. Rows without a valid **`contextPostId`** are stored with **`post_id` null** (audit-only, not on a post timeline).
- **UI:** Recent links list (newest first), per-row **Revoke**, **Copy URL** / **Copy message** when the URL is known in-session, optional **label** + role checkboxes + **Copy last share message** (`buildClientReviewShareMessage`).

## Part 42 — email delivery (operator)

- **Shared mint:** `performOperatorExternalReviewTokenMint` in **`perform-operator-external-review-token-mint.ts`** — used by **`POST /api/social/external-review-tokens`** and the email route (single insert + mint audit pattern).
- **`POST /api/social/external-review-link-email`** (Revenue OS + campaign reviewer access): validates **`recipientEmail`**, mints a **new** token (same options as mint: **`label`**, **`allowedRoles`**, **`expiresInDays`**, **`contextPostId`**), builds plain text with **`buildClientReviewShareMessage`** + optional **`prependRecipientGreeting`** (canonical body), wraps with **`buildClientReviewShareEmailHtml`** for the HTML body sent via **`EmailNotificationService.send`** (inline-styled header, CTA button + plain URL, expiry/campaign context, full plain-text block). Optional **`subject`** / **`bodyText`** overrides still apply to the plain source. **`plainTextShareMessageToEmailHtml`** remains for simple HTML wrapping elsewhere. On success, inserts **`external_review_link_email_sent`** (timeline when **`contextPostId`** resolves to a post). On send failure after mint, returns **502** with **`tokenId`** so operators know a new link exists.
- **UI (`ClientReviewLinkOperatorSection`):** **Email delivery** panel — recipient, optional name, subject, plain-text body; **Open email app (draft)** uses **`mailto:`** with a URL known in-session (mint first) and stays **plain text**; length guard (~1950 chars) falls back to “use Send via server”. **Send via server (new link)** calls the email API (branded HTML). **`buildClientReviewShareEmailSubject`** defaults subject using label + campaign name.
- **Tests:** `src/app/api/social/external-review-link-email/route.spec.ts`, extended **`client-review-share-message.spec.ts`**, timeline allow-list for **`external_review_link_email_sent`**.

## Part 43 — bulk revoke + branded review email

- **Bulk revoke API:** **`POST /api/social/external-review-tokens/bulk-revoke`** (Revenue OS + campaign reviewer access). Body: **`campaignId`** (required), **`mode`**: **`all_active`** \| **`all_except_primary`**, optional **`contextPostId`**. Only **active** tokens are affected (**`revoked_at` null** and **`expires_at` null or future**). **`all_except_primary`** revokes every active token **except** the **newest by `created_at`** (same “primary” notion as the operator summary). Response: **`revokedCount`**, **`remainingActiveCount`**, **`revokedTokenIds`**. **No migration** — uses existing token columns.
- **Audit:** When **`revokedCount > 0`**, a **single** summary row **`external_review_links_bulk_revoked`** is written (`platform: ext_review`, `details`: campaign, mode, counts, capped token id list, optional **`contextPostId`** in details). **Per-token `external_review_link_revoked` rows are not emitted for bulk** (individual revoke route unchanged). Timeline: allow-listed in **`SOCIAL_POST_TIMELINE_AUDIT_ACTIONS`**; **`contextPostId`** resolution matches mint/revoke (attach to post when valid for the campaign).
- **UI:** **`ClientReviewLinkOperatorSection`** — compact **campaign-scoped** actions: **Revoke all active (campaign)** and **Revoke all except newest active** (disabled unless ≥2 active). Confirm before destructive action; refreshes token summary and planner hints via existing **`load` / `onLinksChanged`**.
- **Email:** Server send uses **`buildClientReviewShareEmailHtml`**; operators do not edit HTML. Historical review URLs are still **not** server-recoverable by design.
- **Tests:** `src/app/api/social/external-review-tokens/bulk-revoke/route.spec.ts`, **`ClientReviewLinkOperatorSection.spec.tsx`** (bulk flow), **`client-review-share-message.spec.ts`** (HTML helper), observability mapping for **`external_review_links_bulk_revoked`**.

## Operational notes

- Apply migration **`0089`** before minting tokens in production.
- Rotating a compromised link: **revoke** the token row and mint a new one, or use **bulk revoke** to invalidate all active campaign links at once.
- **Part 44+ ideas:** optional “resend” that only reuses **mailto** after mint; tenant-specific email branding env vars.
