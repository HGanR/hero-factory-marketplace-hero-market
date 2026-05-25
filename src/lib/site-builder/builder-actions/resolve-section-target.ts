/**
 * Deterministic resolution of builder section targets → content.aiSectionId.
 * No guessing: ambiguous or missing targets throw SectionResolveError.
 */

import { z } from "zod";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { resolveImportRegistryKey } from "@/lib/site-builder/site-import/import-registry-aliases";

export const SectionTargetDescriptorSchema = z.object({
  pageSlug: z.string().min(1).max(200).default("/"),
  blockIndex: z.number().int().min(0).max(200).optional(),
  blockType: z.string().min(1).max(40).optional(),
  /** 1-based index among blocks that match blockType/registryKey filters. */
  ordinal: z.number().int().min(1).max(200).optional(),
  /** Matches content.aiRegistryKey (import aliases normalized). */
  registryKey: z.string().min(1).max(80).optional(),
});

export type SectionTargetDescriptor = z.infer<typeof SectionTargetDescriptorSchema>;

export type ResolvedSectionTarget = {
  aiSectionId: string;
  pageSlug: string;
  blockIndex: number;
  blockType: string;
};

export class SectionResolveError extends Error {
  readonly code: "NOT_FOUND" | "AMBIGUOUS" | "INVALID";

  constructor(message: string, code: "NOT_FOUND" | "AMBIGUOUS" | "INVALID") {
    super(message);
    this.name = "SectionResolveError";
    this.code = code;
  }
}

export function hasNonemptyTarget(target: SectionTargetDescriptor | undefined): target is SectionTargetDescriptor {
  if (!target) return false;
  return (
    target.blockIndex !== undefined ||
    Boolean(target.blockType?.trim()) ||
    target.ordinal !== undefined ||
    Boolean(target.registryKey?.trim())
  );
}

function readAiSectionId(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string {
  const c = block.content as { aiSectionId?: string } | undefined;
  return String(c?.aiSectionId || "").trim();
}

function readRegistryKey(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string {
  const c = block.content as { aiRegistryKey?: string } | undefined;
  return String(c?.aiRegistryKey || "").trim();
}

/**
 * Resolve a target descriptor to a single block on a page.
 *
 * Rules:
 * - `blockIndex` wins when set (optional consistency checks for blockType/registryKey).
 * - Otherwise filter by registryKey and/or blockType; if multiple matches, require `ordinal` or throw AMBIGUOUS.
 * - Single match without ordinal is OK.
 */
export function resolveSectionTarget(
  doc: SiteSchemaDocumentType,
  target: SectionTargetDescriptor,
): ResolvedSectionTarget {
  const pageSlug = target.pageSlug ?? "/";
  const page = doc.pages.find((p) => p.slug === pageSlug);
  if (!page) {
    throw new SectionResolveError(`Page not found: ${pageSlug}`, "NOT_FOUND");
  }
  const blocks = page.blocks;

  if (target.blockIndex !== undefined) {
    const idx = target.blockIndex;
    if (idx < 0 || idx >= blocks.length) {
      throw new SectionResolveError(`blockIndex ${idx} is out of range (0..${blocks.length - 1})`, "NOT_FOUND");
    }
    const b = blocks[idx]!;
    if (target.blockType && b.type !== target.blockType) {
      throw new SectionResolveError(
        `Block at index ${idx} has type "${b.type}", expected "${target.blockType}"`,
        "INVALID",
      );
    }
    if (target.registryKey) {
      const rk = resolveImportRegistryKey(readRegistryKey(b));
      const want = resolveImportRegistryKey(target.registryKey);
      if (rk !== want) {
        throw new SectionResolveError(`registryKey at index ${idx} does not match (got "${rk}", want "${want}")`, "INVALID");
      }
    }
    const sid = readAiSectionId(b);
    if (!sid) {
      throw new SectionResolveError(`Block at index ${idx} has no aiSectionId`, "INVALID");
    }
    return { aiSectionId: sid, pageSlug, blockIndex: idx, blockType: b.type };
  }

  if (!target.blockType && !target.registryKey) {
    throw new SectionResolveError(
      "Target must include blockIndex, or blockType/registryKey (and optional ordinal) to disambiguate",
      "INVALID",
    );
  }

  const candidateIndices: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (target.blockType && b.type !== target.blockType) continue;
    if (target.registryKey) {
      const rk = resolveImportRegistryKey(readRegistryKey(b));
      if (rk !== resolveImportRegistryKey(target.registryKey)) continue;
    }
    candidateIndices.push(i);
  }

  if (candidateIndices.length === 0) {
    throw new SectionResolveError("No blocks match the target filters", "NOT_FOUND");
  }

  let chosenIdx: number;
  if (target.ordinal !== undefined) {
    const o = target.ordinal - 1;
    if (o < 0 || o >= candidateIndices.length) {
      throw new SectionResolveError(
        `ordinal ${target.ordinal} out of range (${candidateIndices.length} matching block(s))`,
        "NOT_FOUND",
      );
    }
    chosenIdx = candidateIndices[o]!;
  } else if (candidateIndices.length > 1) {
    throw new SectionResolveError(
      `Ambiguous target: ${candidateIndices.length} blocks match — set ordinal (1-based) or use blockIndex`,
      "AMBIGUOUS",
    );
  } else {
    chosenIdx = candidateIndices[0]!;
  }

  const b = blocks[chosenIdx]!;
  const sid = readAiSectionId(b);
  if (!sid) {
    throw new SectionResolveError(`Matched block at index ${chosenIdx} has no aiSectionId`, "INVALID");
  }
  return { aiSectionId: sid, pageSlug, blockIndex: chosenIdx, blockType: b.type };
}
