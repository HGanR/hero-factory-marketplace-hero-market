/**
 * Feature flags for meet broadcast V2 rendered compositor (opt-in).
 *
 * Env:
 * - MEET_BROADCAST_RENDERED_COMPOSITOR=1|true — enable for all users (use with care).
 * - MEET_BROADCAST_RENDERED_COMPOSITOR_USER_IDS=1,2,3 — allow-list user ids (numeric marketplace user id).
 */

function truthyEnv(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function isRenderedBroadcastCompositorEnabledGlobally(): boolean {
  return truthyEnv(process.env.MEET_BROADCAST_RENDERED_COMPOSITOR);
}

export function isRenderedBroadcastCompositorEnabledForUser(userId: number): boolean {
  if (isRenderedBroadcastCompositorEnabledGlobally()) return true;
  const raw = process.env.MEET_BROADCAST_RENDERED_COMPOSITOR_USER_IDS?.trim();
  if (!raw) return false;
  const allow = new Set(
    raw
      .split(/[,\s]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n))
  );
  return allow.has(userId);
}
