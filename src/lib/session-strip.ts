/**
 * Session strip visibility: only shown when user explicitly selects a workspace from DB.
 * Hidden by default to avoid accidental alterations across the site (including landing page).
 */

const SESSION_STRIP_VISIBLE_KEY = "session_strip_visible_v1";
const SESSION_STRIP_EVENT = "session_strip_visibility_updated";

export function isSessionStripVisible(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SESSION_STRIP_VISIBLE_KEY) === "true";
  } catch {
    return false;
  }
}

export function showSessionStrip(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_STRIP_VISIBLE_KEY, "true");
    window.dispatchEvent(new Event(SESSION_STRIP_EVENT));
  } catch {
    // ignore
  }
}

export function hideSessionStrip(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_STRIP_VISIBLE_KEY);
    window.dispatchEvent(new Event(SESSION_STRIP_EVENT));
  } catch {
    // ignore
  }
}

export { SESSION_STRIP_EVENT };
