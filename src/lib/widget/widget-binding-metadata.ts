import { z } from "zod";

/** Product / UX mode — informational for config + future routing (no privilege). */
export const WidgetProductModeSchema = z.enum([
  "public_chat",
  "lead_capture",
  "support",
  "site_operator",
  "hybrid",
]);

export const WidgetProviderStrategySchema = z.enum(["agent", "site_builder"]);

export const WidgetVisualConfigSchema = z.object({
  launcherPosition: z.enum(["left", "right"]).optional(),
  theme: z.enum(["dark", "light"]).optional(),
  accent: z.string().max(32).optional(),
  launcherLabel: z.string().max(24).optional(),
});

const SAFE_COLOR_NAMES = new Set([
  "black",
  "white",
  "gray",
  "grey",
  "red",
  "blue",
  "green",
  "yellow",
  "orange",
  "purple",
  "teal",
  "cyan",
  "indigo",
  "pink",
  "brown",
  "navy",
]);

export function normalizeWidgetColor(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (/^#[0-9a-f]{6}$/i.test(s) || /^#[0-9a-f]{3}$/i.test(s)) return s;
  if (SAFE_COLOR_NAMES.has(s)) return s;
  return null;
}

export const WidgetAppearanceSchema = z.object({
  avatarImageUrl: z.string().max(5000).optional(),
  avatarAltText: z.string().max(160).optional(),
  avatarShape: z.literal("circle").optional(),
  avatarBorderColor: z.string().max(32).optional(),
  avatarBorderWidth: z.number().int().min(0).max(12).optional(),
  widgetBubbleColor: z.string().max(32).optional(),
  widgetWindowBackgroundColor: z.string().max(32).optional(),
  widgetHeaderColor: z.string().max(32).optional(),
  widgetTextColor: z.string().max(32).optional(),
  widgetAccentColor: z.string().max(32).optional(),
});

export const WidgetBindingMetadataSchema = z
  .object({
    consentRequired: z.boolean().optional(),
    consentText: z.string().max(500).optional(),
    retentionDays: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)]).optional(),
    /** Display title override (defaults to agent name). */
    title: z.string().max(120).optional(),
    welcomeMessage: z.string().max(2000).optional(),
    placeholder: z.string().max(200).optional(),
    starterPrompts: z.array(z.string().max(200)).max(8).optional(),
    mode: WidgetProductModeSchema.optional(),
    visual: WidgetVisualConfigSchema.optional(),
    widgetAppearance: WidgetAppearanceSchema.optional(),
    /**
     * LLM routing: agent credentials vs per-site site-builder AI settings (`web3_site_builder_ai_settings`).
     */
    providerStrategy: WidgetProviderStrategySchema.optional(),
    /**
     * When false/omitted on new bindings, Google/plugin tool loop is skipped (public embed default).
     * Set true only for trusted operator surfaces.
     */
    agentToolsInWidget: z.boolean().optional(),
    /** When true, load published site schema summary for grounding (server-side). */
    siteGrounding: z.boolean().optional(),
    /** Optional pinned site version for grounding (else current site version). */
    siteVersionId: z.string().max(36).optional(),
  })
  .strict();

export type WidgetBindingMetadata = z.infer<typeof WidgetBindingMetadataSchema>;

export function parseWidgetBindingMetadata(raw: unknown): WidgetBindingMetadata {
  if (raw == null) return {};
  const v = typeof raw === "string" ? safeJsonParse(raw) : raw;
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const p = WidgetBindingMetadataSchema.safeParse(v);
  return p.success ? p.data : {};
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return {};
  }
}

/** Extract validated metadata fields from AI Agency “bind site” / site-builder widget POST bodies. */
export function widgetMetadataPatchFromRequestBody(body: unknown): Partial<WidgetBindingMetadata> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const b = body as Record<string, unknown>;
  const raw: Record<string, unknown> = {};

  if (typeof b.consentRequired === "boolean") raw.consentRequired = b.consentRequired;
  if (typeof b.consentText === "string") raw.consentText = b.consentText.trim().slice(0, 500);
  if (typeof b.retentionDays === "number" && [7, 30, 90, 365].includes(b.retentionDays)) {
    raw.retentionDays = b.retentionDays;
  }
  if (typeof b.title === "string") raw.title = b.title.trim().slice(0, 120);
  if (typeof b.welcomeMessage === "string") raw.welcomeMessage = b.welcomeMessage.trim().slice(0, 2000);
  if (typeof b.placeholder === "string") raw.placeholder = b.placeholder.trim().slice(0, 200);
  if (Array.isArray(b.starterPrompts)) {
    raw.starterPrompts = b.starterPrompts
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim().slice(0, 200))
      .slice(0, 8);
  }
  if (typeof b.widgetMode === "string") {
    const m = WidgetProductModeSchema.safeParse(b.widgetMode);
    if (m.success) raw.mode = m.data;
  }
  if (typeof b.providerStrategy === "string") {
    const p = WidgetProviderStrategySchema.safeParse(b.providerStrategy);
    if (p.success) raw.providerStrategy = p.data;
  }
  if (typeof b.agentToolsInWidget === "boolean") raw.agentToolsInWidget = b.agentToolsInWidget;
  if (typeof b.siteGrounding === "boolean") raw.siteGrounding = b.siteGrounding;
  if (typeof b.siteVersionId === "string" && b.siteVersionId.trim()) {
    raw.siteVersionId = b.siteVersionId.trim().slice(0, 36);
  }

  if (b.widgetVisual && typeof b.widgetVisual === "object" && !Array.isArray(b.widgetVisual)) {
    const v = WidgetVisualConfigSchema.safeParse(b.widgetVisual);
    if (v.success) raw.visual = v.data;
  }
  if (b.widgetAppearance && typeof b.widgetAppearance === "object" && !Array.isArray(b.widgetAppearance)) {
    const wa = b.widgetAppearance as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    if (typeof wa.avatarImageUrl === "string") out.avatarImageUrl = wa.avatarImageUrl.trim().slice(0, 5000);
    if (typeof wa.avatarAltText === "string") out.avatarAltText = wa.avatarAltText.trim().slice(0, 160);
    out.avatarShape = "circle";
    if (typeof wa.avatarBorderWidth === "number" && Number.isFinite(wa.avatarBorderWidth)) {
      out.avatarBorderWidth = Math.max(0, Math.min(12, Math.round(wa.avatarBorderWidth)));
    }
    for (const k of [
      "avatarBorderColor",
      "widgetBubbleColor",
      "widgetWindowBackgroundColor",
      "widgetHeaderColor",
      "widgetTextColor",
      "widgetAccentColor",
    ] as const) {
      const c = normalizeWidgetColor(wa[k]);
      if (c) out[k] = c;
    }
    const parsedWa = WidgetAppearanceSchema.partial().safeParse(out);
    if (parsedWa.success) raw.widgetAppearance = parsedWa.data;
  }

  const parsed = WidgetBindingMetadataSchema.partial().safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export function mergeWidgetBindingMetadata(
  current: unknown,
  patch: Partial<WidgetBindingMetadata>,
): Record<string, unknown> {
  const base = parseWidgetBindingMetadata(current);
  return { ...base, ...patch } as Record<string, unknown>;
}
