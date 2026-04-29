import type { LlmMessage } from "@/lib/npc/llm";
import {
  selectSiteBuilderLlmInvoke,
  type SiteBuilderAiSettingsInput,
} from "@/lib/site-builder/ai/providers/select-provider";
import type { SiteBuilderLlmSource } from "@/lib/site-builder/ai/providers/types";
import { getOwnedSite, getSiteBuilderAiSettingsRow, type SiteBuilderAiSettingsRow } from "@/lib/site-builder/db";

type Db = Awaited<ReturnType<typeof import("@/lib/db").getDb>>;

function toInput(row: SiteBuilderAiSettingsRow | null): SiteBuilderAiSettingsInput {
  if (!row) return null;
  return {
    llmMode: row.llmMode,
    endpoint: row.endpoint,
    model: row.model,
    apiKeyEnc: row.apiKeyEnc,
    fallbackToPlatform: row.fallbackToPlatform,
  };
}

/**
 * Resolve planner/regeneration `invokeLlm` for a site (ownership-checked).
 * Returns `undefined` when `siteId` is omitted — caller uses legacy global LLM when configured.
 */
export async function resolveSiteBuilderLlmInvokeForSite(
  db: Db,
  userId: number,
  siteId: string | undefined | null,
): Promise<{
  invokeLlm: ((messages: LlmMessage[]) => Promise<string | null>) | null;
  source: SiteBuilderLlmSource;
  forceDeterministic?: boolean;
} | undefined> {
  if (!siteId?.trim()) return undefined;
  const site = await getOwnedSite(db, userId, siteId.trim());
  if (!site) return undefined;
  const row = await getSiteBuilderAiSettingsRow(db, site.id);
  const { invoke, source, forceDeterministic } = selectSiteBuilderLlmInvoke(toInput(row));
  return { invokeLlm: invoke, source, forceDeterministic };
}
