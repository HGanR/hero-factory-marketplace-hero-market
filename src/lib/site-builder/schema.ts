import { z } from "zod";
import {
  DomainConnectionStatusSchema,
  DomainProviderSchema,
  DomainTypeSchema,
} from "@/lib/site-builder/domain-connection-shared";
import { AgencyLaunchStateSchema } from "@/lib/site-builder/agency-launch-schema";
import { BrandBrainStateSchema } from "@/lib/site-builder/brand-brain-schema";
import { DesignSystemSchema, SiteGovernanceMetaSchema } from "@/lib/site-builder/design-system-schema";
import {
  ImportedSiteAuditSchema,
  ImportRestructureQueueItemSchema,
} from "@/lib/site-builder/import-restructure-schema";
import { SiteBuilderAssetMapSchema } from "@/lib/site-builder/site-builder-asset";
import { ProposalSelectionSchema } from "@/lib/site-builder/deliverables/close-package-schema";
import { PaymentIntegrationSchema } from "@/lib/site-builder/payment-integration-schema";
import {
  BackgroundModeSchema,
  CinematicButtonStyleSchema,
  DepthStyleSchema,
  GradientStyleSchema,
  MotionHintSchema,
} from "@/lib/site-builder/ai/schemas";

/** Cinematic injection v2 — persisted for preview/export + diversity scoring. */
export const SiteVisualMetaV2Schema = z.object({
  layoutFamilyId: z.string().max(80).optional(),
  gradientStyle: z.enum(["mesh", "radial", "linear", "neon", "glass"]),
  backgroundStyle: z.enum(["solid", "gradient", "image-overlay", "3d-depth"]),
  lightingStyle: z.enum(["soft", "high-contrast", "neon-glow", "ambient"]),
});

export type SiteVisualMetaV2 = z.infer<typeof SiteVisualMetaV2Schema>;

/** AI Agency widget embed — persisted on schema; export/preview inject loader + config. */
export const SiteWidgetPlacementSchema = z.enum(["body_end", "head_script", "page_body_end"]);

export const SiteWidgetIntegrationSchema = z.object({
  widgetKey: z.string().min(8).max(80),
  placement: SiteWidgetPlacementSchema.default("body_end"),
  /** Base URL for `/widget/loader.js` (e.g. https://your-app.com). Falls back to NEXT_PUBLIC_SITE_URL at export. */
  loaderOrigin: z.string().max(500).optional(),
  /** When `placement` is `page_body_end`, optional limit to one route slug (e.g. `/about`). */
  pageSlug: z.string().max(200).optional(),
  /** Include embed when opening “preview in new tab” from the builder. */
  injectInDevPreviewTab: z.boolean().optional().default(true),
});

export const SiteImportReconstructionSchema = z.object({
  path: z.enum(["native", "semantic_enriched", "metadata_mvp", "invariant_repair"]),
  signals: z
    .object({
      heroIntent: z.boolean().optional(),
      weakExtraction: z.boolean().optional(),
      navPattern: z.enum(["header_nav", "minimal", "dense", "none"]).optional(),
      ctaDensity: z.number().int().min(0).max(80).optional(),
      imageClusterCount: z.number().int().min(0).max(80).optional(),
      marketingStructureScore: z.number().min(0).max(1).optional(),
    })
    .optional(),
  notes: z.array(z.string().max(400)).max(24).optional(),
});

export const SiteImportMetaSchema = z.object({
  version: z.literal(1).default(1),
  sourceUrl: z.string().max(2000),
  importedAt: z.string().max(80),
  primaryLang: z.string().max(16).optional(),
  detectedPageCount: z.number().int().min(1).max(200).optional(),
  queuedRoutes: z.array(z.string().max(200)).max(30).optional(),
  extractionNotes: z.array(z.string().max(500)).max(50).optional(),
  partialImport: z.boolean().optional(),
  /** True when no sections were extracted and a placeholder home block was inserted. */
  emptyStructureFallback: z.boolean().optional(),
  /** Semantic reconstruction / MVP path applied after raw HTML parse. */
  reconstruction: SiteImportReconstructionSchema.optional(),
});

export type SiteWidgetIntegration = z.infer<typeof SiteWidgetIntegrationSchema>;
export type SiteImportMeta = z.infer<typeof SiteImportMetaSchema>;

const SITE_BLOCK_TYPES = [
  "hero",
  "text",
  "image",
  "button",
  "section",
  "footer",
  "avatar",
  "heading",
  "paragraph",
  "link",
  "socials",
  "image_grid",
  "list",
  "divider",
  "big_link",
  "internal_big_link",
  "header_image",
  "audio",
  "file",
  "video",
  "call_to_action",
  "visual_break",
  "stat_band",
] as const;

export const SiteBlockSchema = z
  .object({
    type: z.enum(SITE_BLOCK_TYPES),
    content: z.record(z.string(), z.unknown()).default({}),
    src: z.string().optional(),
    href: z.string().optional(),
    items: z.array(z.string()).optional(),
  })
  .passthrough();

export const SitePageSchema = z.object({
  slug: z.string().min(1).max(200),
  blocks: z.array(SiteBlockSchema).max(200),
});

export const ClientPortalInviteStatusSchema = z.enum(["not_invited", "invited", "active"]);

export const SiteMetadataClientPortalSchema = z.object({
  enabled: z.boolean(),
  /** Omitted on public static export when only a generic portal link is exposed. */
  clientId: z.string().uuid().optional(),
  portalUrl: z.string().max(200).default("/client-portal"),
  inviteStatus: ClientPortalInviteStatusSchema.default("not_invited"),
  showLoginLinkOnSite: z.boolean().default(false),
});

export const SiteMetadataLeadCaptureSchema = z.object({
  crmEnabled: z.boolean().default(true),
  clientHubEnabled: z.boolean().default(true),
  portalVisible: z.boolean().default(true),
  clientId: z.string().uuid(),
});

export const SiteMetadataAiAgentSchema = z.object({
  agentId: z.string().uuid(),
  widgetKey: z.string().min(8).max(80),
  status: z.string().max(32).optional(),
  clientId: z.string().uuid().optional(),
});

const SiteDomainConnectionDnsRecordSchema = z.object({
  type: z.string().max(16),
  name: z.string().max(255),
  value: z.string().max(2000),
  ttl: z.number().int().min(0).optional(),
  purpose: z.string().max(400).optional(),
});

/** Vercel / DNS rows + optional Web3 narrative (matches `site_domain_connections.requiredRecordsJson`). */
export const SiteMetadataDomainConnectionSchema = z.object({
  enabled: z.boolean(),
  domain: z.string().max(255),
  domainType: DomainTypeSchema,
  provider: DomainProviderSchema,
  targetUrl: z.string().max(2000),
  status: DomainConnectionStatusSchema,
  requiredRecords: z.array(SiteDomainConnectionDnsRecordSchema).max(32).optional(),
  /** Freename / Web3 setup copy when `requiredRecords` alone is insufficient. */
  setupInstructionsMarkdown: z.string().max(12000).optional(),
  lastCheckedAt: z.string().max(80).optional(),
});

export type SiteMetadataDomainConnection = z.infer<typeof SiteMetadataDomainConnectionSchema>;

export const SiteSchemaDocument = z.object({
  /** True when this project is attributed to a Revenue OS client (consultant handoff path). */
  clientSiteBuild: z.boolean().optional(),
  pages: z.array(SitePageSchema).min(1).max(200),
  metadata: z
    .object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      clientId: z.string().max(191).optional(),
      workspaceId: z.string().max(191).optional(),
      removeDefaultCss: z.boolean().optional().default(false),
      web3Domain: z
        .object({
          provider: z.string().max(80).optional(),
          domain: z.string().max(255).optional(),
          parked: z.boolean().optional(),
          notes: z.string().max(4000).optional(),
        })
        .optional(),
      /** Custom domain / Freename Web3 connection (synced from `site_domain_connections` + builder panel). */
      domainConnection: SiteMetadataDomainConnectionSchema.optional(),
      /** Guided AI refinement answers (optional; set when user completes review-step questionnaire). */
      builderRefinement: z.record(z.string(), z.unknown()).optional(),
      /** User-uploaded media linked to this schema (hero backgrounds, etc.). */
      siteBuilderAssets: SiteBuilderAssetMapSchema.optional(),
      /** AI / assistant art direction — copy-forward; no image pipeline required. */
      visualDirection: z
        .object({
          mood: z.string().max(300).optional(),
          background: z.string().max(2000).optional(),
          colorPalette: z.string().max(2000).optional(),
          imageryStyle: z.string().max(2000).optional(),
          lighting: z.string().max(2000).optional(),
          composition: z.string().max(2000).optional(),
          animationHints: z.string().max(2000).optional(),
        })
        .optional(),
      /** Layout-family cinematic fingerprint (v2 injection). */
      visualMeta: SiteVisualMetaV2Schema.optional(),
      theme: z
        .object({
          name: z.string().max(80).optional(),
          backgroundMode: BackgroundModeSchema.optional().default("simple_gradients"),
          gradientStart: z.string().max(40).optional(),
          gradientEnd: z.string().max(40).optional(),
          customGradient: z.string().max(200).optional(),
          backgroundColor: z.string().max(40).optional(),
          mediaUrl: z.string().max(2000).optional(),
          mediaType: z.enum(["image", "video"]).optional().default("image"),
          /** AI generation style profile — informational; affects generated block content only. */
          styleMode: z.enum(["web3", "corporate", "minimal", "bold"]).optional(),
          /** Cinematic layer: consumed by live preview + export. */
          gradientStyle: GradientStyleSchema.optional(),
          buttonStyle: CinematicButtonStyleSchema.optional(),
          depthStyle: DepthStyleSchema.optional(),
          motionHint: MotionHintSchema.optional(),
        })
        .optional(),
      advanced: z
        .object({
          customCss: z.string().max(50000).optional(),
          customJs: z.string().max(50000).optional(),
        })
        .optional(),
      /** Global design tokens — colors, type, spacing, motion; referenced by sections via `content.visual.ds`. */
      designSystem: DesignSystemSchema.optional(),
      /** Brand governance bookkeeping (no user-facing controls). */
      governance: SiteGovernanceMetaSchema,
      /** Brand Brain evaluation + improvement queue (session metadata; optional). */
      brandBrain: BrandBrainStateSchema.optional(),
      /** Launch readiness + agency task queue (orchestration metadata; optional). */
      agencyLaunch: AgencyLaunchStateSchema.optional(),
      /** AI agent/widget (Agency widget key) — injected on export per `placement`. */
      widgetIntegration: SiteWidgetIntegrationSchema.optional(),
      /** Provenance when the site was imported from an existing URL (blueprint, not a clone). */
      siteImport: SiteImportMetaSchema.optional(),
      /** Deterministic import restructuring audit (advisory; Refine). */
      importedSiteAudit: ImportedSiteAuditSchema.optional(),
      importRestructureQueue: z.array(ImportRestructureQueueItemSchema).max(48).optional(),
      /** Consultant proposal tier / scope posture — drives proposal + close-package artifacts only. */
      consultantProposalPosture: ProposalSelectionSchema.optional(),
      /** PayPal Business payment surface (hosted link / button / SDK placeholder). */
      paymentIntegration: PaymentIntegrationSchema.optional(),
      /** SEO keyword list (AI / assistant generated). */
      keywords: z.array(z.string().max(80)).max(48).optional(),
      canonicalUrl: z.string().max(500).optional(),
      robots: z.string().max(120).optional(),
      openGraph: z
        .object({
          title: z.string().max(200).optional(),
          description: z.string().max(500).optional(),
          image: z.string().max(2000).optional(),
          type: z.enum(["website"]).optional(),
        })
        .optional(),
      twitterCard: z
        .object({
          card: z.enum(["summary", "summary_large_image"]).optional(),
          title: z.string().max(200).optional(),
          description: z.string().max(500).optional(),
        })
        .optional(),
      /** JSON-LD objects (`@context` + `@type`) for export and preview `<head>`. */
      structuredData: z.array(z.record(z.string(), z.unknown())).max(16).optional(),
      seoQualityWarnings: z.array(z.string().max(400)).max(24).optional(),
      seoPrimaryKeyword: z.string().max(120).optional(),
      /** Short assistant line after auto SEO (Site Builder chat). */
      seoAssistantSummary: z.string().max(500).optional(),
      /** Consultant → client portal handoff (hosted app); never enable public login link unless explicitly set. */
      clientPortal: SiteMetadataClientPortalSchema.optional(),
      /** CRM / Hub / portal visibility flags for lead capture when a client is assigned. */
      leadCapture: SiteMetadataLeadCaptureSchema.optional(),
      /** Denormalized summary when an AI agent is bound to this site (widget key + status). */
      aiAgent: SiteMetadataAiAgentSchema.optional(),
    })
    .optional(),
});

export const CreateSiteSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(191).optional(),
  trustId: z.string().uuid().optional(),
  workspaceId: z.string().uuid().optional(),
  ownerWallet: z.string().max(140).optional(),
  /** Revenue OS client account — must be owned by the authenticated user. */
  clientId: z.string().uuid().optional(),
});

export const UpdateSiteSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    slug: z.string().min(1).max(191).nullable().optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
    ownerWallet: z.string().max(140).nullable().optional(),
    currentVersionId: z.string().uuid().nullable().optional(),
    /** Set or clear Revenue OS client attribution. Null clears `web3_sites.clientId`. */
    clientId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be updated",
  });

export const CreateVersionSchema = z.object({
  schemaJson: SiteSchemaDocument,
  createdByWallet: z.string().max(140).optional(),
  setCurrent: z.boolean().optional().default(true),
});

export type SiteSchemaDocumentType = z.infer<typeof SiteSchemaDocument>;
