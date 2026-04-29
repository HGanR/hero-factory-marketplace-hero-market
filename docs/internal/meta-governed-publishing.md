# Meta (Facebook & Instagram) governed publishing (Revenue OS)

Part 35 adds **Facebook Page** and **Instagram Business** (Graph API) to the same governed stack as LinkedIn: `campaign_posts`, UTM approval, planner, PATCH audit, worker publishes, and `campaign_audit_events`.

## Prerequisites

- **Env:** `META_APP_ID`, `META_APP_SECRET` (same as `PLATFORM_CONFIG.facebook` / `instagram` in `src/lib/social/config.ts`).
- **OAuth:** `GET /api/social/oauth/facebook/start` and `/api/social/oauth/instagram/start` (existing generic OAuth routes).
- **Facebook:** App with **pages_manage_posts**, **pages_show_list**, **pages_read_engagement**. User must manage at least one **Facebook Page**.
- **Instagram:** Same Meta app; Instagram product + **instagram_content_publish** (and related scopes in config). The connected Facebook user must manage a Page that has an **Instagram Business** account linked.

## How accounts are stored

On OAuth callback (`oauth-complete.ts`):

1. User access token is exchanged as today.
2. We call **`/me/accounts`** and, when possible, persist a **Page access token** (not the user token) plus **`external_account_id` = Facebook Page id**.
3. **Facebook:** first managed Page (deterministic choice on **OAuth connect**). **Part 36:** the Revenue OS **composer** lists every stored `social_accounts` row for that provider so operators **pick the account** explicitly when multiple connections exist; reconnecting creates additional rows if the product allows multiple OAuth completes per client.
4. **Instagram:** first Page that exposes **`instagram_business_account`** (same OAuth note as Facebook for the initial token row).

If no suitable Page is returned, we still store the user token and leave `external_account_id` null; **publish will fail** with a clear error until reconnect/scopes fix the issue.

## Publish behavior (Part 37)

| Platform   | Text + link | Single image (`storage_url`) | Single video (`storage_url`) | Carousel |
|-----------|-------------|------------------------------|------------------------------|----------|
| LinkedIn  | Yes (UGC; link preview) | Not sent by adapter yet | Not sent by adapter yet | No |
| Facebook  | Yes (Page **feed**) | Yes — **Page photos** API when `creative_type=IMAGE` | **No** (explicit error / validation) | No |
| Instagram | Caption + link in caption | Yes — `image_url` container | Yes — `media_type=VIDEO` + container **status** poll → `media_publish` | **No** |

### Capability module

Typed matrix lives in **`src/lib/social/social-provider-publish-capabilities.ts`** (`getProviderPublishCapabilities`, `isCreativeTypeAllowedForProviderMedia`). **Create/PATCH** validation uses **`validateComposerSocialPostMedia`** in `social-post-create-rules.ts` (machine-readable codes: `INSTAGRAM_REQUIRES_MEDIA`, `PROVIDER_MEDIA_UNSUPPORTED_TYPE`, `MEDIA_ASSET_MISSING_URL`, `FACEBOOK_VIDEO_NOT_SUPPORTED`).

### Instagram notes

- **Draft** without `asset_id` is allowed; readiness shows **`instagram_requires_media`** until media is attached.
- **Scheduled** posts require **IMAGE** or **VIDEO** with **`campaign_assets.storage_url`** (public URL for Graph).
- **Wrong creative type** (e.g. TEXT) on a linked asset → planner/diagnostic **`provider_media_incompatible`**.
- Video publish waits up to **~120s** for container `status_code=FINISHED` before `media_publish`.

### Facebook notes

- Optional **IMAGE** → `/{page-id}/photos` with caption (message + link merged into caption).
- **VIDEO** attachment rejected at validate (not implemented).

## Code map

- **Adapters:** `adapters/facebook.ts` (feed + photos), `adapters/instagram.ts` (image + video + poll), `adapters/index.ts`.
- **Metadata projection:** `campaign-asset-metadata.ts` (safe fields from `campaign_assets.metadata` JSON).
- **Governed provider helpers:** `providers/facebook.ts`, `instagram.ts`, `createSocialProvider` in `providers/index.ts`.
- **Worker:** `run-due-scheduled-publishes.ts` → `executeCampaignPostAdapterPublish` passes `assetCreativeType` from `campaign_assets`.
- **Allow-list:** `GOVERNED_SOCIAL_PUBLISH_PLATFORMS` in `social-governed-platforms.ts`.
- **POST create:** `POST /api/social/posts` — `validateComposerSocialPostMedia`.
- **PATCH:** `PATCH /api/social/posts/[id]` supports **`assetId`** (material for approval reset); audit action **`asset_changed`**.

## Planner / UI

Revenue OS planner has a **Provider** filter (LinkedIn / Facebook / Instagram). **Part 37:** planner/detail load **`campaign_assets.creative_type`** for readiness (`provider_media_incompatible`, updated Instagram copy). Composer and planner include **provider-aware** asset pickers; `GET /api/social/campaign-assets` returns **`instagramPublishEligible`**, **`facebookImageEligible`**, and optional **metadata** fields (no raw `storage_url`).

## Part 36 — Governed composer (summary)

**Component:** `RevenueOsLinkedInPublishingPanel.tsx` — multi-provider create/list; see Part 37 for image/video/Facebook photo alignment.

## Deferred (Part 39+)

- **Part 38 (done):** Normalized post analytics snapshots + planner UI — [`social-performance-analytics.md`](./social-performance-analytics.md) (Instagram + LinkedIn refresh; **Facebook insights not wired**).
- **Carousel / multi-image** (Instagram sidecar, Facebook multi-photo).
- **Facebook Page video** upload/publish.
- **LinkedIn** native image/video via register-upload API.
- **Resumable / chunked** video uploads for very large files.

See also: [`publishing-planner-workflow.md`](./publishing-planner-workflow.md), [`linkedin-governed-publishing.md`](./linkedin-governed-publishing.md).
