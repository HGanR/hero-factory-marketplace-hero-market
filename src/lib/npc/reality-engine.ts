/**
 * REALITY AI Engine
 * RAG + Intent Routing + Conversion Layer
 * Structured retrieval + controlled generation for accurate, conversion-focused responses.
 */

import {
  detectIntent,
  type Intent,
} from "./reality-intent";
import {
  retrieveKnowledge,
  GUARDRAIL_UNKNOWN,
  type KnowledgeNode,
} from "./reality-knowledge-v2";
import {
  getCtaForIntent,
  formatResponseWithCta,
  responseToString,
  type ResponseResult,
  type UserContext,
} from "./reality-conversion";

export type { UserContext };

/**
 * Main entry: generate a structured, conversion-focused response.
 * Returns ResponseResult for structured use.
 */
export function generateRealityResponseV2(
  query: string,
  userContext?: UserContext
): ResponseResult {
  const normalized = query.trim().toLowerCase();

  // 0. Handle simple intents first
  const greeting = handleGreeting(normalized, userContext);
  if (greeting) return greeting;

  const thanks = handleThanks(normalized);
  if (thanks) return thanks;

  const appointment = handleAppointmentIntent(normalized);
  if (appointment) return appointment;

  // 1. Detect intent
  const intent = detectIntent(normalized);

  // 2. Retrieve relevant knowledge (top 2-3 nodes)
  const nodes = retrieveKnowledge(normalized, intent);

  // 3. Guardrail: if no relevant knowledge and not a simple intent, use fallback
  if (nodes.length === 0 && !["greeting", "thanks", "objection"].includes(intent)) {
    return {
      answer: GUARDRAIL_UNKNOWN,
      cta: "What would you like to know about our platform?",
    };
  }

  // 4. Build answer from retrieved context
  const answer = buildAnswerFromNodes(nodes, intent, normalized);

  // 5. Apply conversion layer (CTA based on intent + stage)
  const cta = getCtaForIntent(intent, userContext);

  return formatResponseWithCta(answer, cta, userContext);
}

/**
 * Generate response as string (for drop-in with existing chat).
 */
export function generateRealityResponseString(
  query: string,
  userContext?: UserContext
): string {
  const result = generateRealityResponseV2(query, userContext);
  return responseToString(result);
}

function buildAnswerFromNodes(
  nodes: KnowledgeNode[],
  intent: Intent,
  normalized: string
): string {
  // Use primary node content
  const primary = nodes[0];
  if (!primary) {
    return getDefaultForIntent(intent);
  }

  // For pricing, use the dedicated pricing content
  if (intent === "pricing") {
    return primary.content;
  }

  // For what_is_this, use platform overview
  if (intent === "what_is_this") {
    return primary.content;
  }

  // For start, use onboarding content
  if (intent === "start") {
    return primary.content;
  }

  // For objection, use objection handler content
  if (intent === "objection") {
    return primary.content;
  }

  // Default: use primary node content
  return primary.content;
}

function handleGreeting(
  normalized: string,
  userContext?: UserContext
): ResponseResult | null {
  if (
    !/^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo|sup)\s*!?\s*$/i.test(
      normalized
    )
  ) {
    return null;
  }
  if (userContext?.username) {
    return {
      answer: `Hello, ${userContext.username}! Great to see you. I'm REALITY, your AI guide for Hero Market. How can I help you today?`,
    };
  }
  return {
    answer:
      "Hello! Great to meet you. I'm REALITY, your AI guide for Hero Market. I can help you understand our platform, explain features, and guide you through getting started. What would you like to know?",
  };
}

function handleThanks(normalized: string): ResponseResult | null {
  if (!/(thank|thanks|appreciate|thx)/i.test(normalized)) return null;
  return {
    answer:
      "You're welcome! I'm always here to help. If you have any other questions about the platform, features, or how to get started, just ask!",
  };
}

function handleAppointmentIntent(normalized: string): ResponseResult | null {
  if (
    !/(schedule|book|appointment|meet|speak.*specialist|consultation.*time)/i.test(
      normalized
    )
  ) {
    return null;
  }
  // Signal to caller that this should trigger appointment flow
  return { answer: "APPOINTMENT_OFFER" };
}

function getDefaultForIntent(intent: Intent): string {
  switch (intent) {
    case "what_is_this":
      return "This is an AI-powered system that helps you build a revenue-generating business in 30 days. We don't just teach—you execute step-by-step using AI.";
    case "pricing":
      return "Our systems typically start around $10,000 depending on scope. For a tailored quote and what's included, Book a Strategy Call or review the current offer on this page.";
    case "start":
      return "Create your account on this page, then start your 30-day challenge. The AI will guide you through each step.";
    case "objection":
      return "Yes—this is a structured system designed to help you create and launch a real business using AI tools and guided steps. You're not buying theory—you're building something.";
    default:
      return GUARDRAIL_UNKNOWN;
  }
}
