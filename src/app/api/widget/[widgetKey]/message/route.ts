import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { answerFromKnowledgeOnly, buildKnowledgeContextFromRows } from "@/lib/agents/retrieval";
import { getIndustryLabels, parseIndustriesJson } from "@/lib/agents/industry-mapper";
import { getDb } from "@/lib/db";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { runAgentLlmReply } from "@/lib/agents/agent-tool-runtime";
import { normalizeConversationHistory } from "@/lib/agent-plugins/conversation-normalize";
import { aiAgents, aiAgentKnowledgeItems, aiAgentSiteBindings, retSessions, web3Sites } from "@/lib/db/schema";
import { retSnapshotFromDraftJson } from "@/lib/ret/session-snapshot";
import { isOriginAllowed, parseAllowedDomains } from "@/lib/widget/allowed-domains";
import { logWebChatMessage } from "@/lib/widget/crm-logger";
import { checkRateLimit } from "@/lib/widget/rate-limit";
import { tryMaaniaDeterministicReply } from "@/lib/maania/maania-deterministic-reply";
import { appendWidgetContextToSystemPrompt, type WidgetMessageContext } from "@/lib/widget/context-prompt";
import { parseWidgetBindingMetadata } from "@/lib/widget/widget-binding-metadata";
import { resolveSiteBuilderLlmInvokeForSite } from "@/lib/site-builder/ai/provider-resolver";
import { loadSiteSummaryTextForWidget } from "@/lib/widget/site-widget-grounding";
import { getServiceStatusForClientId } from "@/lib/client-portal/client-service-status";
import {
  appendWidgetMessage,
  extractOriginHost,
  getOrResumeWidgetConversation,
} from "@/lib/widget/widget-conversation-service";

type Params = { params: Promise<{ widgetKey: string }> };

const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONTEXT_JSON_CHARS = 32000;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function jsonWidget(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, ...extraHeaders } });
}

/**
 * Public chat endpoint. Rate-limited, origin-checked, input-limited.
 * Persists transcript to `widget_conversations` / `widget_messages`.
 * Response includes `conversationId` (public id) for resume via `conversationId` on the next POST.
 */
export async function POST(req: NextRequest, { params }: Params) {
  let convCtx: { internalId: string; publicId: string } | null = null;

  try {
    const { widgetKey } = await params;
    if (!widgetKey) return jsonWidget({ error: "widgetKey required" }, 400);

    const originHdr = req.headers.get("origin") || "";
    const refererHdr = req.headers.get("referer") || "";
    const origin = originHdr || refererHdr || "";
    const ip = getClientIp(req);

    const db = await getDb();

    const rows = await db
      .select({
        bindingId: aiAgentSiteBindings.id,
        widgetKey: aiAgentSiteBindings.widgetKey,
        agentId: aiAgents.id,
        agentName: aiAgents.name,
        userId: aiAgents.userId,
        siteId: aiAgentSiteBindings.siteId,
        bindingClientId: aiAgentSiteBindings.clientId,
        siteName: web3Sites.name,
        bindingMetadata: aiAgentSiteBindings.metadata,
        systemPrompt: aiAgents.systemPrompt,
        language: aiAgents.language,
        industriesJson: aiAgents.industriesJson,
        status: aiAgents.status,
        allowedDomains: aiAgentSiteBindings.allowedDomains,
        llmEndpoint: aiAgents.llmEndpoint,
        llmApiKeyEnc: aiAgents.llmApiKeyEnc,
        model: aiAgents.model,
      })
      .from(aiAgentSiteBindings)
      .innerJoin(aiAgents, eq(aiAgents.id, aiAgentSiteBindings.agentId))
      .innerJoin(
        web3Sites,
        and(
          eq(web3Sites.id, aiAgentSiteBindings.siteId),
          eq(web3Sites.userId, aiAgents.userId),
        ),
      )
      .where(
        and(eq(aiAgentSiteBindings.widgetKey, widgetKey), eq(aiAgentSiteBindings.isActive, true)),
      )
      .limit(1);

    const row = rows[0];
    if (!row || row.status !== "active") {
      return jsonWidget({ error: "Widget not found or inactive" }, 404);
    }

    const serviceForClient = await getServiceStatusForClientId(
      row.bindingClientId as string | null | undefined,
    );
    if (serviceForClient.blocksWidget) {
      return jsonWidget({
        reply: "This assistant is temporarily unavailable.",
        text: "This assistant is temporarily unavailable.",
      });
    }

    const allowed = parseAllowedDomains(row.allowedDomains);
    if (allowed.length > 0 && !isOriginAllowed(origin, allowed)) {
      return jsonWidget({ error: "Origin not allowed" }, 403);
    }

    const rate = checkRateLimit(ip, widgetKey);
    if (!rate.ok) {
      return jsonWidget(
        { error: "Rate limit exceeded", retryAfter: rate.retryAfter },
        429,
        { "Retry-After": String(rate.retryAfter ?? 60) },
      );
    }

    const body = await req.json().catch(() => ({}));
    const message =
      (typeof body?.message === "string" ? body.message : typeof body?.text === "string" ? body.text : "")
        .trim()
        .slice(0, MAX_MESSAGE_LENGTH);

    if (!message) return jsonWidget({ error: "message required" }, 400);

    const bindingMeta = parseWidgetBindingMetadata(row.bindingMetadata);
    const providerStrategy = bindingMeta.providerStrategy ?? "agent";
    const siteVersionSnap = bindingMeta.siteVersionId?.trim().slice(0, 36) || null;
    const publicConversationIdFromClient =
      typeof body?.conversationId === "string"
        ? body.conversationId.trim()
        : typeof body?.publicConversationId === "string"
          ? body.publicConversationId.trim()
          : null;
    const visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim().slice(0, 64) : null;
    const chatSessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : null;
    const originHost = extractOriginHost(originHdr, refererHdr);

    const conv = await getOrResumeWidgetConversation(db, {
      bindingId: row.bindingId,
      widgetKey: row.widgetKey,
      siteId: row.siteId,
      agentId: row.agentId,
      ownerUserId: row.userId,
      siteVersionIdSnapshot: siteVersionSnap,
      providerStrategy,
      publicConversationIdFromClient: publicConversationIdFromClient || undefined,
      sessionId: chatSessionId,
      originHost,
      visitorId,
    });
    convCtx = { internalId: conv.internalId, publicId: conv.publicId };

    await appendWidgetMessage(db, {
      conversationInternalId: conv.internalId,
      role: "user",
      contentText: message,
      providerStrategySnapshot: providerStrategy,
      metadataJson: body?.page && typeof body.page === "object" ? { page: body.page } : null,
    });

    const priorMessages = normalizeConversationHistory(body?.history);

    const rawContext = body?.context;
    let pageContext: unknown = undefined;
    if (rawContext != null && typeof rawContext === "object" && !Array.isArray(rawContext)) {
      const ser = JSON.stringify(rawContext);
      if (ser.length > MAX_CONTEXT_JSON_CHARS) {
        return jsonWidget({ error: "context too large", conversationId: conv.publicId }, 400);
      }
      pageContext = rawContext;
    } else if (rawContext != null) {
      return jsonWidget({ error: "context must be an object", conversationId: conv.publicId }, 400);
    }

    let contextForPrompt: unknown = pageContext;
    const sid =
      pageContext && typeof pageContext === "object"
        ? String((pageContext as WidgetMessageContext).retSessionId ?? "").trim()
        : "";
    if (sid) {
      const [sess] = await db
        .select()
        .from(retSessions)
        .where(and(eq(retSessions.id, sid), eq(retSessions.userId, row.userId)))
        .limit(1);
      if (sess) {
        const snap = retSnapshotFromDraftJson(sess.draftJson);
        if (snap) {
          contextForPrompt = {
            ...(pageContext as object),
            retSnapshot: snap,
            retServerLoaded: true,
          };
        }
      }
    }

    const maaniaReply = tryMaaniaDeterministicReply(pageContext, message);
    if (maaniaReply) {
      const text = maaniaReply;
      const page = body?.page && typeof body.page === "object" ? body.page : null;
      const pageUrl = typeof page?.url === "string" ? page.url : undefined;
      const pageTitle = typeof page?.title === "string" ? page.title : undefined;

      await appendWidgetMessage(db, {
        conversationInternalId: conv.internalId,
        role: "assistant",
        contentText: text,
        providerStrategySnapshot: providerStrategy,
        modelSnapshot: row.model,
        status: "ok",
        metadataJson: { source: "maania_deterministic" },
      });

      if (chatSessionId && row.siteId) {
        try {
          await ensureCrmTables();
          await logWebChatMessage({
            db,
            userId: row.userId,
            siteId: row.siteId,
            crmClientId: row.bindingClientId ?? null,
            sessionId: chatSessionId,
            pageUrl,
            pageTitle,
            userMessage: message,
            assistantReply: text,
            sourceSiteName: row.siteName,
            sourceAgentName: row.agentName,
          });
        } catch (crmErr) {
          console.warn("[widget] CRM log failed:", crmErr);
        }
      }

      return jsonWidget({ reply: text, text, conversationId: conv.publicId });
    }

    let systemPrompt = row.systemPrompt || "You are a helpful assistant.";
    const industries = parseIndustriesJson(row.industriesJson);
    if (industries.length > 0) {
      const labels = getIndustryLabels(industries);
      systemPrompt += `\n\nIndustry context: This agent serves ${labels.join(", ")}. Tailor responses to industry standards, terminology, and typical use cases for these verticals.`;
    }
    const lang = typeof row.language === "string" && row.language.trim();
    if (lang) {
      const langNames: Record<string, string> = {
        en: "English",
        es: "Spanish",
        fr: "French",
        de: "German",
        it: "Italian",
        pt: "Portuguese",
        "pt-BR": "Portuguese (Brazil)",
        zh: "Chinese (Simplified)",
        "zh-TW": "Chinese (Traditional)",
        ja: "Japanese",
        ko: "Korean",
        ar: "Arabic",
        hi: "Hindi",
        ru: "Russian",
        nl: "Dutch",
        pl: "Polish",
        tr: "Turkish",
        vi: "Vietnamese",
        th: "Thai",
        id: "Indonesian",
      };
      const langName = langNames[lang] ?? lang;
      systemPrompt += `\n\nImportant: Always respond in ${langName}. Speak and write exclusively in ${langName} unless the user explicitly asks you to switch languages.`;
    }

    systemPrompt = appendWidgetContextToSystemPrompt(systemPrompt, contextForPrompt);

    const knowledgeRows = await db
      .select({
        id: aiAgentKnowledgeItems.id,
        contentOrPointer: aiAgentKnowledgeItems.contentOrPointer,
        type: aiAgentKnowledgeItems.type,
      })
      .from(aiAgentKnowledgeItems)
      .where(eq(aiAgentKnowledgeItems.agentId, row.agentId))
      .orderBy(asc(aiAgentKnowledgeItems.sortOrder));

    const knowledgeContext = buildKnowledgeContextFromRows(knowledgeRows, message, 8);
    if (knowledgeContext) {
      systemPrompt += `\n\n---\n${knowledgeContext}`;
    }

    const siteBuilderSelection = await resolveSiteBuilderLlmInvokeForSite(db, row.userId, row.siteId);
    const siteBuilderInvoke = siteBuilderSelection?.invokeLlm ?? null;

    let agentLlmConfig =
      row.llmEndpoint?.trim()
        ? { llmEndpoint: row.llmEndpoint, llmApiKeyEnc: row.llmApiKeyEnc, model: row.model }
        : null;

    let overridePlainLlmInvoke: Parameters<typeof runAgentLlmReply>[0]["overridePlainLlmInvoke"];

    if (providerStrategy === "site_builder") {
      agentLlmConfig = null;
      overridePlainLlmInvoke = siteBuilderInvoke ? (msgs) => siteBuilderInvoke(msgs) : async () => null;
    }

    if (bindingMeta.siteGrounding !== false && row.siteId) {
      const summary = await loadSiteSummaryTextForWidget(db, row.userId, row.siteId, {
        versionId: bindingMeta.siteVersionId,
      });
      if (summary) {
        systemPrompt += `

---
SITE SNAPSHOT (from site builder export; stay factual — do not invent offers, prices, or policies not supported below):
${summary}`;
      }
    }

    const skipAgentTools =
      bindingMeta.agentToolsInWidget === false || providerStrategy === "site_builder";

    const t0 = Date.now();
    let text: string;
    try {
      const { reply: llmReply } = await runAgentLlmReply({
        userId: row.userId,
        agentId: row.agentId,
        systemPrompt,
        userMessage: message,
        agentLlmConfig,
        priorMessages,
        chatSessionId,
        telemetryLogContext: { source: "widget", widgetKey },
        skipAgentTools,
        overridePlainLlmInvoke,
      });

      text =
        llmReply ||
        answerFromKnowledgeOnly(knowledgeRows, message, 3) ||
        "I'm unable to respond right now. Please try again later.";

      await appendWidgetMessage(db, {
        conversationInternalId: conv.internalId,
        role: "assistant",
        contentText: text,
        providerStrategySnapshot: providerStrategy,
        modelSnapshot: row.model,
        status: "ok",
        latencyMs: Date.now() - t0,
      });
    } catch (llmErr) {
      console.error("[widget] LLM path error:", llmErr);
      text = "I'm unable to respond right now. Please try again later.";
      await appendWidgetMessage(db, {
        conversationInternalId: conv.internalId,
        role: "assistant",
        contentText: text,
        providerStrategySnapshot: providerStrategy,
        modelSnapshot: row.model,
        status: "error",
        errorCode: "llm_error",
        latencyMs: Date.now() - t0,
      });
    }

    const page = body?.page && typeof body.page === "object" ? body.page : null;
    const pageUrl = typeof page?.url === "string" ? page.url : undefined;
    const pageTitle = typeof page?.title === "string" ? page.title : undefined;

    if (chatSessionId && row.siteId) {
      try {
        await ensureCrmTables();
        await logWebChatMessage({
          db,
          userId: row.userId,
          siteId: row.siteId,
          crmClientId: row.bindingClientId ?? null,
          sessionId: chatSessionId,
          pageUrl,
          pageTitle,
          userMessage: message,
          assistantReply: text,
          sourceSiteName: row.siteName,
          sourceAgentName: row.agentName,
        });
      } catch (crmErr) {
        console.warn("[widget] CRM log failed:", crmErr);
      }
    }

    return jsonWidget({ reply: text, text, conversationId: conv.publicId });
  } catch (err) {
    console.error("widget message POST error:", err);
    return jsonWidget(
      {
        error: "Failed to process message",
        ...(convCtx ? { conversationId: convCtx.publicId } : {}),
      },
      500,
    );
  }
}
