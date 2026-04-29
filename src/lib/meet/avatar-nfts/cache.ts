import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetAvatarNftMetadataCache } from "@/lib/db/schema";
import type { ResolvedMetadata } from "./metadata";
import { normalizeIpfsToHttp, resolveUriToMetadata } from "./metadata";
import {
  MEET_AVATAR_METADATA_FAILURE_TTL_MS,
  MEET_AVATAR_METADATA_RAW_JSON_MAX_BYTES,
  MEET_AVATAR_METADATA_STALE_SUCCESS_MAX_AGE_MS,
  MEET_AVATAR_METADATA_SUCCESS_TTL_MS,
} from "./cache-constants";

export type MeetAvatarMetadataCacheSource = "hero_erc1155" | "marketplace";

export type MeetAvatarMetadataCacheRow = typeof meetAvatarNftMetadataCache.$inferSelect;

function nowMs(): number {
  return Date.now();
}

export function isMeetAvatarMetadataCacheFreshSuccess(
  row: MeetAvatarMetadataCacheRow,
  now: Date = new Date()
): boolean {
  if (row.fetchStatus !== "success") return false;
  return row.expiresAt.getTime() > now.getTime();
}

export function isMeetAvatarMetadataCacheFreshFailure(
  row: MeetAvatarMetadataCacheRow,
  now: Date = new Date()
): boolean {
  if (row.fetchStatus !== "failure") return false;
  return row.expiresAt.getTime() > now.getTime();
}

export function isStaleSuccessWithinFallbackWindow(
  row: MeetAvatarMetadataCacheRow,
  now: Date = new Date()
): boolean {
  if (row.fetchStatus !== "success") return false;
  const age = now.getTime() - row.fetchedAt.getTime();
  return age <= MEET_AVATAR_METADATA_STALE_SUCCESS_MAX_AGE_MS;
}

export function cacheRowToResolved(row: MeetAvatarMetadataCacheRow): ResolvedMetadata | null {
  if (row.fetchStatus !== "success") return null;
  const name = (row.name && String(row.name).trim()) || "NFT";
  const image = row.image?.trim() ? normalizeIpfsToHttp(row.image.trim()) : null;
  const animationUrl = row.animationUrl?.trim() ? normalizeIpfsToHttp(row.animationUrl.trim()) : null;
  return {
    name,
    image,
    description: row.description,
    animationUrl,
    externalUrl: row.externalUrl,
  };
}

function normalizeForPersistence(m: ResolvedMetadata): ResolvedMetadata {
  const rawImage = m.image?.trim() || null;
  const image = rawImage ? normalizeIpfsToHttp(rawImage) : null;
  const rawAnim = m.animationUrl?.trim() || null;
  const animationUrl = rawAnim ? normalizeIpfsToHttp(rawAnim) : null;
  return {
    name: (m.name?.trim() || "NFT") as string,
    image,
    description: m.description?.trim() || null,
    animationUrl,
    externalUrl: m.externalUrl?.trim() || null,
  };
}

function trimRawJson(raw: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const s = JSON.stringify(raw);
    if (s.length > MEET_AVATAR_METADATA_RAW_JSON_MAX_BYTES) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function getMeetAvatarMetadataCacheEntry(params: {
  chainId: number;
  contractAddress: string;
  tokenId: string;
  source: MeetAvatarMetadataCacheSource;
}): Promise<MeetAvatarMetadataCacheRow | undefined> {
  const db = await getDb();
  const contract = params.contractAddress.toLowerCase();
  const rows = await db
    .select()
    .from(meetAvatarNftMetadataCache)
    .where(
      and(
        eq(meetAvatarNftMetadataCache.chainId, params.chainId),
        eq(meetAvatarNftMetadataCache.contractAddress, contract),
        eq(meetAvatarNftMetadataCache.tokenId, params.tokenId),
        eq(meetAvatarNftMetadataCache.source, params.source)
      )
    )
    .limit(1);
  return rows[0];
}

export async function upsertMeetAvatarMetadataCacheSuccess(params: {
  chainId: number;
  contractAddress: string;
  tokenId: string;
  source: MeetAvatarMetadataCacheSource;
  metadataUrl: string | null;
  metadata: ResolvedMetadata;
  rawMetadataJson?: Record<string, unknown> | null;
}): Promise<void> {
  const db = await getDb();
  const norm = normalizeForPersistence(params.metadata);
  const t = nowMs();
  const fetchedAt = new Date(t);
  const expiresAt = new Date(t + MEET_AVATAR_METADATA_SUCCESS_TTL_MS);
  const contract = params.contractAddress.toLowerCase();
  const existing = await getMeetAvatarMetadataCacheEntry({
    chainId: params.chainId,
    contractAddress: contract,
    tokenId: params.tokenId,
    source: params.source,
  });
  const id = existing?.id ?? crypto.randomUUID();

  await db
    .insert(meetAvatarNftMetadataCache)
    .values({
      id,
      chainId: params.chainId,
      contractAddress: contract,
      tokenId: params.tokenId,
      source: params.source,
      metadataUrl: params.metadataUrl,
      name: norm.name,
      image: norm.image,
      animationUrl: norm.animationUrl,
      externalUrl: norm.externalUrl,
      description: norm.description,
      rawMetadataJson: trimRawJson(params.rawMetadataJson ?? null),
      fetchStatus: "success",
      fetchError: null,
      fetchedAt,
      expiresAt,
    })
    .onDuplicateKeyUpdate({
      set: {
        metadataUrl: params.metadataUrl,
        name: norm.name,
        image: norm.image,
        animationUrl: norm.animationUrl,
        externalUrl: norm.externalUrl,
        description: norm.description,
        rawMetadataJson: trimRawJson(params.rawMetadataJson ?? null),
        fetchStatus: "success",
        fetchError: null,
        fetchedAt,
        expiresAt,
        updatedAt: new Date(),
      },
    });
}

export async function upsertMeetAvatarMetadataCacheFailure(params: {
  chainId: number;
  contractAddress: string;
  tokenId: string;
  source: MeetAvatarMetadataCacheSource;
  metadataUrl: string | null;
  errorMessage: string;
}): Promise<void> {
  const db = await getDb();
  const t = nowMs();
  const fetchedAt = new Date(t);
  const expiresAt = new Date(t + MEET_AVATAR_METADATA_FAILURE_TTL_MS);
  const contract = params.contractAddress.toLowerCase();
  const existing = await getMeetAvatarMetadataCacheEntry({
    chainId: params.chainId,
    contractAddress: contract,
    tokenId: params.tokenId,
    source: params.source,
  });
  const id = existing?.id ?? crypto.randomUUID();

  await db
    .insert(meetAvatarNftMetadataCache)
    .values({
      id,
      chainId: params.chainId,
      contractAddress: contract,
      tokenId: params.tokenId,
      source: params.source,
      metadataUrl: params.metadataUrl,
      name: null,
      image: null,
      animationUrl: null,
      externalUrl: null,
      description: null,
      rawMetadataJson: null,
      fetchStatus: "failure",
      fetchError: params.errorMessage.slice(0, 4000),
      fetchedAt,
      expiresAt,
    })
    .onDuplicateKeyUpdate({
      set: {
        metadataUrl: params.metadataUrl,
        name: null,
        image: null,
        animationUrl: null,
        externalUrl: null,
        description: null,
        rawMetadataJson: null,
        fetchStatus: "failure",
        fetchError: params.errorMessage.slice(0, 4000),
        fetchedAt,
        expiresAt,
        updatedAt: new Date(),
      },
    });
}

export async function invalidateMeetAvatarMetadataCacheEntry(params: {
  chainId: number;
  contractAddress: string;
  tokenId: string;
  source: MeetAvatarMetadataCacheSource;
}): Promise<void> {
  const db = await getDb();
  const contract = params.contractAddress.toLowerCase();
  await db
    .delete(meetAvatarNftMetadataCache)
    .where(
      and(
        eq(meetAvatarNftMetadataCache.chainId, params.chainId),
        eq(meetAvatarNftMetadataCache.contractAddress, contract),
        eq(meetAvatarNftMetadataCache.tokenId, params.tokenId),
        eq(meetAvatarNftMetadataCache.source, params.source)
      )
    );
}

export type ResolveCachedMeetAvatarMetadataResult = {
  metadata: ResolvedMetadata | null;
  staleUsed: boolean;
  cachedFailureSkip: boolean;
};

/**
 * Cache-backed metadata resolution. Ownership must be decided elsewhere (live).
 */
export async function resolveCachedMeetAvatarMetadata(params: {
  chainId: number;
  contractAddress: string;
  tokenId: string;
  source: MeetAvatarMetadataCacheSource;
  uriTemplate: string;
  idForUriSubstitution: bigint;
  fallbackName: string;
}): Promise<ResolveCachedMeetAvatarMetadataResult> {
  const now = new Date();
  let row: MeetAvatarMetadataCacheRow | undefined;
  try {
    row = await getMeetAvatarMetadataCacheEntry({
      chainId: params.chainId,
      contractAddress: params.contractAddress,
      tokenId: params.tokenId,
      source: params.source,
    });
  } catch (e) {
    console.error("[meet avatar metadata cache] read failed:", e);
    row = undefined;
  }

  if (row && isMeetAvatarMetadataCacheFreshSuccess(row, now)) {
    const m = cacheRowToResolved(row);
    if (m) return { metadata: m, staleUsed: false, cachedFailureSkip: false };
  }

  if (row && isMeetAvatarMetadataCacheFreshFailure(row, now)) {
    return { metadata: null, staleUsed: false, cachedFailureSkip: true };
  }

  let live: ResolvedMetadata | null = null;
  try {
    live = await resolveUriToMetadata(
      params.uriTemplate,
      params.idForUriSubstitution,
      params.fallbackName
    );
  } catch {
    live = null;
  }

  if (live) {
    const norm = normalizeForPersistence(live);
    try {
      await upsertMeetAvatarMetadataCacheSuccess({
        chainId: params.chainId,
        contractAddress: params.contractAddress,
        tokenId: params.tokenId,
        source: params.source,
        metadataUrl: params.uriTemplate,
        metadata: norm,
        rawMetadataJson: null,
      });
    } catch (e) {
      console.error("[meet avatar metadata cache] upsert success failed:", e);
    }
    return { metadata: norm, staleUsed: false, cachedFailureSkip: false };
  }

  if (row && row.fetchStatus === "success" && isStaleSuccessWithinFallbackWindow(row, now)) {
    const stale = cacheRowToResolved(row);
    if (stale) {
      return { metadata: stale, staleUsed: true, cachedFailureSkip: false };
    }
  }

  try {
    await upsertMeetAvatarMetadataCacheFailure({
      chainId: params.chainId,
      contractAddress: params.contractAddress,
      tokenId: params.tokenId,
      source: params.source,
      metadataUrl: params.uriTemplate,
      errorMessage: "Live metadata fetch returned empty or failed",
    });
  } catch (e) {
    console.error("[meet avatar metadata cache] upsert failure failed:", e);
  }

  return { metadata: null, staleUsed: false, cachedFailureSkip: false };
}
