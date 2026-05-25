/**
 * Shared Revenue OS pipeline HTTP clients — same POST bodies as the UI sections and Bentley action runner.
 */

import type { ResearchResult } from "@/components/ai-revenue-os/ResearchAssistantSection";
import type { BentleyContentBundleHandoff } from "@/lib/bentley-social-leads/handoff/contentBundleHandoffTypes";
import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { TrendsResponse } from "@/lib/revenue-os/trends-schema";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function readJsonError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; message?: string };
    return j?.error || j?.message || res.statusText || "Request failed";
  } catch {
    return res.statusText || "Request failed";
  }
}

export type ResearchApiParams = {
  marketOrService: string;
  clientId?: string;
  trustId?: string;
};

export async function runResearchApi(params: ResearchApiParams): Promise<ResearchResult> {
  const res = await fetch("/api/revenue-os/research", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : await readJsonError(res));
  return data as ResearchResult;
}

/** Normalizes server research payloads (optional defensive pass). */
export function sanitizeResearchResult(r: ResearchResult): ResearchResult {
  return {
    ...r,
    whatPeopleWant: Array.isArray(r.whatPeopleWant) ? r.whatPeopleWant : [],
    commentsBySource: Array.isArray(r.commentsBySource) ? r.commentsBySource : [],
    marketingTips: Array.isArray(r.marketingTips) ? r.marketingTips : [],
    sourcesSearched: Array.isArray(r.sourcesSearched) ? r.sourcesSearched : ["ads_library", "reddit", "tiktok", "google"],
  };
}

export type TrendsApiParams = {
  industry: string;
  targetAudience?: string;
  clientId?: string;
  trustId?: string;
} & Record<string, unknown>;

export async function runTrendsApi(params: TrendsApiParams): Promise<TrendsResponse> {
  const res = await fetch("/api/revenue-os/trends", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : await readJsonError(res));
  return data as TrendsResponse;
}

export type ResearchSnippet = {
  whatPeopleWant?: string[];
  commentsBySource?: Array<{ source: string; themes: string[]; sampleComments?: string[] }>;
  marketingTips?: string[];
};

export function researchResultToSnippet(r: ResearchResult | null): ResearchSnippet | null {
  if (!r) return null;
  return {
    whatPeopleWant: r.whatPeopleWant,
    commentsBySource: r.commentsBySource,
    marketingTips: r.marketingTips,
  };
}

/**
 * Stable string for synthesis memoization when trends/research/handoff change.
 */
export function buildSynthesisInputSignature(
  trends: TrendsResponse | null,
  research: ResearchResult | null,
  handoffFingerprint: string
): string {
  try {
    const t = trends
      ? `${trends.industry ?? ""}|${trends.targetAudience ?? ""}|${(trends.items ?? []).length}|${(trends.campaignAngles ?? []).join(";")}`
      : "";
    const r = research
      ? `${(research.whatPeopleWant ?? []).join(";")}|${(research.marketingTips ?? []).join(";")}`
      : "";
    return `${t}::${r}::${handoffFingerprint}`;
  } catch {
    return `sig::${handoffFingerprint}`;
  }
}

/**
 * Fingerprint for workflow SLI → content handoff artifact (synthesis cache invalidation).
 */
export function fingerprintWorkflowBentleyHandoff(h: BentleyContentBundleHandoff | null): string {
  if (!h) return "";
  const id = h.handoffId?.trim();
  if (id) return `id:${id}`;
  try {
    return JSON.stringify({
      v: h.schemaVersion,
      createdAt: h.createdAt,
      basedOnFilteredRowCount: h.basedOnFilteredRowCount,
      filteredN: h.provenance?.filteredLeadRecordIds?.length ?? 0,
    });
  } catch {
    return "handoff";
  }
}

export type SynthesizePlanResult = {
  consultantPlan: string;
  campaignBrief: string;
  industry?: string;
  targetAudience?: string;
  campaignAngles?: string[];
  contentBlueprints?: unknown[];
};

export type RunSynthesizePlanParams = {
  trends: TrendsResponse;
  research: ResearchSnippet | null;
  signal?: AbortSignal;
} & Record<string, unknown>;

export async function runSynthesizePlanApi(params: RunSynthesizePlanParams): Promise<SynthesizePlanResult> {
  const { signal, ...body } = params;
  const res = await fetch("/api/revenue-os/synthesize-plan", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : await readJsonError(res));
  return data as SynthesizePlanResult;
}

export type ContentEngineRequestBody = {
  businessName: string;
  industry: string;
  targetAudience: string;
  coreOffer: string;
  transformation: string;
  tone: string;
  platform: string;
  contentType: string;
} & Record<string, unknown>;

export async function runContentEngineApi(
  body: Record<string, unknown>
): Promise<{
  content: ContentEngineOutput;
  unifiedGeneration?: { hadBentley: boolean; hadConversion: boolean; hadCampaignBrief: boolean };
  unifiedGenerationSnapshot?: unknown;
}> {
  const res = await fetch("/api/revenue-os/content-engine", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : await readJsonError(res));
  return {
    content: data.content as ContentEngineOutput,
    unifiedGeneration: data.unifiedGeneration,
    unifiedGenerationSnapshot: data.unifiedGenerationSnapshot,
  };
}

export type RunCampaignFromNotesParams = {
  industry: string;
  targetAudience: string;
  notes: string;
} & Record<string, unknown>;

export async function runCampaignFromNotesApi(params: RunCampaignFromNotesParams): Promise<CampaignResponse> {
  const res = await fetch("/api/revenue-os/campaign-from-notes", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : await readJsonError(res));
  return data as CampaignResponse;
}

export type EnsureCampaignFromBentleyApiParams = {
  bentleyRunId: string;
  clientId: string;
  businessName?: string;
  platforms: string[];
  postingPlatforms?: string[];
  campaign: CampaignResponse;
  tone?: string;
  imageStyle?: string;
};

/** Upsert `campaigns` row for Bentley — idempotent on `bentleyRunId`. */
export async function ensureCampaignFromBentleyApi(
  params: EnsureCampaignFromBentleyApiParams
): Promise<{ id: string; created: boolean; bentleyRunId: string }> {
  const res = await fetch("/api/revenue-os/bentley/ensure-campaign", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      bentleyRunId: params.bentleyRunId,
      clientId: params.clientId,
      businessName: params.businessName,
      platforms: params.platforms,
      postingPlatforms: params.postingPlatforms,
      tone: params.tone,
      imageStyle: params.imageStyle,
      campaign: params.campaign,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    created?: boolean;
    bentleyRunId?: string;
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      typeof data?.message === "string" ? data.message : data?.error ?? "Failed to persist campaign"
    );
  }
  if (!data.id || !data.bentleyRunId) {
    throw new Error("Invalid ensure-campaign response");
  }
  return { id: data.id, created: Boolean(data.created), bentleyRunId: data.bentleyRunId };
}

/** Best-effort Pinata upgrade for ephemeral Bentley post images (no-op when already durable). */
export async function upgradeBentleyCampaignAssetsApi(input: { campaignId: string }): Promise<{
  ok: boolean;
  upgraded: number;
  skipped: number;
  failed: number;
}> {
  const res = await fetch("/api/revenue-os/bentley/upgrade-campaign-assets", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify({ campaignId: input.campaignId }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    upgraded?: number;
    skipped?: number;
    failed?: number;
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      typeof data?.message === "string" ? data.message : data?.error ?? "upgrade-campaign-assets failed"
    );
  }
  return {
    ok: Boolean(data.ok),
    upgraded: data.upgraded ?? 0,
    skipped: data.skipped ?? 0,
    failed: data.failed ?? 0,
  };
}

export type SyncBentleyLaunchApiInput =
  | {
      campaignId: string;
      scheduleStrategy: "immediate" | "staggered";
      staggerMinutes?: number;
      content360PlatformSchedule?: false | undefined;
    }
  | {
      campaignId: string;
      /** Required with `content360PlatformSchedule: true` (also enforced by Zod on the server). */
      scheduleStrategy: "staggered";
      staggerMinutes?: number;
      content360PlatformSchedule: true;
      publishRoute: "content360";
    };

export async function syncBentleyLaunchApi(input: SyncBentleyLaunchApiInput): Promise<{
  ok: boolean;
  created: number;
  skipped: number;
  rescheduled: number;
  postIds: string[];
  requireApproval: boolean;
}> {
  const payload: Record<string, unknown> = {
    campaignId: input.campaignId,
    scheduleStrategy: input.scheduleStrategy,
  };
  if (input.staggerMinutes != null) {
    payload.staggerMinutes = input.staggerMinutes;
  }
  if (
    "content360PlatformSchedule" in input &&
    input.content360PlatformSchedule === true
  ) {
    payload.content360PlatformSchedule = true;
    payload.publishRoute = "content360";
  }

  const res = await fetch("/api/revenue-os/bentley/sync-launch", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    created?: number;
    skipped?: number;
    rescheduled?: number;
    postIds?: string[];
    requireApproval?: boolean;
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      typeof data?.message === "string" ? data.message : data?.error ?? "sync-launch failed"
    );
  }
  return {
    ok: Boolean(data.ok),
    created: data.created ?? 0,
    skipped: data.skipped ?? 0,
    rescheduled: data.rescheduled ?? 0,
    postIds: data.postIds ?? [],
    requireApproval: Boolean(data.requireApproval),
  };
}

export async function runCompileMediaBriefApi(
  params: Record<string, unknown>
): Promise<string> {
  const res = await fetch("/api/revenue-os/compile-media-brief", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : await readJsonError(res));
  const brief = (data as { brief?: string }).brief;
  return typeof brief === "string" ? brief : "";
}

export type CampaignNotesCrawlResult = {
  notesBlock: string;
  sources?: string[];
  meta?: { wikipediaTitle?: string | null; hadExtract?: boolean };
};

export async function runCampaignNotesCrawlApi(params: {
  industry: string;
  targetAudience: string;
}): Promise<CampaignNotesCrawlResult> {
  const res = await fetch("/api/revenue-os/campaign-notes-crawl", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : await readJsonError(res));
  return data as CampaignNotesCrawlResult;
}
