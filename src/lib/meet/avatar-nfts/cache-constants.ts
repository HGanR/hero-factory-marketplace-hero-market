/** Successful metadata row: treat as fresh until this TTL from `fetched_at`. */
export const MEET_AVATAR_METADATA_SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;

/** Failed metadata row: suppress immediate re-fetch until this TTL from `fetched_at`. */
export const MEET_AVATAR_METADATA_FAILURE_TTL_MS = 60 * 60 * 1000;

/**
 * After success TTL passes, a prior success row may still be used as fallback if live refresh fails,
 * as long as `fetched_at` is not older than this window.
 */
export const MEET_AVATAR_METADATA_STALE_SUCCESS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Max concurrent live metadata fetches per Meet avatar request (Hero + marketplace enrichment). */
export const MEET_AVATAR_METADATA_FETCH_CONCURRENCY = 4;

/** Do not persist raw JSON larger than this (bytes of JSON string). */
export const MEET_AVATAR_METADATA_RAW_JSON_MAX_BYTES = 24_000;
