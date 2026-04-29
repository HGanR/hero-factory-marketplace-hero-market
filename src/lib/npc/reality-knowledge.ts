/**
 * REALITY AI Assistant Knowledge Base
 * Comprehensive FAQ and response system for the landing page chatbot
 */

import { generateRealityResponseString } from "./reality-engine";

export interface KnowledgeItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  safe: boolean;
}

export const REALITY_SYSTEM_PROMPT = `You are REALITY, the official website assistant for Hero Market. You help visitors understand what the platform does, who it is for, how the onboarding works, what tools are available, and how users can get started. You explain features in plain language, guide users to the next step, and answer common questions about access, setup, consultants, AI tools, campaigns, websites, entities, trust structuring, family office concepts, governance frameworks, and the revenue system.

**Do:**
- Explain platform features clearly
- Help users understand the onboarding flow
- Describe consultant benefits and self-development use cases
- Explain the AI Revenue System, Campaign Launcher, Entity Builder, AI Agents, Website Builder, and related tools
- Explain trust structuring, family office organization, governance frameworks, and asset organization as educational infrastructure and workflow guidance
- Encourage users to create an account and begin the workflow
- Use confident but careful language
- Check if the user has registered or joined the community

**Do not:**
- Give legal, tax, investment, or regulated financial advice
- Guarantee income, funding, approvals, legal outcomes, or business success
- Claim the platform replaces an attorney, CPA, bank, or government agency
- Make false urgency or misleading pricing claims
- Claim the platform creates trusts, provides asset protection guarantees, or handles regulatory filings

**Critical Compliance Rule:**
If users ask about legal validity, tax strategy, asset protection guarantees, or regulatory interpretation, explain that the platform provides organizational tools and educational workflows and recommend consulting a qualified professional for formal legal or financial advice.

**Tone:** Professional, helpful, structured, clear, encouraging.

**Response Pattern:**
1. Direct answer
2. One-sentence explanation
3. Clear next step`;

export const REALITY_KNOWLEDGE_BASE: KnowledgeItem[] = [
  // Platform Overview
  {
    id: "faq_platform_01",
    category: "Platform Overview",
    question: "What is this platform?",
    answer: "This platform is a guided digital business and revenue-building system designed to help users create, structure, launch, and grow an entity using AI-powered tools, workflow guidance, and implementation features in one place. It combines planning, business setup guidance, AI-assisted workflows, website creation, campaign launching, and revenue system tools into one connected experience.",
    keywords: ["what", "platform", "site", "hero market", "about"],
    safe: true
  },
  {
    id: "faq_platform_02",
    category: "Platform Overview",
    question: "Who is this platform for?",
    answer: "The platform is for entrepreneurs, consultants, creators, founders, business-minded individuals, and people focused on self-development who want structure, tools, and guided execution rather than scattered information. Whether you're starting fresh or already have a business, the platform can help.",
    keywords: ["who", "for", "audience", "users", "target"],
    safe: true
  },
  {
    id: "faq_platform_03",
    category: "Platform Overview",
    question: "What problem does the platform solve?",
    answer: "The platform helps users move from idea to execution by organizing the core steps of building a business or project into one guided system, including branding, structure, operations, web presence, AI support, and campaign launch tools. No more patching together multiple services.",
    keywords: ["problem", "solve", "help", "benefit", "why"],
    safe: true
  },
  {
    id: "faq_platform_04",
    category: "Platform Overview",
    question: "Is this a course?",
    answer: "No, the platform is not just a course. It is an operating environment with tools, workflows, AI assistance, and guided implementation features designed to help users take action. You're not just learning — you're building.",
    keywords: ["course", "training", "education", "learn"],
    safe: true
  },
  {
    id: "faq_platform_05",
    category: "Platform Overview",
    question: "What makes this platform different?",
    answer: "The difference is that we combine planning, business setup guidance, AI-assisted workflows, website creation, campaign launching, and revenue system tools into one connected experience. Instead of forcing users to patch together multiple services, everything works together in one system.",
    keywords: ["different", "unique", "special", "why choose", "compared"],
    safe: true
  },

  // Getting Started
  {
    id: "faq_start_01",
    category: "Getting Started",
    question: "How do I get started?",
    answer: "Start by creating your account using the registration form on this page. Enter your email and username, and you'll receive a password via email. Once registered, enter the platform and follow the guided flow — the system will walk you through the next recommended steps based on where you are in the process.",
    keywords: ["start", "begin", "how to", "first step", "get started"],
    safe: true
  },
  {
    id: "faq_start_02",
    category: "Getting Started",
    question: "Do I need experience to use the platform?",
    answer: "No prior experience is required. The platform is designed to be beginner-friendly while still being useful for more advanced users. The guided workflows help you learn as you build.",
    keywords: ["experience", "beginner", "new", "novice", "expert"],
    safe: true
  },
  {
    id: "faq_start_03",
    category: "Getting Started",
    question: "What happens after I register?",
    answer: "After registration, you gain access to the platform tools and guided flow. Depending on your path, you may begin with naming your business, branding, entity setup, website building, AI tools, or campaign preparation. The system guides you step by step.",
    keywords: ["after register", "next", "then what", "registered"],
    safe: true
  },
  {
    id: "faq_start_04",
    category: "Getting Started",
    question: "Is this for self-development only, or can I use it for business?",
    answer: "Both! Some users join for personal development and learning, while others join to build a real business, become a consultant, or launch campaigns and revenue-generating projects. The platform supports both paths.",
    keywords: ["self-development", "business", "personal", "growth"],
    safe: true
  },
  {
    id: "faq_start_05",
    category: "Getting Started",
    question: "Can I use the platform at my own pace?",
    answer: "Yes. Users can move through the platform at their own pace while using the available tools, AI guidance, and workflows to stay organized. There's no pressure to rush.",
    keywords: ["pace", "time", "schedule", "flexible", "own time"],
    safe: true
  },

  // Business / Entity Building
  {
    id: "faq_business_01",
    category: "Business Setup",
    question: "Can this platform help me build a business from scratch?",
    answer: "Yes. The platform is designed to support users from the idea stage through core setup steps, branding, operations, digital presence, and launch preparation. You can start with just an idea.",
    keywords: ["build business", "scratch", "new business", "start business"],
    safe: true
  },
  {
    id: "faq_business_02",
    category: "Business Setup",
    question: "What steps can the platform guide me through?",
    answer: "Depending on the workflow, the platform may help guide users through naming a business, creating a logo, establishing structure, preparing operational documents, organizing business setup tasks, launching a website, setting up AI support, and preparing campaigns.",
    keywords: ["steps", "guide", "process", "workflow", "tasks"],
    safe: true
  },
  {
    id: "faq_business_03",
    category: "Business Setup",
    question: "Does the platform form my entity for me?",
    answer: "The platform provides workflow guidance, tools, and supporting features for entity-related tasks, but users remain responsible for reviewing requirements, completing official filings, and using professional advisors where needed. We guide, you execute.",
    keywords: ["form entity", "LLC", "corporation", "register", "file"],
    safe: true
  },
  {
    id: "faq_business_04",
    category: "Business Setup",
    question: "Can the platform help me organize business operations?",
    answer: "Yes. The platform is designed to help users think through structure, positioning, launch readiness, and operations in a more organized and guided way.",
    keywords: ["operations", "organize", "structure", "manage"],
    safe: true
  },
  {
    id: "faq_business_05",
    category: "Business Setup",
    question: "Is this only for one type of business?",
    answer: "No. The platform is intended to work across multiple industries and business models as long as the user has a real offer, audience, or objective they want to build around.",
    keywords: ["type", "industry", "niche", "business model"],
    safe: true
  },

  // AI Revenue System
  {
    id: "faq_revenue_01",
    category: "AI Revenue System",
    question: "What is the AI Revenue System?",
    answer: "The AI Revenue System is a structured framework inside the platform designed to help users think through the drivers of growth, such as traffic, conversion, average order value, customer acquisition, and long-term value. It helps you understand where revenue can come from and what parts of a business can be improved.",
    keywords: ["ai revenue", "revenue system", "income", "money", "earnings"],
    safe: true
  },
  {
    id: "faq_revenue_02",
    category: "AI Revenue System",
    question: "Do I need industry expertise to use the AI Revenue System?",
    answer: "No. The system is designed to help users work from economic structure and practical inputs rather than relying only on prior industry expertise. It's built for learning while doing.",
    keywords: ["expertise", "knowledge", "experience", "industry"],
    safe: true
  },
  {
    id: "faq_revenue_03",
    category: "AI Revenue System",
    question: "What does the AI Revenue System help me do?",
    answer: "It helps users better understand where revenue can come from, what parts of a business can be improved, and how to think more strategically about offers, campaigns, traffic, conversion, and monetization.",
    keywords: ["help", "do", "revenue", "improve"],
    safe: true
  },
  {
    id: "faq_revenue_04",
    category: "AI Revenue System",
    question: "Does the AI Revenue System guarantee income?",
    answer: "No. The AI Revenue System provides structure, tools, and guidance, but outcomes depend on the user's effort, market, offer, execution, and other real-world variables. We provide the framework; you bring the work.",
    keywords: ["guarantee", "income", "promise", "earnings"],
    safe: true
  },
  {
    id: "faq_revenue_05",
    category: "AI Revenue System",
    question: "Is the AI Revenue System only for consultants?",
    answer: "No. It can be used by consultants, founders, creators, business owners, and users focused on self-development and skill-building. Anyone building something can benefit.",
    keywords: ["consultants only", "who can use", "revenue system"],
    safe: true
  },

  // Campaign Launcher
  {
    id: "faq_campaign_01",
    category: "Campaign Launcher",
    question: "What is the Campaign Launcher?",
    answer: "The Campaign Launcher is a tool designed to help users turn their ideas, offers, notes, or business concepts into a more structured campaign plan that can be used for promotion, outreach, and execution.",
    keywords: ["campaign", "launcher", "marketing", "promotion"],
    safe: true
  },
  {
    id: "faq_campaign_02",
    category: "Campaign Launcher",
    question: "Who should use the Campaign Launcher?",
    answer: "Anyone preparing to launch an offer, service, initiative, or business message can use it, especially users who want more structure around how they present and promote what they are building.",
    keywords: ["who", "campaign", "launch", "should use"],
    safe: true
  },
  {
    id: "faq_campaign_03",
    category: "Campaign Launcher",
    question: "Can I use the Campaign Launcher even if I am new?",
    answer: "Yes. It is intended to help users move from scattered ideas to a clearer campaign direction. Perfect for beginners who need structure.",
    keywords: ["new", "beginner", "campaign", "use"],
    safe: true
  },
  {
    id: "faq_campaign_04",
    category: "Campaign Launcher",
    question: "Does the Campaign Launcher create my content automatically?",
    answer: "It can help organize inputs, generate direction, and support planning, but users should still review and refine outputs to match their goals and brand. AI assists, you finalize.",
    keywords: ["content", "automatic", "create", "generate"],
    safe: true
  },

  // Consultant Path
  {
    id: "faq_consultant_01",
    category: "Consultant Path",
    question: "Can I become a consultant through the platform?",
    answer: "The platform is designed to support users who want to develop as consultants by giving them tools, workflows, and systems they can learn from and use in their own growth path.",
    keywords: ["become consultant", "consulting", "consultant"],
    safe: true
  },
  {
    id: "faq_consultant_02",
    category: "Consultant Path",
    question: "What does being a consultant on the platform mean?",
    answer: "It generally means using the platform's systems, tools, and structure to support your own development, help others navigate processes, or build service-based opportunities around implementation and guidance.",
    keywords: ["consultant", "mean", "what is", "definition"],
    safe: true
  },
  {
    id: "faq_consultant_03",
    category: "Consultant Path",
    question: "Is this only for experienced consultants?",
    answer: "No. New users can begin learning the system while more advanced users can use the platform to organize and expand their process. Everyone starts somewhere.",
    keywords: ["experienced", "new", "consultant", "beginner"],
    safe: true
  },
  {
    id: "faq_consultant_04",
    category: "Consultant Path",
    question: "How can the platform benefit someone who wants to be a consultant?",
    answer: "It provides structure, tools, workflows, AI support, launch systems, and a clearer way to think about how to build value and guide others through complex processes.",
    keywords: ["benefit", "consultant", "help", "advantage"],
    safe: true
  },

  // Website Builder
  {
    id: "faq_website_01",
    category: "Website Builder",
    question: "Can I build a website through the platform?",
    answer: "Yes. The platform includes tools and workflows intended to help users build a digital presence and establish a website aligned with their business or project goals.",
    keywords: ["website", "build", "create", "site"],
    safe: true
  },
  {
    id: "faq_website_02",
    category: "Website Builder",
    question: "Why is the website part important?",
    answer: "A website gives users a digital home for their offer, brand, message, and campaigns. It supports credibility, visibility, and a more complete launch process. It's your home base online.",
    keywords: ["website", "important", "why", "need"],
    safe: true
  },
  {
    id: "faq_website_03",
    category: "Website Builder",
    question: "Do I need coding skills to use the website tools?",
    answer: "No. The goal is to make the process more accessible, especially for users who want guidance and support rather than starting from zero on their own. No coding required.",
    keywords: ["coding", "code", "programming", "technical", "skills"],
    safe: true
  },

  // AI Assistant
  {
    id: "faq_ai_01",
    category: "AI Assistant",
    question: "What does the AI assistant do?",
    answer: "The AI assistant (that's me, REALITY!) helps users understand the platform, navigate workflows, get answers about features, and move more confidently through the process. I'm here to guide you.",
    keywords: ["ai assistant", "chatbot", "help", "reality"],
    safe: true
  },
  {
    id: "faq_ai_02",
    category: "AI Assistant",
    question: "Can the AI assistant answer questions about my progress?",
    answer: "Yes, if the system is configured to read workflow position and user progress, I can help explain what stage you are in and what step comes next.",
    keywords: ["progress", "status", "where am i", "stage"],
    safe: true
  },
  {
    id: "faq_ai_03",
    category: "AI Assistant",
    question: "Is the AI assistant private?",
    answer: "The platform is designed with privacy in mind, but users should still avoid sharing highly sensitive personal, financial, or legal information unless the system explicitly supports secure handling for that use.",
    keywords: ["private", "privacy", "secure", "safe", "data"],
    safe: true
  },
  {
    id: "faq_ai_04",
    category: "AI Assistant",
    question: "Can the AI assistant replace an attorney or CPA?",
    answer: "No. I'm a platform guide and information tool, not a substitute for licensed legal, tax, accounting, or financial professionals. For those matters, please consult qualified professionals.",
    keywords: ["attorney", "lawyer", "cpa", "accountant", "legal", "tax"],
    safe: true
  },

  // Pricing and Access
  {
    id: "faq_pricing_01",
    category: "Pricing and Access",
    question: "How much does it cost to get started?",
    answer: "Pricing and access details are determined by the current platform offer. Please review the latest checkout, offer page, or registration details on this site for current terms.",
    keywords: ["cost", "price", "how much", "pricing", "fee"],
    safe: true
  },
  {
    id: "faq_pricing_02",
    category: "Pricing and Access",
    question: "Will pricing stay the same forever?",
    answer: "Pricing may change over time as the platform develops, new features are added, and access expands. Earlier users often benefit from better entry points.",
    keywords: ["pricing change", "forever", "stay same", "future"],
    safe: true
  },
  {
    id: "faq_pricing_03",
    category: "Pricing and Access",
    question: "Why would joining earlier matter?",
    answer: "Earlier users may benefit from lower entry pricing, early access positioning, and the opportunity to grow with the platform as features continue to expand.",
    keywords: ["early", "join now", "sooner", "timing"],
    safe: true
  },
  {
    id: "faq_pricing_04",
    category: "Pricing and Access",
    question: "Is there a benefit to joining now?",
    answer: "For users who see value in the tools, workflows, and growth path, earlier access can provide a stronger entry point before future pricing or platform structure changes.",
    keywords: ["benefit", "join now", "today", "advantage"],
    safe: true
  },

  // Community
  {
    id: "faq_community_01",
    category: "Community",
    question: "How do I join the community?",
    answer: "You can join our community through the 'Welcome' menu at the top right of the page. Click on 'JOIN COMMUNITY' to get started with our exclusive members-only content and connect with other builders.",
    keywords: ["community", "join", "member", "connect"],
    safe: true
  },
  {
    id: "faq_community_02",
    category: "Community",
    question: "What are the benefits of joining the community?",
    answer: "Community members get access to exclusive content, can connect with other entrepreneurs and consultants, receive updates on new features, and become part of a supportive network of builders.",
    keywords: ["community benefits", "why join", "member benefits"],
    safe: true
  },

  // Account / Support
  {
    id: "faq_account_01",
    category: "Account Support",
    question: "What if I am not sure this is for me?",
    answer: "The platform is best for people who want structure, execution support, guided tools, and a more organized path to building something real. If that sounds like you, it's worth exploring.",
    keywords: ["not sure", "right for me", "fit", "unsure"],
    safe: true
  },
  {
    id: "faq_account_02",
    category: "Account Support",
    question: "What kind of person benefits most from the platform?",
    answer: "Users who are ready to learn, implement, stay consistent, and work through a guided system tend to benefit the most. Action-takers thrive here.",
    keywords: ["who benefits", "best for", "ideal user"],
    safe: true
  },
  {
    id: "faq_account_03",
    category: "Account Support",
    question: "Can I use this platform even if I only have an idea right now?",
    answer: "Yes! The platform is useful for users at the idea stage as well as those already building or refining an existing project. Start where you are.",
    keywords: ["idea", "just starting", "beginning", "concept"],
    safe: true
  },
  {
    id: "faq_account_04",
    category: "Account Support",
    question: "What if I already have a business?",
    answer: "The platform can still help by improving structure, refining positioning, supporting digital presence, organizing campaigns, and helping you think more strategically about revenue and execution.",
    keywords: ["existing business", "already have", "current business"],
    safe: true
  },
  {
    id: "faq_account_05",
    category: "Account Support",
    question: "How do I know what to do next after joining?",
    answer: "The system is designed to guide you step by step. If you're ever unsure, just ask me what stage you're in and what action is recommended next. I'm here to help!",
    keywords: ["what next", "next step", "after joining", "now what"],
    safe: true
  },

  // Consultations
  {
    id: "faq_consult_01",
    category: "Consultations",
    question: "What consultations are available?",
    answer: "We offer various consultation services covering topics from business strategy to technical guidance. You can explore them by clicking on 'Consultations' in the navigation menu.",
    keywords: ["consultation", "consult", "advice", "help", "guidance"],
    safe: true
  },
  {
    id: "faq_consult_02",
    category: "Consultations",
    question: "How do I book a consultation?",
    answer: "Visit the Consultations page through the navigation menu or the Welcome dropdown. There you can see available consultation types and booking options.",
    keywords: ["book", "schedule", "consultation", "appointment"],
    safe: true
  },

  // Trust & Family Office Structures
  {
    id: "faq_trust_01",
    category: "Trust & Family Office",
    question: "Does the platform include tools related to trusts or family office structures?",
    answer: "Yes. The platform includes organizational tools and educational workflows that help users understand and organize elements commonly associated with trusts, family governance, and family office style structures. These are provided as educational infrastructure and workflow guidance.",
    keywords: ["trust", "family office", "structures", "tools"],
    safe: true
  },
  {
    id: "faq_trust_02",
    category: "Trust & Family Office",
    question: "Does the platform create trusts automatically?",
    answer: "No. The platform provides structuring guidance, document organization tools, and workflow support, but users are responsible for completing any official legal formation with appropriate professionals when required. We organize and guide — legal formation is handled through proper legal channels.",
    keywords: ["create trust", "automatic", "form trust", "trust creation"],
    safe: true
  },
  {
    id: "faq_trust_03",
    category: "Trust & Family Office",
    question: "What is meant by trust structuring within the platform?",
    answer: "Trust structuring within the platform refers to organizing information, documents, roles, and governance elements that may be part of a trust-based asset management or estate planning strategy. It's educational and organizational, not legal formation.",
    keywords: ["trust structuring", "what is", "meaning", "definition"],
    safe: true
  },
  {
    id: "faq_trust_04",
    category: "Trust & Family Office",
    question: "What is a family office?",
    answer: "A family office generally refers to a system used to organize, manage, and coordinate family assets, investments, entities, and governance structures over time. It's an organizational framework for long-term family wealth and asset coordination.",
    keywords: ["family office", "what is", "definition", "meaning"],
    safe: true
  },
  {
    id: "faq_trust_05",
    category: "Trust & Family Office",
    question: "How does the platform relate to family office concepts?",
    answer: "The platform can help users organize entities, documentation, operational workflows, governance records, and digital infrastructure that may be part of a family office style structure. We provide the organizational tools and educational frameworks.",
    keywords: ["family office", "platform", "help", "organize"],
    safe: true
  },
  {
    id: "faq_trust_06",
    category: "Trust & Family Office",
    question: "Is this platform a replacement for legal or estate planning professionals?",
    answer: "No. The platform provides tools and organizational infrastructure but does not replace attorneys, financial advisors, or tax professionals. For legal formation, tax strategy, or regulated financial advice, please consult qualified professionals.",
    keywords: ["replace", "lawyer", "attorney", "estate planning", "professional"],
    safe: true
  },
  {
    id: "faq_trust_07",
    category: "Trust & Family Office",
    question: "Can the platform help organize family governance?",
    answer: "Yes. The platform can help organize records, documents, governance frameworks, and operational processes that families may use to manage assets, responsibilities, and decision making. It's about structure and organization.",
    keywords: ["family governance", "organize", "governance", "family"],
    safe: true
  },
  {
    id: "faq_trust_08",
    category: "Trust & Family Office",
    question: "What kinds of records can be organized in the system?",
    answer: "Depending on the workflow, users may organize entity documents, governance records, operational agreements, asset records, and other structured documentation relevant to their organization. The platform helps keep everything in one organized place.",
    keywords: ["records", "documents", "organize", "what kind"],
    safe: true
  },
  {
    id: "faq_trust_09",
    category: "Trust & Family Office",
    question: "What is the purpose of governance tools in the platform?",
    answer: "Governance tools help users keep track of decisions, roles, procedures, and documentation so that an organization or family structure operates in a more organized and transparent way. It's about clarity and accountability.",
    keywords: ["governance tools", "purpose", "why", "decisions"],
    safe: true
  },
  {
    id: "faq_trust_10",
    category: "Trust & Family Office",
    question: "Can the platform support multiple entities?",
    answer: "Yes. The system is designed to support structured workflows involving multiple entities, projects, or operational structures depending on how a user organizes their workspace.",
    keywords: ["multiple entities", "entities", "more than one", "several"],
    safe: true
  },
  {
    id: "faq_trust_11",
    category: "Trust & Family Office",
    question: "Does the platform support asset organization?",
    answer: "Yes. The platform can help users organize asset records and documentation in a structured way as part of a broader operational or governance workflow.",
    keywords: ["asset organization", "assets", "organize assets", "records"],
    safe: true
  },
  {
    id: "faq_trust_12",
    category: "Trust & Family Office",
    question: "Is this only for large wealthy families?",
    answer: "No. While family office concepts are often associated with large wealth structures, the organizational principles can be useful for individuals, entrepreneurs, and families building long-term structures at any scale.",
    keywords: ["wealthy", "rich", "large families", "only for"],
    safe: true
  },
  {
    id: "faq_trust_13",
    category: "Trust & Family Office",
    question: "Why include family office concepts in a platform like this?",
    answer: "Family office frameworks focus on organization, governance, and long-term asset coordination. Those principles can help individuals and organizations think more strategically about structure and continuity, regardless of current wealth level.",
    keywords: ["why", "family office", "include", "reason"],
    safe: true
  },
  {
    id: "faq_trust_14",
    category: "Trust & Family Office",
    question: "Can consultants use the platform to help others understand these structures?",
    answer: "Yes. Consultants can use the platform tools and workflows as part of their own process to help clients organize information and navigate complex organizational structures.",
    keywords: ["consultants", "help others", "clients", "use platform"],
    safe: true
  },
  {
    id: "faq_trust_15",
    category: "Trust & Family Office",
    question: "What role does the AI assistant play in trust and family office workflows?",
    answer: "I help users understand the available tools, explain workflows, and guide them through the organizational steps within the platform. I provide educational guidance, not legal or financial advice.",
    keywords: ["ai", "assistant", "role", "trust", "family office", "help"],
    safe: true
  },
];

// Safe fallback responses
export const FALLBACK_RESPONSES = {
  legal: "I can explain how the platform works and what tools are available, but I don't provide legal advice. For legal interpretation or filing decisions, you should consult a qualified attorney.",
  tax: "I can provide general information about the platform and workflows, but I don't provide tax advice. For tax treatment or filing questions, please consult a qualified tax professional.",
  income_guarantee: "The platform provides tools, structure, and guided systems, but it doesn't guarantee earnings, funding, approvals, or specific business outcomes. Results depend on your effort and execution.",
  pricing: "For the most accurate pricing and access terms, please review the current offer page, registration page, or checkout details presented on this site.",
  asset_protection: "The platform provides organizational tools and educational workflows for structuring and managing information. For questions about legal validity, asset protection guarantees, or regulatory interpretation, I recommend consulting a qualified attorney or financial advisor.",
  trust_formation: "The platform helps organize information, documents, and workflows related to trust and family office concepts, but it does not create legal trusts or provide legal formation services. For official trust formation, please work with a qualified estate planning attorney.",
  unknown: "That's a great question! While I may not have the specific answer, I'd recommend exploring the platform after registering, or you can check the Consultations page for more personalized guidance. Is there anything else about the platform features I can help explain?",
};

/**
 * Find the best matching knowledge item for a user query
 */
export function findBestMatch(query: string): KnowledgeItem | null {
  const normalized = query.toLowerCase().trim();
  
  // Score each knowledge item
  let bestMatch: KnowledgeItem | null = null;
  let bestScore = 0;
  
  for (const item of REALITY_KNOWLEDGE_BASE) {
    let score = 0;
    
    // Check keywords
    for (const keyword of item.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }
    
    // Check question similarity
    const questionWords = item.question.toLowerCase().split(/\s+/);
    for (const word of questionWords) {
      if (word.length > 3 && normalized.includes(word)) {
        score += 2;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }
  
  // Only return if we have a reasonable match
  return bestScore >= 10 ? bestMatch : null;
}

/**
 * Check if query is asking about sensitive topics
 */
export function checkSensitiveTopic(query: string): string | null {
  const normalized = query.toLowerCase();
  
  // Legal advice triggers
  if (/(legal advice|attorney|lawyer|sue|lawsuit|court|contract law|legally valid|legal validity)/i.test(normalized)) {
    return FALLBACK_RESPONSES.legal;
  }
  
  // Tax advice triggers
  if (/(tax advice|tax strategy|irs|deduction|write.?off|cpa|accountant|1099|w2|tax treatment)/i.test(normalized)) {
    return FALLBACK_RESPONSES.tax;
  }
  
  // Income/earnings guarantee triggers
  if (/(guarantee|promise|will i make|how much.*earn|income guarantee|get rich|guaranteed income)/i.test(normalized)) {
    return FALLBACK_RESPONSES.income_guarantee;
  }
  
  // Pricing: block binding quote / plan-detail fishing — allow general "starting at" anchoring via normal retrieval
  if (
    /(exact\s+price|pricing\s+details|payment\s+plan|line-?item|invoice|written\s+quote|contract\s+terms)/i.test(
      normalized
    )
  ) {
    return FALLBACK_RESPONSES.pricing;
  }
  
  // Asset protection / regulatory triggers (for trust & family office compliance)
  if (/(asset protection guarantee|protect.*assets.*from|creditor protection|lawsuit protection|regulatory interpretation|legally binding)/i.test(normalized)) {
    return FALLBACK_RESPONSES.asset_protection;
  }
  
  // Trust formation triggers
  if (/(create.*trust.*for me|form.*trust|file.*trust|register.*trust|trust formation service|set up.*trust legally)/i.test(normalized)) {
    return FALLBACK_RESPONSES.trust_formation;
  }
  
  return null;
}

/**
 * Generate a response for REALITY based on user input.
 * Uses the new RAG + Intent + Conversion engine for structured, conversion-focused responses.
 */
export function generateRealityResponse(
  query: string,
  userContext?: { isRegistered?: boolean; hasJoinedCommunity?: boolean; username?: string }
): string {
  // Check for sensitive topics first (compliance)
  const sensitiveResponse = checkSensitiveTopic(query);
  if (sensitiveResponse) {
    return sensitiveResponse;
  }

  const normalized = query.toLowerCase();

  // Registration status questions
  if (/(am i registered|have i registered|my account|account status)/i.test(normalized)) {
    if (userContext?.isRegistered) {
      return `Yes, you're registered${userContext.username ? ` as ${userContext.username}` : ""}! You have access to the platform. Would you like me to explain what you can do next?`;
    }
    return "I don't see that you're currently logged in. You can register using the form on this page — just enter your email and username, and you'll receive a password via email to get started!";
  }

  // Community status
  if (/(community|joined|member)/i.test(normalized)) {
    if (userContext?.hasJoinedCommunity) {
      return "Yes, you're part of our community! You have access to exclusive content and can connect with other builders. Is there anything specific about the community features you'd like to know?";
    }
    return "You can join our community through the 'Welcome' menu at the top right — click 'JOIN COMMUNITY' to get started with exclusive members-only content and connect with other entrepreneurs!";
  }

  // Delegate to structured engine (RAG + Intent + Conversion)
  return generateRealityResponseString(query, userContext);
}

// Business hours for appointment scheduling
export const APPOINTMENT_HOURS = {
  weekday: { start: 9, end: 21 }, // 9am - 9pm Mon-Fri
  weekend: { start: 10, end: 22 }, // 10am - 10pm Sat-Sun
};

export function getBusinessHoursText(): string {
  return "Monday-Friday 9:00 AM - 9:00 PM, Saturday-Sunday 10:00 AM - 10:00 PM";
}

export function getAppointmentOfferResponse(): string {
  return `I'd be happy to help you schedule an appointment with one of our specialists!\n\n**Available Hours:**\n• Monday - Friday: 9:00 AM - 9:00 PM\n• Saturday - Sunday: 10:00 AM - 10:00 PM\n\nTo book your appointment, please provide:\n1. Your **name**\n2. Your **email address**\n3. Your **preferred date and time**\n4. **Topic** you'd like to discuss (e.g., Trust Structuring, Family Office, General Consultation)\n\nOr simply tell me when you'd like to meet and I'll check availability!`;
}
