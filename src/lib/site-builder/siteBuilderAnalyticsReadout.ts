/**
 * Session-only aggregation for site-builder analytics (dev / operator debug).
 * Not customer-facing. Enable: NODE_ENV=development OR NEXT_PUBLIC_SITE_BUILDER_ANALYTICS_READOUT=1
 *
 * Inspect: `window.__siteBuilderAnalyticsReadout?.print()` in the browser console.
 */

import type { SiteBuilderAnalyticsEvent } from "./siteBuilderAnalytics";

const SITE_BUILDER_FAILURE_EVENTS = new Set<SiteBuilderAnalyticsEvent>([
  "site_builder_full_build_failed",
  "site_builder_plan_only_failed",
  "site_builder_section_regenerate_failed",
  "site_builder_version_save_failed",
  "site_builder_deploy_failed",
]);

export type SiteBuilderFailureAnalyticsEvent =
  | "site_builder_full_build_failed"
  | "site_builder_plan_only_failed"
  | "site_builder_section_regenerate_failed"
  | "site_builder_version_save_failed"
  | "site_builder_deploy_failed";

export type SiteBuilderSaveSource = "sticky_bar" | "advanced_panel";

/** Derived operator-facing signals (computed; no PII). */
export type SiteBuilderOperatorDiagnostics = {
  /** Most frequent failure bucket this session */
  topFailure?: { category: string; code?: string; count: number; key: string };
  /** Which save entry point has better success rate when both have attempts; else tie or insufficient_data */
  saveHealthier: "sticky_bar" | "advanced_panel" | "tie" | "insufficient_data";
  saveHealthNote?: string;
  stickyBarSave?: { completed: number; failed: number; successRate: number | null };
  advancedPanelSave?: { completed: number; failed: number; successRate: number | null };
  /** Last successful plan vs full build */
  latestSuccessfulBuildPath?: "plan_only" | "full";
  latestBuildSource?: "panel" | "sticky_bar";
  latestExampleId?: string;
  latestFeelId?: string;
  /** Where failures cluster this session (tie-break: deploy > save > build > section) */
  hotspot: "deploy" | "save" | "build" | "section" | "none";
  hotspotBreakdown: { deploy: number; save: number; build: number; section: number };
  hotspotLabel: string;
};

export type SiteBuilderAnalyticsReadoutSnapshot = {
  sessionStartedAt: number;
  eventCounts: Partial<Record<SiteBuilderAnalyticsEvent, number>>;
  /** Counts for failure-only events (subset of eventCounts for convenience) */
  failureCounts: Partial<Record<SiteBuilderFailureAnalyticsEvent, number>>;
  /** Session counts keyed by `category` or `category:code` (privacy-safe buckets only) */
  failureCategoryCodeCounts: Record<string, number>;
  /** Version save outcomes by entry point (compare success vs failure per source) */
  saveBySource: Partial<Record<SiteBuilderSaveSource, { completed: number; failed: number }>>;
  /** Operator diagnostics derived from the fields above */
  diagnostics: SiteBuilderOperatorDiagnostics;
  latestFailure?: {
    event: SiteBuilderFailureAnalyticsEvent;
    failure_category?: string;
    failure_code?: string;
    workflow_stage?: string;
    source?: string;
  };
  /** Last chip / proof selection */
  latestExampleId?: string;
  latestFeelId?: string;
  /** Last completed build path */
  latestBuildPath?: "plan_only" | "full";
  latestBuildSource?: "panel" | "sticky_bar";
  latestStyleMode?: string;
  latestSave?: {
    version?: number;
    schema_hash_prefix?: string;
    style_mode?: string;
    source?: string;
  };
  latestDeploy?: { ipfs_cid_prefix?: string; version_id_prefix?: string; source?: string };
  latestAdvancedSource?: string;
  sectionRegenerateCount: number;
};

type ReadoutMutableState = {
  sessionStartedAt: number;
  eventCounts: Partial<Record<SiteBuilderAnalyticsEvent, number>>;
  failureCounts: Partial<Record<SiteBuilderFailureAnalyticsEvent, number>>;
  failureCategoryCodeCounts: Record<string, number>;
  saveBySource: Partial<Record<SiteBuilderSaveSource, { completed: number; failed: number }>>;
  latestFailure?: SiteBuilderAnalyticsReadoutSnapshot["latestFailure"];
  latestExampleId?: string;
  latestFeelId?: string;
  latestBuildPath?: "plan_only" | "full";
  latestBuildSource?: "panel" | "sticky_bar";
  latestStyleMode?: string;
  latestSave?: SiteBuilderAnalyticsReadoutSnapshot["latestSave"];
  latestDeploy?: SiteBuilderAnalyticsReadoutSnapshot["latestDeploy"];
  latestAdvancedSource?: string;
  sectionRegenerateCount: number;
};

const state: ReadoutMutableState = {
  sessionStartedAt: Date.now(),
  eventCounts: {},
  failureCounts: {},
  failureCategoryCodeCounts: {},
  saveBySource: {},
  sectionRegenerateCount: 0,
};

let windowHookInstalled = false;

function bumpFailureCategoryCode(props: Record<string, string | number | boolean>): void {
  const cat = typeof props.failure_category === "string" ? props.failure_category : "unknown";
  const code = typeof props.failure_code === "string" ? props.failure_code : undefined;
  const key = code ? `${cat}:${code}` : cat;
  state.failureCategoryCodeCounts[key] = (state.failureCategoryCodeCounts[key] ?? 0) + 1;
}

function topFailureFromBuckets(
  counts: Record<string, number>,
): { category: string; code?: string; count: number; key: string } | undefined {
  const keys = Object.keys(counts);
  if (keys.length === 0) return undefined;
  let bestKey = keys[0]!;
  let bestN = counts[bestKey] ?? 0;
  for (const k of keys) {
    const n = counts[k] ?? 0;
    if (n > bestN) {
      bestN = n;
      bestKey = k;
    } else if (n === bestN && k < bestKey) {
      bestKey = k;
    }
  }
  const parts = bestKey.split(":");
  const category = parts[0] ?? bestKey;
  const code = parts.length > 1 ? parts.slice(1).join(":") : undefined;
  return { category, code, count: bestN, key: bestKey };
}

function deriveSaveHealth(
  saveBySource: SiteBuilderAnalyticsReadoutSnapshot["saveBySource"],
): Pick<
  SiteBuilderOperatorDiagnostics,
  "saveHealthier" | "saveHealthNote" | "stickyBarSave" | "advancedPanelSave"
> {
  const t = saveBySource.sticky_bar;
  const a = saveBySource.advanced_panel;
  const pack = (x?: { completed: number; failed: number }) => {
    if (!x) return null;
    const attempts = x.completed + x.failed;
    if (attempts === 0) return null;
    return {
      completed: x.completed,
      failed: x.failed,
      successRate: x.completed / attempts,
    };
  };
  const T = pack(t);
  const A = pack(a);
  if (!T && !A) return { saveHealthier: "insufficient_data", saveHealthNote: "no_save_attempts" };
  if (T && !A) return { saveHealthier: "sticky_bar", stickyBarSave: T, saveHealthNote: "only_sticky_data" };
  if (!T && A) return { saveHealthier: "advanced_panel", advancedPanelSave: A, saveHealthNote: "only_advanced_data" };
  const eps = 1e-9;
  if (T!.successRate! > A!.successRate! + eps) {
    return { saveHealthier: "sticky_bar", stickyBarSave: T!, advancedPanelSave: A! };
  }
  if (A!.successRate! > T!.successRate! + eps) {
    return { saveHealthier: "advanced_panel", stickyBarSave: T!, advancedPanelSave: A! };
  }
  return { saveHealthier: "tie", stickyBarSave: T!, advancedPanelSave: A! };
}

function deriveHotspot(
  failureCounts: Partial<Record<SiteBuilderFailureAnalyticsEvent, number>>,
): Pick<SiteBuilderOperatorDiagnostics, "hotspot" | "hotspotBreakdown" | "hotspotLabel"> {
  const deploy = failureCounts.site_builder_deploy_failed ?? 0;
  const save = failureCounts.site_builder_version_save_failed ?? 0;
  const build =
    (failureCounts.site_builder_full_build_failed ?? 0) + (failureCounts.site_builder_plan_only_failed ?? 0);
  const section = failureCounts.site_builder_section_regenerate_failed ?? 0;
  const breakdown = { deploy, save, build, section };
  const total = deploy + save + build + section;
  if (total === 0) {
    return {
      hotspot: "none",
      breakdown,
      hotspotLabel: "no_failures",
    };
  }
  const maxN = Math.max(deploy, save, build, section);
  const order = ["deploy", "save", "build", "section"] as const;
  const hotspot = order.find((k) => breakdown[k] === maxN) ?? "none";
  return {
    hotspot,
    breakdown,
    hotspotLabel: `${hotspot}_n=${maxN}`,
  };
}

export function buildOperatorDiagnostics(
  snap: Omit<SiteBuilderAnalyticsReadoutSnapshot, "diagnostics">,
): SiteBuilderOperatorDiagnostics {
  const topFailure = topFailureFromBuckets(snap.failureCategoryCodeCounts);
  const save = deriveSaveHealth(snap.saveBySource);
  const hot = deriveHotspot(snap.failureCounts);
  return {
    topFailure,
    ...save,
    latestSuccessfulBuildPath: snap.latestBuildPath,
    latestBuildSource: snap.latestBuildSource,
    latestExampleId: snap.latestExampleId,
    latestFeelId: snap.latestFeelId,
    ...hot,
  };
}

export function formatOperatorDiagnosticsLine(d: SiteBuilderOperatorDiagnostics): string {
  const parts: string[] = ["[site-builder diagnostics]"];
  if (d.topFailure) {
    parts.push(`topFail=${d.topFailure.key}×${d.topFailure.count}`);
  }
  parts.push(`saveHealth→${d.saveHealthier}`);
  if (d.latestSuccessfulBuildPath) {
    parts.push(
      `lastBuild=${d.latestSuccessfulBuildPath}${d.latestBuildSource ? `(${d.latestBuildSource})` : ""}`,
    );
  }
  const pick = [d.latestFeelId ? `feel:${d.latestFeelId}` : null, d.latestExampleId ? `ex:${d.latestExampleId}` : null]
    .filter(Boolean)
    .join("+");
  if (pick) parts.push(`pick=${pick}`);
  parts.push(`hotspot=${d.hotspot}[${d.hotspotLabel}]`);
  return parts.join(" · ");
}

export function isSiteBuilderAnalyticsReadoutEnabled(): boolean {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") return true;
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_BUILDER_ANALYTICS_READOUT === "1") return true;
  return false;
}

function bump(event: SiteBuilderAnalyticsEvent): void {
  state.eventCounts[event] = (state.eventCounts[event] ?? 0) + 1;
}

function bumpSaveSource(source: SiteBuilderSaveSource, kind: "completed" | "failed"): void {
  const cur = state.saveBySource[source] ?? { completed: 0, failed: 0 };
  cur[kind] += 1;
  state.saveBySource[source] = cur;
}

/**
 * Called from trackSiteBuilderEvent (same microtask path). Does not throw.
 */
export function ingestSiteBuilderReadoutEvent(
  event: SiteBuilderAnalyticsEvent,
  props: Record<string, string | number | boolean>,
): void {
  if (!isSiteBuilderAnalyticsReadoutEnabled()) return;

  bump(event);

  if (SITE_BUILDER_FAILURE_EVENTS.has(event)) {
    const fe = event as SiteBuilderFailureAnalyticsEvent;
    state.failureCounts[fe] = (state.failureCounts[fe] ?? 0) + 1;
    bumpFailureCategoryCode(props);
    state.latestFailure = {
      event: fe,
      failure_category: typeof props.failure_category === "string" ? props.failure_category : undefined,
      failure_code: typeof props.failure_code === "string" ? props.failure_code : undefined,
      workflow_stage: typeof props.workflow_stage === "string" ? props.workflow_stage : undefined,
      source: typeof props.source === "string" ? props.source : undefined,
    };
    if (fe === "site_builder_version_save_failed" && (props.source === "sticky_bar" || props.source === "advanced_panel")) {
      bumpSaveSource(props.source, "failed");
    }
  }

  switch (event) {
    case "site_builder_inspiration_chip_clicked":
      if (typeof props.example_id === "string") state.latestExampleId = props.example_id;
      break;
    case "site_builder_proof_snapshot_clicked":
      if (typeof props.feel_id === "string") state.latestFeelId = props.feel_id;
      if (typeof props.example_id === "string") state.latestExampleId = props.example_id;
      break;
    case "site_builder_plan_only_completed":
      state.latestBuildPath = "plan_only";
      break;
    case "site_builder_full_build_completed":
      state.latestBuildPath = "full";
      if (props.source === "panel" || props.source === "sticky_bar") {
        state.latestBuildSource = props.source;
      }
      if (typeof props.style_mode === "string") state.latestStyleMode = props.style_mode;
      break;
    case "site_builder_section_regenerate_completed":
      state.sectionRegenerateCount += 1;
      break;
    case "site_builder_version_save_completed":
      state.latestSave = {
        version: typeof props.version === "number" ? props.version : undefined,
        schema_hash_prefix: typeof props.schema_hash_prefix === "string" ? props.schema_hash_prefix : undefined,
        style_mode: typeof props.style_mode === "string" ? props.style_mode : undefined,
        source: typeof props.source === "string" ? props.source : undefined,
      };
      if (typeof props.style_mode === "string") state.latestStyleMode = props.style_mode;
      if (props.source === "sticky_bar" || props.source === "advanced_panel") {
        bumpSaveSource(props.source, "completed");
      }
      break;
    case "site_builder_deploy_completed":
      state.latestDeploy = {
        ipfs_cid_prefix: typeof props.ipfs_cid_prefix === "string" ? props.ipfs_cid_prefix : undefined,
        version_id_prefix: typeof props.version_id_prefix === "string" ? props.version_id_prefix : undefined,
        source: typeof props.source === "string" ? props.source : undefined,
      };
      break;
    case "site_builder_advanced_opened":
      if (typeof props.source === "string") state.latestAdvancedSource = props.source;
      break;
    default:
      break;
  }

  installWindowHookOnce();
}

export function getSiteBuilderAnalyticsReadoutSnapshot(): SiteBuilderAnalyticsReadoutSnapshot {
  const sb = state.saveBySource;
  const saveBySource: SiteBuilderAnalyticsReadoutSnapshot["saveBySource"] = {
    ...(sb.sticky_bar ? { sticky_bar: { ...sb.sticky_bar } } : {}),
    ...(sb.advanced_panel ? { advanced_panel: { ...sb.advanced_panel } } : {}),
  };
  const failureCategoryCodeCounts = { ...state.failureCategoryCodeCounts };
  const base: Omit<SiteBuilderAnalyticsReadoutSnapshot, "diagnostics"> = {
    ...state,
    eventCounts: { ...state.eventCounts },
    failureCounts: { ...state.failureCounts },
    failureCategoryCodeCounts,
    saveBySource,
  };
  return {
    ...base,
    diagnostics: buildOperatorDiagnostics(base),
  };
}

export function resetSiteBuilderAnalyticsReadout(): void {
  state.eventCounts = {};
  state.failureCounts = {};
  state.failureCategoryCodeCounts = {};
  state.saveBySource = {};
  state.latestFailure = undefined;
  state.latestExampleId = undefined;
  state.latestFeelId = undefined;
  state.latestBuildPath = undefined;
  state.latestBuildSource = undefined;
  state.latestStyleMode = undefined;
  state.latestSave = undefined;
  state.latestDeploy = undefined;
  state.latestAdvancedSource = undefined;
  state.sectionRegenerateCount = 0;
  state.sessionStartedAt = Date.now();
}

/** Compact operator summary (diagnostics line only). */
export function formatSiteBuilderAnalyticsReadout(): string {
  const s = getSiteBuilderAnalyticsReadoutSnapshot();
  return formatOperatorDiagnosticsLine(s.diagnostics);
}

/** Secondary line: raw counters and last events for deeper inspection (still no prompts/payloads). */
export function formatSiteBuilderAnalyticsReadoutDetail(): string {
  const s = getSiteBuilderAnalyticsReadoutSnapshot();
  const parts = [
    `[site-builder readout detail]`,
    `counts=${JSON.stringify(s.eventCounts)}`,
    s.latestExampleId ? `example=${s.latestExampleId}` : null,
    s.latestFeelId ? `feel=${s.latestFeelId}` : null,
    s.latestBuildPath ? `build=${s.latestBuildPath}${s.latestBuildSource ? `(${s.latestBuildSource})` : ""}` : null,
    s.latestStyleMode ? `styleMode=${s.latestStyleMode}` : null,
    s.latestSave
      ? `save=v${s.latestSave.version ?? "?"}${s.latestSave.source ? `@${s.latestSave.source}` : ""}`
      : null,
    s.latestDeploy
      ? `deploy=${s.latestDeploy.ipfs_cid_prefix || s.latestDeploy.version_id_prefix || "?"}…`
      : null,
    s.latestAdvancedSource ? `advanced=${s.latestAdvancedSource}` : null,
    Object.keys(s.failureCounts).length ? `failures=${JSON.stringify(s.failureCounts)}` : null,
    Object.keys(s.failureCategoryCodeCounts).length
      ? `failBuckets=${JSON.stringify(s.failureCategoryCodeCounts)}`
      : null,
    Object.keys(s.saveBySource).length ? `savesBySource=${JSON.stringify(s.saveBySource)}` : null,
    s.latestFailure
      ? `lastFail=${s.latestFailure.event}(${s.latestFailure.failure_category ?? "?"}${s.latestFailure.failure_code ? `:${s.latestFailure.failure_code}` : ""}${s.latestFailure.source ? `;src=${s.latestFailure.source}` : ""}${s.latestFailure.workflow_stage ? `;stage=${s.latestFailure.workflow_stage}` : ""})`
      : null,
    `sectionRegens=${s.sectionRegenerateCount}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function printSiteBuilderAnalyticsReadout(): void {
  const snap = getSiteBuilderAnalyticsReadoutSnapshot();
  // eslint-disable-next-line no-console -- intentional dev/operator readout
  console.log(formatOperatorDiagnosticsLine(snap.diagnostics));
  // eslint-disable-next-line no-console -- secondary line for operators who want counters
  console.log(formatSiteBuilderAnalyticsReadoutDetail());
  // eslint-disable-next-line no-console -- structured snapshot includes diagnostics + full state
  console.log("[site-builder analytics readout] snapshot", snap);
}

function installWindowHookOnce(): void {
  if (windowHookInstalled) return;
  if (typeof window === "undefined") return;
  if (!isSiteBuilderAnalyticsReadoutEnabled()) return;
  windowHookInstalled = true;
  const w = window as Window & {
    __siteBuilderAnalyticsReadout?: {
      snapshot: () => SiteBuilderAnalyticsReadoutSnapshot;
      reset: () => void;
      print: () => void;
      format: () => string;
      formatDetail: () => string;
    };
  };
  w.__siteBuilderAnalyticsReadout = {
    snapshot: getSiteBuilderAnalyticsReadoutSnapshot,
    reset: resetSiteBuilderAnalyticsReadout,
    print: printSiteBuilderAnalyticsReadout,
    format: formatSiteBuilderAnalyticsReadout,
    formatDetail: formatSiteBuilderAnalyticsReadoutDetail,
  };
}
