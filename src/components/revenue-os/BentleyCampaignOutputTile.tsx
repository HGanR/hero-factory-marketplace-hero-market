"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isOauthConnectablePlatform,
  postingPlatformDisplayName,
} from "@/lib/revenue-os/bentley-posting-platforms";
import {
  bentleyExecutionCapabilityLabel,
  getBentleyPlatformExecutionCapability,
  type BentleyExecutionCapability,
} from "@/lib/revenue-os/bentley-platform-execution-capability";
import { rawApprovalStatusKey } from "@/lib/revenue-os/publish-approval-utm";
import { ianaWallTimeToUtcIso } from "@/lib/revenue-os/iana-wall-time-to-utc";
import { parseScheduledPublishMeta, type PublishRoute } from "@/lib/social/scheduled-publish-meta";
import { syncBentleyLaunchApi } from "@/lib/revenue-os/revenue-os-pipeline-actions";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

function asPlatformSlug(value: unknown, fallback = "instagram"): string {
  const s = coerceTrimmedString(value).toLowerCase();
  return s || fallback;
}

function asTrimmedString(value: unknown, fallback = ""): string {
  return coerceTrimmedString(value, fallback);
}

type BentleyDraft = {
  hook?: string;
  cta?: string;
  promptText?: string;
  promptImage?: string;
  promptVideo?: string;
};

export type CampaignDetailPost = {
  id: string;
  platform: string;
  caption: string | null;
  bentleyDraftJson?: BentleyDraft | null;
  assetId: string | null;
  assetStorageUrl: string | null;
  assetCreativeType?: string | null;
  scheduledAt: string | null;
  status: string;
  utmParams?: Record<string, unknown> | null;
  scheduledPublishMeta?: Record<string, unknown> | null;
  hashtags?: string | null;
  errorMessage?: string | null;
};

type CampaignDetailResponse = {
  id: string;
  name?: string;
  bentleyAutopilotPublish?: boolean;
  viewerCampaignReviewerRole?: string;
  posts: CampaignDetailPost[];
};

type PromptTab = "text" | "image" | "video";

type C360ConnectionRow = {
  id: string;
  accountName: string;
  connectionStatus: string;
};

type C360JobRow = Record<string, unknown> & {
  id: string;
  campaignPostId?: string;
  batchId?: string | null;
  status?: string;
  errorMessage?: string | null;
  attempts?: number;
  scheduledAt?: string;
  updatedAt?: string;
  targetPlatform?: string;
};

type C360BatchRow = {
  id: string;
  campaignId: string;
  totalPosts: number;
  scheduledCount: number;
  failedCount: number;
  status: string;
};

type C360ReadinessRow = {
  providerConfigured: boolean;
  featureEnabled: boolean;
  hasConnection: boolean;
  connectionStatus: string;
  canScheduleSingle: boolean;
  canScheduleBatch: boolean;
  canCancel: boolean;
  canSyncStatus: boolean;
  missingConfig: string[];
  warnings: string[];
};

function defaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const CONTENT360_TARGET_PLATFORMS = ["instagram", "facebook", "linkedin", "tiktok", "youtube", "twitter"] as const;

const CONTENT360_TIMEZONES_FALLBACK = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function content360TimeZoneOptions(): string[] {
  try {
    const IntlCtor = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    if (typeof IntlCtor.supportedValuesOf === "function") {
      return IntlCtor.supportedValuesOf("timeZone");
    }
  } catch {
    /* ignore */
  }
  return [...CONTENT360_TIMEZONES_FALLBACK];
}

function draftFromRow(raw: unknown): BentleyDraft {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  return {
    hook: s("hook"),
    cta: s("cta"),
    promptText: s("promptText"),
    promptImage: s("promptImage"),
    promptVideo: s("promptVideo"),
  };
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(v: string): string | null {
  if (!v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Inclusive calendar days as `YYYY-MM-DD` using UTC date arithmetic (date-only picker semantics). */
function eachCalendarDayYmd(startYmd: string, endYmd: string): string[] {
  const a = startYmd.trim().split("-").map((x) => parseInt(x, 10));
  const b = endYmd.trim().split("-").map((x) => parseInt(x, 10));
  if (a.length !== 3 || b.length !== 3 || a.some((n) => !Number.isFinite(n)) || b.some((n) => !Number.isFinite(n))) return [];
  let t = Date.UTC(a[0], a[1] - 1, a[2]);
  const endT = Date.UTC(b[0], b[1] - 1, b[2]);
  if (t > endT) return [];
  const out: string[] = [];
  while (t <= endT) {
    const x = new Date(t);
    out.push(`${x.getUTCFullYear()}-${pad2(x.getUTCMonth() + 1)}-${pad2(x.getUTCDate())}`);
    t += 86400000;
  }
  return out;
}

function platformHeading(p: unknown): string {
  const low = asPlatformSlug(p, "");
  if (isOauthConnectablePlatform(low)) return postingPlatformDisplayName(low);
  return low ? low.charAt(0).toUpperCase() + low.slice(1) : "Platform";
}

function utmStringRecord(u: unknown): Record<string, string> | null {
  if (!u || typeof u !== "object" || Array.isArray(u)) return null;
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(u as Record<string, unknown>)) {
    if (v == null) continue;
    o[k] = String(v);
  }
  return o;
}

function executionRowStatusLabel(post: CampaignDetailPost): string {
  const st = String(post.status ?? "").toUpperCase();
  const meta = parseScheduledPublishMeta(post.scheduledPublishMeta);
  if (meta.publishRoute === "content360") {
    if (st === "POSTED") return "Published (verified)";
    if (st === "PUBLISHING") return "Publishing…";
    if (st === "FAILED") return "Failed";
    if (st === "RETRY_SCHEDULED") return "Retry scheduled";
    const ps = (meta.providerStatus ?? "").toLowerCase();
    if (ps.includes("queued_at_content360")) return "Queued at Content360";
    if (ps === "pending_remote_configuration") return "Awaiting Content360 API";
    if (ps === "submitted" || ps === "manual_retry_queued") return "Queued internally";
    if (ps === "published") return "Published (verified)";
    if (ps === "canceled" || meta.content360ScheduleCanceled) return "Canceled (Content360)";
    if (ps === "disconnected_provider") return "Disconnected (provider)";
    if (st === "SCHEDULED" && post.scheduledAt) return "Scheduled (Content360)";
  }
  if (st === "POSTED") return "Posted";
  if (st === "PUBLISHING") return "Publishing";
  const utm = utmStringRecord(post.utmParams);
  const raw = rawApprovalStatusKey(utm)?.toLowerCase().replace(/-/g, "_") ?? "";
  if (raw === "pending_approval" || raw === "pending") return "Pending approval";
  if (st === "SCHEDULED" && post.scheduledAt) return "Scheduled";
  if (post.assetId) return "Uploaded";
  return "Draft";
}

function capabilityEmoji(cap: BentleyExecutionCapability): string {
  if (cap === "auto_publish") return "✓";
  if (cap === "manual_oauth") return "!";
  return "⌁";
}

function PlatformBadge({ platform }: { platform: string }) {
  const cap = getBentleyPlatformExecutionCapability(platform);
  const { badge, short } = bentleyExecutionCapabilityLabel(cap);
  const label = platformHeading(platform);
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-600/70 bg-slate-950/80 px-3 py-1 text-xs text-slate-200">
      <span className="font-semibold text-cyan-200/95">{label}</span>
      <span className="text-slate-500">·</span>
      <span title={cap}>
        <span className="mr-1 text-slate-400" aria-hidden>
          {capabilityEmoji(cap)}
        </span>
        {short === "Auto" ? "Auto" : short === "Manual" ? "Manual" : "Export"}
        <span className="sr-only"> ({badge})</span>
      </span>
    </div>
  );
}

function buildExportBlob(post: CampaignDetailPost, caption: string, draft: BentleyDraft): string {
  const lines = [
    `Hero / Bentley — export bundle`,
    `Post id: ${post.id}`,
    `Platform: ${post.platform}`,
    `Status: ${post.status}`,
    `--- Caption ---`,
    caption,
    `--- Hook ---`,
    draft.hook || "",
    `--- CTA ---`,
    draft.cta || "",
    `--- Text prompt ---`,
    draft.promptText || "",
    `--- Image prompt ---`,
    draft.promptImage || "",
    `--- Video prompt ---`,
    draft.promptVideo || "",
  ];
  return lines.join("\n\n");
}

function downloadText(filename: string, body: string) {
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type BentleyCampaignOutputTileProps = {
  campaignId: string;
  /** Selected Revenue OS client — required for Content360 APIs and ownership. */
  clientId?: string;
  onShowFullDashboard?: () => void;
  onGenerateNew?: () => void;
};

export function BentleyCampaignOutputTile({
  campaignId,
  clientId = "",
  onShowFullDashboard,
  onGenerateNew,
}: BentleyCampaignOutputTileProps) {
  const safeClientId = coerceTrimmedString(clientId);
  const [data, setData] = useState<CampaignDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [uploadingPostId, setUploadingPostId] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [schedules, setSchedules] = useState<Record<string, string>>({});
  const [promptTab, setPromptTab] = useState<Record<string, PromptTab>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});
  const [autopilot, setAutopilot] = useState(false);
  const [autopilotBusy, setAutopilotBusy] = useState(false);

  const [c360Connections, setC360Connections] = useState<C360ConnectionRow[]>([]);
  const [c360Jobs, setC360Jobs] = useState<C360JobRow[]>([]);
  const [c360Loading, setC360Loading] = useState(false);
  const [c360PanelErr, setC360PanelErr] = useState<string | null>(null);
  const [c360ConnectOpen, setC360ConnectOpen] = useState(false);
  const [c360AccountName, setC360AccountName] = useState("");
  const [c360AccessToken, setC360AccessToken] = useState("");
  const [c360ConnectBusy, setC360ConnectBusy] = useState(false);
  const [defaultConnectionId, setDefaultConnectionId] = useState("");
  const [c360TargetByPost, setC360TargetByPost] = useState<Record<string, string>>({});
  const [c360TzByPost, setC360TzByPost] = useState<Record<string, string>>({});
  const [c360ScheduleBusyId, setC360ScheduleBusyId] = useState<string | null>(null);
  const [c360Batches, setC360Batches] = useState<C360BatchRow[]>([]);
  const [c360Readiness, setC360Readiness] = useState<C360ReadinessRow | null>(null);

  type C360PlatformScheduleUi =
    | { kind: "loading" }
    | { kind: "ready"; content360PlatformConfigured: boolean; canUseContent360PlatformSchedule: boolean }
    | { kind: "forbidden" };

  const [c360PlatformScheduleUi, setC360PlatformScheduleUi] = useState<C360PlatformScheduleUi>({ kind: "loading" });
  const [c360PlatformLaunchBusy, setC360PlatformLaunchBusy] = useState(false);
  const [c360PlatformLaunchMsg, setC360PlatformLaunchMsg] = useState<string | null>(null);

  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [weeklyPostsPreset, setWeeklyPostsPreset] = useState<"1" | "2" | "3" | "4" | "custom">("3");
  const [weeklyCustomN, setWeeklyCustomN] = useState(5);
  const [weeklyStart, setWeeklyStart] = useState("");
  const [weeklyEnd, setWeeklyEnd] = useState("");
  const [weeklyTz, setWeeklyTz] = useState(() => defaultTimeZone());
  const [slotMorning, setSlotMorning] = useState("09:00");
  const [slotAfternoon, setSlotAfternoon] = useState("14:00");
  const [slotEvening, setSlotEvening] = useState("19:00");
  const [weeklyPlatform, setWeeklyPlatform] = useState<string>("instagram");
  const [weeklyBusy, setWeeklyBusy] = useState(false);
  const [weeklyMsg, setWeeklyMsg] = useState<string | null>(null);
  const [lastBatchSend, setLastBatchSend] = useState<{
    batchId: string;
    totalPosts: number;
    scheduledCount: number;
    failedCount: number;
    skippedDuplicates: number;
    batchStatus: string;
  } | null>(null);

  const loadC360 = useCallback(async () => {
    const cid = safeClientId;
    if (!cid) {
      setC360Connections([]);
      setC360Jobs([]);
      setC360Batches([]);
      setC360Readiness(null);
      return;
    }
    setC360Loading(true);
    setC360PanelErr(null);
    try {
      const [cr, jr, br, rd] = await Promise.all([
        fetch(`/api/revenue-os/content360/connections?clientId=${encodeURIComponent(cid)}`, { credentials: "include" }),
        fetch(
          `/api/revenue-os/content360/jobs?clientId=${encodeURIComponent(cid)}&campaignId=${encodeURIComponent(campaignId)}`,
          { credentials: "include" }
        ),
        fetch(
          `/api/revenue-os/content360/batches?clientId=${encodeURIComponent(cid)}&campaignId=${encodeURIComponent(campaignId)}`,
          { credentials: "include" }
        ),
        fetch(`/api/revenue-os/content360/readiness?clientId=${encodeURIComponent(cid)}`, { credentials: "include" }),
      ]);
      const cj = (await cr.json().catch(() => ({}))) as { connections?: C360ConnectionRow[]; error?: string };
      const jj = (await jr.json().catch(() => ({}))) as { jobs?: C360JobRow[]; error?: string };
      const bj = (await br.json().catch(() => ({}))) as { batches?: C360BatchRow[]; error?: string };
      const rz = (await rd.json().catch(() => ({}))) as C360ReadinessRow & { error?: string };
      if (!cr.ok) throw new Error(typeof cj?.error === "string" ? cj.error : "Failed to load Content360 connections");
      if (!jr.ok) throw new Error(typeof jj?.error === "string" ? jj.error : "Failed to load Content360 jobs");
      if (!br.ok) throw new Error(typeof bj?.error === "string" ? bj.error : "Failed to load Content360 batches");
      if (!rd.ok) throw new Error(typeof rz?.error === "string" ? rz.error : "Failed to load Content360 readiness");
      const conns = Array.isArray(cj.connections) ? cj.connections : [];
      setC360Connections(conns);
      setC360Jobs(Array.isArray(jj.jobs) ? jj.jobs : []);
      setC360Batches(Array.isArray(bj.batches) ? bj.batches : []);
      setC360Readiness(
        typeof rz.featureEnabled === "boolean" && typeof rz.providerConfigured === "boolean" ? (rz as C360ReadinessRow) : null
      );
      setDefaultConnectionId((prev) => {
        if (prev && conns.some((c) => c.id === prev)) return prev;
        return conns[0]?.id ?? "";
      });
    } catch (e) {
      setC360PanelErr(e instanceof Error ? e.message : "Content360 load failed");
      setC360Connections([]);
      setC360Jobs([]);
      setC360Batches([]);
      setC360Readiness(null);
    } finally {
      setC360Loading(false);
    }
  }, [clientId, campaignId]);

  const c360UiLines = useMemo(() => {
    const r = c360Readiness;
    if (!r) return null;
    if (!r.featureEnabled) {
      return {
        headline: "Scheduling unavailable",
        sub: "Content360 is turned off for this environment.",
        scheduling: "Scheduling unavailable",
        cancel: "Cancel unavailable",
        sync: "Status sync unavailable",
      };
    }
    if (!r.hasConnection) {
      return {
        headline: "Needs connection",
        sub: "Connect a Content360 account for this client workspace.",
        scheduling: "Scheduling unavailable",
        cancel: "Cancel unavailable",
        sync: "Status sync unavailable",
      };
    }
    if (!r.providerConfigured) {
      return {
        headline: "Waiting on Content360 API setup",
        sub: "Your server is not configured with a Content360 API base URL yet.",
        scheduling: "Scheduling unavailable",
        cancel: "Cancel unavailable",
        sync: "Status sync unavailable",
      };
    }
    return {
      headline: "Ready",
      sub: `Connected account status: ${r.connectionStatus}`,
      scheduling: r.canScheduleSingle ? "Scheduling available" : "Scheduling unavailable",
      cancel: r.canCancel ? "Cancel available" : "Cancel unavailable",
      sync: r.canSyncStatus ? "Status sync available" : "Status sync unavailable",
    };
  }, [c360Readiness]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, { credentials: "include" });
      const j = (await r.json().catch(() => ({}))) as CampaignDetailResponse & { error?: string; message?: string };
      if (!r.ok) {
        throw new Error(typeof j?.message === "string" ? j.message : j?.error ?? "Failed to load campaign");
      }
      const posts = (j.posts ?? []).map((p) => ({
        ...p,
        id: asTrimmedString(p.id),
        platform: asPlatformSlug(p.platform),
        caption: p.caption == null ? null : asTrimmedString(p.caption),
      }));
      setData({ ...j, name: asTrimmedString(j.name), posts });
      setAutopilot(Boolean(j.bentleyAutopilotPublish));
      const cap: Record<string, string> = {};
      const sch: Record<string, string> = {};
      for (const p of posts) {
        cap[p.id] = p.caption ?? "";
        sch[p.id] = toDatetimeLocalValue(p.scheduledAt);
      }
      setCaptions(cap);
      setSchedules(sch);
      const tz0 = defaultTimeZone();
      const tgt: Record<string, string> = {};
      const tz: Record<string, string> = {};
      for (const p of posts) {
        const m = parseScheduledPublishMeta(p.scheduledPublishMeta);
        tgt[p.id] = asPlatformSlug(m.targetPlatform ?? p.platform);
        tz[p.id] = asTrimmedString(m.timezone) || tz0;
      }
      setC360TargetByPost(tgt);
      setC360TzByPost(tz);
      void loadC360();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId, clientId, loadC360]);

  useEffect(() => {
    let cancelled = false;
    setC360PlatformScheduleUi({ kind: "loading" });
    void (async () => {
      try {
        const r = await fetch("/api/admin/content360/platform-status", { credentials: "include" });
        if (cancelled) return;
        if (r.ok) {
          const j = (await r.json().catch(() => ({}))) as {
            content360PlatformConfigured?: boolean;
            canUseContent360PlatformSchedule?: boolean;
          };
          setC360PlatformScheduleUi({
            kind: "ready",
            content360PlatformConfigured: Boolean(j.content360PlatformConfigured),
            canUseContent360PlatformSchedule: Boolean(j.canUseContent360PlatformSchedule),
          });
          return;
        }
        setC360PlatformScheduleUi({ kind: "forbidden" });
      } catch {
        if (!cancelled) setC360PlatformScheduleUi({ kind: "forbidden" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runContent360PlatformBentleySync = useCallback(async () => {
    setC360PlatformLaunchBusy(true);
    setC360PlatformLaunchMsg(null);
    try {
      await syncBentleyLaunchApi({
        campaignId,
        scheduleStrategy: "staggered",
        staggerMinutes: 30,
        publishRoute: "content360",
        content360PlatformSchedule: true,
      });
      setC360PlatformLaunchMsg("Launch sync completed with Content360 platform scheduling.");
      await load();
    } catch (e) {
      setC360PlatformLaunchMsg(e instanceof Error ? e.message : "Launch sync failed.");
    } finally {
      setC360PlatformLaunchBusy(false);
    }
  }, [campaignId, load]);

  useEffect(() => {
    void load();
  }, [load]);

  const platformList = useMemo(() => {
    const posts = data?.posts ?? [];
    const s = new Set<string>();
    for (const p of posts) s.add(asPlatformSlug(p.platform, ""));
    return [...s].sort((a, b) => a.localeCompare(b)).map(platformHeading).join(", ") || "—";
  }, [data?.posts]);

  const grouped = useMemo(() => {
    const posts = data?.posts ?? [];
    const m = new Map<string, CampaignDetailPost[]>();
    for (const p of posts) {
      const k = asPlatformSlug(p.platform, "");
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data?.posts]);

  const jobsByPostId = useMemo(() => {
    const m = new Map<string, C360JobRow[]>();
    for (const j of c360Jobs) {
      const pid = typeof j.campaignPostId === "string" ? j.campaignPostId : "";
      if (!pid) continue;
      const arr = m.get(pid) ?? [];
      arr.push(j);
      m.set(pid, arr);
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
    }
    return m;
  }, [c360Jobs]);

  const tzOptions = useMemo(() => content360TimeZoneOptions(), []);

  const summaryStatus = useMemo(() => {
    const posts = data?.posts ?? [];
    if (!posts.length) return "No posts";
    const posted = posts.filter((p) => String(p.status).toUpperCase() === "POSTED").length;
    if (posted === posts.length) return "All posted";
    return `${posts.length} post${posts.length === 1 ? "" : "s"} · ${posted} published`;
  }, [data?.posts]);

  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const patchPost = async (postId: string, body: Record<string, unknown>) => {
    setBusyPostId(postId);
    try {
      const r = await fetch(`/api/campaigns/posts/${encodeURIComponent(postId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(typeof j?.message === "string" ? j.message : j?.error ?? "Update failed");
      }
      setRowErrors((prev) => ({ ...prev, [postId]: null }));
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      setRowErrors((prev) => ({ ...prev, [postId]: msg }));
      throw e;
    } finally {
      setBusyPostId(null);
    }
  };

  const uploadAsset = async (post: CampaignDetailPost, file: File) => {
    setUploadingPostId(post.id);
    setRowErrors((prev) => ({ ...prev, [post.id]: null }));
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("platform", asPlatformSlug(post.platform));
      fd.append("postId", post.id);
      const r = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/assets`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(typeof j?.message === "string" ? j.message : j?.error ?? "Upload failed");
      }
      const assetId = typeof j?.assetId === "string" ? j.assetId : "";
      if (!assetId) throw new Error("No asset id returned");
      await patchPost(post.id, { assetId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setRowErrors((prev) => ({ ...prev, [post.id]: msg }));
      setError(msg);
    } finally {
      setUploadingPostId(null);
    }
  };

  const publishNow = async (postId: string) => {
    setBusyPostId(postId);
    setError(null);
    setRowErrors((prev) => ({ ...prev, [postId]: null }));
    try {
      const r = await fetch(`/api/campaigns/posts/${encodeURIComponent(postId)}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(typeof j?.message === "string" ? j.message : j?.error ?? "Publish failed");
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publish failed";
      setRowErrors((prev) => ({ ...prev, [postId]: msg }));
      setError(msg);
    } finally {
      setBusyPostId(null);
    }
  };

  const patchAutopilot = async (next: boolean) => {
    if (data?.viewerCampaignReviewerRole !== "owner") return;
    setAutopilotBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bentleyAutopilotPublish: next }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(typeof j?.message === "string" ? j.message : j?.error ?? "Update failed");
      }
      setAutopilot(next);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setAutopilotBusy(false);
    }
  };

  const connectContent360 = async () => {
    const cid = safeClientId;
    if (!cid) return;
    setC360ConnectBusy(true);
    setC360PanelErr(null);
    try {
      const r = await fetch("/api/revenue-os/content360/connect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: cid,
          accountName: c360AccountName.trim() || "Content360",
          accessToken: c360AccessToken.trim(),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : "Connect failed");
      setC360ConnectOpen(false);
      setC360AccessToken("");
      setC360AccountName("");
      await loadC360();
    } catch (e) {
      setC360PanelErr(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setC360ConnectBusy(false);
    }
  };

  const disconnectContent360 = async (connectionId: string) => {
    const cid = safeClientId;
    if (!cid) return;
    if (!window.confirm("Disconnect this Content360 account for this client workspace?")) return;
    setC360ConnectBusy(true);
    setC360PanelErr(null);
    try {
      const base = `/api/revenue-os/content360/connections/${encodeURIComponent(connectionId)}?clientId=${encodeURIComponent(cid)}`;
      const r = await fetch(base, { method: "DELETE", credentials: "include" });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        activeJobCount?: number;
      };
      if (r.status === 409 && j?.code === "CONTENT360_ACTIVE_JOBS") {
        if (
          window.confirm(
            `${j.error ?? "This connection has active Content360 jobs."}\n\nForce disconnect? In-flight schedules will be marked disconnected and will not run.`,
          )
        ) {
          const r2 = await fetch(`${base}&force=1`, { method: "DELETE", credentials: "include" });
          const j2 = (await r2.json().catch(() => ({}))) as { error?: string };
          if (!r2.ok) throw new Error(typeof j2?.error === "string" ? j2.error : "Disconnect failed");
          await loadC360();
        }
        return;
      }
      if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : "Disconnect failed");
      await loadC360();
    } catch (e) {
      setC360PanelErr(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setC360ConnectBusy(false);
    }
  };

  const scheduleViaContent360 = async (post: CampaignDetailPost) => {
    const cid = safeClientId;
    const conn = defaultConnectionId.trim();
    if (!cid || !conn) {
      setRowErrors((prev) => ({ ...prev, [post.id]: "Select a Content360 connection." }));
      return;
    }
    if (c360Readiness && !c360Readiness.canScheduleSingle) {
      setRowErrors((prev) => ({
        ...prev,
        [post.id]: "Content360 scheduling is not available yet. Check the status summary above.",
      }));
      return;
    }
    const iso = fromDatetimeLocalValue(schedules[post.id] ?? "");
    if (!iso) {
      setRowErrors((prev) => ({ ...prev, [post.id]: "Pick a schedule date and time first." }));
      return;
    }
    setC360ScheduleBusyId(post.id);
    setRowErrors((prev) => ({ ...prev, [post.id]: null }));
    setC360PanelErr(null);
    try {
      const r = await fetch("/api/revenue-os/content360/schedule", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: cid,
          campaignId,
          campaignPostId: post.id,
          connectionId: conn,
          scheduledAt: iso,
          timezone: (c360TzByPost[post.id] ?? defaultTimeZone()).trim(),
          targetPlatform: asPlatformSlug(c360TargetByPost[post.id] ?? post.platform),
          caption: captions[post.id] ?? post.caption ?? "",
          hashtags: post.hashtags ?? null,
          assetId: post.assetId,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : "Content360 schedule failed");
      await load();
      await loadC360();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Content360 schedule failed";
      setRowErrors((prev) => ({ ...prev, [post.id]: msg }));
      setC360PanelErr(msg);
    } finally {
      setC360ScheduleBusyId(null);
    }
  };

  const retryContent360Job = async (jobId: string) => {
    const cid = safeClientId;
    if (!cid) return;
    setC360ConnectBusy(true);
    setC360PanelErr(null);
    try {
      const r = await fetch(`/api/revenue-os/content360/jobs/${encodeURIComponent(jobId)}/retry`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: cid }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : "Retry failed");
      await load();
      await loadC360();
    } catch (e) {
      setC360PanelErr(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setC360ConnectBusy(false);
    }
  };

  useEffect(() => {
    if (!weeklyOpen) return;
    if (weeklyStart && weeklyEnd) return;
    const t = new Date();
    const e = new Date(t);
    e.setUTCDate(e.getUTCDate() + 6);
    const toYmd = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    setWeeklyStart((s) => s || toYmd(t));
    setWeeklyEnd((s) => s || toYmd(e));
  }, [weeklyOpen, weeklyStart, weeklyEnd]);

  const latestCampaignBatch = useMemo(() => c360Batches[0] ?? null, [c360Batches]);

  const weeklyPlan = useMemo((): { ok: true; items: Array<{ post: CampaignDetailPost; scheduledAt: string; targetPlatform: string; dayYmd: string; slot: string }> } | { ok: false; error: string } => {
    const posts = data?.posts ?? [];
    if (!weeklyStart.trim() || !weeklyEnd.trim()) return { ok: false, error: "Pick a start and end date for the batch." };
    const days = eachCalendarDayYmd(weeklyStart.trim(), weeklyEnd.trim());
    if (!days.length) return { ok: false, error: "Invalid date range." };
    const n =
      weeklyPostsPreset === "custom"
        ? Math.max(1, Math.min(20, Math.floor(Number(weeklyCustomN)) || 1))
        : Number(weeklyPostsPreset);
    const slots = [slotMorning, slotAfternoon, slotEvening];
    const pool = posts.filter((p) => !["POSTED", "POSTING"].includes(String(p.status).toUpperCase()));
    const items: Array<{ post: CampaignDetailPost; scheduledAt: string; targetPlatform: string; dayYmd: string; slot: string }> = [];
    const queue = [...pool];
    outer: for (const day of days) {
      for (let i = 0; i < n; i++) {
        const next = queue.shift();
        if (!next) break outer;
        const slot = (slots[i % slots.length] ?? "09:00").trim() || "09:00";
        const iso = ianaWallTimeToUtcIso(day, slot, weeklyTz.trim());
        if (!iso) continue;
        items.push({
          post: next,
          scheduledAt: iso,
          targetPlatform: weeklyPlatform.trim().toLowerCase(),
          dayYmd: day,
          slot,
        });
      }
    }
    if (!items.length) return { ok: false, error: "No eligible posts remain to assign in this range (or invalid times)." };
    return { ok: true, items };
  }, [
    data?.posts,
    weeklyStart,
    weeklyEnd,
    weeklyPostsPreset,
    weeklyCustomN,
    slotMorning,
    slotAfternoon,
    slotEvening,
    weeklyTz,
    weeklyPlatform,
  ]);

  const weeklyBatchWarnings = useMemo(() => {
    const w: string[] = [];
    if (!safeClientId) w.push("Select a client workspace in the dashboard header.");
    if (!c360Connections.length) w.push("No Content360 connection — connect an account first.");
    else if (!defaultConnectionId.trim()) w.push("Select a Content360 connection for this batch.");
    const posts = data?.posts ?? [];
    if (!posts.length) w.push("No campaign posts loaded yet.");
    const eligible = posts.filter((p) => !["POSTED", "POSTING"].includes(String(p.status).toUpperCase()));
    if (posts.length > 0 && eligible.length === 0) w.push("No eligible posts (all published or publishing).");
    if (!weeklyPlan.ok) {
      if (weeklyPlan.error && !w.length) w.push(weeklyPlan.error);
      return w;
    }
    const missingMedia = weeklyPlan.items.filter((x) => !asTrimmedString(x.post.assetId)).length;
    if (missingMedia) {
      w.push(
        `${missingMedia} slot(s) are missing media (no asset). Content360 or downstream review may reject them.`,
      );
    }
    const isoKeys = weeklyPlan.items.map((x) => x.scheduledAt);
    if (isoKeys.length !== new Set(isoKeys).size) {
      w.push("Duplicate scheduled times in this batch — duplicates may be skipped server-side; review the preview.");
    }
    for (const x of weeklyPlan.items) {
      const ct = (x.post.assetCreativeType ?? "").toLowerCase();
      if (ct && (ct.includes("pdf") || ct.includes("document") || ct.includes("sheet"))) {
        w.push("At least one post uses a document-style asset; confirm Content360 accepts this format for the selected platform.");
        break;
      }
    }
    return w;
  }, [weeklyPlan, clientId, defaultConnectionId, c360Connections.length, data?.posts]);

  const sendWeekToContent360 = async () => {
    const cid = safeClientId;
    const conn = defaultConnectionId.trim();
    if (!cid || !conn) {
      setWeeklyMsg("Select a Content360 connection.");
      return;
    }
    if (!weeklyPlan.ok) {
      setWeeklyMsg(weeklyPlan.error);
      return;
    }
    if (c360Readiness && !c360Readiness.canScheduleSingle) {
      setWeeklyMsg("Content360 scheduling is not available yet. Check the status summary above.");
      return;
    }
    setWeeklyBusy(true);
    setWeeklyMsg(null);
    setC360PanelErr(null);
    try {
      const r = await fetch("/api/revenue-os/content360/schedule-batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: cid,
          campaignId,
          connectionId: conn,
          timezone: weeklyTz.trim(),
          posts: weeklyPlan.items.map((x) => ({
            campaignPostId: x.post.id,
            assetId: x.post.assetId,
            targetPlatform: x.targetPlatform,
            scheduledAt: x.scheduledAt,
            caption: captions[x.post.id] ?? x.post.caption ?? "",
            hashtags: x.post.hashtags ?? null,
          })),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        batchId?: string;
        totalPosts?: number;
        scheduledCount?: number;
        failedCount?: number;
        skippedDuplicates?: number;
        batchStatus?: string;
      };
      if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : "Batch schedule failed");
      setLastBatchSend({
        batchId: String(j.batchId ?? ""),
        totalPosts: Number(j.totalPosts ?? 0),
        scheduledCount: Number(j.scheduledCount ?? 0),
        failedCount: Number(j.failedCount ?? 0),
        skippedDuplicates: Number(j.skippedDuplicates ?? 0),
        batchStatus: String(j.batchStatus ?? ""),
      });
      await load();
      await loadC360();
    } catch (e) {
      setWeeklyMsg(e instanceof Error ? e.message : "Batch schedule failed");
    } finally {
      setWeeklyBusy(false);
    }
  };

  const retryLatestBatchFailedPosts = async () => {
    const bid = asTrimmedString(lastBatchSend?.batchId || latestCampaignBatch?.id);
    const cid = safeClientId;
    if (!bid || !cid) return;
    setC360ConnectBusy(true);
    setC360PanelErr(null);
    try {
      const r = await fetch(`/api/revenue-os/content360/batches/${encodeURIComponent(bid)}/retry-failed`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: cid }),
      });
      const body = (await r.json().catch(() => ({}))) as { error?: string; retried?: number; skipped?: number };
      if (!r.ok) throw new Error(typeof body?.error === "string" ? body.error : "Retry batch failed");
      await load();
      await loadC360();
    } catch (e) {
      setC360PanelErr(e instanceof Error ? e.message : "Retry batch failed");
    } finally {
      setC360ConnectBusy(false);
    }
  };

  const cancelLatestBatch = async () => {
    const bid = asTrimmedString(lastBatchSend?.batchId || latestCampaignBatch?.id);
    const cid = safeClientId;
    if (!bid || !cid) return;
    if (
      !window.confirm(
        "Cancel all non-published jobs in this batch locally (and request cancel at Content360 when a schedule id exists)?",
      )
    ) {
      return;
    }
    setC360ConnectBusy(true);
    setC360PanelErr(null);
    try {
      const r = await fetch(`/api/revenue-os/content360/batches/${encodeURIComponent(bid)}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: cid }),
      });
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(typeof body?.error === "string" ? body.error : "Cancel batch failed");
      await load();
      await loadC360();
    } catch (e) {
      setC360PanelErr(e instanceof Error ? e.message : "Cancel batch failed");
    } finally {
      setC360ConnectBusy(false);
    }
  };

  const ownerMayAutopilot = data?.viewerCampaignReviewerRole === "owner";

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-cyan-500/40 bg-slate-900/70 p-6 text-slate-300 text-sm">
        Loading campaign execution…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-amber-600/50 bg-amber-950/30 p-6 text-amber-100 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-cyan-500/45 bg-slate-900/80 shadow-xl overflow-hidden"
      data-bentley-section="bentley-campaign-output"
    >
      <div className="border-b border-cyan-500/30 bg-slate-950/70">
        <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
          <div className="min-w-0 space-y-1">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Campaign</div>
            <div className="font-semibold text-cyan-100 truncate">
              {asTrimmedString(data?.name) || "Untitled campaign"}
            </div>
          </div>
          <div className="min-w-0 space-y-1">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Platforms</div>
            <div className="text-slate-200 text-xs max-w-md truncate" title={platformList}>
              {platformList}
            </div>
          </div>
          <div className="min-w-0 space-y-1">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Status</div>
            <div className="text-slate-200 text-xs">{summaryStatus}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-cyan-500/40 text-cyan-200 hover:bg-cyan-950/50 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="px-5 py-2 flex flex-wrap items-center gap-2 border-t border-cyan-500/20 bg-slate-950/50">
          {onGenerateNew ? (
            <button
              type="button"
              onClick={onGenerateNew}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-cyan-600/90 text-black hover:bg-cyan-500"
            >
              Generate new
            </button>
          ) : null}
          {onShowFullDashboard ? (
            <button
              type="button"
              onClick={onShowFullDashboard}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-500/60 text-slate-200 hover:bg-slate-800/80"
            >
              Show full dashboard
            </button>
          ) : null}
          {ownerMayAutopilot ? (
            <label className="ml-auto inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-slate-500 bg-slate-950"
                checked={autopilot}
                disabled={autopilotBusy}
                onChange={(e) => void patchAutopilot(e.target.checked)}
              />
              <span>
                Auto-approve scheduled publish
                <span className="block text-[10px] text-slate-500 font-normal">
                  When the server requires publish approval, the worker can still run on schedule for this campaign.
                </span>
              </span>
            </label>
          ) : null}
        </div>
      </div>

      {error ? <div className="px-5 py-2 text-xs text-amber-200/90 bg-amber-950/25 border-b border-amber-700/30">{error}</div> : null}
      {c360PanelErr ? (
        <div className="px-5 py-2 text-xs text-amber-200/90 bg-amber-950/25 border-b border-amber-800/35">{c360PanelErr}</div>
      ) : null}

      <div className="px-4 pt-3 pb-2 border-b border-violet-500/25 bg-violet-950/15 text-sm text-slate-200 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-violet-200/95">Content360 publishing</div>
          <button
            type="button"
            onClick={() => void loadC360()}
            disabled={c360Loading || !safeClientId}
            className="text-xs font-medium px-2.5 py-1 rounded-md border border-violet-500/50 text-violet-100 hover:bg-violet-950/50 disabled:opacity-40"
          >
            Refresh jobs
          </button>
        </div>
        {c360UiLines ? (
          <div className="rounded-md border border-slate-700/50 bg-slate-950/45 px-2.5 py-2 space-y-1">
            <div className="text-slate-200 font-medium text-xs">{c360UiLines.headline}</div>
            <p className="text-[11px] text-slate-500 leading-snug">{c360UiLines.sub}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
              <span>{c360UiLines.scheduling}</span>
              <span className="text-slate-600">·</span>
              <span>{c360UiLines.cancel}</span>
              <span className="text-slate-600">·</span>
              <span>{c360UiLines.sync}</span>
            </div>
          </div>
        ) : null}
        {c360PlatformScheduleUi.kind === "ready" ? (
          <div className="rounded-md border border-amber-600/35 bg-amber-950/20 px-2.5 py-2 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-100/90">
              Platform admin · Content360 launch sync
            </div>
            {c360PlatformScheduleUi.canUseContent360PlatformSchedule ? (
              <>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Re-run Bentley launch sync so scheduled posts use the{" "}
                  <span className="text-slate-300">platform owner Content360 account</span> (central server credentials —
                  not workspace OAuth). The worker publishes via the trusted platform-key path. Per-row &quot;Schedule
                  via Content360&quot; above still uses client connections when you pick Content360 there.
                </p>
                {c360PlatformLaunchMsg ? (
                  <p
                    className={`text-[11px] ${
                      /failed|forbidden|401|403|not configured/i.test(c360PlatformLaunchMsg)
                        ? "text-amber-200/95"
                        : "text-emerald-200/90"
                    }`}
                  >
                    {c360PlatformLaunchMsg}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={c360PlatformLaunchBusy}
                  onClick={() => void runContent360PlatformBentleySync()}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-amber-500/55 text-amber-100 hover:bg-amber-950/50 disabled:opacity-40"
                >
                  {c360PlatformLaunchBusy ? "Syncing…" : "Sync launch (Content360 platform scheduling)"}
                </button>
              </>
            ) : (
              <p className="text-[11px] text-slate-500">
                Content360 platform API environment is not fully configured on this server, so centralized platform
                scheduling is unavailable.
              </p>
            )}
          </div>
        ) : null}
        {!safeClientId ? (
          <p className="text-xs text-amber-200/85">
            Select a client workspace in the dashboard header so Content360 calls are scoped to the correct owner.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 shrink-0">Use connection</span>
              <select
                className="flex-1 min-w-[10rem] max-w-md rounded-md border border-slate-600/70 bg-slate-950 px-2 py-1 text-slate-100"
                value={defaultConnectionId}
                onChange={(e) => setDefaultConnectionId(e.target.value)}
                disabled={!c360Connections.length}
              >
                {!c360Connections.length ? <option value="">No connections yet</option> : null}
                {c360Connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.accountName} · {c.connectionStatus}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setC360ConnectOpen((o) => !o)}
                className="shrink-0 rounded-md border border-violet-500/55 px-2 py-1 text-violet-100 hover:bg-violet-950/40"
              >
                {c360ConnectOpen ? "Close" : "Connect Content360"}
              </button>
            </div>
            {c360ConnectOpen ? (
              <div className="rounded-lg border border-violet-600/40 bg-black/25 p-3 space-y-2 text-xs">
                <p className="text-slate-400">
                  Credentials are encrypted server-side. Use the account label you recognize in Content360.
                </p>
                <input
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-slate-100"
                  placeholder="Account label"
                  value={c360AccountName}
                  onChange={(e) => setC360AccountName(e.target.value)}
                />
                <input
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-slate-100"
                  type="password"
                  autoComplete="off"
                  placeholder="Access token"
                  value={c360AccessToken}
                  onChange={(e) => setC360AccessToken(e.target.value)}
                />
                <button
                  type="button"
                  disabled={c360ConnectBusy || !c360AccessToken.trim()}
                  onClick={() => void connectContent360()}
                  className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40"
                >
                  {c360ConnectBusy ? "Saving…" : "Save connection"}
                </button>
              </div>
            ) : null}
            {c360Connections.length > 0 ? (
              <ul className="text-[11px] text-slate-400 space-y-1 max-h-24 overflow-y-auto">
                {c360Connections.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/30 pb-1">
                    <span className="truncate">
                      {c.accountName}{" "}
                      <span className="text-slate-600">({c.connectionStatus})</span>
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-rose-300 hover:text-rose-200"
                      onClick={() => void disconnectContent360(c.id)}
                      disabled={c360ConnectBusy}
                    >
                      Disconnect
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {c360Jobs.length > 0 ? (
              <div className="text-[11px] text-slate-400 border-t border-violet-500/20 pt-2 space-y-1 max-h-36 overflow-y-auto">
                <div className="font-medium text-slate-500">Job timeline (this campaign)</div>
                {c360Jobs.slice(0, 20).map((j) => (
                  <div key={String(j.id)} className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800/60 py-1">
                    <div className="min-w-0">
                      <span className="text-violet-200/90 font-medium">{String(j.status ?? "")}</span>
                      <span className="text-slate-600"> · {String(j.targetPlatform ?? "")}</span>
                      <div className="text-slate-500 truncate" title={String(j.errorMessage ?? "")}>
                        {String(j.updatedAt ?? "").slice(0, 19)}
                        {j.errorMessage ? ` — ${String(j.errorMessage)}` : ""}
                      </div>
                    </div>
                    {String(j.status) === "failed" ? (
                      <button
                        type="button"
                        className="shrink-0 text-cyan-300 hover:text-cyan-200 text-[11px]"
                        onClick={() => void retryContent360Job(String(j.id))}
                        disabled={c360ConnectBusy}
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">No Content360 jobs for this campaign yet.</p>
            )}

            <div className="border-t border-violet-500/25 pt-3 space-y-2 text-[11px] text-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-violet-200/95 text-xs uppercase tracking-wide">Weekly batch → Content360</div>
                <button
                  type="button"
                  className="rounded-md border border-violet-500/50 px-2 py-1 text-violet-100 hover:bg-violet-950/45 disabled:opacity-40"
                  disabled={!safeClientId}
                  onClick={() => setWeeklyOpen((o) => !o)}
                >
                  {weeklyOpen ? "Hide planner" : "Create weekly schedule"}
                </button>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Plan in Bentley, then send a full week to Content360 for timed publishing. Content360 executes delivery; Bentley does not wake per slot.
              </p>
              {weeklyOpen ? (
                <div className="rounded-lg border border-violet-600/35 bg-black/20 p-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-slate-500">Posts per day</span>
                      <select
                        className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
                        value={weeklyPostsPreset}
                        onChange={(e) => setWeeklyPostsPreset(e.target.value as typeof weeklyPostsPreset)}
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="custom">Custom</option>
                      </select>
                    </label>
                    {weeklyPostsPreset === "custom" ? (
                      <label className="space-y-1">
                        <span className="text-slate-500">Custom (1–20)</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
                          value={weeklyCustomN}
                          onChange={(e) => setWeeklyCustomN(Number(e.target.value))}
                        />
                      </label>
                    ) : null}
                    <label className="space-y-1">
                      <span className="text-slate-500">Start date</span>
                      <input
                        type="date"
                        className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
                        value={weeklyStart}
                        onChange={(e) => setWeeklyStart(e.target.value)}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-500">End date</span>
                      <input
                        type="date"
                        className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
                        value={weeklyEnd}
                        onChange={(e) => setWeeklyEnd(e.target.value)}
                      />
                    </label>
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-slate-500">Timezone</span>
                      <select
                        className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
                        value={weeklyTz}
                        onChange={(e) => setWeeklyTz(e.target.value)}
                      >
                        {tzOptions.map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1">
                      <span className="text-slate-500">Morning</span>
                      <input
                        type="time"
                        className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
                        value={slotMorning}
                        onChange={(e) => setSlotMorning(e.target.value)}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-500">Afternoon</span>
                      <input
                        type="time"
                        className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
                        value={slotAfternoon}
                        onChange={(e) => setSlotAfternoon(e.target.value)}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-500">Evening</span>
                      <input
                        type="time"
                        className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
                        value={slotEvening}
                        onChange={(e) => setSlotEvening(e.target.value)}
                      />
                    </label>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-slate-500">Platform for this batch</span>
                    <select
                      className="w-full max-w-md rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
                      value={weeklyPlatform}
                      onChange={(e) => setWeeklyPlatform(e.target.value)}
                    >
                      {CONTENT360_TARGET_PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                  {weeklyBatchWarnings.length > 0 ? (
                    <ul className="list-disc pl-4 text-amber-200/85 space-y-1">
                      {weeklyBatchWarnings.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  ) : null}
                  {weeklyMsg ? <p className="text-amber-200/90">{weeklyMsg}</p> : null}
                  {latestCampaignBatch ? (
                    <div className="rounded-md border border-slate-700/60 bg-slate-950/60 px-2 py-2 text-slate-400">
                      <div className="text-slate-300 font-medium">Latest batch</div>
                      <div>
                        {latestCampaignBatch.totalPosts} posts queued · {latestCampaignBatch.scheduledCount} accepted by Content360
                        {latestCampaignBatch.failedCount ? (
                          <span className="text-amber-200/90"> · {latestCampaignBatch.failedCount} failed</span>
                        ) : null}
                      </div>
                      <div className="text-slate-500">Status: {latestCampaignBatch.status}</div>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {latestCampaignBatch.failedCount > 0 ? (
                          <button
                            type="button"
                            disabled={c360ConnectBusy}
                            className="text-cyan-300 hover:text-cyan-200"
                            onClick={() => void retryLatestBatchFailedPosts()}
                          >
                            Retry failed (batch)
                          </button>
                        ) : null}
                        {latestCampaignBatch.status !== "canceled" && latestCampaignBatch.totalPosts > 0 ? (
                          <button
                            type="button"
                            disabled={c360ConnectBusy}
                            className="text-rose-300/90 hover:text-rose-200"
                            onClick={() => void cancelLatestBatch()}
                          >
                            Cancel batch
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {lastBatchSend ? (
                    <div className="rounded-md border border-cyan-700/40 bg-cyan-950/20 px-2 py-2 text-cyan-100/90">
                      <div>
                        {`Last send: ${lastBatchSend.scheduledCount}/${lastBatchSend.totalPosts} accepted by Content360${
                          lastBatchSend.failedCount ? ` · ${lastBatchSend.failedCount} failed` : ""
                        }${
                          lastBatchSend.skippedDuplicates
                            ? ` · ${lastBatchSend.skippedDuplicates} skipped as duplicates`
                            : ""
                        } (${lastBatchSend.batchStatus})`}
                      </div>
                      {lastBatchSend.batchId ? (
                        <div className="mt-2 flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={c360ConnectBusy}
                            className="text-cyan-300 hover:text-cyan-200"
                            onClick={() => void retryLatestBatchFailedPosts()}
                          >
                            Retry failed
                          </button>
                          <button
                            type="button"
                            disabled={c360ConnectBusy}
                            className="text-rose-300/90 hover:text-rose-200"
                            onClick={() => void cancelLatestBatch()}
                          >
                            Cancel batch
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div>
                    <div className="text-slate-500 mb-1">Preview calendar</div>
                    {weeklyPlan.ok ? (
                      <ul className="max-h-40 overflow-y-auto space-y-1 border border-slate-700/50 rounded-md p-2 bg-slate-950/40">
                        {weeklyPlan.items.slice(0, 80).map((x) => (
                          <li key={`${x.post.id}-${x.scheduledAt}`} className="flex flex-wrap justify-between gap-1">
                            <span className="text-slate-400">
                              {x.dayYmd} {x.slot} ({weeklyTz})
                            </span>
                            <span className="text-slate-300 truncate max-w-[12rem]" title={x.post.id}>
                              {x.post.id.slice(0, 8)}… · {x.targetPlatform}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-amber-200/85">{weeklyPlan.error}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={
                      weeklyBusy ||
                      !defaultConnectionId.trim() ||
                      !weeklyPlan.ok ||
                      !safeClientId ||
                      Boolean(c360Readiness && !c360Readiness.canScheduleSingle)
                    }
                    onClick={() => void sendWeekToContent360()}
                    className="w-full sm:w-auto rounded-md bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
                  >
                    {weeklyBusy ? "Sending batch…" : "Send week to Content360"}
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      <div className="p-4 space-y-8 max-h-[min(78vh,1200px)] overflow-y-auto">
        {grouped.length === 0 ? (
          <p className="text-sm text-slate-400 px-2">No posts yet — run sync-launch after campaign generation.</p>
        ) : (
          grouped.map(([platform, rows]) => (
            <section key={platform} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 sticky top-0 bg-slate-900/95 py-2 z-[1] border-b border-slate-700/40">
                <h3 className="text-sm font-semibold text-cyan-300/95">{platformHeading(platform)}</h3>
                <PlatformBadge platform={platform} />
              </div>
              <div className="space-y-5">
                {rows.map((post, idx) => {
                  const draft = draftFromRow(post.bentleyDraftJson);
                  const cap = captions[post.id] ?? "";
                  const sched = schedules[post.id] ?? "";
                  const busy = busyPostId === post.id;
                  const uploading = uploadingPostId === post.id;
                  const capMode = getBentleyPlatformExecutionCapability(post.platform);
                  const tab = promptTab[post.id] ?? "text";
                  const tabBody =
                    tab === "text" ? draft.promptText : tab === "image" ? draft.promptImage : draft.promptVideo;
                  const postPr = parseScheduledPublishMeta(post.scheduledPublishMeta);
                  const chip = executionRowStatusLabel(post);
                  const rowErr = rowErrors[post.id];
                  const needsAssetToPublish = capMode === "auto_publish";
                  const canPostNow = needsAssetToPublish ? Boolean(post.assetId) : false;

                  const setTab = (t: PromptTab) => setPromptTab((prev) => ({ ...prev, [post.id]: t }));

                  return (
                    <div
                      key={post.id}
                      className="rounded-xl border border-slate-600/55 bg-black/30 p-4 shadow-inner"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="text-xs text-slate-500 uppercase tracking-wide">Post</div>
                          <div className="text-sm font-medium text-slate-100">
                            #{idx + 1}{" "}
                            <span className="text-slate-500 font-normal">· {post.id.slice(0, 8)}…</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-medium uppercase tracking-wide rounded-full border border-slate-600/70 px-2.5 py-1 text-cyan-100/90 bg-slate-950/80">
                          {chip}
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">Caption</label>
                          <textarea
                            className="w-full min-h-[80px] rounded-lg border border-slate-600/60 bg-slate-950/80 text-slate-100 text-sm p-2"
                            value={cap}
                            onChange={(e) => setCaptions((prev) => ({ ...prev, [post.id]: e.target.value }))}
                            rows={3}
                          />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Hook</div>
                            <div className="text-sm text-slate-200 whitespace-pre-wrap min-h-[2.5rem]">
                              {draft.hook || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">CTA</div>
                            <div className="text-sm text-slate-200 whitespace-pre-wrap min-h-[2.5rem]">
                              {draft.cta || "—"}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="flex gap-1 mb-2 border-b border-slate-700/60">
                            {(["text", "image", "video"] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-t-md border border-b-0 transition-colors ${
                                  tab === t
                                    ? "border-cyan-500/50 bg-slate-900 text-cyan-200"
                                    : "border-transparent text-slate-500 hover:text-slate-300"
                                }`}
                              >
                                {t === "text" ? "Text prompt" : t === "image" ? "Image prompt" : "Video prompt"}
                              </button>
                            ))}
                          </div>
                          <div className="rounded-lg border border-slate-700/50 bg-slate-950/80 p-3 flex flex-col gap-2">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                disabled={!tabBody?.trim()}
                                onClick={() => void copyPrompt(tabBody.trim())}
                                className="text-xs font-medium text-cyan-300 hover:text-cyan-200 disabled:opacity-40"
                              >
                                Copy prompt
                              </button>
                            </div>
                            <pre className="text-xs text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                              {tabBody?.trim() || "—"}
                            </pre>
                          </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-12 border-t border-slate-700/40 pt-4">
                          <div className="lg:col-span-5 space-y-2">
                            <div className="text-xs text-slate-500 uppercase tracking-wide">Upload asset</div>
                            {uploading ? (
                              <div className="flex items-center gap-2 text-xs text-cyan-200/90">
                                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                                Uploading…
                              </div>
                            ) : post.assetStorageUrl ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500">Preview</span>
                                  {String(post.assetCreativeType ?? "").toUpperCase() === "VIDEO" ? (
                                    <video
                                      src={post.assetStorageUrl}
                                      className="h-24 w-40 rounded object-cover border border-slate-600"
                                      muted
                                      playsInline
                                      controls
                                    />
                                  ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={post.assetStorageUrl}
                                      alt=""
                                      className="h-24 w-40 rounded object-cover border border-slate-600"
                                    />
                                  )}
                                </div>
                                <label className="inline-flex items-center gap-2 text-xs text-cyan-200 cursor-pointer">
                                  <span className="rounded-lg border border-cyan-600/50 px-3 py-1.5 hover:bg-cyan-950/40">
                                    Replace
                                  </span>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="video/mp4,video/quicktime,image/jpeg,image/png,.mp4,.mov,.jpg,.jpeg,.png"
                                    disabled={busy || uploading}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      e.target.value = "";
                                      if (f) void uploadAsset(post, f);
                                    }}
                                  />
                                </label>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {capMode === "auto_publish" ? (
                                  <p className="text-xs text-amber-200/85">Upload required before Post now.</p>
                                ) : (
                                  <p className="text-xs text-slate-500">Optional media for this row.</p>
                                )}
                                <label className="inline-flex items-center gap-2 text-xs text-cyan-200 cursor-pointer">
                                  <span className="rounded-lg border border-cyan-600/50 px-3 py-1.5 hover:bg-cyan-950/40">
                                    Choose file
                                  </span>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="video/mp4,video/quicktime,image/jpeg,image/png,.mp4,.mov,.jpg,.jpeg,.png"
                                    disabled={busy || uploading}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      e.target.value = "";
                                      if (f) void uploadAsset(post, f);
                                    }}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                          <div className="lg:col-span-7 flex flex-col gap-3">
                            <div className="flex flex-wrap items-end gap-3">
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Schedule</label>
                                <input
                                  type="datetime-local"
                                  className="rounded-lg border border-slate-600/60 bg-slate-950/80 text-slate-100 text-sm px-2 py-1.5"
                                  value={sched}
                                  onChange={(e) => setSchedules((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                />
                              </div>
                              <button
                                type="button"
                                disabled={busy || uploading}
                                onClick={() =>
                                  void patchPost(post.id, {
                                    caption: cap,
                                    scheduledAt: fromDatetimeLocalValue(sched),
                                  }).catch(() => {})
                                }
                                className="text-sm font-medium rounded-lg px-4 py-2 bg-cyan-600/90 text-black hover:bg-cyan-500 disabled:opacity-50"
                              >
                                Schedule post
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {capMode === "auto_publish" ? (
                                <button
                                  type="button"
                                  disabled={busy || uploading || !canPostNow}
                                  title={!canPostNow ? "Attach an asset before posting." : undefined}
                                  onClick={() => void publishNow(post.id)}
                                  className="text-sm font-medium rounded-lg px-4 py-2 border border-emerald-500/60 text-emerald-100 hover:bg-emerald-950/40 disabled:opacity-45"
                                >
                                  Post now
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={busy || uploading}
                                onClick={() =>
                                  downloadText(
                                    `bentley-${post.platform}-${post.id.slice(0, 8)}.txt`,
                                    buildExportBlob(post, cap, draft)
                                  )
                                }
                                className={`text-sm font-medium rounded-lg px-4 py-2 border disabled:opacity-50 ${
                                  capMode === "auto_publish"
                                    ? "border-slate-500/55 text-slate-200 hover:bg-slate-800/70"
                                    : "border-amber-500/55 text-amber-100 hover:bg-amber-950/30"
                                }`}
                              >
                                Export post
                              </button>
                            </div>
                            <div className="space-y-2 border-t border-slate-700/40 pt-3">
                              <div className="text-xs text-slate-500 uppercase tracking-wide">Outbound route</div>
                              <select
                                className="w-full max-w-md rounded-lg border border-slate-600/60 bg-slate-950/80 text-slate-100 text-sm px-2 py-1.5"
                                value={(postPr.publishRoute ?? "native") as string}
                                disabled={busy || uploading}
                                onChange={(e) =>
                                  void patchPost(post.id, {
                                    publishRoute: e.target.value as PublishRoute,
                                  }).catch(() => {})
                                }
                              >
                                <option value="native">Native (Bentley OAuth worker)</option>
                                <option value="content360">Content360</option>
                              </select>
                              {postPr.publishRoute === "content360" ? (
                                <div className="space-y-2 rounded-lg border border-violet-500/30 bg-violet-950/10 p-3">
                                  <div className="grid sm:grid-cols-2 gap-2">
                                    <label className="text-xs text-slate-500 block space-y-1">
                                      <span>Target platform</span>
                                      <select
                                        className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
                                        value={c360TargetByPost[post.id] ?? asPlatformSlug(post.platform)}
                                        onChange={(e) =>
                                          setC360TargetByPost((prev) => ({ ...prev, [post.id]: e.target.value }))
                                        }
                                        disabled={busy || uploading}
                                      >
                                        {CONTENT360_TARGET_PLATFORMS.map((p) => (
                                          <option key={p} value={p}>
                                            {p}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="text-xs text-slate-500 block space-y-1">
                                      <span>Timezone</span>
                                      <select
                                        className="w-full max-h-28 rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
                                        value={c360TzByPost[post.id] ?? defaultTimeZone()}
                                        onChange={(e) =>
                                          setC360TzByPost((prev) => ({ ...prev, [post.id]: e.target.value }))
                                        }
                                        disabled={busy || uploading}
                                      >
                                        {tzOptions.slice(0, 80).map((tz) => (
                                          <option key={tz} value={tz}>
                                            {tz}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={
                                      !safeClientId ||
                                      !defaultConnectionId.trim() ||
                                      c360ScheduleBusyId === post.id ||
                                      busy ||
                                      uploading ||
                                      Boolean(c360Readiness && !c360Readiness.canScheduleSingle)
                                    }
                                    onClick={() => void scheduleViaContent360(post)}
                                    className="text-sm font-medium rounded-lg px-4 py-2 bg-violet-600/90 text-white hover:bg-violet-500 disabled:opacity-45"
                                  >
                                    {c360ScheduleBusyId === post.id ? "Scheduling…" : "Schedule via Content360"}
                                  </button>
                                  <p className="text-[11px] text-slate-500">
                                    Uses the datetime above and this caption. Upload MP4/MOV/JPEG/PNG through the same
                                    asset flow as native publishing — no duplicate upload pipeline.
                                  </p>
                                  {(jobsByPostId.get(post.id) ?? []).length > 0 ? (
                                    <ul className="text-[11px] text-slate-400 space-y-1 list-none border border-slate-700/50 rounded-md p-2 bg-black/20">
                                      {(jobsByPostId.get(post.id) ?? []).slice(0, 6).map((j) => (
                                        <li key={String(j.id)} className="flex flex-wrap justify-between gap-2 border-b border-slate-800/50 py-0.5 last:border-0">
                                          <span>
                                            <span className="text-violet-200/90">{String(j.status ?? "")}</span> ·{" "}
                                            {String(j.updatedAt ?? "").slice(0, 19)}
                                            {j.errorMessage ? (
                                              <span className="text-amber-200/80"> — {String(j.errorMessage)}</span>
                                            ) : null}
                                          </span>
                                          {String(j.status) === "failed" ? (
                                            <button
                                              type="button"
                                              className="text-cyan-300 hover:text-cyan-200"
                                              onClick={() => void retryContent360Job(String(j.id))}
                                              disabled={c360ConnectBusy}
                                            >
                                              Retry
                                            </button>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            {capMode === "manual_oauth" || capMode === "export_only" ? (
                              <p className="text-[11px] text-slate-500">
                                {capMode === "export_only"
                                  ? "No in-app publisher for this network — export and post where your audience lives."
                                  : "Publishing adapter not enabled yet — connect accounts may still work elsewhere; use Export to ship manually."}
                              </p>
                            ) : null}
                            {rowErr ? (
                              <p className="text-xs text-amber-200/95 border border-amber-700/40 rounded-lg px-2 py-1.5 bg-amber-950/25">
                                {rowErr}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
