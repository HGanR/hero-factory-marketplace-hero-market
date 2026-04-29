/**
 * Request correlation for Bentley pipeline API calls (client → Next.js routes).
 * Server handlers read the same header names for logging; no DB persistence.
 */

export const X_BENTLEY_RUN_ID = "x-bentley-run-id";
export const X_BENTLEY_USER_ID = "x-bentley-user-id";
export const X_BENTLEY_CLIENT_ID = "x-bentley-client-id";
