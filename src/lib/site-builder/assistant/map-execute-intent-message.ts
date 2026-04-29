import type { BuilderAction } from "@/lib/site-builder/builder-actions/action-schemas";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import {
  type ExecuteIntentKind,
  type ExecuteIntentMappingInput,
  type ExecuteIntentResponse,
  classifyIntentFromActions,
  emptyExecuteIntentResponse,
} from "@/lib/site-builder/assistant/execute-intent-types";
import { resolveSectionIdForExecuteIntent } from "@/lib/site-builder/assistant/resolve-execute-intent-section";
import { normalizeCssColor } from "@/lib/site-builder/builder-actions/section-style-apply";

const UUID_IN_TEXT_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function extractUuidFromText(message: string): string | null {
  const m = message.match(UUID_IN_TEXT_RE);
  return m ? m[0]!.toLowerCase() : null;
}

function extractEmailFromText(message: string): string | null {
  const m = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0]! : null;
}

function schemaLinkedClientId(schema: SiteSchemaDocumentType): string | null {
  const cid = typeof schema.metadata?.clientId === "string" ? schema.metadata.clientId.trim() : "";
  if (cid && UUID_IN_TEXT_RE.test(cid)) return cid.toLowerCase();
  const cp = schema.metadata?.clientPortal?.clientId;
  if (typeof cp === "string" && UUID_IN_TEXT_RE.test(cp)) return cp.toLowerCase();
  return null;
}

function extractLooseColor(message: string, contextWords: string[]): string | undefined {
  const lower = message.toLowerCase();
  const color = "(#[0-9a-f]{3,6}|white|black|blue|red|green|yellow|orange|purple|teal|cyan|indigo|pink|gray|grey|navy)";
  for (const w of contextWords) {
    const after = new RegExp(`${w}[^#a-z0-9]{0,12}${color}`, "i");
    const before = new RegExp(`${color}[^#a-z0-9]{0,12}${w}`, "i");
    const m1 = lower.match(after);
    if (m1?.[1]) return m1[1];
    const m2 = lower.match(before);
    if (m2?.[1]) return m2[1];
  }
  return undefined;
}

function mapAttachAgentAppearanceIntent(input: ExecuteIntentMappingInput): ExecuteIntentResponse | null {
  const ml = input.message.toLowerCase();
  if (!/\b(attach|bind|connect)\b.*\b(agent|assistant)\b/.test(ml) && !/\bai bubble\b|\bwidget\b/.test(ml)) {
    return null;
  }
  const agentId = extractUuidFromText(input.message);
  if (!agentId) return null;
  const avatarBorderColor = extractLooseColor(ml, ["border", "avatar border"]);
  const widgetBubbleColor = extractLooseColor(ml, ["bubble", "launcher"]);
  const widgetHeaderColor = extractLooseColor(ml, ["header", "chat header"]);
  const widgetWindowBackgroundColor = extractLooseColor(ml, ["window", "background", "chat window"]);
  return {
    actions: [
      {
        action: "attach_agent_to_client_site",
        agentId,
        ...(avatarBorderColor ? { avatarBorderColor } : {}),
        ...(widgetBubbleColor ? { widgetBubbleColor } : {}),
        ...(widgetHeaderColor ? { widgetHeaderColor } : {}),
        ...(widgetWindowBackgroundColor ? { widgetWindowBackgroundColor } : {}),
      },
    ],
    assistantReply:
      "I can attach that agent and carry over avatar/bubble/header colors. If you also want an uploaded avatar image, add it in Agent Control after binding.",
    meta: { intent: "structural_edit", needsClarification: false },
  };
}

function mapClientHandoffIntents(input: ExecuteIntentMappingInput): ExecuteIntentResponse | null {
  const ml = input.message.toLowerCase().trim();
  const cid = schemaLinkedClientId(input.schema) || extractUuidFromText(input.message);

  const wantsPrepare =
    /\bprepare client portal\b|\bsync client portal\b|\b(prepare|sync)\b.*\b(client portal|portal metadata)\b/.test(ml);
  if (wantsPrepare) {
    if (!cid) {
      return emptyExecuteIntentResponse({
        assistantReply: "Link a Revenue OS client to this site first, then I can prepare portal metadata on the draft.",
        meta: {
          intent: "unclear",
          needsClarification: true,
          clarificationQuestion: "Which hub client should this site use?",
        },
      });
    }
    return {
      actions: [{ action: "prepare_client_portal", buildForClient: true, siteClientId: cid }],
      assistantReply: "I'll sync client portal and lead-capture metadata for that client on the draft.",
      meta: { intent: "structural_edit", needsClarification: false },
    };
  }

  const wantsOpenHub =
    /\b(open|show)\b.*\b(client (command center|hub))\b|\bclient command center\b|\bopen client hub\b/.test(ml);
  if (wantsOpenHub) {
    if (!cid) {
      return emptyExecuteIntentResponse({
        assistantReply: "I need a client id — pick a hub client for this project or paste a UUID in your message.",
        meta: {
          intent: "unclear",
          needsClarification: true,
          clarificationQuestion: "What is the Revenue OS client id?",
        },
      });
    }
    return {
      actions: [{ action: "open_client_command_center", clientId: cid }],
      assistantReply: "Use the Client Hub command center link from the apply summary (new tab recommended).",
      meta: { intent: "deploy", needsClarification: false },
    };
  }

  const wantsInvite =
    /\binvite\b.*\b(client|portal)\b|\bportal invite\b|\binvite to (the )?portal\b|\bsend (a )?portal invite\b/.test(ml);
  if (wantsInvite) {
    const email = extractEmailFromText(input.message);
    if (!cid || !email) {
      return emptyExecuteIntentResponse({
        assistantReply:
          "To stage a portal invite I need the client email in the same message and a linked client id — nothing is sent until you confirm in Client Hub.",
        meta: {
          intent: "unclear",
          needsClarification: true,
          clarificationQuestion: "Paste the client email and ensure this site is linked to the right hub client.",
        },
      });
    }
    return {
      actions: [{ action: "invite_client_to_portal", clientId: cid, email, confirmed: false }],
      assistantReply:
        "Staged invite_client_to_portal with confirmed:false — the server only sends after confirmed:true once you verify the address in Client Hub.",
      meta: { intent: "structural_edit", needsClarification: false },
    };
  }

  return null;
}

function splitCompound(message: string): string[] {
  const t = message.replace(/\s+/g, " ").trim();
  if (/\band\b/i.test(t)) {
    return t
      .split(/\s+and\s+/i)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [t];
}

function extractUrl(message: string): string | null {
  const m = message.match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0]!.trim() : null;
}

function mapDomainConnectionIntent(input: ExecuteIntentMappingInput): ExecuteIntentResponse | null {
  const ml = input.message.toLowerCase();
  const wantsConnect =
    /\bfreename\b|\.crypto\b|\.web3\b|\bweb3 domain\b|\bfreename domain\b|\bconnect (my|our|the) .{0,40}domain\b|\buse my .{0,30}\.(crypto|web3|x|eth|nft)\b/i.test(
      ml,
    );
  if (!wantsConnect) return null;
  const url = extractUrl(input.message);
  const domainMatch = input.message.match(
    /\b([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+)\b/i,
  );
  let domain = (domainMatch?.[1] ?? "").toLowerCase();
  if (!domain || /\.(vercel\.app|github\.io|netlify\.app)\b/i.test(domain)) {
    domain = "";
  }
  if (!url || !domain) {
    return emptyExecuteIntentResponse({
      assistantReply:
        "I can set up a Freename / Web3 domain connection. Send both the domain (e.g. brand.crypto) and your public https URL (Vercel deployment or static site) in the same message.",
      meta: {
        intent: "unclear",
        needsClarification: true,
        clarificationQuestion: "What is the Web3 domain and the https URL it should point to?",
      },
    });
  }
  return {
    actions: [
      {
        action: "upsert_domain_connection",
        domain,
        domainType: "freename_web3",
        provider: "freename",
        deploymentTarget: "vercel_deployment_url",
        targetUrl: url,
      },
    ],
    assistantReply:
      "I’ll save the Web3 domain connection and DNS-style instructions on the project. Open **Connect Domain** in Advanced to copy the checklist and run Re-check when live.",
    meta: { intent: "structural_edit", needsClarification: false },
  };
}

function pageSlug(ctx: ExecuteIntentMappingInput["editContext"]): string {
  const s = ctx.lastPageSlug.trim();
  return s || "/";
}

function wantsStyle(messageLower: string): boolean {
  return (
    /\b(modern|minimal|bold|corporate|sleek|contemporary|futuristic|web3|professional|clean|punchy)\b/.test(messageLower) ||
    /\b(cinematic|holograph|holographic|immersive|neon|glow(ing)?|glassmorphism|parallax|premium|high-end)\b/.test(
      messageLower,
    ) ||
    /\b(make it cinematic|more cinematic|more premium|glowing buttons|glow buttons|holographic gradient)\b/.test(
      messageLower,
    ) ||
    (/\b(make it|make the site|make the background)\b/.test(messageLower) && /\b(modern|minimal|bold|corporate|white|light|dark)\b/.test(messageLower))
  );
}

function buildSetThemeTokens(messageLower: string): BuilderAction | null {
  if (/\bmake the background white\b|\bchange the background to white\b|\bbackground to white\b/.test(messageLower)) {
    return {
      action: "set_theme_tokens",
      styleMode: "bold",
      backgroundMode: "custom_color",
      backgroundColor: "#ffffff",
      gradientStart: "#ffffff",
      gradientEnd: "#f8fafc",
      depthStyle: "card-depth",
      buttonStyle: "bold-solid",
    };
  }
  if (/\b(remove|no)\s+dark\s+background\b|\bnot\s+dark\b.*\bbackground\b/.test(messageLower)) {
    return {
      action: "set_theme_tokens",
      backgroundMode: "white-editorial",
      gradientStart: "#ffffff",
      gradientEnd: "#f1f5f9",
      gradientStyle: "soft-mesh",
      depthStyle: "card-depth",
    };
  }
  if (/\bmake it cinematic\b|\bmore cinematic\b|\b(cinematic|movie-like) (look|visual|style|site)\b/.test(messageLower)) {
    return {
      action: "set_theme_tokens",
      styleMode: "web3",
      backgroundMode: "holographic-gradient",
      gradientStart: "#0f172a",
      gradientEnd: "#4c1d95",
      gradientStyle: "aurora",
      buttonStyle: "glow",
      depthStyle: "cinematic-layered",
      motionHint: "subtle-parallax",
    };
  }
  if (/\bholographic gradient(s)?\b/.test(messageLower)) {
    return {
      action: "set_theme_tokens",
      backgroundMode: "holographic-gradient",
      gradientStyle: "neon-radial",
      buttonStyle: "glow",
      motionHint: "floating-orbs",
    };
  }
  if (/\b(glow(ing)?\s+button|glowing\s+cta|make the buttons glow)\b/.test(messageLower)) {
    return {
      action: "set_theme_tokens",
      buttonStyle: "glow",
      backgroundMode: "holographic-gradient",
      gradientStart: "#0f172a",
      gradientEnd: "#312e81",
    };
  }
  if (/\b(look more premium|more premium|luxury (look|feel|finish))\b/.test(messageLower)) {
    return {
      action: "set_theme_tokens",
      backgroundMode: "luxury-minimal",
      gradientStyle: "chrome",
      buttonStyle: "chrome",
      depthStyle: "cinematic-layered",
    };
  }
  if (/\b(bold|heavy|thicker)\s+text\b|\bmake the text bold\b/.test(messageLower)) {
    return { action: "set_theme_tokens", styleMode: "bold" };
  }
  if (/\bweb3\b|\bfuturistic\b/.test(messageLower)) {
    return {
      action: "set_theme_tokens",
      styleMode: "web3",
      backgroundMode: "abstract_gradients",
      gradientStart: "#0f172a",
      gradientEnd: "#22d3ee",
    };
  }
  if (/\bcorporate\b|\bprofessional\b/.test(messageLower)) {
    return {
      action: "set_theme_tokens",
      styleMode: "corporate",
      backgroundMode: "simple_gradients",
      gradientStart: "#0f172a",
      gradientEnd: "#334155",
    };
  }
  if (/\bbold\b|\bpunchy\b/.test(messageLower)) {
    return {
      action: "set_theme_tokens",
      styleMode: "bold",
      backgroundMode: "abstract_gradients",
      gradientStart: "#1e1b4b",
      gradientEnd: "#f97316",
    };
  }
  if (/\bminimal\b|\bclean\b/.test(messageLower)) {
    return {
      action: "set_theme_tokens",
      styleMode: "minimal",
      backgroundMode: "simple_gradients",
      gradientStart: "#f8fafc",
      gradientEnd: "#e2e8f0",
    };
  }
  if (/\bmodern\b|\bsleek\b|\bcontemporary\b/.test(messageLower) || /\bmore modern\b/.test(messageLower)) {
    return {
      action: "set_theme_tokens",
      styleMode: "minimal",
      backgroundMode: "abstract_gradients",
      gradientStart: "#0f172a",
      gradientEnd: "#6366f1",
    };
  }
  return null;
}

function mapAddSection(messageLower: string, slug: string): BuilderAction | null {
  if (!/\b(add|insert|create)\b/.test(messageLower)) return null;
  if (/\bpricing\b/.test(messageLower)) {
    return {
      action: "add_section",
      pageSlug: slug,
      template: "section",
      contentPatch: {
        title: "Pricing",
        body: "Add your plans and packages here.",
        aiRegistryKey: "feature_grid",
      },
    };
  }
  if (/\bfaq\b/.test(messageLower)) {
    return {
      action: "add_section",
      pageSlug: slug,
      template: "section",
      contentPatch: {
        title: "FAQ",
        body: "Add common questions and answers.",
        aiRegistryKey: "faq",
      },
    };
  }
  if (/\b(testimonial|social proof)\b/.test(messageLower)) {
    return {
      action: "add_section",
      pageSlug: slug,
      template: "section",
      contentPatch: {
        title: "Testimonials",
        body: "Add quotes from happy clients.",
        aiRegistryKey: "social_proof",
      },
    };
  }
  if (/\bsection\b/.test(messageLower)) {
    return {
      action: "add_section",
      pageSlug: slug,
      template: "section",
      contentPatch: { title: "New section", body: "Replace this copy with your content." },
    };
  }
  return null;
}

function mapRemoveSection(
  doc: SiteSchemaDocumentType,
  messageLower: string,
  slug: string,
  lastSectionIds: string[],
): { action: BuilderAction } | { clarification: string } | null {
  if (!/\b(remove|delete|get rid of|drop)\b/.test(messageLower)) return null;
  const resolved = resolveSectionIdForExecuteIntent(doc, slug, messageLower, lastSectionIds);
  if (!resolved.ok) return { clarification: resolved.clarificationQuestion };
  return {
    action: {
      action: "remove_section",
      pageSlug: slug,
      aiSectionId: resolved.sectionId,
    },
  };
}

function mapRegenerateSection(
  doc: SiteSchemaDocumentType,
  messageLower: string,
  slug: string,
  lastSectionIds: string[],
  instruction: string,
): { action: BuilderAction } | { clarification: string } | null {
  const wantsRegen =
    /\b(rewrite|regenerate|refresh|redo|rebuild)\b/.test(messageLower) ||
    /\b(shorten|tighten|punch up)\b/.test(messageLower) ||
    /\b(headline|title|subhead|subtitle|copy)\b/.test(messageLower);
  if (!wantsRegen) return null;
  const resolved = resolveSectionIdForExecuteIntent(doc, slug, messageLower, lastSectionIds);
  if (!resolved.ok) return { clarification: resolved.clarificationQuestion };
  const instr =
    instruction.trim().slice(0, 4000) ||
    (/\bshorten\b/.test(messageLower) ? "Shorten headlines and supporting copy while keeping meaning." : messageLower.slice(0, 4000));
  return {
    action: {
      action: "regenerate_section",
      sectionId: resolved.sectionId,
      instruction: instr,
    },
  };
}

function mapImport(message: string, messageLower: string): BuilderAction | { clarification: string } | null {
  if (!/\b(import|clone|pull in)\b/.test(messageLower)) return null;
  const url = extractUrl(message);
  if (!url) {
    return { clarification: "Paste the full URL you want to import (including https://)." };
  }
  return { action: "import_blueprint_from_url", url } satisfies BuilderAction;
}

function mapDeployOrFullSite(messageLower: string): ExecuteIntentResponse | null {
  if (/\b(publish|deploy|go live|push live)\b/.test(messageLower)) {
    return emptyExecuteIntentResponse({
      assistantReply: "Use the Publish / Deploy controls in the builder when you are ready to go live.",
      meta: { intent: "deploy", needsClarification: false },
    });
  }
  if (/\b(rebuild entire|regenerate entire|redo the whole site|start over from scratch)\b/.test(messageLower)) {
    return emptyExecuteIntentResponse({
      assistantReply: "Regenerating the full site uses the main Generate flow — use Generate my site after confirming intake.",
      meta: { intent: "pipeline_full", needsClarification: false },
    });
  }
  return null;
}

function buildAssistantReply(actions: BuilderAction[]): string {
  if (actions.length === 0) return "";
  const verbs: string[] = [];
  for (const a of actions) {
    if (a.action === "set_theme_tokens") verbs.push("refresh the visual theme");
    if (a.action === "set_section_background") verbs.push("update that section's background");
    if (a.action === "set_section_text_color") verbs.push("tune section text color");
    if (a.action === "set_section_accent_color") verbs.push("set section accent color");
    if (a.action === "update_section_style") verbs.push("refine section styling");
    if (a.action === "regenerate_section") verbs.push("regenerate a section with AI");
    if (a.action === "add_section") verbs.push("add a new section");
    if (a.action === "remove_section") verbs.push("remove a section");
    if (a.action === "import_blueprint_from_url") verbs.push("import a page from a URL");
    if (a.action === "apply_seo_enrichment") verbs.push("refresh SEO metadata and on-page signals");
  }
  const uniq = [...new Set(verbs)];
  if (uniq.length === 0) return "I'll apply those builder updates.";
  if (uniq.length === 1) return `I'll ${uniq[0]}.`;
  return `I'll ${uniq.slice(0, -1).join(", ")}, and ${uniq[uniq.length - 1]}.`;
}

function pushClarified(out: BuilderAction[], next: { action: BuilderAction } | { clarification: string } | null) {
  if (!next) return null;
  if ("clarification" in next) return next.clarification;
  out.push(next.action);
  return null;
}

function mapSeoEnrichment(fragment: string, messageLower: string): BuilderAction | null {
  if (!/\b(seo|serp|search engine|optimize for|local search|meta description|meta title|keywords?|ranking for)\b/i.test(messageLower)) {
    return null;
  }
  if (/\b(import|remove|delete|add\s+section|rewrite|regenerate)\b/i.test(messageLower)) return null;
  return { action: "apply_seo_enrichment", focusPrompt: fragment.trim().slice(0, 4000) };
}

function wantsFullSiteBackgroundOnly(messageLower: string): boolean {
  return /\b(full page|entire page|whole site|site-?wide|globally)\s+(background|theme)\b/.test(messageLower);
}

function wantsNamedSectionKeyword(messageLower: string): boolean {
  return /\b(hero|footer|faq|pricing|stats?\b|stat band|cta|call to action)\b/.test(messageLower);
}

function wantsSectionStyleScope(messageLower: string): boolean {
  if (wantsFullSiteBackgroundOnly(messageLower)) return false;
  return (
    /\b(this section|selected section|that section|the selected section)\b/.test(messageLower) ||
    /\b(of|for)\s+(the\s+)?(this|selected|that)\s+section\b/.test(messageLower) ||
    /\b(selected\s+)?section\s+(background|bg|backdrop|foreground|accent)\b/.test(messageLower) ||
    /\b(background|bg|backdrop|foreground|accent)\b[^.]{0,60}\b(this|that|the\s+selected)\s+section\b/.test(
      messageLower,
    ) ||
    (/\bmake\b/.test(messageLower) && /\b(this|the|that|selected)\s+section\b/.test(messageLower))
  );
}

function hasLooseColorToken(messageLower: string): boolean {
  return /\b(white|black|light|dark|grey|gray|navy|blue|red|green|teal|orange|purple|#[0-9a-f]{3,8})\b/.test(
    messageLower,
  );
}

function wantsSectionBackgroundEdit(messageLower: string): boolean {
  if (wantsFullSiteBackgroundOnly(messageLower)) return false;
  const colorish = hasLooseColorToken(messageLower);
  const bgWords = /\b(background|bg|backdrop)\b/.test(messageLower);
  const makeSection =
    /\bmake\b/.test(messageLower) && /\b(this|the|that|selected)\s+section\b/.test(messageLower) && colorish;
  const named = wantsNamedSectionKeyword(messageLower) && bgWords && colorish;
  const scoped = wantsSectionStyleScope(messageLower) && (bgWords || makeSection);
  return Boolean(named || scoped);
}

function wantsSectionTextColorIntent(messageLower: string): boolean {
  if (!hasLooseColorToken(messageLower)) return false;
  const tw = /\b(text\s*colou?r|foreground|font\s*colou?r)\b/.test(messageLower);
  if (!tw) return false;
  return wantsSectionStyleScope(messageLower) || wantsNamedSectionKeyword(messageLower);
}

function wantsSectionAccentColorIntent(messageLower: string): boolean {
  if (!hasLooseColorToken(messageLower)) return false;
  const aw = /\b(accent\s*colou?r|highlight\s*colou?r|accent\b)\b/.test(messageLower);
  if (!aw) return false;
  return wantsSectionStyleScope(messageLower) || wantsNamedSectionKeyword(messageLower);
}

function extractSectionIntentColor(fragment: string, messageLower: string, kind: "bg" | "text" | "accent"): string {
  const ctx =
    kind === "bg"
      ? ["background", "bg", "section", "to", "white", "black", "light", "dark"]
      : kind === "text"
        ? ["text", "color", "foreground", "to", "white", "black"]
        : ["accent", "highlight", "to", "border"];
  const loose = extractLooseColor(fragment, ctx);
  if (loose) return normalizeCssColor(loose);
  if (/\bwhite\b/.test(messageLower)) return "#ffffff";
  if (/\bblack\b/.test(messageLower)) return "#000000";
  if (/\blight\b/.test(messageLower) && kind === "bg") return "#f8fafc";
  return "#6366f1";
}

function mapSectionSurfaceStyle(
  doc: SiteSchemaDocumentType,
  fragment: string,
  editContext: ExecuteIntentMappingInput["editContext"],
): { actions: BuilderAction[]; clarification?: string } | null {
  const ml = fragment.toLowerCase();
  const slug = pageSlug(editContext);
  const bg = wantsSectionBackgroundEdit(ml);
  const tx = wantsSectionTextColorIntent(ml);
  const ac = wantsSectionAccentColorIntent(ml) && !bg && !tx;
  if (!bg && !tx && !ac) return null;

  const resolved = resolveSectionIdForExecuteIntent(doc, slug, ml, editContext.lastSectionIds);
  if (!resolved.ok) {
    return { actions: [], clarification: resolved.clarificationQuestion };
  }

  const actions: BuilderAction[] = [];
  if (bg) {
    actions.push({
      action: "set_section_background",
      pageSlug: slug,
      sectionId: resolved.sectionId,
      color: extractSectionIntentColor(fragment, ml, "bg"),
      ...(editContext.lastSectionIds.includes(resolved.sectionId)
        ? { scope: "selected_section" as const }
        : {}),
    });
  }
  if (tx) {
    actions.push({
      action: "set_section_text_color",
      pageSlug: slug,
      sectionId: resolved.sectionId,
      color: extractSectionIntentColor(fragment, ml, "text"),
    });
  }
  if (ac) {
    actions.push({
      action: "set_section_accent_color",
      pageSlug: slug,
      sectionId: resolved.sectionId,
      color: extractSectionIntentColor(fragment, ml, "accent"),
    });
  }
  return { actions };
}

function mapSingleFragment(
  doc: SiteSchemaDocumentType,
  fragment: string,
  editContext: ExecuteIntentMappingInput["editContext"],
): { actions: BuilderAction[]; clarification?: string } {
  const slug = pageSlug(editContext);
  const ml = fragment.toLowerCase();
  const actions: BuilderAction[] = [];

  const imp = mapImport(fragment, ml);
  if (imp && "clarification" in imp) return { actions: [], clarification: imp.clarification };
  if (imp) actions.push(imp);

  const add = mapAddSection(ml, slug);
  if (add) actions.push(add);

  const rem = mapRemoveSection(doc, ml, slug, editContext.lastSectionIds);
  const remCl = pushClarified(actions, rem);
  if (typeof remCl === "string") return { actions: [], clarification: remCl };

  const secStyle = mapSectionSurfaceStyle(doc, fragment, editContext);
  if (secStyle?.clarification) return { actions: [], clarification: secStyle.clarification };
  if (secStyle?.actions.length) actions.push(...secStyle.actions);

  const seo = mapSeoEnrichment(fragment, ml);
  if (seo) actions.push(seo);

  if (wantsStyle(ml)) {
    const st = buildSetThemeTokens(ml);
    if (st) actions.push(st);
  }

  const regen = mapRegenerateSection(doc, ml, slug, editContext.lastSectionIds, fragment);
  const regCl = pushClarified(actions, regen);
  if (typeof regCl === "string") return { actions: [], clarification: regCl };

  return { actions };
}

/**
 * Live preview uses `metadata.theme.backgroundMode === "custom_color"` + `theme.backgroundColor`.
 * Style-only phrases (web3, bold, …) otherwise keep gradient backgrounds; merge a light surface when the user asks for white/light backgrounds.
 */
function mergeLightSurfaceBackgroundIntent(fullLower: string, actions: BuilderAction[]): BuilderAction[] {
  if (actions.some((a) => a.action === "set_section_background")) return actions;
  const wantsBold = /\bbold\b|\bpunchy\b/.test(fullLower);
  const wantsLightSurface =
    /\b(light|white)\s+background\b/.test(fullLower) ||
    /\bbackground\s+(to\s+)?(white|light|#fff|#ffffff)\b/.test(fullLower) ||
    (/\bwhite\b/.test(fullLower) && /\b(background|bg|backdrop|page)\b/.test(fullLower)) ||
    (/\b#fff(f{3})?\b/.test(fullLower) && /\b(background|bg)\b/.test(fullLower));

  if (!wantsLightSurface) return actions;

  const themes = actions.filter((a): a is Extract<BuilderAction, { action: "set_theme_tokens" }> => a.action === "set_theme_tokens");
  const rest = actions.filter((a) => a.action !== "set_theme_tokens");

  let base: Extract<BuilderAction, { action: "set_theme_tokens" }> = { action: "set_theme_tokens", styleMode: "minimal" };
  for (const t of themes) {
    const { action: _a, ...fields } = t;
    base = { ...base, ...fields, action: "set_theme_tokens" };
  }

  const next: Extract<BuilderAction, { action: "set_theme_tokens" }> = {
    ...base,
    backgroundMode: "custom_color",
    backgroundColor: "#ffffff",
    gradientStart: "#ffffff",
    gradientEnd: "#ffffff",
    styleMode: wantsBold ? "bold" : base.styleMode ?? "minimal",
  };

  return [...rest, next];
}

/**
 * Deterministic NL → `BuilderAction[]` for the Site Builder assistant.
 */
export function mapExecuteIntentMessage(input: ExecuteIntentMappingInput): ExecuteIntentResponse {
  const full = input.message.trim();
  if (!full) {
    return emptyExecuteIntentResponse({
      assistantReply: "Tell me what you would like to change.",
      meta: { intent: "unclear", needsClarification: true, clarificationQuestion: "What should I update?" },
    });
  }

  const domainConn = mapDomainConnectionIntent(input);
  if (domainConn) return domainConn;
  const handoff = mapClientHandoffIntents(input);
  if (handoff) return handoff;
  const attach = mapAttachAgentAppearanceIntent(input);
  if (attach) return attach;

  const deploy = mapDeployOrFullSite(full.toLowerCase());
  if (deploy) return deploy;

  const parts = splitCompound(full);
  const merged: BuilderAction[] = [];
  let clarification: string | undefined;

  for (const part of parts) {
    const r = mapSingleFragment(input.schema, part, input.editContext);
    if (r.clarification) {
      clarification = r.clarification;
      break;
    }
    merged.push(...r.actions);
  }

  if (clarification) {
    return emptyExecuteIntentResponse({
      assistantReply: clarification,
      meta: { intent: "unclear", needsClarification: true, clarificationQuestion: clarification },
    });
  }

  const surfaceAdjusted = mergeLightSurfaceBackgroundIntent(full.toLowerCase(), merged);

  if (surfaceAdjusted.length === 0) {
    return emptyExecuteIntentResponse({
      assistantReply:
        "I am not sure how to map that yet — try naming a section (hero, FAQ, pricing) or select a block on the canvas.",
      meta: {
        intent: "unclear",
        needsClarification: true,
        clarificationQuestion: "Which section should change, and should it be style, copy, or a full section refresh?",
      },
    });
  }

  const intent: ExecuteIntentKind = classifyIntentFromActions(surfaceAdjusted);
  return {
    actions: surfaceAdjusted,
    assistantReply: buildAssistantReply(surfaceAdjusted),
    meta: { intent, needsClarification: false },
  };
}
