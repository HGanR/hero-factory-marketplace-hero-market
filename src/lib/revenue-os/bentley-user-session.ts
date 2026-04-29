/**
 * Browser user id for Bentley sessionStorage scoping — must match on first paint
 * across `/ai-revenue-os` and `/revenue-os/dashboard` or handoff keys diverge.
 */

export function getResolvedUserIdFromStorage(): string {
  if (typeof window === "undefined") return "demo-user";
  try {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser) as { id?: string; email?: string; username?: string };
      return String(parsed?.id ?? parsed?.email ?? parsed?.username ?? "demo-user");
    }
  } catch {
    // ignore
  }
  return "demo-user";
}
