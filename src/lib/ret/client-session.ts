const STORAGE_KEY = "ret_client_session_id";

/**
 * Stable per-browser-tab id for correlating RET widget messages until server-backed
 * `retSessionId` exists. Uses sessionStorage (cleared when the tab closes).
 */
export function getOrCreateRetClientSessionId(): string {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return "ssr";
  }
  try {
    let id = window.sessionStorage.getItem(STORAGE_KEY);
    if (!id || id.length < 8) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `ret_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      window.sessionStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}
