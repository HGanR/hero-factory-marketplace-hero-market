/**
 * Bentley Revenue OS — hash / in-page scroll helpers and lightweight chat intents.
 */

import type { BentleySectionId } from "@/lib/revenue-os/bentley-flow-types";
import {
  BENTLEY_SCOPE_DEFAULT_CLIENT,
  getBentleyStorageScope,
} from "@/lib/revenue-os/bentley-storage-scope";

/** Dashboard DOM id for the launch block (hash links use #campaign-launch). */
const LAUNCH_SECTION_DOM_ID = "campaign-launch";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Map hash tokens to element lookup: id, then data-bentley-section. */
function resolveDashboardHashKey(raw: string): string {
  const h = raw.replace(/^#/, "").trim();
  if (h === "launch-campaigns") return LAUNCH_SECTION_DOM_ID;
  return h;
}

/**
 * Scroll to the in-page target for the current `location.hash` on Revenue OS Dashboard.
 * Called on mount and on `hashchange`.
 */
export function scrollDashboardHashIntoView(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const raw = (window.location.hash || "").replace(/^#/, "").trim();
  if (!raw) return;

  const key = resolveDashboardHashKey(raw);

  window.setTimeout(() => {
    const byId = document.getElementById(key);
    if (byId) {
      byId.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const bySection =
      document.querySelector<HTMLElement>(`[data-bentley-section="${raw}"]`) ??
      document.querySelector<HTMLElement>(`[data-bentley-section="${key}"]`);
    bySection?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);
}

function findBentleySectionEl(section: BentleySectionId): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const byMarker = document.querySelector<HTMLElement>(
    `[data-bentley-section="${section}"]`
  );
  if (byMarker) return byMarker;
  return document.getElementById(section);
}

function defaultHashForSection(section: BentleySectionId): string {
  if (section === "launch-campaigns") return LAUNCH_SECTION_DOM_ID;
  return section;
}

function buildDashboardUrlWithHash(hash: string): string {
  const q = new URLSearchParams();
  const scope = typeof window !== "undefined" ? getBentleyStorageScope() : null;
  const cid = scope?.clientId?.trim();
  if (cid && cid !== BENTLEY_SCOPE_DEFAULT_CLIENT) q.set("clientId", cid);
  const qs = q.toString();
  const base = qs ? `/revenue-os/dashboard?${qs}` : "/revenue-os/dashboard";
  const h = hash.replace(/^#/, "");
  return `${base}#${h}`;
}

function buildAiRevenueOsUrlWithHash(hash: string): string {
  const q = new URLSearchParams();
  const scope = typeof window !== "undefined" ? getBentleyStorageScope() : null;
  const cid = scope?.clientId?.trim();
  if (cid && cid !== BENTLEY_SCOPE_DEFAULT_CLIENT) q.set("clientId", cid);
  const qs = q.toString();
  const base = qs ? `/ai-revenue-os?${qs}` : "/ai-revenue-os";
  const h = hash.replace(/^#/, "");
  return `${base}#${h}`;
}

const DASHBOARD_ONLY_SECTIONS: ReadonlySet<BentleySectionId> = new Set([
  "launch-campaigns",
  "deployment-center",
]);

export function scrollToBentleySection(
  section: BentleySectionId,
  opts: { router: { push: (href: string) => void } }
): void {
  const { router } = opts;
  if (typeof window === "undefined") return;

  const el = findBentleySectionEl(section);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    const hash = defaultHashForSection(section);
    const next = `#${hash}`;
    if (window.location.hash !== next) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${next}`
      );
    }
    return;
  }

  const hash = defaultHashForSection(section);
  if (DASHBOARD_ONLY_SECTIONS.has(section)) {
    router.push(buildDashboardUrlWithHash(hash));
    return;
  }
  router.push(buildAiRevenueOsUrlWithHash(hash));
}

export function isLaunchCampaignsIntent(message: string): boolean {
  const t = norm(message);
  if (/^video upload & launch$/i.test(message.trim())) return true;
  if (/\blaunch campaigns\b/.test(t)) return true;
  if (/\bvideo\b/.test(t) && /\bupload\b/.test(t) && /\blaunch\b/.test(t)) return true;
  return false;
}

export function isDeploymentCenterIntent(message: string): boolean {
  const t = norm(message);
  if (/^deployment & sequences$/i.test(message.trim())) return true;
  if (/\bdeployment center\b/.test(t)) return true;
  if (/\bmodule 3\b/.test(t) && /\bdeployment\b/.test(t)) return true;
  if (/\bdeploy(ment)?\b/.test(t) && /\bsequence(s)?\b/.test(t)) return true;
  return false;
}

export function isSevenDayLaunchPlanIntent(message: string): boolean {
  const t = norm(message);
  if (/^generate 7-day launch plan$/i.test(message.trim())) return true;
  return (
    /\b(generate|build|show|create|give)\b/.test(t) &&
    /\b7[-\s]?day\b/.test(t) &&
    /\blaunch\b/.test(t)
  );
}

export function isWhatsNextIntent(message: string): boolean {
  const t = norm(message);
  return (
    t === "what's next?" ||
    t === "whats next?" ||
    t === "what is next?" ||
    t === "what next?"
  );
}

export function isStrategicDiagnosticIntent(message: string): boolean {
  const t = norm(message);
  if (t.length < 14) return false;
  if (
    isLaunchCampaignsIntent(message) ||
    isDeploymentCenterIntent(message) ||
    isSevenDayLaunchPlanIntent(message) ||
    isWhatsNextIntent(message)
  ) {
    return false;
  }
  return (
    /\bstrategic diagnostic\b/.test(t) ||
    /\bstrategic (overview|assessment|analysis)\b/.test(t) ||
    /\b(holistic|big[-\s]picture)\b.*\b(diagnos|assess|review|status)\b/.test(t) ||
    /\bdiagnos(e|is)\s+(my|our)\s+(business|revenue|funnel|pipeline)\b/.test(t)
  );
}
