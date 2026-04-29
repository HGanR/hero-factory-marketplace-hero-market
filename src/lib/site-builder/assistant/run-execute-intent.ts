import type { LlmMessage } from "@/lib/npc/llm";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import type { ExecuteIntentRequest, ExecuteIntentResponse } from "@/lib/site-builder/assistant/execute-intent-types";
import { analyzeAssistantPrompt } from "@/lib/site-builder/assistant/assistantBehavior";
import { mapExecuteIntentMessage } from "@/lib/site-builder/assistant/map-execute-intent-message";
import { tryExecuteIntentWithLlm } from "@/lib/site-builder/assistant/execute-intent-llm";

export async function runExecuteIntentAnalysis(args: {
  message: string;
  schema: SiteSchemaDocumentType;
  editContext: ExecuteIntentRequest["editContext"];
  invokeLlm?: (messages: LlmMessage[]) => Promise<string | null>;
}): Promise<ExecuteIntentResponse> {
  const behavior = analyzeAssistantPrompt(args.message, {
    lastSectionIds: args.editContext.lastSectionIds,
    lastPageSlug: args.editContext.lastPageSlug,
  });
  if (!behavior.canAct && behavior.clarificationQuestion) {
    return {
      actions: [],
      assistantReply: behavior.clarificationQuestion,
      meta: {
        intent: "unclear",
        needsClarification: true,
        clarificationQuestion: behavior.clarificationQuestion,
      },
    };
  }

  const deterministic = mapExecuteIntentMessage({
    message: args.message,
    schema: args.schema,
    editContext: args.editContext,
  });

  if (
    deterministic.actions.length > 0 ||
    deterministic.meta.intent === "deploy" ||
    deterministic.meta.intent === "pipeline_full"
  ) {
    return deterministic;
  }

  if (!args.invokeLlm) return deterministic;

  const slug = args.editContext.lastPageSlug.trim() || "/";
  const llm = await tryExecuteIntentWithLlm({
    message: args.message,
    schema: args.schema,
    pageSlug: slug,
    lastSectionIds: args.editContext.lastSectionIds,
    invokeLlm: args.invokeLlm,
  });
  return llm ?? deterministic;
}
