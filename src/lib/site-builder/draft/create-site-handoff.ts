export type CreateSiteResult = { site?: { id?: string; name?: string } | null };

export type CreateSiteWithDraftHandoffParams = {
  schemaText: string;
  createSite: () => Promise<CreateSiteResult>;
  saveFirstVersion: (siteId: string, schemaJson: unknown) => Promise<void>;
  clearDraftSession: () => void;
};

export type CreateSiteWithDraftHandoffResult =
  | { ok: true; siteId: string; versionSaved: boolean }
  | { ok: false; stage: "create_site"; message: string }
  | { ok: false; stage: "save_version"; message: string; siteId: string };

/**
 * Creates a site and, when schema JSON is valid, immediately saves first version from current draft.
 * Draft session is cleared only after both steps succeed.
 */
export async function createSiteWithDraftHandoff(
  params: CreateSiteWithDraftHandoffParams,
): Promise<CreateSiteWithDraftHandoffResult> {
  let parsedSchema: unknown = null;
  try {
    parsedSchema = JSON.parse(params.schemaText);
  } catch {
    parsedSchema = null;
  }

  let created: CreateSiteResult;
  try {
    created = await params.createSite();
  } catch (e) {
    return {
      ok: false,
      stage: "create_site",
      message: e instanceof Error ? e.message : "Could not create site",
    };
  }

  const siteId = String(created?.site?.id || "").trim();
  if (!siteId) {
    return { ok: false, stage: "create_site", message: "Site created but no site id was returned." };
  }

  // Preserve legacy behavior for invalid JSON drafts: site can still be created, version step is skipped.
  if (parsedSchema == null) {
    return { ok: true, siteId, versionSaved: false };
  }

  try {
    await params.saveFirstVersion(siteId, parsedSchema);
    params.clearDraftSession();
    return { ok: true, siteId, versionSaved: true };
  } catch (e) {
    return {
      ok: false,
      stage: "save_version",
      message: e instanceof Error ? e.message : "Could not save first version",
      siteId,
    };
  }
}
