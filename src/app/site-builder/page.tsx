"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  clearMaaniaSiteBuilderPendingImport,
  readMaaniaImportSchemaForSiteBuilder,
} from "@/lib/maania/maania-demo-storage";
import { MAANIA_FROM_MAANIA_PARAM, MAANIA_SITE_BUILDER_IMPORT_PARAM } from "@/lib/maania/open-in-builder";
import { SiteBuilderAgentAttachWizard } from "@/components/site-builder/SiteBuilderAgentAttachWizard";
import { SiteBuilderAiPanel, type SiteBuilderAiPanelHandle } from "@/components/site-builder/SiteBuilderAiPanel";
import { SiteBuilderAssistantPanel } from "@/components/site-builder/SiteBuilderAssistantPanel";
import { SiteBuilderFileDrawer } from "@/components/site-builder/SiteBuilderFileDrawer";
import { SiteBuilderHeader } from "@/components/site-builder/SiteBuilderHeader";
import { SiteBuilderLivePreview, type SiteBuilderCanvasEditProps } from "@/components/site-builder/SiteBuilderLivePreview";
import { SiteBuilderPreviewCanvas } from "@/components/site-builder/SiteBuilderPreviewCanvas";
import { SiteBuilderStageNav } from "@/components/site-builder/SiteBuilderStageNav";
import { SiteBuilderStickyBar } from "@/components/site-builder/SiteBuilderStickyBar";
import { SiteBuilderConnectDomainPanel } from "@/components/site-builder/SiteBuilderConnectDomainPanel";
import { SiteBuilderWorkspaceLayout } from "@/components/site-builder/SiteBuilderWorkspaceLayout";
import type { BuilderWorkflowStage } from "@/components/site-builder/builder-workflow-stage";
import { getBlockPlacement } from "@/lib/site-builder/preview/blockPreviewUtils";
import { compactSectionIdPrefixes, normalizeRefineSectionIds } from "@/lib/site-builder/refine-selection-utils";
import { trackSiteBuilderEvent } from "@/lib/site-builder/siteBuilderAnalytics";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { buildPreviewHeadTagsHtml } from "@/lib/site-builder/seo/seo-intelligence";
import { buildPaymentEmbedForIsolatedPreviewHtml } from "@/lib/site-builder/site-builder-payment-embed";
import { buildWidgetEmbedForIsolatedPreviewHtml } from "@/lib/site-builder/site-builder-widget-embed";
import { runSiteBuilderTrackedAction } from "@/lib/site-builder/siteBuilderTrackedAction";
import { fetchTrustRecordsMeActive } from "@/lib/trust-records-me-client";
import { normalizeSchemaJsonStringForTargeting } from "@/lib/site-builder/schema/ensure-block-targeting";
import {
  clearSiteBuilderDraftSessionStorage,
  readDraftSchemaFromSession,
} from "@/lib/site-builder/draft/site-builder-draft";
import { createSiteWithDraftHandoff } from "@/lib/site-builder/draft/create-site-handoff";
import type { FullBuildClientGate } from "@/lib/site-builder/ai/site-builder-intake";
import { mergeClientLifecycleMetadataJson } from "@/lib/site-builder/client-lifecycle-metadata";
import { computePublishChecklist, schemaSizeWarning } from "@/lib/site-builder/publish-readiness";
import {
  autoFixConversionPath,
  evaluateConversionPath,
  type ConversionGoal,
} from "@/lib/site-builder/conversion-engine";
import {
  applySectionStylePreset,
  applyThemePresetTokens,
  computeSectionCritiqueScore,
  createVisualLibraryBlock,
  duplicateSectionById,
  getVisualSections,
  mutateVisualSchema,
  reorderSectionBySnapDrop,
  reorderSectionByDropTarget,
  replaceFirstTextInSection,
  removeSectionById,
  suggestMissingSections,
  updateSectionById,
  type SectionStylePreset,
  VISUAL_COMPONENT_LIBRARY,
} from "@/lib/site-builder/visual-editor";

const SAMPLE_SCHEMA = `{
  "pages": [
    {
      "slug": "/",
      "blocks": [
        { "type": "hero", "content": { "title": "Family Office Portal", "subtitle": "Decentralized governance" } },
        { "type": "text", "content": { "body": "Welcome to your trust-owned web3 site." } },
        { "type": "button", "content": { "label": "Open Records", "href": "/trust-records" } }
      ]
    }
  ],
  "metadata": {
    "title": "Family Office Portal",
    "description": "Decentralized trust portal"
  }
}`;

const BLOCK_LIBRARY: Array<{ type: string; label: string; template: Record<string, unknown> }> = [
  { type: "avatar", label: "Avatar", template: { type: "avatar", src: "", content: { alt: "Avatar" } } },
  { type: "heading", label: "Heading", template: { type: "heading", content: { text: "Heading" } } },
  { type: "paragraph", label: "Paragraph", template: { type: "paragraph", content: { text: "Paragraph content" } } },
  { type: "link", label: "Link", template: { type: "link", content: { label: "Open Link", href: "#" } } },
  { type: "socials", label: "Socials", template: { type: "socials", content: { links: [{ label: "X", href: "https://x.com" }] } } },
  { type: "image", label: "Image", template: { type: "image", src: "", content: { alt: "Image" } } },
  { type: "image_grid", label: "Image Grid", template: { type: "image_grid", content: { images: [] } } },
  { type: "list", label: "List", template: { type: "list", items: ["Item 1", "Item 2"] } },
  { type: "divider", label: "Divider", template: { type: "divider" } },
  { type: "big_link", label: "Big Link", template: { type: "big_link", href: "#", content: { label: "Big Link" } } },
  { type: "internal_big_link", label: "Internal Big Link", template: { type: "internal_big_link", href: "/", content: { label: "Open Page" } } },
  { type: "header_image", label: "Header Image", template: { type: "header_image", src: "", content: { alt: "Header image" } } },
  { type: "audio", label: "Audio", template: { type: "audio", src: "" } },
  { type: "file", label: "File", template: { type: "file", href: "", content: { label: "Download File" } } },
  { type: "video", label: "Video", template: { type: "video", src: "" } },
  { type: "call_to_action", label: "Call to Action", template: { type: "call_to_action", content: { title: "Ready to proceed?", body: "Continue to the next step.", label: "Continue", href: "#" } } },
];

const SOCIAL_PLATFORMS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/..." },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@..." },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
  { key: "whatsapp", label: "WhatsApp", placeholder: "https://wa.me/..." },
  { key: "snapchat", label: "Snapchat", placeholder: "https://snapchat.com/add/..." },
];

type SiteRow = {
  id: string;
  name: string;
  slug: string | null;
  trustId: string | null;
  workspaceId: string | null;
  clientId?: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  ownerWallet: string | null;
  currentVersionId: string | null;
  nftChainId: number | null;
  nftContract: string | null;
  nftTokenId: string | null;
  updatedAt?: string | null;
};

type SiteVersionRow = {
  id: string;
  siteId: string;
  version: number;
  schemaHash: string;
  ipfsCid: string | null;
  createdAt?: string | null;
};

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  schemaJson: string;
  trustId: string | null;
  workspaceId: string | null;
  clientId: string | null;
  updatedAt?: string | null;
};

type BuilderPopoutType = "avatar" | "link" | "paragraph" | "heading" | "image" | "divider" | "video";
type PreviewDevice = "desktop" | "tablet" | "mobile";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export default function SiteBuilderPage() {
  const BINDING_KEY = "smart_trust_platform_binding_v1";
  const BINDING_EVENT = "smart_trust_platform_binding_updated";
  const [busy, setBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maaniaImportBanner, setMaaniaImportBanner] = useState(false);

  const [sites, setSites] = useState<SiteRow[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [versions, setVersions] = useState<SiteVersionRow[]>([]);

  const [createName, setCreateName] = useState("Family Office Site");
  const [createSlug, setCreateSlug] = useState("");
  const [createTrustId, setCreateTrustId] = useState("");
  const [createWorkspaceId, setCreateWorkspaceId] = useState("");
  const [createOwnerWallet, setCreateOwnerWallet] = useState("");
  const [createDraftRetrySiteId, setCreateDraftRetrySiteId] = useState<string>("");
  const [createDraftRetrySchemaText, setCreateDraftRetrySchemaText] = useState<string>("");
  const [transferOwnerWallet, setTransferOwnerWallet] = useState("");
  const [connectedWallet, setConnectedWallet] = useState("");
  const [activeTrustContext, setActiveTrustContext] = useState<{ trustId: string; workspaceId: string; clientId: string } | null>(null);

  const [schemaText, setSchemaText] = useState(() => normalizeSchemaJsonStringForTargeting(SAMPLE_SCHEMA));
  const [versionIdForActions, setVersionIdForActions] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [deployVersionId, setDeployVersionId] = useState("");
  const [lastDeployGatewayUrl, setLastDeployGatewayUrl] = useState("");
  const [lastDeployIpfsCid, setLastDeployIpfsCid] = useState("");

  const [mintChainId, setMintChainId] = useState("137");
  const [mintContract, setMintContract] = useState("");
  const [mintToWallet, setMintToWallet] = useState("");
  const [mintVersionId, setMintVersionId] = useState("");
  const [mintSiteName, setMintSiteName] = useState("");
  const [mintDescription, setMintDescription] = useState("");
  const [mintPrepared, setMintPrepared] = useState<any | null>(null);

  const [confirmChainId, setConfirmChainId] = useState("137");
  const [confirmContract, setConfirmContract] = useState("");
  const [confirmTokenId, setConfirmTokenId] = useState("");
  const [confirmTxHash, setConfirmTxHash] = useState("");
  const [confirmOwnerWallet, setConfirmOwnerWallet] = useState("");

  const [removeDefaultCss, setRemoveDefaultCss] = useState(false);
  const [themeName, setThemeName] = useState("Custom");
  const [backgroundMode, setBackgroundMode] = useState<string>("simple_gradients");
  const [gradientStart, setGradientStart] = useState("#0f172a");
  const [gradientEnd, setGradientEnd] = useState("#1e293b");
  const [customGradient, setCustomGradient] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("#020617");
  const [backgroundMediaUrl, setBackgroundMediaUrl] = useState("");
  const [backgroundMediaType, setBackgroundMediaType] = useState<"image" | "video">("image");
  const [clientId, setClientId] = useState("");
  /** Standalone = save without requiring workspace/client; linked = bind version metadata to a trust/workspace + client. */
  const [workspaceLinkMode, setWorkspaceLinkMode] = useState<"standalone" | "linked">("standalone");
  const [linkedWorkspaceId, setLinkedWorkspaceId] = useState("");
  const [workspacesList, setWorkspacesList] = useState<Array<{ id: string; name: string; clientId: string | null }>>([]);
  const [web3DomainName, setWeb3DomainName] = useState("");
  const [web3DomainProvider, setWeb3DomainProvider] = useState("Freename");
  const [web3DomainParked, setWeb3DomainParked] = useState(false);
  const [web3DomainNotes, setWeb3DomainNotes] = useState("");
  const [customCssText, setCustomCssText] = useState("");
  const [customJsText, setCustomJsText] = useState("");
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number>(0);
  const [addBlockType, setAddBlockType] = useState<string>("");
  const [expandedBlockListIndex, setExpandedBlockListIndex] = useState<number | null>(null);
  const [editBlockPanelOpen, setEditBlockPanelOpen] = useState(false);
  const [draggingBlockIndex, setDraggingBlockIndex] = useState<number | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ index: number; position: "above" | "below" } | null>(null);
  const [activePopout, setActivePopout] = useState<BuilderPopoutType | null>(null);
  const [popoutEditIndex, setPopoutEditIndex] = useState<number | null>(null);
  const [popoutExiting, setPopoutExiting] = useState(false);
  const [popoutAvatarSrc, setPopoutAvatarSrc] = useState("");
  const [popoutAvatarFileName, setPopoutAvatarFileName] = useState("");
  const [popoutAvatarSize, setPopoutAvatarSize] = useState("75x75");
  const [popoutAvatarShape, setPopoutAvatarShape] = useState("square");
  const [popoutAvatarBorderWidth, setPopoutAvatarBorderWidth] = useState(0);
  const [popoutAvatarBorderStyle, setPopoutAvatarBorderStyle] = useState<"solid" | "dashed">("solid");
  const [popoutAvatarBorderColor, setPopoutAvatarBorderColor] = useState("#334155");
  const [popoutLinkHref, setPopoutLinkHref] = useState("");
  const [popoutLinkLabel, setPopoutLinkLabel] = useState("");
  const [popoutParagraphText, setPopoutParagraphText] = useState("");
  const [popoutHeadingLevel, setPopoutHeadingLevel] = useState("h1");
  const [popoutHeadingText, setPopoutHeadingText] = useState("");
  const [popoutImageSrc, setPopoutImageSrc] = useState("");
  const [popoutImageFileName, setPopoutImageFileName] = useState("");
  const [popoutImageAlt, setPopoutImageAlt] = useState("");
  const [popoutImageHref, setPopoutImageHref] = useState("");
  const [popoutVideoSrc, setPopoutVideoSrc] = useState("");
  const [popoutVideoFileName, setPopoutVideoFileName] = useState("");
  const [popoutDividerVariant, setPopoutDividerVariant] = useState<"thin" | "medium" | "thick">("medium");
  const [popoutDividerThickness, setPopoutDividerThickness] = useState(2);
  const [popoutDividerColor, setPopoutDividerColor] = useState("#334155");
  const [popoutDividerOffsetY, setPopoutDividerOffsetY] = useState(0);
  const [popoutDividerEditIndex, setPopoutDividerEditIndex] = useState<number | null>(null);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [builderStage, setBuilderStage] = useState<BuilderWorkflowStage>("describe");
  const [refineTargetSectionIds, setRefineTargetSectionIds] = useState<string[]>([]);
  const [schemaHistoryPast, setSchemaHistoryPast] = useState<string[]>([]);
  const [schemaHistoryFuture, setSchemaHistoryFuture] = useState<string[]>([]);
  const [previewNotes, setPreviewNotes] = useState<{ desktop: string; tablet: string; mobile: string }>({
    desktop: "",
    tablet: "",
    mobile: "",
  });
  const [coPilotSuggestion, setCoPilotSuggestion] = useState<string | null>(null);
  const [conversionGoal, setConversionGoal] = useState<ConversionGoal>("lead_capture");
  const [canvasEditorSectionId, setCanvasEditorSectionId] = useState<string | null>(null);
  const [canvasFlashSectionIds, setCanvasFlashSectionIds] = useState<string[]>([]);
  const [canvasError, setCanvasError] = useState<{ id: string; message: string } | null>(null);
  /** Pin busy overlay to the section ids that started the request (canvas path). */
  const [canvasRegenerateTargetIds, setCanvasRegenerateTargetIds] = useState<string[] | null>(null);
  const [sectionRegenVisualMask, setSectionRegenVisualMask] = useState(false);
  const [canvasPulseSectionIds, setCanvasPulseSectionIds] = useState<string[]>([]);
  const [scrollPreviewToTopTrigger, setScrollPreviewToTopTrigger] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fileDrawerOpen, setFileDrawerOpen] = useState(false);
  const [activeDrawerFileId, setActiveDrawerFileId] = useState("schema.json");
  const [agencyAgents, setAgencyAgents] = useState<
    Array<{ id: string; name: string; status: string; workspaceId?: string | null }>
  >([]);
  const [agencyWidgetAgentId, setAgencyWidgetAgentId] = useState("");
  const [agencyWidgetProvider, setAgencyWidgetProvider] = useState<"agent" | "site_builder">("agent");
  const [agencyWidgetBindings, setAgencyWidgetBindings] = useState<
    Array<{
      widgetKey: string;
      agentId: string;
      agentName: string;
      agentStatus: string;
      isActive: boolean;
      clientId?: string | null;
      providerStrategy: string;
      embedSnippet: string;
    }>
  >([]);
  const [agencyWidgetBusy, setAgencyWidgetBusy] = useState(false);
  /** Revenue OS client hub accounts — for site + widget attribution. */
  const [hubClients, setHubClients] = useState<Array<{ id: string; name: string }>>([]);
  const [hubClientPick, setHubClientPick] = useState("");
  const [hubClientCreateBusy, setHubClientCreateBusy] = useState(false);
  const [widgetNewHubClientName, setWidgetNewHubClientName] = useState("");
  const [buildForClient, setBuildForClient] = useState(false);
  const [layoutGenComplete, setLayoutGenComplete] = useState(false);
  const [postLayoutAgentSkipped, setPostLayoutAgentSkipped] = useState(false);
  const [agentAttachWizardOpen, setAgentAttachWizardOpen] = useState(false);
  const [agentWizardBusy, setAgentWizardBusy] = useState(false);
  const [mobilePreviewOk, setMobilePreviewOk] = useState(false);
  /** Ship checklist: operator chose to defer portal invite (per site, sessionStorage). */
  const [portalInviteBypass, setPortalInviteBypass] = useState(false);
  const backgroundMediaInputRef = useRef<HTMLInputElement | null>(null);
  const livePreviewRef = useRef<HTMLDivElement | null>(null);
  const aiPanelRef = useRef<SiteBuilderAiPanelHandle | null>(null);
  const maaniaImportConsumed = useRef(false);
  const draftSessionHydrated = useRef(false);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) ?? null,
    [selectedSiteId, sites]
  );

  useEffect(() => {
    if (!selectedSiteId) {
      setPortalInviteBypass(false);
      return;
    }
    try {
      setPortalInviteBypass(sessionStorage.getItem(`site-builder-portal-invite-skip:${selectedSiteId}`) === "1");
    } catch {
      setPortalInviteBypass(false);
    }
  }, [selectedSiteId]);

  const agencyBindingsForLifecycleMerge = useMemo(
    () =>
      agencyWidgetBindings.map((b) => ({
        agentId: b.agentId,
        widgetKey: b.widgetKey,
        agentStatus: b.agentStatus,
        clientId: b.clientId ?? null,
        isActive: b.isActive,
      })),
    [agencyWidgetBindings],
  );

  const parsedSchema = useMemo(() => {
    try {
      return JSON.parse(schemaText) as any;
    } catch {
      return null;
    }
  }, [schemaText]);

  const lifecycleSchemaText = useMemo(() => {
    try {
      const raw = JSON.parse(schemaText);
      const r = mergeClientLifecycleMetadataJson(raw, {
        buildForClient,
        siteClientId: hubClientPick.trim() || selectedSite?.clientId?.trim() || undefined,
        agencyBindings: agencyBindingsForLifecycleMerge,
      });
      if (!r.ok) return schemaText;
      return normalizeSchemaJsonStringForTargeting(JSON.stringify(r.schema, null, 2));
    } catch {
      return schemaText;
    }
  }, [schemaText, buildForClient, hubClientPick, selectedSite?.clientId, agencyBindingsForLifecycleMerge]);

  useEffect(() => {
    if (lifecycleSchemaText === schemaText) return;
    setSchemaText(lifecycleSchemaText);
  }, [lifecycleSchemaText, schemaText]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (maaniaImportConsumed.current) return;
    const params = new URLSearchParams(window.location.search);
    const importParam = params.get(MAANIA_SITE_BUILDER_IMPORT_PARAM) === "1";
    const fromMaania = params.get(MAANIA_FROM_MAANIA_PARAM) === "1";
    if (!importParam && !fromMaania) return;

    maaniaImportConsumed.current = true;

    try {
      const raw = readMaaniaImportSchemaForSiteBuilder();
      if (!raw) {
        setNotice(
          "No MAANIA demo schema found in this browser tab. Open Preview from MAANIA chat, then try again."
        );
      } else {
        const doc = JSON.parse(raw) as Record<string, unknown>;
        setSchemaText(normalizeSchemaJsonStringForTargeting(JSON.stringify(doc, null, 2)));
        setMaaniaImportBanner(true);
        setNotice(
          "MAANIA demo imported into the schema editor. Review JSON, edit blocks in the preview, then save as a site version or template."
        );
      }
    } catch {
      setError("Could not import MAANIA schema from session storage.");
    }

    clearMaaniaSiteBuilderPendingImport();
    params.delete(MAANIA_SITE_BUILDER_IMPORT_PARAM);
    params.delete(MAANIA_FROM_MAANIA_PARAM);
    const qs = params.toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, "", next);
  }, []);

  useEffect(() => {
    if (draftSessionHydrated.current) return;
    if (typeof window === "undefined") return;
    draftSessionHydrated.current = true;
    if (maaniaImportConsumed.current) return;
    if (selectedSiteId) return;
    try {
      const raw = readDraftSchemaFromSession();
      if (!raw?.trim()) return;
      const p = SiteSchemaDocument.safeParse(JSON.parse(raw));
      if (p.success) {
        setSchemaText(normalizeSchemaJsonStringForTargeting(JSON.stringify(p.data, null, 2)));
      }
    } catch {
      /* ignore */
    }
  }, [selectedSiteId]);

  const firstPageBlocks = useMemo(() => {
    const blocks = parsedSchema?.pages?.[0]?.blocks;
    return Array.isArray(blocks) ? blocks : [];
  }, [parsedSchema]);

  const previewStyleMode = useMemo(() => {
    const m = parsedSchema?.metadata?.theme?.styleMode;
    return typeof m === "string" && m.length > 0 ? m : undefined;
  }, [parsedSchema]);

  const previewCinematic = useMemo(() => {
    const t = parsedSchema?.metadata?.theme;
    if (!t) return undefined;
    return {
      gradientStyle: typeof t.gradientStyle === "string" ? t.gradientStyle : undefined,
      depthStyle: typeof t.depthStyle === "string" ? t.depthStyle : undefined,
      motionHint: typeof t.motionHint === "string" ? t.motionHint : undefined,
      buttonStyle: typeof t.buttonStyle === "string" ? t.buttonStyle : undefined,
    };
  }, [parsedSchema]);

  const previewVisualBoost = useMemo(() => {
    const vm = parsedSchema?.metadata?.visualMeta as Record<string, unknown> | undefined;
    if (!vm || typeof vm !== "object") return undefined;
    const th = parsedSchema?.metadata?.theme;
    return {
      lightingStyle: typeof vm.lightingStyle === "string" ? vm.lightingStyle : undefined,
      gradientStyle: typeof vm.gradientStyle === "string" ? vm.gradientStyle : undefined,
      backgroundStyle: typeof vm.backgroundStyle === "string" ? vm.backgroundStyle : undefined,
      layoutFamilyId: typeof vm.layoutFamilyId === "string" ? vm.layoutFamilyId : undefined,
      motionIntensity: typeof vm.motionIntensity === "number" && Number.isFinite(vm.motionIntensity) ? vm.motionIntensity : undefined,
      motionHint: typeof th?.motionHint === "string" ? th.motionHint : undefined,
    };
  }, [parsedSchema]);

  const canvasBusySectionIds =
    canvasRegenerateTargetIds ??
    (busy && sectionRegenVisualMask ? normalizeRefineSectionIds(refineTargetSectionIds, 3) : []);
  const sectionCritiqueScoreById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const block of firstPageBlocks as any[]) {
      const id = String(block?.content?.aiSectionId || "").trim();
      if (!id) continue;
      map[id] = computeSectionCritiqueScore(block);
    }
    return map;
  }, [firstPageBlocks]);

  const handleCanvasSelectSection = useCallback(
    (sectionId: string, sectionType?: string, opts?: { shiftKey?: boolean }) => {
      setCanvasError(null);
      if (opts?.shiftKey) {
        setRefineTargetSectionIds((prev) => {
          const norm = (ids: string[]) => normalizeRefineSectionIds(ids, 3);
          const next = prev.includes(sectionId)
            ? norm(prev.filter((id) => id !== sectionId))
            : norm([...prev, sectionId]);
          if (next.length >= 2) {
            trackSiteBuilderEvent("site_builder_canvas_multi_section_selected", {
              section_count: next.length,
              section_ids_compact: compactSectionIdPrefixes(next),
              workflow_stage: builderStage,
              ...(previewStyleMode ? { style_mode: previewStyleMode } : {}),
              ...(sectionType ? { section_type: sectionType } : {}),
            });
          }
          return next;
        });
        return;
      }
      setCanvasEditorSectionId(null);
      setRefineTargetSectionIds((prev) => {
        const next = normalizeRefineSectionIds([sectionId], 3);
        if (prev.length !== 1 || prev[0] !== sectionId) {
          trackSiteBuilderEvent("site_builder_canvas_section_selected", {
            section_id: sectionId,
            workflow_stage: builderStage,
            ...(previewStyleMode ? { style_mode: previewStyleMode } : {}),
            ...(sectionType ? { section_type: sectionType } : {}),
          });
        }
        return next;
      });
    },
    [builderStage, previewStyleMode],
  );

  const handleRefineTargetSectionIdsChange = useCallback((ids: string[]) => {
    setRefineTargetSectionIds(normalizeRefineSectionIds(ids, 3));
    setCanvasEditorSectionId(null);
    setCanvasError(null);
  }, []);

  const handleCanvasSubmitSection = useCallback(async (sectionIds: string[], instruction: string) => {
    const ids = normalizeRefineSectionIds(sectionIds, 3);
    if (ids.length === 0) return;
    setCanvasError(null);
    setCanvasFlashSectionIds([]);
    setCanvasRegenerateTargetIds(ids);
    try {
      const panel = aiPanelRef.current;
      if (!panel) throw new Error("Assistant unavailable");
      await panel.runRefineSectionRegenerate(instruction, { sectionIds: ids, source: "canvas" });
      setCanvasFlashSectionIds(ids);
      setCanvasEditorSectionId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      setCanvasError({ id: ids[0]!, message: msg });
      throw e;
    } finally {
      setCanvasRegenerateTargetIds(null);
    }
  }, []);

  const refineCanvasEdit: SiteBuilderCanvasEditProps | undefined = useMemo(() => {
    if (builderStage !== "refine" || firstPageBlocks.length === 0) return undefined;
    return {
      workflowStage: builderStage,
      selectedSectionIds: normalizeRefineSectionIds(refineTargetSectionIds, 3),
      editorOpenSectionId: canvasEditorSectionId,
      busySectionIds: canvasBusySectionIds,
      flashSuccessSectionIds: canvasFlashSectionIds,
      pulseSectionIds: canvasPulseSectionIds,
      errorSectionId: canvasError?.id ?? null,
      errorMessage: canvasError?.message ?? null,
      styleMode: previewStyleMode,
      onSelectSection: handleCanvasSelectSection,
      onOpenEditor: (id) => setCanvasEditorSectionId(id),
      onCloseEditor: () => setCanvasEditorSectionId(null),
      onSubmitSection: handleCanvasSubmitSection,
      onInlineTextEdit: inlineEditSectionText,
      onReorderSectionDrop: reorderSectionFromCanvasDrop,
      onDuplicateSection: duplicateSectionFromCanvas,
      onDeleteSection: deleteSectionFromCanvas,
      onToggleSectionStyle: toggleCanvasSectionStyle,
      onUpdateSectionSpacing: updateCanvasSectionSpacing,
      onApplyStylePreset: applyCanvasStylePreset,
      onFixSection: fixCanvasSection,
      sectionCritiqueScoreById,
      onDismissFlash: () => setCanvasFlashSectionIds([]),
      onDismissError: () => setCanvasError(null),
    };
  }, [
    builderStage,
    firstPageBlocks.length,
    refineTargetSectionIds,
    canvasEditorSectionId,
    canvasBusySectionIds,
    canvasRegenerateTargetIds,
    canvasFlashSectionIds,
    canvasError,
    previewStyleMode,
    handleCanvasSelectSection,
    handleCanvasSubmitSection,
    inlineEditSectionText,
    reorderSectionFromCanvasDrop,
    duplicateSectionFromCanvas,
    deleteSectionFromCanvas,
    toggleCanvasSectionStyle,
    updateCanvasSectionSpacing,
    applyCanvasStylePreset,
    fixCanvasSection,
    sectionCritiqueScoreById,
    canvasPulseSectionIds,
  ]);

  useEffect(() => {
    if (builderStage !== "refine") {
      setCanvasEditorSectionId(null);
      setCanvasFlashSectionIds([]);
      setCanvasError(null);
      setRefineTargetSectionIds([]);
      setSectionRegenVisualMask(false);
      setCanvasRegenerateTargetIds(null);
      setCanvasPulseSectionIds([]);
    }
  }, [builderStage]);

  const selectedBlock = useMemo(
    () => (firstPageBlocks[selectedBlockIndex] ? firstPageBlocks[selectedBlockIndex] : null),
    [firstPageBlocks, selectedBlockIndex]
  );
  const visualSections = useMemo(() => getVisualSections(schemaText), [schemaText]);
  const selectedVisualSectionId = refineTargetSectionIds[0] ?? visualSections[0]?.id ?? "";
  const selectedVisualSection = useMemo(
    () => visualSections.find((section) => section.id === selectedVisualSectionId) ?? null,
    [visualSections, selectedVisualSectionId],
  );
  const selectedVisualBlock = useMemo(
    () => (selectedVisualSection ? (firstPageBlocks[selectedVisualSection.index] as any) : null),
    [firstPageBlocks, selectedVisualSection],
  );
  const conversionAudit = useMemo(() => evaluateConversionPath(schemaText), [schemaText]);
  useEffect(() => {
    const notes = (parsedSchema?.metadata as any)?.visualEditor?.previewNotes || {};
    const goal = String((parsedSchema?.metadata as any)?.conversionGoal || "").trim() as ConversionGoal;
    if (goal) setConversionGoal(goal);
    setPreviewNotes({
      desktop: String(notes.desktop || ""),
      tablet: String(notes.tablet || ""),
      mobile: String(notes.mobile || ""),
    });
  }, [parsedSchema?.metadata]);
  const currentVersion = useMemo(
    () => versions.find((v) => v.id === selectedSite?.currentVersionId) ?? null,
    [versions, selectedSite?.currentVersionId]
  );
  const hasSavedVersion = versions.length > 0;
  const hasDeployedVersion = Boolean(lastDeployIpfsCid || versions.some((v) => Boolean(v.ipfsCid)));
  const hasDomainConfigured = Boolean(
    web3DomainName.trim() ||
      (Boolean(String((parsedSchema?.metadata as any)?.domainConnection?.domain || "").trim()) &&
        String((parsedSchema?.metadata as any)?.domainConnection?.status || "") === "connected"),
  );
  const hasMintPrepared = Boolean(mintPrepared);

  const workflowSteps = useMemo(
    () => [
      { key: "build", label: "Build", done: Boolean(selectedSiteId) },
      { key: "version", label: "Save Version", done: hasSavedVersion },
      { key: "deploy", label: "Deploy", done: hasDeployedVersion },
      { key: "domain", label: "Connect Domain", done: hasDomainConfigured },
      { key: "mint", label: "Mint", done: hasMintPrepared || Boolean(selectedSite?.nftTokenId) },
    ],
    [selectedSiteId, hasSavedVersion, hasDeployedVersion, hasDomainConfigured, hasMintPrepared, selectedSite?.nftTokenId]
  );

  async function loadSites(preferredSiteId?: string) {
    setError(null);
    const data = await jsonFetch<{ items: SiteRow[] }>("/api/site-builder/sites");
    const items = data.items || [];
    setSites(items);
    const urlSite =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("siteId")?.trim() : "";
    const fromUrl = urlSite && items.some((s) => s.id === urlSite) ? urlSite : "";
    const fallback = preferredSiteId || fromUrl || selectedSiteId || items[0]?.id || "";
    setSelectedSiteId(items.some((s) => s.id === fallback) ? fallback : (items[0]?.id || ""));
  }

  async function loadVersions(siteId: string) {
    if (!siteId) {
      setVersions([]);
      return;
    }
    const data = await jsonFetch<{ versions: SiteVersionRow[] }>(
      `/api/site-builder/sites/${encodeURIComponent(siteId)}/versions`
    );
    setVersions(data.versions || []);
    const latest = data.versions?.[0]?.id || "";
    setVersionIdForActions((prev) => prev || latest);
    setDeployVersionId((prev) => prev || latest);
    setMintVersionId((prev) => prev || latest);
  }

  const refreshSchemaFromServerCurrentVersion = useCallback(async () => {
    if (!selectedSiteId) {
      throw new Error("No site selected");
    }
    const res = await fetch(`/api/site-builder/sites/${encodeURIComponent(selectedSiteId)}`, {
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      currentVersion?: { id?: string; schemaJson?: string };
    };
    if (!res.ok) {
      throw new Error(data.error || `Failed to load site (${res.status})`);
    }
    const raw = data.currentVersion?.schemaJson;
    if (raw == null || String(raw).length === 0) {
      throw new Error("No saved version schema on the server yet.");
    }
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    setSchemaText(normalizeSchemaJsonStringForTargeting(JSON.stringify(parsed, null, 2)));
    const vid = data.currentVersion?.id;
    if (vid) {
      setVersionIdForActions(vid);
    }
    await loadVersions(selectedSiteId);
    setNotice("Loaded the latest saved version into the editor.");
  }, [selectedSiteId]);

  async function loadTemplates() {
    const data = await jsonFetch<{ items: TemplateRow[] }>("/api/site-builder/templates");
    setTemplates(data.items || []);
    if (!selectedTemplateId && data.items?.[0]?.id) {
      setSelectedTemplateId(data.items[0].id);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/trust-records/workspaces", { credentials: "include" });
        if (!r.ok) return;
        const j = (await r.json()) as { workspaces?: Array<{ id: string; name: string; clientId: string | null }> };
        if (!cancelled && Array.isArray(j.workspaces)) {
          setWorkspacesList(
            j.workspaces.map((w) => ({
              id: String(w.id),
              name: String(w.name || "Untitled"),
              clientId: w.clientId != null ? String(w.clientId) : null,
            }))
          );
        }
      } catch {
        // optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadActiveSessionContext() {
    try {
      const snap = await fetchTrustRecordsMeActive();
      const trustId = String(snap?.trustId || "").trim();
      const ctxClientId = String(snap?.clientId || "").trim();
      const workspaceId = trustId;
      if (trustId) {
        setCreateTrustId((prev) => prev || trustId);
        setCreateWorkspaceId((prev) => prev || workspaceId);
      }
      if (ctxClientId) {
        setClientId((prev) => prev || ctxClientId);
      }
      if (trustId || ctxClientId || workspaceId) {
        setActiveTrustContext({ trustId, workspaceId, clientId: ctxClientId });
      }
    } catch {
      // optional context
    }
    try {
      const clientData = await jsonFetch<any>("/api/clients/me");
      const profileClientId = String(clientData?.client?.id || "").trim();
      if (profileClientId) {
        setClientId((prev) => prev || profileClientId);
      }
    } catch {
      // optional context
    }
  }

  function loadLocalSessionBinding() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(BINDING_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { trustId?: string | null; clientId?: string | null };
      const trustId = String(parsed?.trustId || "").trim();
      const bindingClientId = String(parsed?.clientId || "").trim();
      const workspaceId = trustId;
      if (trustId) {
        setCreateTrustId((prev) => prev || trustId);
        setCreateWorkspaceId((prev) => prev || workspaceId);
      }
      if (bindingClientId) {
        setClientId((prev) => prev || bindingClientId);
      }
      if (trustId || bindingClientId) {
        setActiveTrustContext({ trustId, workspaceId, clientId: bindingClientId });
      }
    } catch {
      // ignore malformed local binding payloads
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cid = new URLSearchParams(window.location.search).get("clientId")?.trim();
      if (cid) {
        setClientId((prev) => prev || cid);
        setHubClientPick(cid);
      }
    }
    void (async () => {
      try {
        await loadSites();
        await loadTemplates();
        await loadActiveSessionContext();
        loadLocalSessionBinding();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sites");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHubClients = useCallback(async () => {
    try {
      const r = await fetch("/api/revenue-os/clients", { credentials: "include" });
      if (!r.ok) return;
      const j = (await r.json()) as { clients?: Array<{ id: string; name: string }> };
      if (!Array.isArray(j.clients)) return;
      setHubClients(j.clients.map((c) => ({ id: c.id, name: c.name })));
    } catch {
      /* optional — requires Revenue OS access */
    }
  }, []);

  useEffect(() => {
    void loadHubClients();
  }, [loadHubClients]);

  useEffect(() => {
    void loadVersions(selectedSiteId);
  }, [selectedSiteId]);

  useEffect(() => {
    if (!selectedSiteId) {
      setAgencyWidgetBindings([]);
      return;
    }
    void (async () => {
      try {
        const d = await jsonFetch<{
          bindings: Array<{
            widgetKey: string;
            agentId: string;
            agentName: string;
            agentStatus: string;
            isActive: boolean;
            clientId?: string | null;
            providerStrategy: string;
            embedSnippet: string;
          }>;
        }>(`/api/site-builder/sites/${encodeURIComponent(selectedSiteId)}/agency-widget`);
        setAgencyWidgetBindings(d.bindings ?? []);
      } catch {
        setAgencyWidgetBindings([]);
      }
    })();
  }, [selectedSiteId]);

  useEffect(() => {
    if (!advancedOpen) return;
    void (async () => {
      try {
        const d = await jsonFetch<{ items: Array<{ id: string; name: string; status: string }> }>("/api/app/agents");
        setAgencyAgents(d.items ?? []);
      } catch {
        setAgencyAgents([]);
      }
    })();
  }, [advancedOpen]);

  useEffect(() => {
    if (builderStage === "refine") {
      setAdvancedOpen(true);
    }
  }, [builderStage]);

  useEffect(() => {
    if (!selectedSite) return;
    const sc = selectedSite.clientId?.trim();
    if (!sc) return;
    setClientId((prev) => (prev.trim() ? prev : sc));
    setHubClientPick((prev) => (prev ? prev : sc));
  }, [selectedSite, selectedSiteId]);

  useEffect(() => {
    const refreshLocalBinding = () => loadLocalSessionBinding();
    refreshLocalBinding();
    window.addEventListener(BINDING_EVENT, refreshLocalBinding);
    window.addEventListener("storage", refreshLocalBinding);
    return () => {
      window.removeEventListener(BINDING_EVENT, refreshLocalBinding);
      window.removeEventListener("storage", refreshLocalBinding);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connectedWallet) {
      setCreateOwnerWallet(connectedWallet);
      setTransferOwnerWallet((prev) => prev || connectedWallet);
    }
  }, [connectedWallet]);

  useEffect(() => {
    if (!selectedSite) return;
    if (selectedSite.trustId) setCreateTrustId(selectedSite.trustId);
    if (selectedSite.workspaceId) setCreateWorkspaceId(selectedSite.workspaceId);
  }, [selectedSite]);

  useEffect(() => {
    const ethereum = (window as any)?.ethereum;
    if (!ethereum) return;
    void (async () => {
      try {
        const accounts = (await ethereum.request({ method: "eth_accounts" })) as string[];
        const wallet = String(accounts?.[0] || "");
        if (wallet) setConnectedWallet(wallet);
      } catch {
        // ignore wallet probe errors
      }
    })();
  }, []);

  async function withBusy(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }

  async function withBusyRethrowing(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Operation failed";
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setBusy(false);
    }
  }

  async function connectConsultantWallet() {
    setWalletBusy(true);
    setError(null);
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error("No injected wallet found. Install MetaMask or WalletConnect-enabled wallet.");
      }
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const wallet = String(accounts?.[0] || "");
      if (!wallet) throw new Error("Wallet connection failed.");
      setConnectedWallet(wallet);
      if (!createOwnerWallet) setCreateOwnerWallet(wallet);
      setNotice(`Wallet connected: ${wallet.slice(0, 6)}...${wallet.slice(-4)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed");
    } finally {
      setWalletBusy(false);
    }
  }

  async function transferSiteOwnership(nextOwnerWallet: string) {
    if (!selectedSiteId) return;
    const wallet = nextOwnerWallet.trim();
    if (!wallet) {
      setError("Target wallet is required for transfer.");
      return;
    }
    await withBusy(async () => {
      await jsonFetch<{ site: SiteRow }>(`/api/site-builder/sites/${encodeURIComponent(selectedSiteId)}`, {
        method: "PATCH",
        body: JSON.stringify({ ownerWallet: wallet }),
      });
      await loadSites(selectedSiteId);
      setNotice(`Site ownership transferred to ${wallet}`);
    });
  }

  async function saveCurrentAsTemplate() {
    let parsedSchema: unknown;
    try {
      parsedSchema = JSON.parse(schemaText);
    } catch {
      throw new Error("Schema JSON is invalid");
    }
    const cleanName = templateName.trim();
    if (!cleanName) throw new Error("Template name is required.");
    await jsonFetch<{ template: TemplateRow }>("/api/site-builder/templates", {
      method: "POST",
      body: JSON.stringify({
        name: cleanName,
        description: templateDescription.trim() || undefined,
        schemaJson: parsedSchema,
        trustId: createTrustId || undefined,
        workspaceId: createWorkspaceId || undefined,
        clientId: clientId || undefined,
      }),
    });
    await loadTemplates();
    setTemplateName("");
    setTemplateDescription("");
    setNotice("Template saved to consultant library.");
  }

  async function quickSaveTemplate() {
    let parsedSchema: unknown;
    try {
      parsedSchema = JSON.parse(schemaText);
    } catch {
      throw new Error("Schema JSON is invalid");
    }
    const autoName = `${createName || "Site"} Template ${new Date().toLocaleString()}`;
    await jsonFetch<{ template: TemplateRow }>("/api/site-builder/templates", {
      method: "POST",
      body: JSON.stringify({
        name: autoName,
        description: "Quick-saved from builder",
        schemaJson: parsedSchema,
        trustId: createTrustId || undefined,
        workspaceId: createWorkspaceId || undefined,
        clientId: clientId || undefined,
      }),
    });
    await loadTemplates();
    setNotice(`Template saved: ${autoName}`);
  }

  function applySelectedTemplateToEditor() {
    const selected = templates.find((t) => t.id === selectedTemplateId);
    if (!selected) {
      setError("Select a template first.");
      return;
    }
    try {
      const parsed = JSON.parse(String(selected.schemaJson || "{}"));
      setSchemaText(normalizeSchemaJsonStringForTargeting(JSON.stringify(parsed, null, 2)));
      setNotice(`Template applied: ${selected.name}`);
    } catch {
      setError("Template schema is invalid.");
    }
  }

  function openPreviewInNewTab() {
    const preview = livePreviewRef.current;
    if (!preview) {
      setError("Preview is not ready yet.");
      return;
    }
    const content = preview.innerHTML;
    let widgetExtra = "";
    let paymentExtra = "";
    let seoHead = "";
    try {
      const parsed = SiteSchemaDocument.safeParse(JSON.parse(schemaText));
      if (parsed.success) {
        seoHead = buildPreviewHeadTagsHtml(parsed.data.metadata);
        widgetExtra = buildWidgetEmbedForIsolatedPreviewHtml(parsed.data);
        paymentExtra = buildPaymentEmbedForIsolatedPreviewHtml(parsed.data);
        const pay = parsed.data.metadata?.paymentIntegration;
        if (pay?.provider === "paypal") {
          const br = parsed.data.metadata?.builderRefinement as { deploymentTarget?: string } | undefined;
          const deployment_target = typeof br?.deploymentTarget === "string" ? br.deploymentTarget : "static";
          trackSiteBuilderEvent("site_builder_payment_integration_rendered", {
            workflow_stage: builderStage,
            deployment_target,
            provider: "paypal",
            mode: pay.mode,
            intent: pay.intent,
            placement: pay.placement,
          });
        }
      }
    } catch {
      /* ignore */
    }
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${seoHead || "<title>Site Builder Preview</title>"}
  <style>
    body{margin:0;background:#020617;color:#e2e8f0;font-family:Inter,system-ui,-apple-system,sans-serif;padding:24px}
    .preview-wrap{max-width:980px;margin:0 auto;background:#0f172a;border:1px solid #334155;border-radius:16px;padding:20px}
    a{color:#67e8f9}
    img,video{max-width:100%;height:auto}
    .site-builder-payment-wall{margin-top:16px;padding:14px 16px;border-radius:14px;border:1px solid rgba(148,163,184,0.28);background:rgba(15,23,42,0.92)}
    .site-builder-payment-wall .site-builder-payment-link.btn{display:inline-block;border-radius:9999px;padding:10px 16px;background:#0070ba;color:#fff;text-decoration:none;font-weight:700}
  </style>
</head>
<body><div class="preview-wrap">${content}</div>${paymentExtra}${widgetExtra}</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const previewUrl = URL.createObjectURL(blob);
    const win = window.open(previewUrl, "_blank");
    if (!win) {
      URL.revokeObjectURL(previewUrl);
      setError("Pop-up blocked. Please allow pop-ups for preview.");
      return;
    }
    window.setTimeout(() => URL.revokeObjectURL(previewUrl), 15000);
  }

  function selectedVersionOrEmpty() {
    return versionIdForActions || versions[0]?.id || "";
  }

  function getDefaultSchemaObject() {
    return {
      pages: [{ slug: "/", blocks: [] as any[] }],
      metadata: { title: "Web3 Site", description: "" },
    };
  }

  function commitSchemaText(nextSchemaText: string, opts?: { recordHistory?: boolean }) {
    const normalized = normalizeSchemaJsonStringForTargeting(nextSchemaText);
    const recordHistory = opts?.recordHistory ?? true;
    if (recordHistory && normalized !== schemaText) {
      setSchemaHistoryPast((prev) => [...prev.slice(-39), schemaText]);
      setSchemaHistoryFuture([]);
    }
    setSchemaText(normalized);
  }

  function undoSchemaChange() {
    setSchemaHistoryPast((prev) => {
      if (prev.length === 0) return prev;
      const prior = prev[prev.length - 1]!;
      setSchemaHistoryFuture((future) => [schemaText, ...future].slice(0, 40));
      setSchemaText(prior);
      return prev.slice(0, -1);
    });
  }

  function redoSchemaChange() {
    setSchemaHistoryFuture((prev) => {
      if (prev.length === 0) return prev;
      const [next, ...rest] = prev;
      if (next) {
        setSchemaHistoryPast((past) => [...past.slice(-39), schemaText]);
        setSchemaText(next);
      }
      return rest;
    });
  }

  function updateSchema(mutator: (draft: any) => void) {
    let next: any;
    try {
      next = JSON.parse(schemaText);
    } catch {
      next = getDefaultSchemaObject();
      setNotice("Schema JSON was invalid. Builder recovered with a valid schema.");
      setError(null);
    }
    if (!Array.isArray(next.pages)) next.pages = [];
    if (!next.pages[0]) next.pages[0] = { slug: "/", blocks: [] };
    if (!Array.isArray(next.pages[0].blocks)) next.pages[0].blocks = [];
    if (!next.metadata) next.metadata = { title: "Web3 Site" };
    mutator(next);
    commitSchemaText(JSON.stringify(next, null, 2));
  }

  function addBlock(type: string) {
    const lib = BLOCK_LIBRARY.find((item) => item.type === type);
    if (!lib) return;
    updateSchema((draft) => {
      draft.pages[0].blocks.push(structuredClone(lib.template));
    });
    const newIndex = firstPageBlocks.length;
    setSelectedBlockIndex(newIndex);
    setExpandedBlockListIndex(newIndex);
    setEditBlockPanelOpen(true);
    setNotice(`Added ${lib.label} block.`);
  }

  function addBlockObject(nextBlock: Record<string, unknown>, noticeLabel: string) {
    updateSchema((draft) => {
      draft.pages[0].blocks.push(nextBlock);
    });
    const newIndex = firstPageBlocks.length;
    setSelectedBlockIndex(newIndex);
    setExpandedBlockListIndex(newIndex);
    setEditBlockPanelOpen(true);
    setNotice(`${noticeLabel} added.`);
  }

  function dividerThicknessForVariant(variant: "thin" | "medium" | "thick"): number {
    return variant === "thin" ? 1 : variant === "thick" ? 4 : 2;
  }

  function seedDividerPopoutFromBlock(block?: any) {
    const variantRaw = String(block?.content?.variant || "medium");
    const variant: "thin" | "medium" | "thick" =
      variantRaw === "thin" || variantRaw === "thick" ? variantRaw : "medium";
    setPopoutDividerVariant(variant);
    setPopoutDividerThickness(Number(block?.content?.thickness || dividerThicknessForVariant(variant)));
    setPopoutDividerColor(String(block?.content?.color || "#334155"));
    setPopoutDividerOffsetY(Number(block?.content?.offsetY || 0));
  }

  function applyDividerPopoutToBlock(index: number, next: {
    variant: "thin" | "medium" | "thick";
    thickness: number;
    color: string;
    offsetY: number;
  }) {
    updateBlock(index, (block) => {
      block.content = block.content || {};
      block.content.variant = next.variant;
      block.content.thickness = next.thickness;
      block.content.color = next.color;
      block.content.offsetY = next.offsetY;
    });
  }

  function updateDividerPopout(next: Partial<{
    variant: "thin" | "medium" | "thick";
    thickness: number;
    color: string;
    offsetY: number;
  }>) {
    const merged = {
      variant: next.variant ?? popoutDividerVariant,
      thickness: next.thickness ?? popoutDividerThickness,
      color: next.color ?? popoutDividerColor,
      offsetY: next.offsetY ?? popoutDividerOffsetY,
    };
    setPopoutDividerVariant(merged.variant);
    setPopoutDividerThickness(merged.thickness);
    setPopoutDividerColor(merged.color);
    setPopoutDividerOffsetY(merged.offsetY);
    if (popoutDividerEditIndex !== null) {
      applyDividerPopoutToBlock(popoutDividerEditIndex, merged);
    }
  }

  function openDividerEditor(index: number) {
    const block = firstPageBlocks[index];
    seedDividerPopoutFromBlock(block);
    setPopoutEditIndex(index);
    setPopoutDividerEditIndex(index);
    openBlockPopout("divider", true, true);
  }

  function openBlockEditorFromList(index: number) {
    const block = firstPageBlocks[index];
    if (!block) return;
    setSelectedBlockIndex(index);
    setExpandedBlockListIndex(index);
    setEditBlockPanelOpen(true);
    const type = String(block?.type || "");
    if (type === "avatar") {
      setPopoutAvatarSrc(String(block?.src || ""));
      setPopoutAvatarFileName(block?.src ? "Current avatar" : "");
      setPopoutAvatarShape(String(block?.content?.shape || "circle"));
      const width = Number(block?.content?.width || 75);
      const height = Number(block?.content?.height || 75);
      setPopoutAvatarSize(`${width}x${height}`);
      setPopoutAvatarBorderWidth(Number(block?.content?.style?.borderWidth || 0));
      setPopoutAvatarBorderStyle(String(block?.content?.style?.borderStyle || "solid") === "dashed" ? "dashed" : "solid");
      setPopoutAvatarBorderColor(String(block?.content?.style?.borderColor || "#334155"));
      setPopoutEditIndex(index);
      openBlockPopout("avatar", false, true);
      return;
    }
    if (type === "link") {
      setPopoutLinkHref(String(block?.href || block?.content?.href || ""));
      setPopoutLinkLabel(String(block?.content?.label || ""));
      setPopoutEditIndex(index);
      openBlockPopout("link", false, true);
      return;
    }
    if (type === "paragraph") {
      setPopoutParagraphText(String(block?.content?.text || ""));
      setPopoutEditIndex(index);
      openBlockPopout("paragraph", false, true);
      return;
    }
    if (type === "heading") {
      setPopoutHeadingText(String(block?.content?.text || ""));
      setPopoutHeadingLevel(String(block?.content?.level || "h1"));
      setPopoutEditIndex(index);
      openBlockPopout("heading", false, true);
      return;
    }
    if (type === "image" || type === "header_image") {
      setPopoutImageSrc(String(block?.src || ""));
      setPopoutImageFileName(block?.src ? "Current image" : "");
      setPopoutImageAlt(String(block?.content?.alt || ""));
      setPopoutImageHref(String(block?.href || block?.content?.href || ""));
      setPopoutEditIndex(index);
      openBlockPopout("image", false, true);
      return;
    }
    if (type === "video") {
      setPopoutVideoSrc(String(block?.src || block?.content?.src || ""));
      setPopoutVideoFileName(block?.src ? "Current video" : "");
      setPopoutEditIndex(index);
      openBlockPopout("video", false, true);
      return;
    }
    if (type === "divider") {
      openDividerEditor(index);
      return;
    }
  }

  function openBlockPopout(type: BuilderPopoutType, preserveDividerConfig = false, preserveEditIndex = false) {
    setPopoutExiting(false);
    if (!preserveEditIndex) setPopoutEditIndex(null);
    if (type !== "divider") setPopoutDividerEditIndex(null);
    if (type === "divider" && !preserveDividerConfig) {
      setPopoutDividerVariant("medium");
      setPopoutDividerThickness(2);
      setPopoutDividerColor("#334155");
      setPopoutDividerOffsetY(0);
    }
    setActivePopout(type);
    setError(null);
  }

  function closeBlockPopout() {
    setPopoutExiting(true);
    window.setTimeout(() => {
      setActivePopout(null);
      setPopoutEditIndex(null);
      setPopoutDividerEditIndex(null);
      setPopoutExiting(false);
    }, 180);
  }

  function handleAddBlockClick(type: string) {
    if (
      type === "avatar" ||
      type === "link" ||
      type === "paragraph" ||
      type === "heading" ||
      type === "image" ||
      type === "divider" ||
      type === "video"
    ) {
      openBlockPopout(type);
      return;
    }
    addBlock(type);
  }

  function removeBlockAt(index: number) {
    updateSchema((draft) => {
      draft.pages[0].blocks.splice(index, 1);
    });
    setSelectedBlockIndex((prev) => Math.max(0, Math.min(prev, Math.max(0, firstPageBlocks.length - 2))));
    setExpandedBlockListIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  }

  function moveBlock(index: number, direction: -1 | 1) {
    updateSchema((draft) => {
      const blocks = draft.pages[0].blocks;
      const target = index + direction;
      if (target < 0 || target >= blocks.length) return;
      const current = blocks[index];
      blocks[index] = blocks[target];
      blocks[target] = current;
    });
  }

  function reorderBlock(fromIndex: number, insertionIndex: number) {
    updateSchema((draft) => {
      const blocks = draft.pages[0].blocks;
      if (!Array.isArray(blocks)) return;
      if (fromIndex < 0 || fromIndex >= blocks.length) return;
      if (insertionIndex < 0 || insertionIndex > blocks.length) return;
      const [moved] = blocks.splice(fromIndex, 1);
      const normalizedInsertionIndex =
        fromIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;
      blocks.splice(normalizedInsertionIndex, 0, moved);
      setSelectedBlockIndex(normalizedInsertionIndex);
    });
  }

  function updateBlockJson(index: number, nextJson: string) {
    try {
      const parsed = JSON.parse(nextJson);
      updateSchema((draft) => {
        draft.pages[0].blocks[index] = parsed;
      });
    } catch {
      // Keep editor permissive while user is typing invalid JSON.
    }
  }

  function updateBlock(index: number, updater: (block: any) => void) {
    updateSchema((draft) => {
      const current = draft.pages[0].blocks[index];
      if (!current) return;
      updater(current);
    });
  }

  function setBlockContentValue(index: number, key: string, value: unknown) {
    updateBlock(index, (block) => {
      block.content = block.content || {};
      block.content[key] = value;
    });
  }

  function setBlockStyleValue(index: number, key: string, value: unknown) {
    updateBlock(index, (block) => {
      block.content = block.content || {};
      block.content.style = block.content.style || {};
      block.content.style[key] = value;
    });
  }

  function upsertSocialLink(index: number, platformKey: string, href: string) {
    updateBlock(index, (block) => {
      block.content = block.content || {};
      const links = Array.isArray(block.content.links) ? [...block.content.links] : [];
      const existingIndex = links.findIndex((item: any) => String(item?.platform || "").toLowerCase() === platformKey);
      const clean = href.trim();
      if (!clean) {
        if (existingIndex >= 0) links.splice(existingIndex, 1);
      } else {
        const label = SOCIAL_PLATFORMS.find((s) => s.key === platformKey)?.label || platformKey;
        const nextItem = { label, platform: platformKey, href: clean };
        if (existingIndex >= 0) links[existingIndex] = nextItem;
        else links.push(nextItem);
      }
      block.content.links = links;
    });
  }

  function setBlockPlacement(index: number, align: "left" | "center" | "right") {
    updateBlock(index, (block) => {
      block.content = block.content || {};
      block.content.align = align;
      block.content.style = block.content.style || {};
      block.content.style.textAlign = align;
    });
  }

  function selectVisualSection(sectionId: string) {
    setRefineTargetSectionIds(normalizeRefineSectionIds([sectionId], 3));
  }

  function renameVisualSection(sectionId: string, label: string) {
    const next = mutateVisualSchema(schemaText, (doc) => {
      updateSectionById(doc, sectionId, (block) => {
        block.content.sectionLabel = label.trim();
      });
    });
    commitSchemaText(next);
  }

  function reorderVisualSection(sectionId: string, direction: -1 | 1) {
    const next = mutateVisualSchema(schemaText, (doc) => {
      const blocks = doc.pages?.[0]?.blocks ?? [];
      const index = blocks.findIndex((block, i) => {
        const sid = String(block?.content?.aiSectionId || "").trim() || `idx-${i}`;
        return sid === sectionId;
      });
      if (index < 0) return;
      const target = index + direction;
      if (target < 0 || target >= blocks.length) return;
      const current = blocks[index];
      blocks[index] = blocks[target];
      blocks[target] = current;
    });
    commitSchemaText(next);
  }

  function deleteVisualSection(sectionId: string) {
    const next = mutateVisualSchema(schemaText, (doc) => {
      const blocks = doc.pages?.[0]?.blocks ?? [];
      const index = blocks.findIndex((block, i) => {
        const sid = String(block?.content?.aiSectionId || "").trim() || `idx-${i}`;
        return sid === sectionId;
      });
      if (index >= 0) blocks.splice(index, 1);
    });
    commitSchemaText(next);
    setRefineTargetSectionIds((prev) => prev.filter((id) => id !== sectionId));
  }

  function duplicateVisualSection(sectionId: string) {
    const next = mutateVisualSchema(schemaText, (doc) => {
      const blocks = doc.pages?.[0]?.blocks ?? [];
      const index = blocks.findIndex((block, i) => {
        const sid = String(block?.content?.aiSectionId || "").trim() || `idx-${i}`;
        return sid === sectionId;
      });
      if (index < 0) return;
      const clone = structuredClone(blocks[index]);
      if (!clone.content || typeof clone.content !== "object") clone.content = {};
      clone.content.aiSectionId = `dup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      clone.content.sectionLabel = `${String(clone.content.sectionLabel || "Copy")} copy`;
      blocks.splice(index + 1, 0, clone);
    });
    commitSchemaText(next);
  }

  function toggleVisualSectionHidden(sectionId: string) {
    const next = mutateVisualSchema(schemaText, (doc) => {
      updateSectionById(doc, sectionId, (block) => {
        block.content.style = block.content.style || {};
        const hidden = String(block.content.style.display || "") === "none";
        block.content.style.display = hidden ? "block" : "none";
      });
    });
    commitSchemaText(next);
  }

  function updateSelectedVisualSectionProperty(mutator: (block: any) => void) {
    if (!selectedVisualSectionId) return;
    const next = mutateVisualSchema(schemaText, (doc) => {
      updateSectionById(doc, selectedVisualSectionId, (block) => {
        mutator(block);
      });
    });
    commitSchemaText(next);
  }

  function inlineEditSectionText(sectionId: string, previousText: string, nextText: string) {
    const next = mutateVisualSchema(schemaText, (doc) => {
      replaceFirstTextInSection(doc, sectionId, previousText, nextText);
    });
    commitSchemaText(next);
    setNotice("Inline text updated.");
    if (sectionId.toLowerCase().includes("hero")) setCoPilotSuggestion("Improve CTA?");
  }

  function reorderSectionFromCanvasDrop(targetSectionId: string, sourceSectionId: string, position: "before" | "after") {
    const next = mutateVisualSchema(schemaText, (doc) => {
      reorderSectionBySnapDrop(doc, sourceSectionId, targetSectionId, position);
    });
    commitSchemaText(next);
  }

  function duplicateSectionFromCanvas(sectionId: string) {
    const next = mutateVisualSchema(schemaText, (doc) => {
      duplicateSectionById(doc, sectionId);
    });
    commitSchemaText(next);
  }

  function deleteSectionFromCanvas(sectionId: string) {
    const next = mutateVisualSchema(schemaText, (doc) => {
      removeSectionById(doc, sectionId);
    });
    commitSchemaText(next);
    setRefineTargetSectionIds((prev) => prev.filter((id) => id !== sectionId));
  }

  function toggleCanvasSectionStyle(sectionId: string) {
    const next = mutateVisualSchema(schemaText, (doc) => {
      updateSectionById(doc, sectionId, (block) => {
        block.content.style = block.content.style || {};
        const current = String(block.content.style.backgroundColor || "").toLowerCase();
        block.content.style.backgroundColor = current === "#0f172a" ? "#111827" : "#0f172a";
      });
    });
    commitSchemaText(next);
  }

  function updateCanvasSectionSpacing(sectionId: string, updates: { padding?: number; margin?: number }) {
    const next = mutateVisualSchema(schemaText, (doc) => {
      updateSectionById(doc, sectionId, (block) => {
        block.content.style = block.content.style || {};
        if (typeof updates.padding === "number") block.content.style.padding = `${updates.padding}px`;
        if (typeof updates.margin === "number") block.content.style.margin = `${updates.margin}px`;
      });
    });
    commitSchemaText(next);
  }

  function addVisualLibrarySection(registryKey: string) {
    const item = VISUAL_COMPONENT_LIBRARY.find((entry) => entry.label === registryKey);
    if (!item) return;
    const nextBlock = createVisualLibraryBlock(item.templateKey, item.category.toLowerCase().replace(/\s+/g, "_"));
    const next = mutateVisualSchema(schemaText, (doc) => {
      const blocks = doc.pages?.[0]?.blocks ?? [];
      blocks.push(nextBlock);
      if (doc.pages?.[0]) doc.pages[0].blocks = blocks;
    });
    commitSchemaText(next);
    setNotice(`${item.label} section added.`);
    const suggestions = suggestMissingSections(next);
    setCoPilotSuggestion(suggestions[0] || "Add testimonials?");
  }

  function updateDevicePreviewNote(device: PreviewDevice, note: string) {
    setPreviewNotes((prev) => ({ ...prev, [device]: note }));
    const next = mutateVisualSchema(schemaText, (doc) => {
      doc.metadata = doc.metadata || {};
      doc.metadata.visualEditor = doc.metadata.visualEditor || {};
      doc.metadata.visualEditor.previewNotes = {
        ...(doc.metadata.visualEditor.previewNotes || {}),
        [device]: note,
      };
    });
    commitSchemaText(next);
  }

  function applyConversionGoal(goal: ConversionGoal) {
    setConversionGoal(goal);
    const next = mutateVisualSchema(schemaText, (doc) => {
      doc.metadata = doc.metadata || {};
      (doc.metadata as any).conversionGoal = goal;
    });
    commitSchemaText(next);
  }

  function fixConversionPath() {
    const fixed = autoFixConversionPath(schemaText);
    commitSchemaText(fixed.schemaText);
    setNotice(`Conversion path fixed — score ${fixed.audit.score}/100.`);
  }

  function applyCanvasStylePreset(sectionId: string, preset: SectionStylePreset) {
    const next = mutateVisualSchema(schemaText, (doc) => {
      applySectionStylePreset(doc, sectionId, preset);
      applyThemePresetTokens(doc, preset);
    });
    commitSchemaText(next);
    setNotice(`Applied ${preset} preset.`);
  }

  function fixCanvasSection(sectionId: string) {
    setRefineTargetSectionIds(normalizeRefineSectionIds([sectionId], 3));
    setCanvasEditorSectionId(sectionId);
    setNotice("Fix section opened in Refine editor.");
  }

  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function readPopoutImage(
    files: FileList | null,
    maxMb: number,
    onData: (dataUrl: string, fileName: string) => void
  ) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setError(`Image must be ${maxMb}MB or smaller.`);
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    onData(dataUrl, file.name);
    setError(null);
  }

  async function readPopoutVideo(
    files: FileList | null,
    maxMb: number,
    onData: (dataUrl: string, fileName: string) => void
  ) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setError(`Video must be ${maxMb}MB or smaller.`);
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    onData(dataUrl, file.name);
    setError(null);
  }

  function submitPopoutBlock() {
    if (!activePopout) return;
    if (activePopout === "avatar") {
      if (!popoutAvatarSrc) {
        setError("Please choose an avatar image.");
        return;
      }
      const [wRaw, hRaw] = popoutAvatarSize.split("x");
      const width = Number(wRaw || 75);
      const height = Number((hRaw || "75").replace("px", ""));
      const avatarBlock = {
        type: "avatar",
        src: popoutAvatarSrc,
        content: {
          alt: "Avatar",
          shape: popoutAvatarShape,
          style: {
            borderRadius: popoutAvatarShape === "circle" ? 9999 : popoutAvatarShape === "rounded" ? 16 : 0,
            borderWidth: popoutAvatarBorderWidth,
            borderStyle: popoutAvatarBorderStyle,
            borderColor: popoutAvatarBorderColor,
          },
          width,
          height,
        },
      };
      if (popoutEditIndex !== null) {
        updateBlock(popoutEditIndex, (block) => {
          Object.assign(block, avatarBlock);
        });
        setNotice("Avatar block updated.");
      } else {
        addBlockObject(avatarBlock, "Avatar block");
      }
      closeBlockPopout();
      return;
    }
    if (activePopout === "link") {
      if (!popoutLinkHref.trim() || !popoutLinkLabel.trim()) {
        setError("Destination URL and Name are required.");
        return;
      }
      const linkBlock = {
        type: "link",
        href: popoutLinkHref.trim(),
        content: { label: popoutLinkLabel.trim(), href: popoutLinkHref.trim() },
      };
      if (popoutEditIndex !== null) {
        updateBlock(popoutEditIndex, (block) => {
          Object.assign(block, linkBlock);
        });
        setNotice("Link block updated.");
      } else {
        addBlockObject(linkBlock, "Link block");
      }
      closeBlockPopout();
      return;
    }
    if (activePopout === "paragraph") {
      if (!popoutParagraphText.trim()) {
        setError("Paragraph text is required.");
        return;
      }
      const paragraphBlock = { type: "paragraph", content: { text: popoutParagraphText } };
      if (popoutEditIndex !== null) {
        updateBlock(popoutEditIndex, (block) => {
          Object.assign(block, paragraphBlock);
        });
        setNotice("Paragraph block updated.");
      } else {
        addBlockObject(paragraphBlock, "Paragraph block");
      }
      closeBlockPopout();
      return;
    }
    if (activePopout === "heading") {
      if (!popoutHeadingText.trim()) {
        setError("Heading text is required.");
        return;
      }
      const headingBlock = { type: "heading", content: { text: popoutHeadingText, level: popoutHeadingLevel } };
      if (popoutEditIndex !== null) {
        updateBlock(popoutEditIndex, (block) => {
          Object.assign(block, headingBlock);
        });
        setNotice("Heading block updated.");
      } else {
        addBlockObject(headingBlock, "Heading block");
      }
      closeBlockPopout();
      return;
    }
    if (activePopout === "image") {
      if (!popoutImageSrc) {
        setError("Please choose an image.");
        return;
      }
      const imageBlock = {
        type: "image",
        src: popoutImageSrc,
        href: popoutImageHref.trim() || undefined,
        content: { alt: popoutImageAlt.trim() || "Image" },
      };
      if (popoutEditIndex !== null) {
        updateBlock(popoutEditIndex, (block) => {
          block.src = imageBlock.src;
          block.href = imageBlock.href;
          block.content = imageBlock.content;
        });
        setNotice("Image block updated.");
      } else {
        addBlockObject(imageBlock, "Image block");
      }
      closeBlockPopout();
      return;
    }
    if (activePopout === "video") {
      if (!popoutVideoSrc) {
        setError("Please choose a video.");
        return;
      }
      const videoBlock = {
        type: "video",
        src: popoutVideoSrc,
      };
      if (popoutEditIndex !== null) {
        updateBlock(popoutEditIndex, (block) => {
          Object.assign(block, videoBlock);
        });
        setNotice("Video block updated.");
      } else {
        addBlockObject(videoBlock, "Video block");
      }
      closeBlockPopout();
      return;
    }
    if (activePopout === "divider") {
      const nextDivider = {
        variant: popoutDividerVariant,
        thickness: Math.max(1, Number(popoutDividerThickness || 1)),
        color: popoutDividerColor || "#334155",
        offsetY: Number(popoutDividerOffsetY || 0),
      };
      if (popoutDividerEditIndex !== null) {
        applyDividerPopoutToBlock(popoutDividerEditIndex, nextDivider);
        setNotice("Divider updated.");
      } else {
        addBlockObject(
          {
            type: "divider",
            content: {
              variant: nextDivider.variant,
              thickness: nextDivider.thickness,
              color: nextDivider.color,
              offsetY: nextDivider.offsetY,
            },
          },
          "Divider block"
        );
      }
      closeBlockPopout();
    }
  }

  async function handleBlockFileUpload(index: number, field: "src" | "href", files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    updateBlock(index, (block) => {
      block[field] = dataUrl;
    });
  }

  async function handleBackgroundMediaUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (backgroundMediaType === "image" && !file.type.startsWith("image/")) {
      setError("Please choose an image file for image background.");
      return;
    }
    if (backgroundMediaType === "video" && !file.type.startsWith("video/")) {
      setError("Please choose a video file for video background.");
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setError("Background media must be 40MB or smaller.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setBackgroundMediaUrl(dataUrl);
    setError(null);
    setNotice(`Background ${backgroundMediaType} uploaded: ${file.name}`);
  }

  function applyCustomizationToSchema() {
    updateSchema((draft) => {
      draft.metadata = draft.metadata || {};
      draft.metadata.removeDefaultCss = removeDefaultCss;
      draft.metadata.theme = {
        ...(draft.metadata.theme || {}),
        name: themeName,
        backgroundMode,
        gradientStart,
        gradientEnd,
        customGradient: customGradient || undefined,
        backgroundColor,
        mediaUrl: backgroundMediaUrl || undefined,
        mediaType: backgroundMediaType,
      };
      draft.metadata.clientId = clientId.trim() || undefined;
      draft.metadata.workspaceId =
        workspaceLinkMode === "linked"
          ? linkedWorkspaceId.trim() || selectedSite?.workspaceId?.trim() || undefined
          : undefined;
      draft.metadata.web3Domain = {
        provider: web3DomainProvider || "Freename",
        domain: web3DomainName || undefined,
        parked: web3DomainParked,
        notes: web3DomainNotes || undefined,
      };
      draft.metadata.advanced = {
        customCss: customCssText || undefined,
        customJs: customJsText || undefined,
      };
    });
    setNotice("Customization settings applied to schema.");
  }

  useEffect(() => {
    if (!parsedSchema?.metadata) return;
    const metadata = parsedSchema.metadata;
    const theme = metadata.theme || {};
    setRemoveDefaultCss(Boolean(metadata.removeDefaultCss));
    if (typeof theme.name === "string") setThemeName(theme.name);
    if (typeof theme.backgroundMode === "string" && theme.backgroundMode.length) {
      setBackgroundMode(theme.backgroundMode);
    }
    if (typeof theme.gradientStart === "string") setGradientStart(theme.gradientStart);
    if (typeof theme.gradientEnd === "string") setGradientEnd(theme.gradientEnd);
    if (typeof theme.customGradient === "string") setCustomGradient(theme.customGradient);
    if (typeof theme.backgroundColor === "string") setBackgroundColor(theme.backgroundColor);
    if (typeof theme.mediaUrl === "string") setBackgroundMediaUrl(theme.mediaUrl);
    if (theme.mediaType === "image" || theme.mediaType === "video") setBackgroundMediaType(theme.mediaType);
    if (typeof metadata.clientId === "string") setClientId(metadata.clientId);
    if (typeof metadata.workspaceId === "string" && metadata.workspaceId.trim()) {
      setLinkedWorkspaceId(metadata.workspaceId.trim());
      setWorkspaceLinkMode("linked");
    }
    if (typeof metadata.web3Domain?.provider === "string") setWeb3DomainProvider(metadata.web3Domain.provider);
    if (typeof metadata.web3Domain?.domain === "string") setWeb3DomainName(metadata.web3Domain.domain);
    if (typeof metadata.web3Domain?.parked === "boolean") setWeb3DomainParked(metadata.web3Domain.parked);
    if (typeof metadata.web3Domain?.notes === "string") setWeb3DomainNotes(metadata.web3Domain.notes);
    if (typeof metadata.advanced?.customCss === "string") setCustomCssText(metadata.advanced.customCss);
    if (typeof metadata.advanced?.customJs === "string") setCustomJsText(metadata.advanced.customJs);
  }, [parsedSchema]);

  useEffect(() => {
    if (!selectedSiteId) return;
    const ws = selectedSite?.workspaceId?.trim();
    setLinkedWorkspaceId(ws || "");
  }, [selectedSiteId, selectedSite?.workspaceId]);

  useEffect(() => {
    if (backgroundMode !== "custom_media") return;
    if (!backgroundMediaInputRef.current) return;
    backgroundMediaInputRef.current.click();
  }, [backgroundMediaType, backgroundMode]);

  useEffect(() => {
    if (!activePopout) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeBlockPopout();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePopout]);

  async function copyMintCallPayload() {
    if (!mintPrepared?.mintIntent) return;
    const payload = {
      contract: mintPrepared.mintIntent.contract,
      functionName: mintPrepared.mintIntent.functionName,
      args: mintPrepared.mintIntent.args,
      chainId: mintPrepared.mintIntent.chainId,
      tokenUri: mintPrepared.tokenUri,
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Mint call payload copied to clipboard.");
      setError(null);
    } catch {
      setError("Could not copy to clipboard. Copy from the payload panel instead.");
    }
  }

  const pageGradient =
    "bg-slate-950 bg-[radial-gradient(ellipse_100%_60%_at_50%_-15%,rgba(99,102,241,0.09),transparent_50%)] bg-[radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(45,212,191,0.05),transparent_45%)]";
  const cardClass =
    "rounded-2xl border border-white/[0.07] bg-slate-900/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-md";
  const tileClass = "rounded-xl border border-white/[0.05] bg-slate-950/35 backdrop-blur-sm";
  const smallTileClass = "rounded-lg border border-white/[0.05] bg-slate-950/45";

  const previewViewportStyle: CSSProperties | undefined =
    previewDevice === "desktop"
      ? undefined
      : {
          width: previewDevice === "tablet" ? 820 : 390,
          maxWidth: "100%",
        };

  useEffect(() => {
    setAgentAttachWizardOpen(false);
    setLayoutGenComplete(false);
    setMobilePreviewOk(false);
    if (!selectedSiteId) {
      setPostLayoutAgentSkipped(false);
      return;
    }
    try {
      setPostLayoutAgentSkipped(sessionStorage.getItem(`site-builder-agent-skip:${selectedSiteId}`) === "1");
      setMobilePreviewOk(sessionStorage.getItem(`site-builder-publish-mobile-ok:${selectedSiteId}`) === "1");
    } catch {
      setPostLayoutAgentSkipped(false);
      setMobilePreviewOk(false);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    if (versions.length > 0) setLayoutGenComplete(true);
  }, [versions.length]);

  const fullBuildClientGate = useMemo<FullBuildClientGate>(
    () => ({
      buildForClient,
      revenueOsClientId: hubClientPick.trim() || selectedSite?.clientId?.trim() || "",
    }),
    [buildForClient, hubClientPick, selectedSite?.clientId],
  );

  const clientBadgeLabel = useMemo(() => {
    const cid = selectedSite?.clientId?.trim();
    if (!cid) return null;
    const row = hubClients.find((c) => c.id === cid);
    return row?.name ?? `${cid.slice(0, 8)}…`;
  }, [hubClients, selectedSite?.clientId]);

  const publishChecklist = useMemo(
    () =>
      computePublishChecklist({
        buildForClient,
        siteClientId: hubClientPick.trim() || selectedSite?.clientId,
        parsedSchema,
        agencyBindings: agencyWidgetBindings,
        postLayoutAgentSkipped,
        portalInviteBypass,
        mobilePreviewOk,
        layoutGenComplete,
        versionsCount: versions.length,
      }),
    [
      agencyWidgetBindings,
      buildForClient,
      hubClientPick,
      layoutGenComplete,
      mobilePreviewOk,
      parsedSchema,
      portalInviteBypass,
      postLayoutAgentSkipped,
      selectedSite?.clientId,
      versions.length,
    ],
  );

  const schemaSizeWarn = useMemo(() => schemaSizeWarning(schemaText), [schemaText]);

  const publishChecklistOk = publishChecklist.every((i) => i.done);

  const firstBlockingChecklistHint = useMemo(() => {
    const i = publishChecklist.find((x) => !x.done);
    return i?.hint ?? i?.label;
  }, [publishChecklist]);

  const markPortalInviteDeferred = useCallback(() => {
    if (!selectedSiteId) return;
    try {
      sessionStorage.setItem(`site-builder-portal-invite-skip:${selectedSiteId}`, "1");
    } catch {
      /* ignore */
    }
    setPortalInviteBypass(true);
    setNotice("Portal invite checklist skipped for this project in this browser — you can still send from Client Hub.");
  }, [selectedSiteId]);

  const publishMeta = parsedSchema?.metadata as Record<string, unknown> | undefined;
  const domainConnMeta = publishMeta?.domainConnection as { status?: string; domain?: string } | undefined;
  const seoTitleValue = typeof publishMeta?.title === "string" ? publishMeta.title : "";
  const seoDescValue = typeof publishMeta?.description === "string" ? publishMeta.description : "";
  const seoPrimaryKeyword = typeof publishMeta?.seoPrimaryKeyword === "string" ? publishMeta.seoPrimaryKeyword : "";
  const seoSecondaryKeywords = Array.isArray(publishMeta?.keywords)
    ? publishMeta.keywords.filter((k): k is string => typeof k === "string").slice(1, 8)
    : [];
  const seoWarnings = Array.isArray(publishMeta?.seoQualityWarnings)
    ? publishMeta.seoQualityWarnings.filter((w): w is string => typeof w === "string")
    : [];

  const seoDrawerFiles = useMemo(() => {
    const out: Array<{ id: string; label: string; content: string; languageHint?: string }> = [
      { id: "schema.json", label: "schema.json", content: schemaText, languageHint: "json" },
      {
        id: "metadata.json",
        label: "metadata.json",
        content: JSON.stringify(parsedSchema?.metadata ?? {}, null, 2),
        languageHint: "json",
      },
    ];
    const blocks = parsedSchema?.pages?.[0]?.blocks ?? [];
    for (let i = 0; i < Math.min(6, blocks.length); i++) {
      out.push({
        id: `home-block-${i}.json`,
        label: `pages/home/block-${i}.json`,
        content: JSON.stringify(blocks[i], null, 2),
        languageHint: "json",
      });
    }
    return out;
  }, [parsedSchema?.metadata, parsedSchema?.pages, schemaText]);

  const seoScore = useMemo(() => {
    const primary = seoPrimaryKeyword.toLowerCase();
    const firstPage = parsedSchema?.pages?.[0];
    const blocks = firstPage?.blocks ?? [];
    const heroText = String((blocks.find((b) => b.type === "hero")?.content as { title?: string } | undefined)?.title || "");
    const firstParagraphText = String((blocks.find((b) => b.type === "paragraph")?.content as { text?: string } | undefined)?.text || "");
    const cta = String((blocks.find((b) => b.type === "call_to_action")?.content as { label?: string } | undefined)?.label || "");
    const hasStructured = Array.isArray(publishMeta?.structuredData) && publishMeta.structuredData.length > 0;
    const checks = [
      { ok: Boolean(primary && seoTitleValue.toLowerCase().includes(primary)), pts: 20, missing: "Keyword in title" },
      { ok: Boolean(primary && heroText.toLowerCase().includes(primary)), pts: 15, missing: "Keyword in H1" },
      { ok: Boolean(primary && seoDescValue.toLowerCase().includes(primary)), pts: 15, missing: "Keyword in description" },
      { ok: seoDescValue.length >= 140 && seoDescValue.length <= 160, pts: 10, missing: "Description length" },
      { ok: seoTitleValue.length >= 50 && seoTitleValue.length <= 60, pts: 10, missing: "Title length" },
      { ok: hasStructured, pts: 10, missing: "Schema present" },
      { ok: Boolean(primary && cta.toLowerCase().includes(primary.split(/\s+/)[0] || primary)), pts: 10, missing: "CTA relevance" },
      { ok: firstParagraphText.length >= 120, pts: 10, missing: "Content depth" },
    ];
    const score = checks.reduce((sum, c) => sum + (c.ok ? c.pts : 0), 0);
    return {
      score,
      missingItems: checks.filter((c) => !c.ok).map((c) => c.missing),
      suggestedKeywords: seoSecondaryKeywords.slice(0, 5),
    };
  }, [parsedSchema?.pages, publishMeta?.structuredData, seoDescValue, seoPrimaryKeyword, seoSecondaryKeywords, seoTitleValue]);

  const handleBuildForClientToggle = useCallback(
    (next: boolean) => {
      setBuildForClient(next);
      if (next && selectedSite?.clientId?.trim() && !hubClientPick.trim()) {
        const cid = selectedSite.clientId.trim();
        setHubClientPick(cid);
        setClientId(cid);
      }
    },
    [hubClientPick, selectedSite?.clientId],
  );

  const handleHubClientPick = useCallback(
    async (next: string) => {
      setHubClientPick(next);
      if (next.trim()) setClientId(next.trim());
      else if (selectedSite?.clientId?.trim()) setClientId(selectedSite.clientId.trim());
      else setClientId("");
      if (!selectedSiteId) return;
      try {
        await jsonFetch<{ site: SiteRow }>(`/api/site-builder/sites/${encodeURIComponent(selectedSiteId)}`, {
          method: "PATCH",
          body: JSON.stringify({ clientId: next.trim() || null }),
        });
        await loadSites(selectedSiteId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update site client");
      }
    },
    [selectedSite?.clientId, selectedSiteId],
  );

  const createRevenueOsHubClient = useCallback(
    async (rawName: string) => {
      const name = rawName.trim();
      if (!name) {
        setError("Enter a client name.");
        throw new Error("Enter a client name.");
      }
      setHubClientCreateBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/revenue-os/clients", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, status: "active" }),
        });
        const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!res.ok) {
          throw new Error(typeof j.error === "string" ? j.error : `Create client failed (${res.status})`);
        }
        const id = String(j.id || "").trim();
        if (!id) {
          throw new Error("Server did not return a client id.");
        }
        await loadHubClients();
        await handleHubClientPick(id);
        setNotice(`Client “${name}” created — it appears in Revenue OS Client Hub and is selected for this project.`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not create Revenue OS client";
        setError(msg);
        throw e instanceof Error ? e : new Error(msg);
      } finally {
        setHubClientCreateBusy(false);
      }
    },
    [handleHubClientPick, loadHubClients],
  );

  const dismissAgentAttachWizard = useCallback(() => {
    setAgentAttachWizardOpen(false);
    setPostLayoutAgentSkipped(true);
    if (selectedSiteId) {
      try {
        sessionStorage.setItem(`site-builder-agent-skip:${selectedSiteId}`, "1");
      } catch {
        /* ignore quota / private mode */
      }
    }
  }, [selectedSiteId]);

  const applySeoMetadata = useCallback(
    (patch: { title?: string; description?: string }) => {
      try {
        const doc = JSON.parse(schemaText) as Record<string, unknown>;
        doc.metadata =
          typeof doc.metadata === "object" && doc.metadata !== null && !Array.isArray(doc.metadata)
            ? { ...(doc.metadata as Record<string, unknown>) }
            : {};
        const meta = doc.metadata as Record<string, unknown>;
        if (patch.title !== undefined) meta.title = patch.title;
        if (patch.description !== undefined) meta.description = patch.description;
        setSchemaText(normalizeSchemaJsonStringForTargeting(JSON.stringify(doc, null, 2)));
      } catch {
        setError("Could not update SEO fields — fix schema JSON if it is invalid.");
      }
    },
    [schemaText],
  );

  const runSeoQuickAction = useCallback(
    async (focusPrompt: string) => {
      await withBusy(async () => {
        setError(null);
        const res = await fetch("/api/site-builder/builder-actions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            schemaJson: JSON.parse(schemaText),
            actions: [{ action: "apply_seo_enrichment", focusPrompt }],
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { schemaJson?: unknown; error?: string };
        if (!res.ok || !data.schemaJson) {
          throw new Error(data.error || `SEO update failed (${res.status})`);
        }
        setSchemaText(normalizeSchemaJsonStringForTargeting(JSON.stringify(data.schemaJson, null, 2)));
        setNotice("SEO enrichment applied.");
      });
    },
    [schemaText, withBusy],
  );

  const handlePreviewDeviceChange = useCallback(
    (d: PreviewDevice) => {
      setPreviewDevice(d);
      if (builderStage !== "publish" || !selectedSiteId) return;
      if (d === "mobile") {
        setMobilePreviewOk(true);
        try {
          sessionStorage.setItem(`site-builder-publish-mobile-ok:${selectedSiteId}`, "1");
        } catch {
          /* ignore */
        }
      }
    },
    [builderStage, selectedSiteId],
  );

  useEffect(() => {
    if (builderStage !== "publish" || !selectedSiteId) return;
    if (previewDevice !== "mobile") return;
    setMobilePreviewOk(true);
    try {
      sessionStorage.setItem(`site-builder-publish-mobile-ok:${selectedSiteId}`, "1");
    } catch {
      /* ignore */
    }
  }, [builderStage, previewDevice, selectedSiteId]);

  const handleWizardAttachAgent = useCallback(
    async (agentId: string) => {
      if (!selectedSiteId) {
        setError("Select a site project first.");
        return;
      }
      const vid = versionIdForActions.trim() || selectedSite?.currentVersionId?.trim() || "";
      const cid = (hubClientPick.trim() || selectedSite?.clientId?.trim() || clientId.trim() || "").trim();
      setAgentWizardBusy(true);
      setError(null);
      try {
        const data = await jsonFetch<{ widgetKey: string; schema?: Record<string, unknown> }>(
          `/api/site-builder/sites/${encodeURIComponent(selectedSiteId)}/agency-widget`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentId,
              providerStrategy: "agent" as const,
              applyToSchema: Boolean(vid),
              ...(vid ? { versionId: vid } : {}),
              ...(cid ? { clientId: cid } : {}),
            }),
          },
        );
        if (data.schema) {
          setSchemaText(normalizeSchemaJsonStringForTargeting(JSON.stringify(data.schema, null, 2)));
          setNotice("Agent attached — widget metadata merged into the current schema.");
        } else {
          setNotice("Agent bound — save a version, then use Advanced to merge the widget into JSON if needed.");
        }
        const d = await jsonFetch<{ bindings: typeof agencyWidgetBindings }>(
          `/api/site-builder/sites/${encodeURIComponent(selectedSiteId)}/agency-widget`,
        );
        setAgencyWidgetBindings(d.bindings ?? []);
        setAgencyWidgetAgentId(agentId);
        setScrollPreviewToTopTrigger((t) => t + 1);
        setAgentAttachWizardOpen(false);
        setPostLayoutAgentSkipped(false);
        aiPanelRef.current?.notifyClientLifecycle?.("post_agent_attach");
        if (selectedSiteId) {
          try {
            sessionStorage.removeItem(`site-builder-agent-skip:${selectedSiteId}`);
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Attach failed");
      } finally {
        setAgentWizardBusy(false);
      }
    },
    [
      clientId,
      hubClientPick,
      selectedSite?.clientId,
      selectedSite?.currentVersionId,
      selectedSiteId,
      versionIdForActions,
    ],
  );

  useEffect(() => {
    if (!agentAttachWizardOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const d = await jsonFetch<{ items: Array<{ id: string; name: string; status: string; workspaceId?: string | null }> }>(
          "/api/app/agents",
        );
        if (!cancelled) setAgencyAgents(d.items ?? []);
      } catch {
        if (!cancelled) setAgencyAgents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentAttachWizardOpen]);

  const canDeployOps = Boolean(selectedSiteId && versions.length > 0);

  /** Shared POST /versions body for sticky + Advanced save; analytics layered via runSiteBuilderTrackedAction. */
  async function saveSiteVersionForSiteId(siteId: string, schemaInput: unknown): Promise<{
    version: SiteVersionRow;
    schemaHash: string;
  }> {
    const data = await jsonFetch<{ version: SiteVersionRow; schemaHash: string }>(
      `/api/site-builder/sites/${encodeURIComponent(siteId)}/versions`,
      {
        method: "POST",
        body: JSON.stringify({
          schemaJson: schemaInput,
          setCurrent: true,
        }),
      },
    );
    return data;
  }

  async function saveCurrentSiteVersionToServer(): Promise<{
    version: number;
    schemaHash: string;
    styleMode?: string;
  }> {
    if (!selectedSiteId) {
      throw new Error("Select or create a site project first (Advanced → Project).");
    }
    let parsedSchema: unknown = {};
    try {
      parsedSchema = JSON.parse(schemaText);
    } catch {
      throw new Error("Schema JSON is invalid");
    }
    if (workspaceLinkMode === "linked") {
      const hasWorkspace = linkedWorkspaceId.trim() || selectedSite?.workspaceId?.trim();
      if (!hasWorkspace && !clientId.trim()) {
        throw new Error("Select a workspace or enter Client ID when linking to a client record.");
      }
    }
    const schemaWithIds = parsedSchema as Record<string, unknown>;
    schemaWithIds.metadata = (schemaWithIds.metadata as object) || {};
    const meta = schemaWithIds.metadata as Record<string, unknown>;
    meta.workspaceId =
      workspaceLinkMode === "linked" ? linkedWorkspaceId.trim() || selectedSite?.workspaceId?.trim() || undefined : undefined;
    meta.clientId = clientId.trim() || undefined;
    const data = await saveSiteVersionForSiteId(selectedSiteId, schemaWithIds);
    await loadVersions(selectedSiteId);
    await loadSites(selectedSiteId);
    setVersionIdForActions(data.version.id);
    setNotice(`Saved version v${data.version.version} (${data.schemaHash.slice(0, 12)}...)`);
    let styleMode: string | undefined;
    try {
      const doc = JSON.parse(schemaText) as { metadata?: { theme?: { styleMode?: string } } };
      const sm = doc?.metadata?.theme?.styleMode;
      if (typeof sm === "string") styleMode = sm;
    } catch {
      /* ignore */
    }
    return { version: data.version.version, schemaHash: data.schemaHash, styleMode };
  }

  async function saveSiteVersionWithAnalytics(source: "sticky_bar" | "advanced_panel") {
    return runSiteBuilderTrackedAction({
      successEvent: "site_builder_version_save_completed",
      failureEvent: "site_builder_version_save_failed",
      baseProps: { workflow_stage: builderStage, source },
      action: saveCurrentSiteVersionToServer,
      mapSuccessProps: (r) => ({
        version: r.version,
        schema_hash_prefix: r.schemaHash.slice(0, 12),
        ...(r.styleMode ? { style_mode: r.styleMode } : {}),
      }),
    });
  }

  async function persistVersionFromSticky() {
    if (!selectedSiteId) {
      setError("Select or create a site project first (Advanced → Project).");
      return;
    }
    await withBusy(async () => {
      await saveSiteVersionWithAnalytics("sticky_bar");
    });
  }

  function openAdvancedPanel(source: string) {
    trackSiteBuilderEvent("site_builder_advanced_opened", { source, workflow_stage: builderStage });
    setAdvancedOpen(true);
  }

  const assistantStatusLabel: "Building" | "Editing" | "Ready" | "Needs input" =
    busy ? "Building" : error ? "Needs input" : builderStage === "refine" ? "Editing" : "Ready";

  return (
    <div className={`min-h-screen pb-28 text-slate-100 ${pageGradient}`}>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <SiteBuilderHeader
          selectedSiteName={selectedSite?.name ?? null}
          currentVersionLabel={currentVersion ? `v${currentVersion.version}` : null}
          lastIpfsShort={lastDeployIpfsCid || "not deployed"}
          onOpenAdvanced={() => openAdvancedPanel("header")}
          clientBadgeLabel={clientBadgeLabel}
        />

        {maaniaImportBanner ? (
          <div className="mb-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
            Started from your MAANIA intake—review the preview, adjust anything, then publish when it’s right.
          </div>
        ) : null}
        {notice ? <div className="mb-4 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">{notice}</div> : null}
        {error ? <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

        <SiteBuilderWorkspaceLayout
          preview={
            <SiteBuilderPreviewCanvas
              fileDrawerToggle={
                <button
                  type="button"
                  onClick={() => setFileDrawerOpen((v) => !v)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-600"
                >
                  Files / Code
                </button>
              }
            >
              <SiteBuilderLivePreview
                variant="hero"
                isLoading={busy && !sectionRegenVisualMask}
                scrollPreviewToTopTrigger={scrollPreviewToTopTrigger}
                workflowStage={builderStage}
                livePreviewRef={livePreviewRef}
                firstPageBlocks={firstPageBlocks}
                previewDevice={previewDevice}
                onPreviewDeviceChange={handlePreviewDeviceChange}
                previewViewportStyle={previewViewportStyle}
                backgroundMode={backgroundMode}
                gradientStart={gradientStart}
                gradientEnd={gradientEnd}
                customGradient={customGradient}
                backgroundColor={backgroundColor}
                backgroundMediaUrl={backgroundMediaUrl}
                backgroundMediaType={backgroundMediaType}
                gradientStyle={previewCinematic?.gradientStyle}
                depthStyle={previewCinematic?.depthStyle}
                motionHint={previewCinematic?.motionHint}
                buttonStyle={previewCinematic?.buttonStyle}
                visualMetaBoost={previewVisualBoost}
                onOpenPreviewTab={openPreviewInNewTab}
                canvasEdit={refineCanvasEdit}
              />
            </SiteBuilderPreviewCanvas>
          }
          fileDrawer={
            <SiteBuilderFileDrawer
              open={fileDrawerOpen}
              files={seoDrawerFiles}
              activeFileId={activeDrawerFileId}
              onSelectFile={setActiveDrawerFileId}
              onClose={() => setFileDrawerOpen(false)}
            />
          }
          assistant={
            <SiteBuilderAssistantPanel
              statusLabel={assistantStatusLabel}
              stageNav={<SiteBuilderStageNav stage={builderStage} onStageChange={setBuilderStage} />}
              seoAudit={{
                title: seoTitleValue,
                description: seoDescValue,
                primaryKeyword: seoPrimaryKeyword,
                secondaryKeywords: seoSecondaryKeywords,
                h1Status: (seoWarnings.find((w) => /H1/i.test(w)) ? "Needs fix" : "Good"),
                structuredDataStatus:
                  Array.isArray(publishMeta?.structuredData) && publishMeta.structuredData.length > 0 ? "Present" : "Missing",
                imageAltStatus: firstPageBlocks.some((b) => b.type === "image" || b.type === "image_grid") ? "Present" : "No image blocks",
                localSeoStatus: typeof publishMeta?.localSeoStatus === "string" ? publishMeta.localSeoStatus : "Auto-detected",
                warnings: seoWarnings,
                score: seoScore,
                onGenerateSeo: () => void runSeoQuickAction("generate SEO metadata and page signals"),
                onImproveTitle: () => void runSeoQuickAction("improve SEO title quality and keyword targeting"),
                onAddStructuredData: () => void runSeoQuickAction("add and improve structured data"),
                onOptimizeLocal: () => void runSeoQuickAction("optimize for local search"),
              }}
              aiPanel={
                <SiteBuilderAiPanel
                  ref={aiPanelRef}
                  workflowStage={builderStage}
                  suppressPrimaryGenerate
                  onPlanReadyGoReview={() => setBuilderStage("review")}
                  onImportBlueprintReady={() => setBuilderStage("refine")}
                  schemaText={schemaText}
                  onApplySchema={(json) => commitSchemaText(json)}
                  onAiEditCompleted={(payload) => {
                    if (
                      payload.changedSectionIds.length > 0 &&
                      (payload.scope === "section" || payload.scope === "light_page")
                    ) {
                      setCanvasPulseSectionIds(payload.changedSectionIds);
                      window.setTimeout(() => setCanvasPulseSectionIds([]), 3600);
                    } else {
                      setCanvasPulseSectionIds([]);
                      setScrollPreviewToTopTrigger((t) => t + 1);
                    }
                  }}
                  onNotice={setNotice}
                  onError={setError}
                  withBusy={withBusy}
                  withBusyRethrowing={withBusyRethrowing}
                  onSectionRegenerationVisualMask={setSectionRegenVisualMask}
                  refineTargetSectionIds={refineTargetSectionIds}
                  onRefineTargetSectionIdsChange={handleRefineTargetSectionIdsChange}
                  busy={busy}
                  builderSiteId={selectedSiteId || undefined}
                  builderVersionId={versionIdForActions || undefined}
                  onExecuteIntentSchemaConflict={refreshSchemaFromServerCurrentVersion}
                  fullBuildClientGate={fullBuildClientGate}
                  buildForClient={buildForClient}
                  onBuildForClientChange={handleBuildForClientToggle}
                  hubClients={hubClients}
                  hubClientPick={hubClientPick}
                  onHubClientPickChange={(id) => void handleHubClientPick(id)}
                  hubClientCreateBusy={hubClientCreateBusy}
                  onCreateHubClient={createRevenueOsHubClient}
                  hasSelectedProject={Boolean(selectedSiteId)}
                  onOpenCodeDrawerRequest={() => setFileDrawerOpen(true)}
                  handoffSiteClientId={hubClientPick.trim() || selectedSite?.clientId?.trim() || ""}
                  onVariantSelectionComplete={(payload) => {
                    setBuilderStage("refine");
                    setLayoutGenComplete(true);
                    if (payload.schemaHasWidget) {
                      setAgentAttachWizardOpen(false);
                      return;
                    }
                    if (selectedSiteId) {
                      try {
                        sessionStorage.removeItem(`site-builder-agent-skip:${selectedSiteId}`);
                      } catch {
                        /* ignore */
                      }
                    }
                    setPostLayoutAgentSkipped(false);
                    setAgentAttachWizardOpen(true);
                  }}
                />
              }
            />
          }
        />
        <section className={`${cardClass} mt-5 p-5`}>
          <div className="mb-3 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-emerald-100">
                Conversion Score: <span className="font-semibold">{conversionAudit.score}/100</span>
              </div>
              <button
                type="button"
                onClick={fixConversionPath}
                className="rounded border border-emerald-400/50 bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
              >
                Fix conversion path
              </button>
            </div>
            <div className="mt-2 grid gap-2 text-[11px] text-emerald-100/90 md:grid-cols-2">
              <div>
                <div className="mb-1 font-medium">CTA checklist</div>
                <ul className="space-y-0.5 text-emerald-100/80">
                  {conversionAudit.issues.length === 0 ? <li>All key conversion checks passed.</li> : null}
                  {conversionAudit.issues.map((issue) => (
                    <li key={issue}>- {issue}</li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="mb-1 block font-medium">Conversion goal</label>
                <select
                  value={conversionGoal}
                  onChange={(e) => applyConversionGoal(e.target.value as ConversionGoal)}
                  className="w-full rounded border border-emerald-400/40 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                >
                  <option value="lead_capture">lead_capture</option>
                  <option value="booking">booking</option>
                  <option value="consultation">consultation</option>
                  <option value="purchase">purchase</option>
                  <option value="newsletter">newsletter</option>
                  <option value="call_request">call_request</option>
                </select>
                <div className="mt-2 text-emerald-100/75">
                  {conversionAudit.recommendedActions[0] || "Conversion path is on track."}
                </div>
              </div>
            </div>
          </div>
          {coPilotSuggestion ? (
            <div className="mb-3 rounded border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
              AI Co-Pilot: {coPilotSuggestion}
            </div>
          ) : null}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Visual editor</p>
              <h2 className="text-base font-semibold text-slate-100">Layers, components, and properties</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={undoSchemaChange}
                disabled={schemaHistoryPast.length === 0}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-40"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={redoSchemaChange}
                disabled={schemaHistoryFuture.length === 0}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-40"
              >
                Redo
              </button>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className={`${tileClass} p-3`}>
              <div className="text-xs font-semibold text-slate-200">Layer manager</div>
              <p className="mt-1 text-[11px] text-slate-500">Page `/` sections</p>
              <div className="mt-2 space-y-2">
                {visualSections.map((section) => (
                  <div
                    key={section.id}
                    className={`rounded border p-2 ${selectedVisualSectionId === section.id ? "border-cyan-500/70 bg-cyan-500/10" : "border-slate-800 bg-slate-950"}`}
                  >
                    <button
                      type="button"
                      className="w-full truncate text-left text-xs font-medium text-slate-100"
                      onClick={() => selectVisualSection(section.id)}
                    >
                      {section.label}
                    </button>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {sectionCritiqueScoreById[section.id] >= 70 ? "strong" : "needs improvement"} · {Math.round(sectionCritiqueScoreById[section.id] || 0)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button type="button" onClick={() => reorderVisualSection(section.id, -1)} className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px]">Up</button>
                      <button type="button" onClick={() => reorderVisualSection(section.id, 1)} className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px]">Down</button>
                      <button type="button" onClick={() => duplicateVisualSection(section.id)} className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px]">Duplicate</button>
                      <button type="button" onClick={() => toggleVisualSectionHidden(section.id)} className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px]">{section.hidden ? "Show" : "Hide"}</button>
                      <button type="button" onClick={() => deleteVisualSection(section.id)} className="rounded border border-red-700/60 px-1.5 py-0.5 text-[10px] text-red-300">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={`${tileClass} p-3`}>
              <div className="text-xs font-semibold text-slate-200">Component library</div>
              <p className="mt-1 text-[11px] text-slate-500">Add section by category</p>
              <div className="mt-2 rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-300">
                Smart suggestions: {suggestMissingSections(schemaText).join(" ") || "Layout is balanced."}
              </div>
              <div className="mt-2 space-y-2">
                {VISUAL_COMPONENT_LIBRARY.map((item) => (
                  <button
                    key={`${item.category}-${item.label}`}
                    type="button"
                    onClick={() => addVisualLibrarySection(item.label)}
                    className="flex w-full items-center justify-between rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-left text-xs hover:border-cyan-500/50"
                  >
                    <span className="text-slate-200">{item.label}</span>
                    <span className="text-[10px] text-slate-500">{item.category}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className={`${tileClass} p-3`}>
              <div className="text-xs font-semibold text-slate-200">Properties</div>
              {!selectedVisualSection || !selectedVisualBlock ? (
                <p className="mt-2 text-xs text-slate-500">Select a section from the layer list or preview to edit.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  <input
                    value={selectedVisualSection.label}
                    onChange={(e) => renameVisualSection(selectedVisualSection.id, e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                    placeholder="Section label"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input type="color" value={String(selectedVisualBlock?.content?.style?.backgroundColor || "#0f172a")} onChange={(e) => updateSelectedVisualSectionProperty((b) => { b.content.style = b.content.style || {}; b.content.style.backgroundColor = e.target.value; })} />
                    <input type="color" value={String(selectedVisualBlock?.content?.style?.textColor || "#e2e8f0")} onChange={(e) => updateSelectedVisualSectionProperty((b) => { b.content.style = b.content.style || {}; b.content.style.textColor = e.target.value; })} />
                    <input type="color" value={String(selectedVisualBlock?.content?.visual?.accent || "#22d3ee")} onChange={(e) => updateSelectedVisualSectionProperty((b) => { b.content.visual = b.content.visual || {}; b.content.visual.accent = e.target.value; })} />
                  </div>
                  <input
                    value={String(selectedVisualBlock?.content?.style?.padding || "")}
                    onChange={(e) => updateSelectedVisualSectionProperty((b) => { b.content.style = b.content.style || {}; b.content.style.padding = e.target.value; })}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                    placeholder="Padding / spacing (e.g. 48px 24px)"
                  />
                  <select
                    value={String(selectedVisualBlock?.content?.align || "left")}
                    onChange={(e) => updateSelectedVisualSectionProperty((b) => { b.content.align = e.target.value; b.content.style = b.content.style || {}; b.content.style.textAlign = e.target.value; })}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                  <input
                    value={String(selectedVisualBlock?.content?.label || "")}
                    onChange={(e) => updateSelectedVisualSectionProperty((b) => { b.content.label = e.target.value; })}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                    placeholder="CTA label"
                  />
                  <input
                    value={String(selectedVisualBlock?.content?.href || "")}
                    onChange={(e) => updateSelectedVisualSectionProperty((b) => { b.content.href = e.target.value; })}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                    placeholder="CTA link"
                  />
                  <input
                    value={String(selectedVisualBlock?.content?.title || "")}
                    onChange={(e) => updateSelectedVisualSectionProperty((b) => { b.content.title = e.target.value; })}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                    placeholder="Section title"
                  />
                  <textarea
                    value={String(selectedVisualBlock?.content?.body || selectedVisualBlock?.content?.subtitle || selectedVisualBlock?.content?.text || "")}
                    onChange={(e) => updateSelectedVisualSectionProperty((b) => { if (typeof b.content.body === "string") b.content.body = e.target.value; else if (typeof b.content.subtitle === "string") b.content.subtitle = e.target.value; else b.content.text = e.target.value; })}
                    className="min-h-[72px] w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                    placeholder="Section body text"
                  />
                  <div className="rounded border border-slate-800 bg-slate-950 p-2">
                    <div className="text-[11px] font-medium text-slate-300">Responsive (mobile overrides)</div>
                    <input
                      value={String(selectedVisualBlock?.content?.responsive?.mobile?.padding || "")}
                      onChange={(e) => updateSelectedVisualSectionProperty((b) => { b.content.responsive = b.content.responsive || {}; b.content.responsive.mobile = b.content.responsive.mobile || {}; b.content.responsive.mobile.padding = e.target.value; })}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                      placeholder="Mobile padding"
                    />
                    <select
                      value={String(selectedVisualBlock?.content?.responsive?.mobile?.textAlign || "left")}
                      onChange={(e) => updateSelectedVisualSectionProperty((b) => { b.content.responsive = b.content.responsive || {}; b.content.responsive.mobile = b.content.responsive.mobile || {}; b.content.responsive.mobile.textAlign = e.target.value; })}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                    >
                      <option value="left">Mobile left</option>
                      <option value="center">Mobile center</option>
                      <option value="right">Mobile right</option>
                    </select>
                    <label className="mt-1 inline-flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedVisualBlock?.content?.responsive?.mobile?.hidden)}
                        onChange={(e) => updateSelectedVisualSectionProperty((b) => { b.content.responsive = b.content.responsive || {}; b.content.responsive.mobile = b.content.responsive.mobile || {}; b.content.responsive.mobile.hidden = e.target.checked; })}
                      />
                      Hide on mobile
                    </label>
                  </div>
                </div>
              )}
              <div className="mt-3 rounded border border-slate-800 bg-slate-950 p-2">
                <div className="text-[11px] font-medium text-slate-300">Preview note ({previewDevice})</div>
                <textarea
                  value={previewNotes[previewDevice]}
                  onChange={(e) => updateDevicePreviewNote(previewDevice, e.target.value)}
                  placeholder="Optional review note for this device"
                  className="mt-1 min-h-[56px] w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                />
              </div>
            </div>
          </div>
        </section>
        {builderStage === "publish" ? (
              <section className={`${cardClass} mt-5 p-5`}>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Publish</p>
                <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-100">Finalize &amp; deploy</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  You’re choosing which version goes live next. Deploy always uses a{" "}
                  <span className="font-medium text-slate-300">saved server version</span> — the live preview alone is
                  not published until you save.
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-400/80" aria-hidden />
                    <span>
                      <span className="font-medium text-slate-300">Save version</span> from the bar below (Edit → Ship)
                      or Advanced → Versions — required before IPFS deploy.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-400/80" aria-hidden />
                    Use the preview <span className="font-medium text-slate-300">Phone</span> toggle once so mobile
                    layout is reviewed (tracked for this project).
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-400/80" aria-hidden />
                    Deploy to IPFS and connect your domain (Advanced).
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" aria-hidden />
                    Optional: mint site ownership (Advanced).
                  </li>
                </ul>
                {(hubClientPick.trim() || selectedSite?.clientId?.trim()) && buildForClient ? (
                  <div className="mt-4 rounded-xl border border-white/[0.06] bg-slate-950/40 p-3 text-xs leading-relaxed text-slate-400">
                    <p className="font-medium text-slate-200">Client portal ship checklist</p>
                    <p className="mt-1">
                      If you are handling the portal invite outside the builder, you can clear the “invite sent” row
                      without sending email from here.
                    </p>
                    <button
                      type="button"
                      onClick={markPortalInviteDeferred}
                      disabled={portalInviteBypass}
                      className="mt-2 rounded-lg border border-slate-600 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-orange-400/50 disabled:opacity-40"
                    >
                      {portalInviteBypass ? "Invite step skipped (session)" : "Skip portal invite step for now"}
                    </button>
                  </div>
                ) : null}
                <div
                  className="mt-4 rounded-xl border border-white/[0.06] bg-slate-950/50 p-3"
                  role="region"
                  aria-label="SEO metadata for publish"
                >
                  <p className="text-xs font-semibold text-slate-200">SEO basics</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Written to <span className="font-mono text-slate-400">metadata.title</span> and{" "}
                    <span className="font-mono text-slate-400">metadata.description</span> (export + static HTML head).
                    Aim for at least three characters each — checklist uses these values.
                  </p>
                  <label className="mt-3 block text-[11px] font-medium text-slate-400" htmlFor="sb-publish-seo-title">
                    Site title
                  </label>
                  <input
                    id="sb-publish-seo-title"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    value={seoTitleValue}
                    onChange={(e) => applySeoMetadata({ title: e.target.value })}
                    maxLength={200}
                    autoComplete="off"
                  />
                  <label
                    className="mt-3 block text-[11px] font-medium text-slate-400"
                    htmlFor="sb-publish-seo-description"
                  >
                    Meta description
                  </label>
                  <textarea
                    id="sb-publish-seo-description"
                    rows={3}
                    className="mt-1 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    value={seoDescValue}
                    onChange={(e) => applySeoMetadata({ description: e.target.value })}
                    maxLength={500}
                  />
                </div>
                {schemaSizeWarn.warn ? (
                  <p
                    className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-[11px] leading-relaxed text-amber-100/90"
                    role="status"
                  >
                    Large schema payload (~{Math.round(schemaSizeWarn.bytes / 1024)} KB) — export and deploy may feel
                    slower. Trim unused assets or pages if you can.
                  </p>
                ) : null}
                <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
                  Accessibility: we shorten sticky-bar motion when your OS requests reduced motion. Prefer keyboard? Tab
                  to the checklist row below, then use the primary action.
                </p>
                <button
                  type="button"
                  disabled={!canDeployOps || !publishChecklistOk}
                  title={
                    !canDeployOps
                      ? "Save a version first — deploy reads a saved snapshot, not preview-only state."
                      : !publishChecklistOk
                        ? firstBlockingChecklistHint
                        : undefined
                  }
                  onClick={() => openAdvancedPanel("publish_column")}
                  aria-label="Open Advanced — full configuration, deploy, and mint"
                  className="mt-5 w-full rounded-xl border border-teal-500/25 bg-teal-500/5 px-4 py-2.5 text-sm font-medium text-teal-100/90 transition-colors hover:border-teal-400/40 hover:bg-teal-500/10 disabled:pointer-events-none disabled:opacity-40"
                >
                  Open Advanced
                </button>
              </section>
            ) : null}

        <details
          className="group mt-12 rounded-2xl border border-dashed border-white/[0.08] bg-slate-900/25 open:border-white/[0.12] open:bg-slate-900/35"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer list-none px-4 py-4 text-left transition-colors hover:bg-white/[0.02] sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="block text-sm font-medium text-slate-200">Advanced · Full control</span>
            <span className="mt-0.5 block text-xs font-normal leading-relaxed text-slate-500">
              Full control when you need it—deployment, domain, minting, and deep settings. Optional; the steps above are enough for most launches.
            </span>
          </summary>
          <div className="border-t border-white/[0.06] px-3 pb-8 pt-6 sm:px-5">
            <section className={`${cardClass} mb-6 p-4`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Your full workflow</div>
                  <div className="text-xs text-slate-400">Draft, save a version, deploy, connect a domain, mint—same trusted path, when you need it.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
                    Selected Site: <span className="font-mono text-slate-100">{selectedSite?.name || "none"}</span>
                  </span>
                  <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
                    Current Version: <span className="font-mono text-slate-100">{currentVersion ? `v${currentVersion.version}` : "none"}</span>
                  </span>
                  <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
                    Last IPFS: <span className="font-mono text-slate-100">{lastDeployIpfsCid || "not deployed"}</span>
                  </span>
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-5">
                {workflowSteps.map((step) => (
                  <div
                    key={step.key}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      step.done
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                        : "border-slate-700 bg-slate-950/60 text-slate-300"
                    }`}
                  >
                    <div className="font-semibold">{step.label}</div>
                    <div className="mt-1">{step.done ? "Completed" : "Pending"}</div>
                  </div>
                ))}
              </div>
            </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className={`${cardClass} p-5`}>
            <h2 className="text-lg font-semibold">Step 1: Create Site Project</h2>
            <div className="mt-3 grid gap-2">
              <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Site name" />
              <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={createSlug} onChange={(e) => setCreateSlug(e.target.value)} placeholder="Slug (optional)" />
              <input className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200" value={createTrustId} onChange={(e) => setCreateTrustId(e.target.value)} placeholder="Trust ID (auto from active session)" />
              <input className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200" value={createWorkspaceId} onChange={(e) => setCreateWorkspaceId(e.target.value)} placeholder="Workspace ID (auto from active session)" />
              <input className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200" value={createOwnerWallet || connectedWallet} readOnly placeholder="Connect wallet to auto-fill owner" />
              {activeTrustContext ? (
                <div className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200">
                  Session context loaded: Trust <span className="font-mono">{activeTrustContext.trustId || "—"}</span>, Workspace <span className="font-mono">{activeTrustContext.workspaceId || "—"}</span>, Client <span className="font-mono">{activeTrustContext.clientId || "—"}</span>
                </div>
              ) : null}
              <button
                disabled={busy || !createName.trim() || (buildForClient && !hubClientPick.trim())}
                onClick={() =>
                  withBusy(async () => {
                    const resolvedClient =
                      buildForClient && hubClientPick.trim()
                        ? hubClientPick.trim()
                        : clientId.trim() || undefined;
                    const handoff = await createSiteWithDraftHandoff({
                      schemaText,
                      createSite: () =>
                        jsonFetch<{ site: SiteRow }>("/api/site-builder/sites", {
                          method: "POST",
                          body: JSON.stringify({
                            name: createName.trim(),
                            slug: createSlug.trim() || undefined,
                            trustId: createTrustId.trim() || undefined,
                            workspaceId: createWorkspaceId.trim() || undefined,
                            ownerWallet: createOwnerWallet.trim() || undefined,
                            clientId: resolvedClient,
                          }),
                        }),
                      saveFirstVersion: async (siteId, parsedSchema) => {
                        const schemaWithIds = parsedSchema as Record<string, unknown>;
                        schemaWithIds.metadata = (schemaWithIds.metadata as object) || {};
                        const meta = schemaWithIds.metadata as Record<string, unknown>;
                        meta.workspaceId =
                          workspaceLinkMode === "linked"
                            ? linkedWorkspaceId.trim() || createWorkspaceId.trim() || undefined
                            : undefined;
                        meta.clientId = resolvedClient || undefined;
                        await saveSiteVersionForSiteId(siteId, schemaWithIds);
                      },
                      clearDraftSession: clearSiteBuilderDraftSessionStorage,
                    });

                    if (!handoff.ok) {
                      if (handoff.stage === "save_version") {
                        setCreateDraftRetrySiteId(handoff.siteId);
                        setCreateDraftRetrySchemaText(schemaText);
                        await loadSites(handoff.siteId);
                        await loadVersions(handoff.siteId);
                        setError(
                          `Site created, but saving first draft version failed: ${handoff.message}. Retry below.`,
                        );
                        return;
                      }
                      throw new Error(handoff.message);
                    }

                    setCreateDraftRetrySiteId("");
                    setCreateDraftRetrySchemaText("");
                    await loadSites(handoff.siteId);
                    await loadVersions(handoff.siteId);
                    if (handoff.versionSaved) {
                      setNotice(`Created site and saved current draft as first version.`);
                    } else {
                      setNotice(`Created site ${createName.trim()}. Save version to persist schema.`);
                    }
                  })
                }
                className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {busy ? "Working..." : "Create site and save current draft"}
              </button>
              {createDraftRetrySiteId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    withBusy(async () => {
                      let parsed: unknown;
                      try {
                        parsed = JSON.parse(createDraftRetrySchemaText || schemaText);
                      } catch {
                        throw new Error("Draft schema JSON is invalid. Fix schema and retry.");
                      }
                      const schemaWithIds = parsed as Record<string, unknown>;
                      schemaWithIds.metadata = (schemaWithIds.metadata as object) || {};
                      const meta = schemaWithIds.metadata as Record<string, unknown>;
                      const resolvedClient =
                        buildForClient && hubClientPick.trim()
                          ? hubClientPick.trim()
                          : clientId.trim() || undefined;
                      meta.workspaceId =
                        workspaceLinkMode === "linked"
                          ? linkedWorkspaceId.trim() || createWorkspaceId.trim() || undefined
                          : undefined;
                      meta.clientId = resolvedClient || undefined;
                      await saveSiteVersionForSiteId(createDraftRetrySiteId, schemaWithIds);
                      await loadVersions(createDraftRetrySiteId);
                      await loadSites(createDraftRetrySiteId);
                      clearSiteBuilderDraftSessionStorage();
                      setCreateDraftRetrySiteId("");
                      setCreateDraftRetrySchemaText("");
                      setNotice("Saved first version for newly created site.");
                      setError(null);
                    })
                  }
                  className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
                >
                  Retry saving first draft version
                </button>
              ) : null}
            </div>
          </section>

          <section className={`${cardClass} p-5 lg:col-span-2`}>
            <h2 className="text-lg font-semibold">Project Registry</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <select
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
              >
                <option value="">Select site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} • {site.status}
                  </option>
                ))}
              </select>
              <button
                disabled={busy}
                onClick={() =>
                  withBusy(async () => {
                    await loadSites();
                    await loadActiveSessionContext();
                  })
                }
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400 disabled:opacity-50"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void connectConsultantWallet()}
                disabled={walletBusy}
                className="rounded-lg border border-cyan-500 px-3 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
              >
                {walletBusy ? "Connecting..." : connectedWallet ? "Wallet Connected" : "Connect Wallet"}
              </button>
            </div>
            {connectedWallet ? (
              <div className="mt-2 text-xs text-slate-400">Consultant wallet: <span className="font-mono">{connectedWallet}</span></div>
            ) : null}
            {activeTrustContext ? (
              <div className={`mt-3 ${tileClass} p-3 text-xs text-slate-300`}>
                <div className="mb-1 font-semibold text-cyan-200">Current Session Context (DB)</div>
                <div>Trust ID: <span className="font-mono">{activeTrustContext.trustId || "—"}</span></div>
                <div>Workspace ID: <span className="font-mono">{activeTrustContext.workspaceId || "—"}</span></div>
                <div>Client ID: <span className="font-mono">{activeTrustContext.clientId || "—"}</span></div>
              </div>
            ) : null}
            {selectedSite ? (
              <div className={`mt-3 ${tileClass} p-3 text-xs text-slate-300`}>
                <div>Site ID: <span className="font-mono">{selectedSite.id}</span></div>
                <div>Trust ID: <span className="font-mono">{selectedSite.trustId || "—"}</span></div>
                <div>Workspace ID: <span className="font-mono">{selectedSite.workspaceId || "—"}</span></div>
                <div>Owner Wallet: <span className="font-mono">{selectedSite.ownerWallet || "—"}</span></div>
                <div>Current Version ID: <span className="font-mono">{selectedSite.currentVersionId || "—"}</span></div>
                <div>NFT: <span className="font-mono">{selectedSite.nftContract && selectedSite.nftTokenId ? `${selectedSite.nftContract} #${selectedSite.nftTokenId}` : "Not minted"}</span></div>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                  <input
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                    value={transferOwnerWallet}
                    onChange={(e) => setTransferOwnerWallet(e.target.value)}
                    placeholder="Transfer target wallet"
                  />
                  <button
                    type="button"
                    onClick={() => void transferSiteOwnership(transferOwnerWallet)}
                    className="rounded border border-cyan-500 px-2 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
                  >
                    Transfer Ownership
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className={`${cardClass} p-5`}>
            <h2 className="text-lg font-semibold">Step 2: Build and Save Version</h2>
            <div className={`mt-3 ${tileClass} p-3`}>
              <div className="mb-2 text-sm font-semibold text-slate-200">Add a new block</div>
              <p className="mb-2 text-[11px] text-slate-500">
                Pick a block type, then click Add — keeps the list short so you can focus.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Block type</label>
                  <select
                    value={addBlockType}
                    onChange={(e) => setAddBlockType(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="">Choose…</option>
                    {BLOCK_LIBRARY.map((item) => (
                      <option key={item.type} value={item.type}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={!addBlockType}
                  onClick={() => {
                    if (!addBlockType) return;
                    handleAddBlockClick(addBlockType);
                    setAddBlockType("");
                  }}
                  className="rounded-lg border border-cyan-500/60 bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add block
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className={`${tileClass} p-3`}>
                <div className="mb-2 text-sm font-semibold text-slate-200">Block list</div>
                {firstPageBlocks.length === 0 ? (
                  <div className="text-xs text-slate-400">No blocks yet. Choose a type above and click Add block.</div>
                ) : (
                  <div className="grid gap-2">
                    {firstPageBlocks.map((block: any, index: number) => (
                      <div key={`${index}-${String(block?.type || "block")}`}>
                        {dragOverTarget?.index === index && dragOverTarget.position === "above" ? (
                          <div className="mb-1 h-0.5 w-full rounded bg-cyan-400/90" />
                        ) : null}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            const target = e.currentTarget as HTMLDivElement;
                            const rect = target.getBoundingClientRect();
                            const y = e.clientY - rect.top;
                            const position: "above" | "below" = y < rect.height / 2 ? "above" : "below";
                            setDragOverTarget({ index, position });
                          }}
                          onDrop={() => {
                            if (draggingBlockIndex === null) return;
                            const insertionIndex =
                              dragOverTarget?.index === index && dragOverTarget.position === "below"
                                ? index + 1
                                : index;
                            reorderBlock(draggingBlockIndex, insertionIndex);
                            setDraggingBlockIndex(null);
                            setDragOverTarget(null);
                          }}
                          className={`rounded-lg border p-2 ${selectedBlockIndex === index ? "border-cyan-500 bg-cyan-500/5" : "border-slate-800 bg-slate-950"}`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <div
                              draggable
                              onDragStart={() => {
                                setDraggingBlockIndex(index);
                                setDragOverTarget({ index, position: "above" });
                              }}
                              onDragEnd={() => {
                                setDraggingBlockIndex(null);
                                setDragOverTarget(null);
                              }}
                              className="cursor-grab rounded border border-slate-700/80 bg-slate-900 px-2 py-1 text-[10px] text-slate-300 active:cursor-grabbing"
                              title="Drag to reorder"
                            >
                              ⋮
                            </div>
                            <button
                              type="button"
                              onClick={() => openBlockEditorFromList(index)}
                              className="min-w-0 flex-1 text-left text-xs font-semibold text-cyan-300 hover:underline"
                            >
                              {index + 1}. {String(block?.type || "block")}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBlockListIndex(expandedBlockListIndex === index ? null : index)
                              }
                              className="shrink-0 rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-400"
                            >
                              {expandedBlockListIndex === index ? "Hide ▲" : "Layout ▼"}
                            </button>
                          </div>
                          <div className="mt-2 flex flex-wrap justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => moveBlock(index, -1)}
                              className="rounded border border-slate-700 px-2 py-1 text-[10px] hover:border-cyan-400"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBlock(index, 1)}
                              className="rounded border border-slate-700 px-2 py-1 text-[10px] hover:border-cyan-400"
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              onClick={() => removeBlockAt(index)}
                              className="rounded border border-red-600/50 px-2 py-1 text-[10px] text-red-300 hover:bg-red-600/10"
                            >
                              Remove
                            </button>
                          </div>
                          {expandedBlockListIndex === index ? (
                            <div className="mt-2 flex flex-wrap items-center gap-3 rounded border border-slate-700 bg-slate-900 px-2 py-2">
                              <span className="text-[10px] text-slate-400">Placement</span>
                              {(["left", "center", "right"] as const).map((placement) => (
                                <label key={placement} className="inline-flex items-center gap-1 text-[10px] text-slate-300">
                                  <input
                                    type="radio"
                                    name={`block-placement-${index}`}
                                    checked={getBlockPlacement(block) === placement}
                                    onChange={() => setBlockPlacement(index, placement)}
                                  />
                                  {placement}
                                </label>
                              ))}
                            </div>
                          ) : null}
                          </div>
                        {dragOverTarget?.index === index && dragOverTarget.position === "below" ? (
                          <div className="mt-1 h-0.5 w-full rounded bg-cyan-400/90" />
                        ) : null}
                    </div>
                    ))}
                  </div>
                )}

                {selectedBlock ? (
                  <div className={`mt-3 min-w-0 ${smallTileClass} overflow-hidden p-0`}>
                    <button
                      type="button"
                      onClick={() => setEditBlockPanelOpen((o) => !o)}
                      className="flex w-full items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/50 px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-900/80"
                    >
                      <span>Edit block: {String(selectedBlock?.type || "block")}</span>
                      <span className="text-slate-500">{editBlockPanelOpen ? "Hide" : "Show"}</span>
                    </button>
                    {editBlockPanelOpen ? (
                    <div className="p-3 min-w-0">
                    {selectedBlock.type === "avatar" ? (
                      <div className="grid min-w-0 gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => void handleBlockFileUpload(selectedBlockIndex, "src", e.target.files)}
                          className="w-full max-w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                        <select
                          value={String(selectedBlock?.content?.shape || "circle")}
                          onChange={(e) => setBlockContentValue(selectedBlockIndex, "shape", e.target.value)}
                          className="w-full max-w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        >
                          <option value="circle">Circle</option>
                          <option value="square">Square</option>
                          <option value="rounded">Rounded</option>
                        </select>
                      </div>
                    ) : null}

                    {selectedBlock.type === "heading" ? (
                      <div className="grid gap-2">
                        <input
                          value={String(selectedBlock?.content?.text || "")}
                          onChange={(e) => setBlockContentValue(selectedBlockIndex, "text", e.target.value)}
                          placeholder="Heading text"
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                        <select
                          value={String(selectedBlock?.content?.align || "left")}
                          onChange={(e) => setBlockContentValue(selectedBlockIndex, "align", e.target.value)}
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    ) : null}

                    {selectedBlock.type === "paragraph" ? (
                      <div className="grid gap-2">
                        <textarea
                          value={String(selectedBlock?.content?.text || "")}
                          onChange={(e) => setBlockContentValue(selectedBlockIndex, "text", e.target.value)}
                          placeholder="Paragraph text"
                          className="min-h-[80px] rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                        <input
                          value={String(selectedBlock?.content?.fontFamily || "")}
                          onChange={(e) => {
                            setBlockContentValue(selectedBlockIndex, "fontFamily", e.target.value);
                            setBlockStyleValue(selectedBlockIndex, "fontFamily", e.target.value);
                          }}
                          placeholder="Font family (e.g., Inter, serif)"
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                      </div>
                    ) : null}

                    {selectedBlock.type === "link" || selectedBlock.type === "big_link" || selectedBlock.type === "internal_big_link" ? (
                      <div className="grid gap-2">
                        <input
                          value={String(selectedBlock?.content?.label || "")}
                          onChange={(e) => setBlockContentValue(selectedBlockIndex, "label", e.target.value)}
                          placeholder="Link label"
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                        <input
                          value={String(selectedBlock?.href || selectedBlock?.content?.href || "")}
                          onChange={(e) => updateBlock(selectedBlockIndex, (block) => {
                            block.href = e.target.value;
                            block.content = block.content || {};
                            block.content.href = e.target.value;
                          })}
                          placeholder="https://example.com"
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                      </div>
                    ) : null}

                    {selectedBlock.type === "image" || selectedBlock.type === "header_image" ? (
                      <div className="grid gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => void handleBlockFileUpload(selectedBlockIndex, "src", e.target.files)}
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                        <select
                          value={String(selectedBlock?.content?.fit || "cover")}
                          onChange={(e) => setBlockContentValue(selectedBlockIndex, "fit", e.target.value)}
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        >
                          <option value="cover">Fit: Cover (wide)</option>
                          <option value="contain">Fit: Contain (square)</option>
                        </select>
                      </div>
                    ) : null}

                    {selectedBlock.type === "image_grid" ? (
                      <div className="grid gap-2">
                        <textarea
                          value={Array.isArray(selectedBlock?.content?.images) ? selectedBlock.content.images.map((img: any) => String(img?.src || "")).join("\n") : ""}
                          onChange={(e) => {
                            const rows = e.target.value
                              .split("\n")
                              .map((line) => line.trim())
                              .filter(Boolean)
                              .slice(0, 4);
                            setBlockContentValue(
                              selectedBlockIndex,
                              "images",
                              rows.map((src) => ({ src, alt: "grid image" }))
                            );
                          }}
                          placeholder="Paste up to 4 image URLs, one per line"
                          className="min-h-[80px] rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                      </div>
                    ) : null}

                    {selectedBlock.type === "divider" ? (
                      <div className="grid gap-2">
                        <div className="rounded border border-slate-700 bg-slate-900/70 px-2 py-2 text-xs text-slate-300">
                          Divider controls moved to the popout window.
                        </div>
                        <button
                          type="button"
                          onClick={() => openDividerEditor(selectedBlockIndex)}
                          className="rounded border border-cyan-500/50 bg-cyan-500/10 px-2 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
                        >
                          Open Divider Adjustments
                        </button>
                      </div>
                    ) : null}

                    {selectedBlock.type === "socials" ? (
                      <div className="grid gap-2">
                        {SOCIAL_PLATFORMS.map((social) => {
                          const links = Array.isArray(selectedBlock?.content?.links) ? selectedBlock.content.links : [];
                          const current = links.find((entry: any) => String(entry?.platform || "").toLowerCase() === social.key);
                          return (
                            <div key={social.key} className="grid gap-1">
                              <label className="text-[11px] text-slate-300">{social.label}</label>
                              <input
                                value={String(current?.href || "")}
                                onChange={(e) => upsertSocialLink(selectedBlockIndex, social.key, e.target.value)}
                                placeholder={social.placeholder}
                                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {selectedBlock.type === "audio" ? (
                      <div className="grid gap-2">
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={(e) => void handleBlockFileUpload(selectedBlockIndex, "src", e.target.files)}
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                      </div>
                    ) : null}

                    {selectedBlock.type === "video" ? (
                      <div className="grid gap-2">
                        <input
                          type="file"
                          accept="video/*"
                          onChange={(e) => void handleBlockFileUpload(selectedBlockIndex, "src", e.target.files)}
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                      </div>
                    ) : null}

                    {selectedBlock.type === "call_to_action" ? (
                      <div className="grid gap-2">
                        <input
                          value={String(selectedBlock?.content?.title || "")}
                          onChange={(e) => setBlockContentValue(selectedBlockIndex, "title", e.target.value)}
                          placeholder="CTA title"
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                        <input
                          value={String(selectedBlock?.content?.label || "")}
                          onChange={(e) => setBlockContentValue(selectedBlockIndex, "label", e.target.value)}
                          placeholder="Button label"
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                        <select
                          value={String(selectedBlock?.content?.actionType || "link")}
                          onChange={(e) => setBlockContentValue(selectedBlockIndex, "actionType", e.target.value)}
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        >
                          <option value="link">Hyperlink</option>
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                        </select>
                        <input
                          value={String(selectedBlock?.content?.href || "")}
                          onChange={(e) => setBlockContentValue(selectedBlockIndex, "href", e.target.value)}
                          placeholder="https://... or mailto:... or tel:..."
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        />
                      </div>
                    ) : null}

                    {selectedBlock.type !== "divider" ? (
                    <>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-2 py-1">
                        <label className="text-[11px] text-slate-300">Block background</label>
                        <input
                          type="color"
                          value={String(selectedBlock?.content?.style?.backgroundColor || "#000000")}
                          onChange={(e) => setBlockStyleValue(selectedBlockIndex, "backgroundColor", e.target.value)}
                          className="h-7 w-10 cursor-pointer rounded border border-slate-700 bg-slate-800"
                        />
                        <input
                          value={String(selectedBlock?.content?.style?.backgroundColor || "")}
                          onChange={(e) => setBlockStyleValue(selectedBlockIndex, "backgroundColor", e.target.value)}
                          placeholder="#000000"
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-2 py-1">
                        <label className="text-[11px] text-slate-300">Text color</label>
                        <input
                          type="color"
                          value={String(selectedBlock?.content?.style?.textColor || "#ffffff")}
                          onChange={(e) => setBlockStyleValue(selectedBlockIndex, "textColor", e.target.value)}
                          className="h-7 w-10 cursor-pointer rounded border border-slate-700 bg-slate-800"
                        />
                        <input
                          value={String(selectedBlock?.content?.style?.textColor || "")}
                          onChange={(e) => setBlockStyleValue(selectedBlockIndex, "textColor", e.target.value)}
                          placeholder="#ffffff"
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-2 py-1">
                        <label className="text-[11px] text-slate-300">Border color</label>
                        <input
                          type="color"
                          value={String(selectedBlock?.content?.style?.borderColor || "#334155")}
                          onChange={(e) => setBlockStyleValue(selectedBlockIndex, "borderColor", e.target.value)}
                          className="h-7 w-10 cursor-pointer rounded border border-slate-700 bg-slate-800"
                        />
                        <input
                          value={String(selectedBlock?.content?.style?.borderColor || "")}
                          onChange={(e) => setBlockStyleValue(selectedBlockIndex, "borderColor", e.target.value)}
                          placeholder="#334155"
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        />
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={24}
                        value={Number(selectedBlock?.content?.style?.borderWidth || 0)}
                        onChange={(e) => setBlockStyleValue(selectedBlockIndex, "borderWidth", Number(e.target.value))}
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      />
                      <select
                        value={String(selectedBlock?.content?.style?.borderStyle || "solid")}
                        onChange={(e) => setBlockStyleValue(selectedBlockIndex, "borderStyle", e.target.value)}
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      >
                        <option value="dashed">Dashed</option>
                        <option value="solid">Solid</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={Number(selectedBlock?.content?.style?.borderRadius || 0)}
                        onChange={(e) => setBlockStyleValue(selectedBlockIndex, "borderRadius", Number(e.target.value))}
                        placeholder="Border radius"
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      />
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                      <label className="inline-flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs">
                        <input
                          type="radio"
                          name="selected-block-placement"
                          checked={getBlockPlacement(selectedBlock) === "left"}
                          onChange={() => setBlockPlacement(selectedBlockIndex, "left")}
                        />
                        Left
                      </label>
                      <label className="inline-flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs">
                        <input
                          type="radio"
                          name="selected-block-placement"
                          checked={getBlockPlacement(selectedBlock) === "center"}
                          onChange={() => setBlockPlacement(selectedBlockIndex, "center")}
                        />
                        Center
                      </label>
                      <label className="inline-flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs">
                        <input
                          type="radio"
                          name="selected-block-placement"
                          checked={getBlockPlacement(selectedBlock) === "right"}
                          onChange={() => setBlockPlacement(selectedBlockIndex, "right")}
                        />
                        Right
                      </label>
                    </div>
                    </>
                    ) : null}
                    </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

            </div>

            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <SiteBuilderConnectDomainPanel siteId={selectedSiteId} onNotice={setNotice} onError={setError} />
            </div>

            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="mb-2 text-sm font-semibold text-slate-200">Customizations</div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="md:col-span-2 flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                  <div className="text-xs font-semibold text-slate-300">Client / workspace</div>
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name="workspace-link"
                        checked={workspaceLinkMode === "standalone"}
                        onChange={() => setWorkspaceLinkMode("standalone")}
                      />
                      Standalone (no client link required to save)
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name="workspace-link"
                        checked={workspaceLinkMode === "linked"}
                        onChange={() => setWorkspaceLinkMode("linked")}
                      />
                      Link to workspace
                    </label>
                  </div>
                  {workspaceLinkMode === "linked" ? (
                    <select
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                      value={linkedWorkspaceId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setLinkedWorkspaceId(id);
                        const w = workspacesList.find((x) => x.id === id);
                        if (w?.clientId) setClientId(String(w.clientId));
                      }}
                    >
                      <option value="">Select workspace (trust)…</option>
                      {workspacesList.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                          {w.clientId ? ` • client ${w.clientId}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <p className="text-[11px] text-slate-500">
                    Linking embeds trust/workspace and client IDs in the saved version metadata. Choose Standalone to save
                    without them.
                  </p>
                </div>
                <label className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={removeDefaultCss}
                    onChange={(e) => setRemoveDefaultCss(e.target.checked)}
                  />
                  Remove default CSS
                </label>
                <input
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                  value={themeName}
                  onChange={(e) => setThemeName(e.target.value)}
                  placeholder="Theme name"
                />
                <input
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder={
                    workspaceLinkMode === "linked"
                      ? "Client ID (optional if workspace selected)"
                      : "Client ID (optional)"
                  }
                />
                <input
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                  value={web3DomainName}
                  onChange={(e) => setWeb3DomainName(e.target.value)}
                  placeholder="Web3 domain (e.g., yourtrust.crypto)"
                />
                <select
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                  value={web3DomainProvider}
                  onChange={(e) => setWeb3DomainProvider(e.target.value)}
                >
                  <option value="Freename">Freename</option>
                  <option value="Other">Other</option>
                </select>
                <label className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={web3DomainParked}
                    onChange={(e) => setWeb3DomainParked(e.target.checked)}
                  />
                  Parked domain (no live site yet)
                </label>
                <textarea
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs md:col-span-2"
                  value={web3DomainNotes}
                  onChange={(e) => setWeb3DomainNotes(e.target.value)}
                  placeholder="Freename DNS notes / resolver details"
                />
                <select
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                  value={backgroundMode}
                  onChange={(e) =>
                    setBackgroundMode(
                      e.target.value as
                        | "simple_gradients"
                        | "abstract_gradients"
                        | "custom_gradient"
                        | "custom_color"
                        | "custom_media"
                    )
                  }
                >
                  <option value="simple_gradients">Simple gradients</option>
                  <option value="abstract_gradients">Abstract gradients</option>
                  <option value="custom_gradient">Custom gradient</option>
                  <option value="custom_color">Custom color</option>
                  <option value="custom_media">Custom image/video</option>
                </select>
                {(backgroundMode === "simple_gradients" || backgroundMode === "custom_gradient" || backgroundMode === "custom_media") && (
                  <>
                    <input
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                      value={gradientStart}
                      onChange={(e) => setGradientStart(e.target.value)}
                      placeholder="Gradient start color"
                    />
                    <input
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                      value={gradientEnd}
                      onChange={(e) => setGradientEnd(e.target.value)}
                      placeholder="Gradient end color"
                    />
                  </>
                )}
                {backgroundMode === "custom_gradient" ? (
                  <input
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs md:col-span-2"
                    value={customGradient}
                    onChange={(e) => setCustomGradient(e.target.value)}
                    placeholder="linear-gradient(...)"
                  />
                ) : null}
                {backgroundMode === "custom_color" ? (
                  <input
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs md:col-span-2"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    placeholder="#020617"
                  />
                ) : null}
                {backgroundMode === "custom_media" ? (
                  <>
                    <input
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      placeholder="Base background color under media"
                    />
                    <input
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                      value={backgroundMediaUrl}
                      onChange={(e) => setBackgroundMediaUrl(e.target.value)}
                      placeholder="Background image/video URL (mp4 supported)"
                    />
                    <select
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                      value={backgroundMediaType}
                      onChange={(e) => setBackgroundMediaType(e.target.value as "image" | "video")}
                    >
                      <option value="image">Image</option>
                      <option value="video">Video (mp4)</option>
                    </select>
                    <input
                      ref={backgroundMediaInputRef}
                      type="file"
                      accept={backgroundMediaType === "video" ? "video/mp4,video/*" : "image/*"}
                      onChange={(e) => void handleBackgroundMediaUpload(e.target.files)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs md:col-span-2"
                    />
                  </>
                ) : null}
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs text-slate-300">Custom CSS</div>
                  <textarea
                    className="min-h-[120px] w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono text-[11px]"
                    value={customCssText}
                    onChange={(e) => setCustomCssText(e.target.value)}
                    placeholder=".container { max-width: 1280px; }"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-slate-300">Custom JS</div>
                  <textarea
                    className="min-h-[120px] w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono text-[11px]"
                    value={customJsText}
                    onChange={(e) => setCustomJsText(e.target.value)}
                    placeholder={`window.TROO_AGENT_CONFIG = { widgetKey: "…", context: { pageType: "site", source: "sitebuilder" } };\n// then load /widget/loader.js — see AI Agency → Embed`}
                  />
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 md:col-span-2 max-w-3xl">
                <div className="mb-1 text-xs font-semibold text-slate-200">AI Agency widget (this site)</div>
                <p className="mb-2 text-[11px] text-slate-500">
                  Bind an agent to this site to get a widget key. Embeds use{" "}
                  <code className="text-slate-400">/widget/loader.js</code> and public config/chat routes. Choose whether
                  chat LLM calls follow the agent keys or site-builder AI settings (BYOK / platform). Select a{" "}
                  <strong className="text-slate-300">Revenue OS client</strong> so the site, binding, and web chat CRM
                  leads stay linked — visible in the{" "}
                  <a className="text-cyan-400 hover:underline" href="/ai-revenue-os/clients">
                    client hub
                  </a>
                  .
                </p>
                <div className="mb-2 flex flex-col gap-2 text-[11px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-slate-400">Client (hub)</label>
                    <select
                      className="min-w-[200px] max-w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs"
                      value={hubClientPick}
                      onChange={(e) => void handleHubClientPick(e.target.value)}
                      disabled={!selectedSiteId}
                    >
                      <option value="">Inherit (use client on site / workspace id field)</option>
                      {hubClients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                    <div className="flex min-w-[160px] flex-1 flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        New Revenue OS client
                      </span>
                      <input
                        type="text"
                        value={widgetNewHubClientName}
                        onChange={(e) => setWidgetNewHubClientName(e.target.value)}
                        placeholder="Company or contact name"
                        disabled={hubClientCreateBusy}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={hubClientCreateBusy || !widgetNewHubClientName.trim()}
                      onClick={() =>
                        void (async () => {
                          try {
                            await createRevenueOsHubClient(widgetNewHubClientName);
                            setWidgetNewHubClientName("");
                          } catch {
                            /* setError in handler */
                          }
                        })()
                      }
                      className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {hubClientCreateBusy ? "Creating…" : "Create & select"}
                    </button>
                  </div>
                  <p className="text-[10px] leading-relaxed text-slate-500">
                    Same records as{" "}
                    <a className="text-cyan-400 hover:underline" href="/ai-revenue-os/clients">
                      Client Hub
                    </a>{" "}
                    and onboarding contacts — new clients can run full generation and widget CRM attribution.
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <select
                    className="min-w-[180px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs"
                    value={agencyWidgetAgentId}
                    onChange={(e) => setAgencyWidgetAgentId(e.target.value)}
                    disabled={!selectedSiteId || agencyWidgetBusy}
                  >
                    <option value="">Select agent…</option>
                    {agencyAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.status})
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs"
                    value={agencyWidgetProvider}
                    onChange={(e) => setAgencyWidgetProvider(e.target.value as "agent" | "site_builder")}
                    disabled={agencyWidgetBusy}
                  >
                    <option value="agent">LLM: agent keys / platform</option>
                    <option value="site_builder">LLM: site-builder AI settings</option>
                  </select>
                  <button
                    type="button"
                    disabled={!selectedSiteId || !agencyWidgetAgentId || agencyWidgetBusy}
                    onClick={() =>
                      void (async () => {
                        setAgencyWidgetBusy(true);
                        setError(null);
                        try {
                          await jsonFetch(`/api/site-builder/sites/${encodeURIComponent(selectedSiteId)}/agency-widget`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              agentId: agencyWidgetAgentId,
                              providerStrategy: agencyWidgetProvider,
                              ...(clientId.trim() ? { clientId: clientId.trim() } : {}),
                            }),
                          });
                          setNotice("Widget binding saved.");
                          const d = await jsonFetch<{ bindings: typeof agencyWidgetBindings }>(
                            `/api/site-builder/sites/${encodeURIComponent(selectedSiteId)}/agency-widget`
                          );
                          setAgencyWidgetBindings(d.bindings ?? []);
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Widget bind failed");
                        } finally {
                          setAgencyWidgetBusy(false);
                        }
                      })()
                    }
                    className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {agencyWidgetBusy ? "Saving…" : "Bind / update widget"}
                  </button>
                  <button
                    type="button"
                    disabled={!selectedSiteId || !agencyWidgetAgentId || agencyWidgetBusy || !versionIdForActions}
                    onClick={() =>
                      void (async () => {
                        setAgencyWidgetBusy(true);
                        setError(null);
                        try {
                          const data = await jsonFetch<{ widgetKey: string; schema?: Record<string, unknown> }>(
                            `/api/site-builder/sites/${encodeURIComponent(selectedSiteId)}/agency-widget`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                agentId: agencyWidgetAgentId,
                                providerStrategy: agencyWidgetProvider,
                                applyToSchema: true,
                                versionId: versionIdForActions,
                                ...(clientId.trim() ? { clientId: clientId.trim() } : {}),
                              }),
                            }
                          );
                          if (data.schema) {
                            setSchemaText(
                              normalizeSchemaJsonStringForTargeting(JSON.stringify(data.schema, null, 2)),
                            );
                            setNotice("Schema editor updated with widget embed metadata.");
                          } else {
                            setNotice("Widget saved; could not merge schema for that version.");
                          }
                          const d = await jsonFetch<{ bindings: typeof agencyWidgetBindings }>(
                            `/api/site-builder/sites/${encodeURIComponent(selectedSiteId)}/agency-widget`
                          );
                          setAgencyWidgetBindings(d.bindings ?? []);
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Widget merge failed");
                        } finally {
                          setAgencyWidgetBusy(false);
                        }
                      })()
                    }
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50"
                  >
                    Merge widget into selected version JSON
                  </button>
                </div>
                {agencyWidgetBindings.length ? (
                  <ul className="mt-2 space-y-2 text-[11px] text-slate-400">
                    {agencyWidgetBindings.map((b) => (
                      <li key={b.widgetKey} className="rounded border border-slate-800 bg-slate-950/80 p-2">
                        <div className="font-medium text-slate-300">
                          {b.agentName} · {b.providerStrategy}
                          {b.clientId ? (
                            <span className="ml-1 text-slate-500"> · client {b.clientId.slice(0, 8)}…</span>
                          ) : null}
                        </div>
                        <code className="mt-1 block break-all text-cyan-200/90">{b.embedSnippet}</code>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-600">No widget bindings for this site yet.</p>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-500 md:col-span-2 max-w-3xl">
                <span className="text-slate-400">AI agent on published sites:</span> generate a widget key in{" "}
                <a href="/app/agents" className="text-cyan-400 hover:underline">
                  AI Agency
                </a>
                , allow your site&apos;s domain, then set{" "}
                <code className="text-slate-300">window.TROO_AGENT_CONFIG</code> (optional{" "}
                <code className="text-slate-300">context</code>) and load{" "}
                <code className="text-slate-300">/widget/loader.js</code>. RET uses the same agent with{" "}
                <code className="text-slate-300">NEXT_PUBLIC_RET_WIDGET_KEY</code> — see{" "}
                <code className="text-slate-300">docs/ret-agent-widget.md</code>.
              </p>
              <button
                type="button"
                onClick={applyCustomizationToSchema}
                className="mt-2 rounded-lg border border-cyan-500 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
              >
                Apply Customizations to Schema
              </button>
            </div>

            <textarea
              className="mt-3 min-h-[260px] w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs"
              value={schemaText}
              onChange={(e) => setSchemaText(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                disabled={busy || !selectedSiteId}
                onClick={() =>
                  withBusy(async () => {
                    await saveSiteVersionWithAnalytics("advanced_panel");
                  })
                }
                className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                Save New Version
              </button>
              <button
                disabled={busy}
                onClick={() => withBusy(quickSaveTemplate)}
                className="rounded-lg border border-amber-500 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
              >
                Save as Template
              </button>
              <select
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={versionIdForActions}
                onChange={(e) => setVersionIdForActions(e.target.value)}
              >
                <option value="">Select version</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version} • {v.schemaHash.slice(0, 10)}...
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !selectedSiteId || !selectedVersionOrEmpty()}
                onClick={() =>
                  withBusy(async () => {
                    const versionId = selectedVersionOrEmpty();
                    await jsonFetch(
                      `/api/site-builder/sites/${encodeURIComponent(selectedSiteId)}/versions/${encodeURIComponent(versionId)}/set-current`,
                      { method: "POST" }
                    );
                    await loadSites(selectedSiteId);
                    setNotice("Current version updated");
                  })
                }
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400 disabled:opacity-50"
              >
                Set Current Version
              </button>
            </div>
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="mb-2 text-sm font-semibold text-slate-200">Consultant Template Library</div>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name (required)"
                />
                <input
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Template description (optional)"
                />
                <div className="md:col-span-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || !templateName.trim()}
                    onClick={() => withBusy(saveCurrentAsTemplate)}
                    className="rounded-lg border border-amber-500 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
                  >
                    Save Current Design as Template
                  </button>
                  <select
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    <option value="">Select saved template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedTemplateId}
                    onClick={applySelectedTemplateToEditor}
                    className="rounded-lg border border-cyan-500 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
                  >
                    Apply Selected Template
                  </button>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                Templates are saved in the DB for your consultant account. Manage all templates on the{" "}
                <Link href="/site-builder/templates" className="text-cyan-300 underline">Templates page</Link>.
              </div>
            </div>
          </section>

          <section className={`${cardClass} p-5`}>
            <h2 className="text-lg font-semibold">Versions</h2>
            <div className={`mt-3 ${tileClass} p-3 text-xs text-slate-400`}>
              Live preview is anchored in the main workspace (right column). Device toggles and “Open tab” live there — this panel lists saved versions only.
            </div>
            <div className={`mt-3 max-h-[420px] overflow-auto ${tileClass} p-3 text-xs text-slate-300`}>
              {versions.length === 0 ? (
                <div>No versions yet.</div>
              ) : (
                versions.map((version) => (
                  <div key={version.id} className={`mb-2 ${smallTileClass} p-2`}>
                    <div>v{version.version} {selectedSite?.currentVersionId === version.id ? "(current)" : ""}</div>
                    <div className="font-mono">{version.id}</div>
                    <div className="font-mono">{version.schemaHash}</div>
                    <div>IPFS: <span className="font-mono">{version.ipfsCid || "not deployed"}</span></div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className={`${cardClass} p-5`}>
            <h2 className="text-lg font-semibold">Step 3: Deploy to IPFS</h2>
            <p className="mt-1 text-xs text-slate-400">
              Choose a version (or use current), deploy, then use the gateway URL to verify output.
            </p>
            <div className="mt-3 grid gap-2">
              <select
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={deployVersionId}
                onChange={(e) => setDeployVersionId(e.target.value)}
              >
                <option value="">Use current version</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version} • {v.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !selectedSiteId || !canDeployOps || !publishChecklistOk}
                title={
                  !canDeployOps
                    ? "Save a version first."
                    : !publishChecklistOk
                      ? firstBlockingChecklistHint
                      : "Deploy the selected version to IPFS"
                }
                onClick={() =>
                  withBusy(async () => {
                    await runSiteBuilderTrackedAction({
                      successEvent: "site_builder_deploy_completed",
                      failureEvent: "site_builder_deploy_failed",
                      baseProps: { workflow_stage: builderStage, source: "advanced_panel" },
                      action: async () => {
                        const data = await jsonFetch<{ ipfsCid: string; gatewayUrl: string; versionId: string }>(
                          `/api/site-builder/sites/${encodeURIComponent(selectedSiteId)}/deploy`,
                          {
                            method: "POST",
                            body: JSON.stringify({
                              versionId: deployVersionId || undefined,
                            }),
                          }
                        );
                        await loadVersions(selectedSiteId);
                        await loadSites(selectedSiteId);
                        setLastDeployGatewayUrl(data.gatewayUrl || "");
                        setLastDeployIpfsCid(data.ipfsCid || "");
                        setNotice(`Deployed version ${data.versionId} to ${data.ipfsCid}`);
                        const shipCid = (hubClientPick.trim() || selectedSite?.clientId?.trim() || "").trim();
                        if (shipCid) {
                          aiPanelRef.current?.notifyClientLifecycle?.("post_publish_deploy");
                        }
                        return data;
                      },
                      mapSuccessProps: (data) => ({
                        ipfs_cid_prefix: data.ipfsCid?.slice(0, 12) ?? "",
                        version_id_prefix: data.versionId?.slice(0, 8) ?? "",
                      }),
                    });
                  })
                }
                className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                Deploy Site Version
              </button>
              {lastDeployGatewayUrl ? (
                <div className="grid gap-2">
                  <a
                    href={lastDeployGatewayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-lg border border-cyan-500 px-3 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10"
                  >
                    View Deployed Site (IPFS Gateway)
                  </a>
                  {web3DomainName.trim() ? (
                    <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-2 text-xs text-slate-300">
                      <div className="font-semibold text-cyan-200">Step 4: Domain Mapping</div>
                      <div>Domain: <span className="font-mono">{web3DomainName.trim()}</span></div>
                      <div>Provider: <span className="font-mono">{web3DomainProvider || "Freename"}</span></div>
                      {lastDeployIpfsCid ? <div>IPFS CID: <span className="font-mono">{lastDeployIpfsCid}</span></div> : null}
                      <div className="mt-1">
                        Share URL:{" "}
                        <a
                          href={`https://${web3DomainName.trim()}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-300 underline"
                        >
                          https://{web3DomainName.trim()}
                        </a>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-400">
                        DNS Hint (Freename Web3 DNS): point domain content to this deployment.
                        {lastDeployIpfsCid ? ` Contenthash target: /ipfs/${lastDeployIpfsCid}` : ""}
                        {" "}Gateway fallback: {lastDeployGatewayUrl}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-100">
                      Add your domain in <span className="font-semibold">Customizations</span> to unlock mapping instructions here after deploy.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </section>

          <section className={`${cardClass} p-5`}>
            <h2 className="text-lg font-semibold">Step 5: Mint (Prepare)</h2>
            <p className="mt-1 text-xs text-slate-400">
              Prepare the wallet mint payload, execute the transaction in wallet, then confirm below.
            </p>
            <div className="mt-3 grid gap-2">
              <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={mintChainId} onChange={(e) => setMintChainId(e.target.value)} placeholder="Chain ID (e.g. 137)" />
              <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={mintContract} onChange={(e) => setMintContract(e.target.value)} placeholder="NFT contract address" />
              <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={mintToWallet} onChange={(e) => setMintToWallet(e.target.value)} placeholder="Recipient wallet address" />
              <select
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={mintVersionId}
                onChange={(e) => setMintVersionId(e.target.value)}
              >
                <option value="">Use current version</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version} • {v.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={mintSiteName} onChange={(e) => setMintSiteName(e.target.value)} placeholder="NFT name (optional)" />
              <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={mintDescription} onChange={(e) => setMintDescription(e.target.value)} placeholder="NFT description (optional)" />
              <button
                disabled={busy || !selectedSiteId || !canDeployOps || !mintContract.trim() || !mintToWallet.trim()}
                onClick={() =>
                  withBusy(async () => {
                    const data = await jsonFetch<any>(
                      `/api/site-builder/sites/${encodeURIComponent(selectedSiteId)}/mint`,
                      {
                        method: "POST",
                        body: JSON.stringify({
                          chainId: Number(mintChainId),
                          contract: mintContract.trim(),
                          toWallet: mintToWallet.trim(),
                          versionId: mintVersionId || undefined,
                          siteName: mintSiteName.trim() || undefined,
                          description: mintDescription.trim() || undefined,
                        }),
                      }
                    );
                    setMintPrepared(data);
                    setConfirmChainId(String(data?.mintIntent?.chainId || mintChainId));
                    setConfirmContract(String(data?.mintIntent?.contract || mintContract));
                    setConfirmOwnerWallet(mintToWallet.trim());
                    setNotice("Mint payload prepared. Execute wallet mint, then confirm below.");
                  })
                }
                className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                Prepare Mint Payload
              </button>
            </div>
            {mintPrepared ? (
              <>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void copyMintCallPayload()}
                    className="rounded-lg border border-cyan-500 px-3 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10"
                  >
                    Copy Mint Call
                  </button>
                </div>
                <pre className="mt-3 overflow-auto rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
                  {JSON.stringify(mintPrepared, null, 2)}
                </pre>
              </>
            ) : null}
          </section>
        </div>

        <section className={`mt-6 ${cardClass} p-5`}>
          <h2 className="text-lg font-semibold">Step 6: Mint Confirm (ownerOf verification)</h2>
          <p className="mt-1 text-xs text-slate-400">
            Paste chain, token, tx hash, and expected owner to sync ownership into the project record.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={confirmChainId} onChange={(e) => setConfirmChainId(e.target.value)} placeholder="Chain ID" />
            <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={confirmContract} onChange={(e) => setConfirmContract(e.target.value)} placeholder="Contract address" />
            <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={confirmTokenId} onChange={(e) => setConfirmTokenId(e.target.value)} placeholder="Token ID" />
            <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2" value={confirmTxHash} onChange={(e) => setConfirmTxHash(e.target.value)} placeholder="Mint transaction hash" />
            <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={confirmOwnerWallet} onChange={(e) => setConfirmOwnerWallet(e.target.value)} placeholder="Expected owner wallet" />
          </div>
          <button
            disabled={busy || !selectedSiteId || !confirmContract.trim() || !confirmTokenId.trim() || !confirmOwnerWallet.trim() || !confirmTxHash.trim()}
            onClick={() =>
              withBusy(async () => {
                await jsonFetch(`/api/site-builder/sites/${encodeURIComponent(selectedSiteId)}/mint/confirm`, {
                  method: "POST",
                  body: JSON.stringify({
                    chainId: Number(confirmChainId),
                    contract: confirmContract.trim(),
                    tokenId: confirmTokenId.trim(),
                    txHash: confirmTxHash.trim(),
                    expectedOwnerWallet: confirmOwnerWallet.trim(),
                  }),
                });
                await loadSites(selectedSiteId);
                setNotice("Mint confirmed and site ownership updated.");
              })
            }
            className="mt-3 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Confirm Mint
          </button>
        </section>

        </div>
        </details>

        <SiteBuilderAgentAttachWizard
          open={agentAttachWizardOpen}
          onDismiss={dismissAgentAttachWizard}
          siteClientId={selectedSite?.clientId ?? null}
          agents={agencyAgents}
          bindings={agencyWidgetBindings}
          workspaceClientPairs={workspacesList}
          widgetInSchema={Boolean(
            (parsedSchema as { metadata?: { widgetIntegration?: { widgetKey?: string } } } | null)?.metadata
              ?.widgetIntegration?.widgetKey,
          )}
          busy={agentWizardBusy}
          onAttach={(agentId) => void handleWizardAttachAgent(agentId)}
          onSkip={dismissAgentAttachWizard}
        />

        <SiteBuilderStickyBar
          stage={builderStage}
          onStageChange={setBuilderStage}
          busy={busy}
          aiPanelRef={aiPanelRef}
          selectedSiteId={selectedSiteId}
          canDeployOps={canDeployOps}
          onSaveVersion={persistVersionFromSticky}
          onOpenAdvanced={() => openAdvancedPanel("sticky_bar")}
          publishChecklist={builderStage === "publish" ? publishChecklist : undefined}
        />

        {activePopout ? (
          <div
            className={`fixed inset-0 z-[120] grid place-items-center bg-slate-950/75 p-4 transition-opacity duration-200 ${popoutExiting ? "opacity-0" : "opacity-100"}`}
            onMouseDown={() => closeBlockPopout()}
          >
            <div
              className={`w-full max-w-2xl rounded-2xl border border-orange-400/60 bg-slate-900/95 p-6 shadow-[0_0_0_1px_rgba(251,146,60,0.8),0_0_36px_rgba(249,115,22,0.35)] transition-all duration-200 ${popoutExiting ? "translate-y-2 scale-[0.98] opacity-0" : "translate-y-0 scale-100 opacity-100"}`}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-3xl font-bold capitalize text-slate-100">
                  {activePopout === "divider" && popoutDividerEditIndex !== null
                    ? "Edit divider"
                    : `Add ${activePopout === "link" ? "a link button" : activePopout}`}
                </h3>
                <button
                  type="button"
                  onClick={() => closeBlockPopout()}
                  className="rounded-full border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:border-orange-300"
                >
                  Close
                </button>
              </div>

              {activePopout === "avatar" ? (
                <div className="grid gap-4">
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">Image</label>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.svg,.gif,.webp"
                      onChange={(e) => void readPopoutImage(e.target.files, 3, (src, fileName) => {
                        setPopoutAvatarSrc(src);
                        setPopoutAvatarFileName(fileName);
                      })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      {popoutAvatarFileName || "No file chosen"} - .jpg, .jpeg, .png, .svg, .gif, .webp allowed. 3 MB max.
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-300">Size</label>
                      <select
                        value={popoutAvatarSize}
                        onChange={(e) => setPopoutAvatarSize(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      >
                        <option value="75x75">75x75px</option>
                        <option value="96x96">96x96px</option>
                        <option value="128x128">128x128px</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-300">Border Radius</label>
                      <select
                        value={popoutAvatarShape}
                        onChange={(e) => setPopoutAvatarShape(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      >
                        <option value="square">Straight</option>
                        <option value="rounded">Rounded</option>
                        <option value="circle">Circle</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm text-slate-300">Border Width</label>
                      <input
                        type="range"
                        min={0}
                        max={12}
                        value={popoutAvatarBorderWidth}
                        onChange={(e) => setPopoutAvatarBorderWidth(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="mt-1 text-xs text-slate-500">{popoutAvatarBorderWidth}px</div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-300">Border Style</label>
                      <select
                        value={popoutAvatarBorderStyle}
                        onChange={(e) => setPopoutAvatarBorderStyle(e.target.value as "solid" | "dashed")}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-300">Border Color</label>
                      <input
                        type="color"
                        value={popoutAvatarBorderColor}
                        onChange={(e) => setPopoutAvatarBorderColor(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {activePopout === "link" ? (
                <div className="grid gap-4">
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">Destination URL</label>
                    <input
                      value={popoutLinkHref}
                      onChange={(e) => setPopoutLinkHref(e.target.value)}
                      placeholder="https://example.com/sample-link"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">Name</label>
                    <input
                      value={popoutLinkLabel}
                      onChange={(e) => setPopoutLinkLabel(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : null}

              {activePopout === "paragraph" ? (
                <div>
                  <label className="mb-1 block text-sm text-slate-300">Text</label>
                  <textarea
                    value={popoutParagraphText}
                    onChange={(e) => setPopoutParagraphText(e.target.value)}
                    className="min-h-[180px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
              ) : null}

              {activePopout === "heading" ? (
                <div className="grid gap-4">
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">Type</label>
                    <select
                      value={popoutHeadingLevel}
                      onChange={(e) => setPopoutHeadingLevel(e.target.value)}
                      className="w-full rounded-lg border border-cyan-400 bg-slate-950 px-3 py-2 text-sm"
                    >
                      <option value="h1">H1</option>
                      <option value="h2">H2</option>
                      <option value="h3">H3</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">Text</label>
                    <input
                      value={popoutHeadingText}
                      onChange={(e) => setPopoutHeadingText(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : null}

              {activePopout === "image" ? (
                <div className="grid gap-4">
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">Image</label>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.svg,.gif,.webp"
                      onChange={(e) => void readPopoutImage(e.target.files, 2, (src, fileName) => {
                        setPopoutImageSrc(src);
                        setPopoutImageFileName(fileName);
                      })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      {popoutImageFileName || "No file chosen"} - 2 MB maximum.
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">Image alt</label>
                    <input
                      value={popoutImageAlt}
                      onChange={(e) => setPopoutImageAlt(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">Destination URL</label>
                    <input
                      value={popoutImageHref}
                      onChange={(e) => setPopoutImageHref(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : null}

              {activePopout === "video" ? (
                <div className="grid gap-4">
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">Video File (MP4/Video)</label>
                    <input
                      type="file"
                      accept="video/mp4,video/*"
                      onChange={(e) => void readPopoutVideo(e.target.files, 40, (src, fileName) => {
                        setPopoutVideoSrc(src);
                        setPopoutVideoFileName(fileName);
                      })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      {popoutVideoFileName || "No file chosen"} - up to 40MB.
                    </div>
                  </div>
                  {popoutVideoSrc ? (
                    <video src={popoutVideoSrc} controls playsInline className="w-full rounded-xl border border-slate-700 bg-slate-950" />
                  ) : null}
                </div>
              ) : null}

              {activePopout === "divider" ? (
                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-300">Variant</label>
                      <select
                        value={popoutDividerVariant}
                        onChange={(e) => {
                          const variant = (e.target.value === "thin" || e.target.value === "thick" ? e.target.value : "medium") as "thin" | "medium" | "thick";
                          updateDividerPopout({
                            variant,
                            thickness: dividerThicknessForVariant(variant),
                          });
                        }}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      >
                        <option value="thin">Thin</option>
                        <option value="medium">Medium</option>
                        <option value="thick">Thick</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-300">Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={popoutDividerColor}
                          onChange={(e) => updateDividerPopout({ color: e.target.value })}
                          className="h-10 w-14 rounded-lg border border-slate-700 bg-slate-950"
                        />
                        <input
                          value={popoutDividerColor}
                          onChange={(e) => updateDividerPopout({ color: e.target.value })}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">Thickness</label>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={popoutDividerThickness}
                      onChange={(e) => updateDividerPopout({ thickness: Number(e.target.value) })}
                      className="w-full"
                    />
                    <div className="mt-1 text-xs text-slate-500">{popoutDividerThickness}px</div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">Vertical Spacing / Position</label>
                    <input
                      type="range"
                      min={-120}
                      max={120}
                      step={1}
                      value={popoutDividerOffsetY}
                      onChange={(e) => updateDividerPopout({ offsetY: Number(e.target.value) })}
                      className="w-full"
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      {popoutDividerOffsetY > 0 ? `Down ${popoutDividerOffsetY}px` : popoutDividerOffsetY < 0 ? `Up ${Math.abs(popoutDividerOffsetY)}px` : "Centered"}
                      {popoutDividerEditIndex !== null ? " - live preview updating" : ""}
                    </div>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={submitPopoutBlock}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-red-500 px-4 py-3 text-lg font-semibold text-white hover:brightness-110"
              >
                Submit
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
