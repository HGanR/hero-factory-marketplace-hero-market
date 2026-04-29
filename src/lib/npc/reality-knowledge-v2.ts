/**
 * REALITY Knowledge Base v2
 * Structured, controlled knowledge — ONLY what works now.
 * No hallucination. No incomplete features.
 */

import type { Intent } from "./reality-intent";

export type KnowledgeCategory =
  | "platform"
  | "pricing"
  | "onboarding"
  | "features"
  | "faq";

export type KnowledgeNode = {
  id: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  keywords: string[];
};

export const GUARDRAIL_UNKNOWN =
  "That feature is being expanded. Right now, the focus is helping users build revenue with AI.";

// --- PLATFORM OVERVIEW ---
const PLATFORM_NODES: KnowledgeNode[] = [
  {
    id: "platform_01",
    category: "platform",
    title: "What is TroothHurtz",
    content:
      "This is an AI-powered system that helps you build a revenue-generating business in 30 days. We don't just teach—you execute step-by-step using AI. It's an AI Revenue Operating System.",
    keywords: ["what", "platform", "troothhurtz", "hero market", "about", "this"],
  },
  {
    id: "platform_02",
    category: "platform",
    title: "AI Revenue Operating System",
    content:
      "The AI Revenue Operating System is a structured framework that helps you think through growth drivers—traffic, conversion, offers, campaigns—and execute with guided tasks. You build something real in 30 days.",
    keywords: ["ai revenue", "revenue os", "operating system"],
  },
  {
    id: "platform_03",
    category: "platform",
    title: "30-Day Challenge",
    content:
      "The 30-day challenge guides you from idea to execution. You get step-by-step AI tasks, business creation steps, and campaign tools. It's designed so you're building, not just learning.",
    keywords: ["30 day", "challenge", "30-day"],
  },
];

// --- POSITIONING (LANDING / SALES) ---
const POSITIONING_NODES: KnowledgeNode[] = [
  {
    id: "positioning_01",
    category: "platform",
    title: "Revenue system installed",
    content:
      "Hero Market installs a revenue system into your business — combining AI marketing, automation, and client acquisition so it runs for you instead of only by you. Most businesses struggle with: posting content with no strategy, chasing leads manually, and operating without a system. That often leads to inconsistent income, burnout, and lack of scalability.",
    keywords: [
      "revenue system",
      "install",
      "installed",
      "automation",
      "client acquisition",
      "strategy",
      "leads",
      "scalability",
      "burnout",
      "income",
    ],
  },
  {
    id: "positioning_02",
    category: "platform",
    title: "AI Revenue System engines",
    content:
      "The AI Revenue System consists of four engines: Traffic Engine (content and campaigns), Conversion Engine (funnels), Automation Engine (AI agents), and Revenue Engine (offers and monetization).",
    keywords: [
      "ai revenue system",
      "traffic engine",
      "conversion",
      "funnels",
      "automation engine",
      "ai agents",
      "monetization",
      "revenue engine",
      "campaigns",
    ],
  },
  {
    id: "positioning_03",
    category: "features",
    title: "Business-friendly tool names",
    content:
      "When speaking with general users, translate internal tools into business language: say automated marketing engine instead of leading with AI Agency; business automation for workflows; digital business presence for Property Twin; financial stability system for Financial Center — unless someone asks for the exact in-product name.",
    keywords: [
      "ai agency",
      "workflows",
      "property twin",
      "financial center",
      "marketing engine",
      "digital presence",
    ],
  },
  {
    id: "positioning_04",
    category: "pricing",
    title: "Offer and investment",
    content:
      "Clients typically receive: full system installation, AI marketing setup, automation and lead handling, and campaign launch. Systems typically start around $10,000 depending on scope — confirm current terms on the site or on a strategy call. Built for operators, designed to replace multiple tools, systemized for scale. Next steps: Get Your System Installed (register on this page) or Book a Strategy Call (consultations).",
    keywords: [
      "system installation",
      "10000",
      "10,000",
      "ten thousand",
      "starting",
      "strategy call",
      "consultation",
      "offer",
      "operators",
      "scope",
    ],
  },
];

// --- PRICING ---
const PRICING_NODES: KnowledgeNode[] = [
  {
    id: "pricing_01",
    category: "pricing",
    title: "Starting investment",
    content:
      "Our systems typically start around $10,000 depending on scope — what’s included (installation, AI marketing setup, automation, lead handling, campaign launch) is confirmed during onboarding or a strategy call. For the latest terms, use the options on this page or speak with the team.",
    keywords: ["how much", "cost", "price", "pricing", "fee", "dollar", "pay", "investment"],
  },
  {
    id: "pricing_02",
    category: "pricing",
    title: "Strategy call",
    content:
      "If you want scope and numbers tailored to your business, Book a Strategy Call — we’ll align the AI Revenue System to your situation. You can also Get Your System Installed by registering on this page when you’re ready to move forward.",
    keywords: ["strategy call", "book", "call", "consultation", "talk", "speak"],
  },
];

// --- CORE FEATURES (ONLY WHAT WORKS) ---
const FEATURES_NODES: KnowledgeNode[] = [
  {
    id: "features_01",
    category: "features",
    title: "AI Revenue OS",
    content:
      "The AI Revenue OS helps you analyze your business, run scenarios, and plan campaigns. It's built for entrepreneurs who want structure, not scattered advice.",
    keywords: ["ai revenue", "revenue os", "revenue system"],
  },
  {
    id: "features_02",
    category: "features",
    title: "Campaign Generator",
    content:
      "Turn your ideas and notes into structured campaigns. The campaign-from-notes feature helps you go from scattered thoughts to a clear launch plan.",
    keywords: ["campaign", "generator", "launcher", "marketing"],
  },
  {
    id: "features_03",
    category: "features",
    title: "Business Creation Steps",
    content:
      "Guided steps for naming your business, structuring your entity, and setting up operations. The platform walks you through each phase.",
    keywords: ["business", "create", "steps", "entity", "llc"],
  },
  {
    id: "features_04",
    category: "features",
    title: "Wallet Login",
    content:
      "You can connect your wallet to sign in. We support wallet-based authentication for a seamless experience.",
    keywords: ["wallet", "login", "connect", "metamask"],
  },
];

// --- ONBOARDING ---
const ONBOARDING_NODES: KnowledgeNode[] = [
  {
    id: "onboarding_01",
    category: "onboarding",
    title: "How to Start",
    content:
      "Create your account using the registration form on this page. Enter your email and username—you'll receive a password via email. Once in, start your 30-day challenge and follow the AI-guided tasks.",
    keywords: ["start", "begin", "how", "get started", "first step"],
  },
  {
    id: "onboarding_02",
    category: "onboarding",
    title: "After Registration",
    content:
      "After you register, you'll enter the platform and see your dashboard. The AI will guide you through the next steps—naming your business, setting up structure, and launching campaigns.",
    keywords: ["after", "register", "next", "then"],
  },
];

// --- FAQ / OBJECTION HANDLING ---
const FAQ_NODES: KnowledgeNode[] = [
  {
    id: "faq_legit",
    category: "faq",
    title: "Is this legit?",
    content:
      "Yes—this is a structured system designed to help you create and launch a real business using AI tools and guided steps. You're not buying theory—you're building something.",
    keywords: ["legit", "scam", "real", "trust", "believe"],
  },
  {
    id: "faq_llc",
    category: "faq",
    title: "Do I need an LLC?",
    content:
      "The platform guides you through business structure—including when an LLC or other entity makes sense. You'll get step-by-step guidance; for official filings, you work with your own professionals.",
    keywords: ["llc", "entity", "need", "required"],
  },
];

const ALL_NODES: KnowledgeNode[] = [
  ...PLATFORM_NODES,
  ...POSITIONING_NODES,
  ...PRICING_NODES,
  ...FEATURES_NODES,
  ...ONBOARDING_NODES,
  ...FAQ_NODES,
];

/**
 * Retrieve top 2-3 relevant knowledge nodes.
 * Uses keyword match + simple scoring.
 */
export function retrieveKnowledge(
  normalizedQuery: string,
  intent: Intent
): KnowledgeNode[] {
  const q = normalizedQuery;
  const words = q.split(/\s+/).filter((w) => w.length > 2);

  const scored = ALL_NODES.map((node) => {
    let score = 0;

    // Keyword match
    for (const kw of node.keywords) {
      if (q.includes(kw.toLowerCase())) score += 10;
    }

    // Word overlap with title/content
    const nodeText = `${node.title} ${node.content}`.toLowerCase();
    for (const w of words) {
      if (nodeText.includes(w)) score += 2;
    }

    // Intent boost: prefer nodes that match intent category
    const intentCategory: Record<string, KnowledgeCategory> = {
      what_is_this: "platform",
      how_it_works: "onboarding",
      pricing: "pricing",
      start: "onboarding",
      trust_question: "faq",
      objection: "faq",
      features: "features",
    };
    if (intentCategory[intent] === node.category) {
      score += 5;
    }

    return { node, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.node);
}
