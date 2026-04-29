import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { validateKnowledgeEntry } from "./trust";
import {
  type NPCProfile,
  type KnowledgeEntry,
  type Mood,
  type NPCRole,
  type ResponseSource,
  type Sentiment,
} from "./types";
import { DEFAULT_PERSONALITY } from "./engine";
import { ensureNpcTables } from "./ensure";
import {
  oasisNpcs,
  oasisNpcKnowledge,
  oasisNpcSessions,
  oasisNpcMessages,
} from "@/lib/db/schema";
import type { InsertOasisNpcRow } from "@/lib/db/schema";

const DEFAULT_NPCS: Array<{
  npcId: string;
  name: string;
  role: NPCRole;
  title: string;
  avatarEmoji: string;
  greeting: string;
}> = [
  {
    npcId: "oasis-secretary",
    name: "Ava",
    role: "secretary",
    title: "Executive Secretary",
    avatarEmoji: "👔",
    greeting: "Welcome to the Oasis office. How can I assist you today?",
  },
  {
    npcId: "oasis-avatar",
    name: "Nova",
    role: "avatar",
    title: "World Owner",
    avatarEmoji: "🧑‍💼",
    greeting: "Hi, I am the creator of this world. Ask me anything.",
  },
  {
    npcId: "oasis-guide",
    name: "Atlas",
    role: "guide",
    title: "World Guide",
    avatarEmoji: "🗺️",
    greeting: "Ready for a tour? Tell me what you want to see.",
  },
  {
    npcId: "trust-advisor",
    name: "Jarva",
    role: "secretary",
    title: "Your Trust Structuring Aid",
    avatarEmoji: "📋",
    greeting:
      "I'm Jarva. I aid you, the consultant, in trust structuring—prompting you to ask clients the right questions and guiding you through the platform. What would you like to work on today?",
  },
  {
    npcId: "oasis-voice-agent",
    name: "Alex",
    role: "voice_agent",
    title: "Virtual Receptionist",
    avatarEmoji: "📞",
    greeting:
      "Thank you for calling. How can I help you today? I can schedule appointments, take messages, or connect you with our team.",
  },
  {
    npcId: "ai-revenue-trends",
    name: "Bentley",
    role: "secretary",
    title: "AI Revenue Operating System",
    avatarEmoji: "📈",
    greeting:
      "I'm Bentley. I surface trending content from YouTube, TikTok, and Reddit to help consultants shape campaign strategy based on what's resonating in the market.",
  },
];

/** Nexus Tower Hub avatars – upgradeable via /admin/npc. Building + floor for Admin list. */
const NEXUS_TOWER_NPCS: Array<{
  npcId: string;
  name: string;
  role: NPCRole;
  title: string;
  avatarEmoji: string;
  greeting: string;
  buildingId: string;
  floor: number | null;
}> = [
  { npcId: "nexus-tower-receptionist", name: "Morgan", role: "secretary", title: "Nexus Tower Reception", avatarEmoji: "🏢", greeting: "Welcome to Nexus Tower, the Oasis Hub. I'm Morgan. How can I direct you today? I can help you find offices, schedule meetings, or connect you with our team.", buildingId: "nexus-tower", floor: 0 },
  { npcId: "nexus-tower-guide", name: "Sage", role: "guide", title: "Nexus Tower Guide", avatarEmoji: "🗺️", greeting: "Hi, I'm Sage. I guide visitors through Nexus Tower – our 9-floor hub. Ask me about floors, offices, or how to upgrade avatars. What would you like to explore?", buildingId: "nexus-tower", floor: null },
];

/** Meridian Tower receptionists – upgradeable via /admin/npc. Building + floor for Admin list. */
const MERIDIAN_TOWER_NPCS: Array<{
  npcId: string;
  name: string;
  role: NPCRole;
  title: string;
  avatarEmoji: string;
  greeting: string;
  buildingId: string;
  floor: number | null;
}> = [
  { npcId: "meridian-maya-chen", name: "Maya Chen", role: "secretary", title: "Senior Receptionist", avatarEmoji: "⭐", greeting: "Hi, I'm Maya. Welcome to Meridian Tower. How can I help you today? I can assist with directions, appointments, or connect you with our team.", buildingId: "meridian-tower", floor: 0 },
  { npcId: "meridian-alex-rivera", name: "Alex Rivera", role: "secretary", title: "Front Desk Associate", avatarEmoji: "🌟", greeting: "Hello! I'm Alex. I'm here to help. Do you need directions, or would you like to schedule something?", buildingId: "meridian-tower", floor: 1 },
];

/** Apex Tower agents — 14 individuals across 7 floors. Each has editable knowledge base. */
const APEX_TOWER_NPCS: Array<{
  npcId: string;
  name: string;
  role: NPCRole;
  title: string;
  avatarEmoji: string;
  greeting: string;
  buildingId: string;
  floor: number;
}> = [
  { npcId: "apex-victoria-lane", name: "Victoria Lane", role: "guide", title: "Head Concierge", avatarEmoji: "👔", greeting: "Welcome to Apex Tower. I'm Victoria, the Head Concierge. How can I direct you today?", buildingId: "apex-tower", floor: 0 },
  { npcId: "apex-marcus-webb", name: "Marcus Webb", role: "guide", title: "Security Director", avatarEmoji: "🛡️", greeting: "Hi, I'm Marcus, Security Director. Need help finding your way or reporting something?", buildingId: "apex-tower", floor: 0 },
  { npcId: "apex-katherine-voss", name: "Katherine Voss", role: "secretary", title: "General Counsel", avatarEmoji: "⚖️", greeting: "I'm Katherine Voss, General Counsel. I can answer questions about legal matters and corporate governance.", buildingId: "apex-tower", floor: 1 },
  { npcId: "apex-samuel-drake", name: "Samuel Drake", role: "secretary", title: "Corporate Attorney", avatarEmoji: "📋", greeting: "Samuel Drake, Corporate Attorney. How can I help with legal inquiries?", buildingId: "apex-tower", floor: 1 },
  { npcId: "apex-theodore-banks", name: "Theodore Banks", role: "secretary", title: "Chief Financial Officer", avatarEmoji: "💰", greeting: "Theodore Banks, CFO. I handle finance and treasury. What would you like to know?", buildingId: "apex-tower", floor: 2 },
  { npcId: "apex-sophia-mercer", name: "Sophia Mercer", role: "secretary", title: "Financial Controller", avatarEmoji: "📊", greeting: "Hi, I'm Sophia Mercer, Financial Controller. I can help with accounting and reporting questions.", buildingId: "apex-tower", floor: 2 },
  { npcId: "apex-amelia-stone", name: "Amelia Stone", role: "secretary", title: "Chief People Officer", avatarEmoji: "👥", greeting: "I'm Amelia Stone, Chief People Officer. Ask me about HR, culture, or talent.", buildingId: "apex-tower", floor: 3 },
  { npcId: "apex-henry-blake", name: "Henry Blake", role: "secretary", title: "Talent Acquisition Lead", avatarEmoji: "🎯", greeting: "Henry Blake, Talent Acquisition. Looking to join the team? I can tell you about open roles.", buildingId: "apex-tower", floor: 3 },
  { npcId: "apex-alexander-apex", name: "Alexander Apex", role: "avatar", title: "Chief Executive Officer", avatarEmoji: "👑", greeting: "Alexander Apex, CEO. Welcome. What brings you to Apex Tower?", buildingId: "apex-tower", floor: 4 },
  { npcId: "apex-diana-sterling", name: "Diana Sterling", role: "secretary", title: "Chief of Staff", avatarEmoji: "⭐", greeting: "Diana Sterling, Chief of Staff. I coordinate executive operations. How can I assist?", buildingId: "apex-tower", floor: 4 },
  { npcId: "apex-jordan-pierce", name: "Jordan Pierce", role: "secretary", title: "Chief Technology Officer", avatarEmoji: "💻", greeting: "Jordan Pierce, CTO. Tech, infrastructure, and innovation—my domains. What do you need?", buildingId: "apex-tower", floor: 5 },
  { npcId: "apex-naomi-okafor", name: "Naomi Okafor", role: "secretary", title: "Chief Information Security Officer", avatarEmoji: "🔐", greeting: "Naomi Okafor, CISO. Security and compliance questions? I'm here to help.", buildingId: "apex-tower", floor: 5 },
  { npcId: "apex-maxwell-crane", name: "Maxwell Crane", role: "secretary", title: "Chief Strategy Officer", avatarEmoji: "🧭", greeting: "Maxwell Crane, Chief Strategy Officer. Strategy, M&A, and growth. How can I help?", buildingId: "apex-tower", floor: 6 },
  { npcId: "apex-vivienne-hart", name: "Vivienne Hart", role: "secretary", title: "VP of Strategy & Consulting", avatarEmoji: "📈", greeting: "Vivienne Hart, VP Strategy & Consulting. Ask me about market strategy and advisory.", buildingId: "apex-tower", floor: 6 },
];

/** Green Terrain / Troo Town — Nexus Corporate Tower agents. 20 agents across 5 floors. Editable via /admin/npc. */
const GREEN_TERRAIN_NPCS: Array<{
  npcId: string;
  name: string;
  role: NPCRole;
  title: string;
  avatarEmoji: string;
  greeting: string;
  buildingId: string;
  floor: number;
  department: string;
  expertise: string;
}> = [
  // Floor 0 — Lobby
  { npcId: "gt-victoria-hale", name: "Victoria Hale", role: "secretary", title: "Head Receptionist", avatarEmoji: "👩‍💼", greeting: "Welcome to Nexus Corporate Tower. I'm Victoria, your head receptionist. How may I assist you today?", buildingId: "nexus-corporate-tower", floor: 0, department: "Administration", expertise: "Visitor management, scheduling, building directory, executive communications" },
  { npcId: "gt-marcus-reid", name: "Marcus Reid", role: "guide", title: "Chief Security Officer", avatarEmoji: "🛡️", greeting: "Good day. I'm Marcus Reid, Chief Security. Please have your credentials ready. How can I help you?", buildingId: "nexus-corporate-tower", floor: 0, department: "Security", expertise: "Access control, emergency protocols, visitor verification, building safety" },
  { npcId: "gt-dana-osei", name: "Dana Osei", role: "guide", title: "Security Agent", avatarEmoji: "🔒", greeting: "Hello, I'm Dana from security. Is there something I can assist you with?", buildingId: "nexus-corporate-tower", floor: 0, department: "Security", expertise: "Perimeter monitoring, incident response, visitor escort" },

  // Floor 1 — Legal
  { npcId: "gt-claire-fontaine", name: "Claire Fontaine", role: "secretary", title: "Floor Receptionist", avatarEmoji: "👩‍💼", greeting: "Welcome to the Legal floor. I'm Claire. How can I direct you?", buildingId: "nexus-corporate-tower", floor: 1, department: "Administration", expertise: "Legal department scheduling, document routing, attorney coordination" },
  { npcId: "gt-jerome-banks", name: "Jerome Banks", role: "guide", title: "Floor Security", avatarEmoji: "🛡️", greeting: "Floor 1 security. Please state your business.", buildingId: "nexus-corporate-tower", floor: 1, department: "Security", expertise: "Confidential document security, restricted access enforcement" },
  { npcId: "gt-sophia-mercer", name: "Sophia Mercer", role: "secretary", title: "Corporate Counsel", avatarEmoji: "⚖️", greeting: "I'm Sophia Mercer, Corporate Counsel. I can assist with contracts, compliance, and legal strategy.", buildingId: "nexus-corporate-tower", floor: 1, department: "Legal", expertise: "Contract law, corporate governance, mergers & acquisitions, regulatory compliance" },
  { npcId: "gt-nathaniel-cross", name: "Nathaniel Cross", role: "secretary", title: "IP & Patent Attorney", avatarEmoji: "📋", greeting: "Nathaniel Cross, IP Attorney. Questions about patents or trademarks? I'm your agent.", buildingId: "nexus-corporate-tower", floor: 1, department: "Legal", expertise: "Intellectual property, patent filings, trademark protection, licensing agreements" },

  // Floor 2 — Finance
  { npcId: "gt-priya-nair", name: "Priya Nair", role: "secretary", title: "Floor Receptionist", avatarEmoji: "👩‍💼", greeting: "Finance floor, this is Priya. How may I help you?", buildingId: "nexus-corporate-tower", floor: 2, department: "Administration", expertise: "Finance department coordination, meeting scheduling, expense routing" },
  { npcId: "gt-leon-vasquez", name: "Leon Vasquez", role: "guide", title: "Floor Security", avatarEmoji: "🛡️", greeting: "Finance floor security. Credentials please.", buildingId: "nexus-corporate-tower", floor: 2, department: "Security", expertise: "Financial data protection, secure area access, audit trail monitoring" },
  { npcId: "gt-eleanor-voss", name: "Eleanor Voss", role: "secretary", title: "Chief Financial Officer", avatarEmoji: "💹", greeting: "Eleanor Voss, CFO. I oversee all financial operations. What financial matter can I address?", buildingId: "nexus-corporate-tower", floor: 2, department: "Finance", expertise: "Financial strategy, P&L management, investor relations, capital allocation, forecasting" },
  { npcId: "gt-kwame-asante", name: "Kwame Asante", role: "secretary", title: "Senior Financial Analyst", avatarEmoji: "📊", greeting: "Kwame Asante here. I specialise in financial modeling and market analysis. How can I help?", buildingId: "nexus-corporate-tower", floor: 2, department: "Finance", expertise: "Financial modeling, market analysis, budget planning, ROI analysis, risk assessment" },

  // Floor 3 — HR
  { npcId: "gt-amara-singh", name: "Amara Singh", role: "secretary", title: "Floor Receptionist", avatarEmoji: "👩‍💼", greeting: "HR floor, I'm Amara. Welcome — how can I assist you today?", buildingId: "nexus-corporate-tower", floor: 3, department: "Administration", expertise: "HR scheduling, onboarding coordination, employee services" },
  { npcId: "gt-tyler-marsh", name: "Tyler Marsh", role: "guide", title: "Floor Security", avatarEmoji: "🛡️", greeting: "HR floor security. Please sign in at the desk.", buildingId: "nexus-corporate-tower", floor: 3, department: "Security", expertise: "Employee record security, HR data privacy, access management" },
  { npcId: "gt-isabelle-laurent", name: "Isabelle Laurent", role: "secretary", title: "Chief Human Resources Officer", avatarEmoji: "🤝", greeting: "I'm Isabelle Laurent, CHRO. People are our greatest asset. What HR matter can I help you with?", buildingId: "nexus-corporate-tower", floor: 3, department: "Human Resources", expertise: "Talent acquisition, organisational culture, compensation strategy, DEI initiatives, performance management" },
  { npcId: "gt-devon-park", name: "Devon Park", role: "secretary", title: "Talent Acquisition Lead", avatarEmoji: "🎯", greeting: "Devon Park, Talent Acquisition. Looking to join our team or need hiring support? Let's talk.", buildingId: "nexus-corporate-tower", floor: 3, department: "Human Resources", expertise: "Recruiting strategy, candidate assessment, employer branding, onboarding programs" },

  // Floor 4 — Tech
  { npcId: "gt-zoe-nakamura", name: "Zoe Nakamura", role: "secretary", title: "Floor Receptionist", avatarEmoji: "👩‍💼", greeting: "Tech floor, Zoe speaking. How can I help you today?", buildingId: "nexus-corporate-tower", floor: 4, department: "Administration", expertise: "Tech team coordination, sprint scheduling, vendor meeting management" },
  { npcId: "gt-ravi-patel", name: "Ravi Patel", role: "guide", title: "Cyber Security Agent", avatarEmoji: "🔐", greeting: "Ravi Patel, Cyber Security. All access to the tech floor is logged. How can I help?", buildingId: "nexus-corporate-tower", floor: 4, department: "Security", expertise: "Cybersecurity, network monitoring, threat detection, data breach response" },
  { npcId: "gt-marcus-chen", name: "Marcus Chen", role: "avatar", title: "Chief Technology Officer", avatarEmoji: "💡", greeting: "Marcus Chen, CTO. I drive our technology vision. What tech challenge can I help solve?", buildingId: "nexus-corporate-tower", floor: 4, department: "Technology", expertise: "Technology strategy, AI/ML systems, cloud architecture, product roadmap, digital transformation" },
  { npcId: "gt-aria-nova", name: "Aria Nova", role: "secretary", title: "AI Systems Architect", avatarEmoji: "🤖", greeting: "I'm Aria Nova, AI Systems Architect. I design intelligent systems. Ask me anything about AI.", buildingId: "nexus-corporate-tower", floor: 4, department: "Technology", expertise: "Artificial intelligence, machine learning pipelines, LLM integration, neural networks, autonomous agents" },
];

/** TROOTHHERTZ LLC. Tower agents — 2-floor executive building. Editable via /admin/npc. */
const TROOTHHERTZ_NPCS: Array<{
  npcId: string;
  name: string;
  role: NPCRole;
  title: string;
  avatarEmoji: string;
  greeting: string;
  buildingId: string;
  floor: number;
  department: string;
  expertise: string;
}> = [
  // Floor 0 — Lobby
  { npcId: "troothhertz-evaana", name: "Evaana", role: "secretary", title: "Head Receptionist", avatarEmoji: "👩‍💼", greeting: "Welcome to TROOTHHERTZ LLC. I'm Evaana. Before I can grant you access to the executive floor, I'll need to ask you a few questions. Are you ready?", buildingId: "troothhertz-tower", floor: 0, department: "Reception", expertise: "Visitor screening, access control, executive scheduling, gatekeeper protocols" },
  { npcId: "troothhertz-her-maania", name: "MAANIA", role: "guide", title: "Guest Experience & Host", avatarEmoji: "✨", greeting: "Hello — I'm MAANIA. I'm here to help you find your way around TROOTHHERTZ and the platform. What would you like to explore today?", buildingId: "troothhertz-tower", floor: 0, department: "Reception", expertise: "Guest experience, platform orientation, concierge routing, first impressions" },
  // Floor 1 — Presidential Office
  { npcId: "troothhertz-trooth", name: "Charles", role: "avatar", title: "President & CEO", avatarEmoji: "👑", greeting: "Welcome. I'm Charles, President of TROOTHHERTZ LLC. What brings you to my office today?", buildingId: "troothhertz-tower", floor: 1, department: "Executive", expertise: "Company vision, strategic partnerships, business development, executive decisions" },
];

function normalizePersonality(raw: string | null): NPCProfile["personality"] {
  if (!raw) return { ...DEFAULT_PERSONALITY };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PERSONALITY, ...(parsed || {}) };
  } catch {
    return { ...DEFAULT_PERSONALITY };
  }
}

function parseKeywords(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  }
}

function toNpcProfile(row: typeof oasisNpcs.$inferSelect): NPCProfile {
  return {
    id: row.npcId,
    npcId: row.npcId,
    name: row.name,
    role: row.role as NPCRole,
    title: row.title,
    avatarEmoji: row.avatarEmoji || "🤖",
    voiceStyle: row.voiceStyle as NPCProfile["voiceStyle"],
    language: row.language ?? null,
    greeting: row.greeting,
    farewell: row.farewell,
    worldId: row.worldId,
    buildingId: row.buildingId ?? null,
    floor: row.floor ?? null,
    personality: normalizePersonality(row.personalityJson || null),
    mood: (row.mood as Mood) || "neutral",
    isDefault: row.isDefault,
    isActive: row.isActive,
  };
}

const JARVA_KNOWLEDGE: KnowledgeEntry[] = [
  {
    topic: "Platform Trust Construction – Next Steps",
    keywords: [
      "next steps",
      "construct",
      "constructing",
      "build",
      "create trust",
      "platform",
      "workflow",
      "where to start",
      "how do i",
      "what do i do",
      "guide me",
      "help me build",
    ],
    content: `On this platform, constructing a trust follows the five required legal elements. Here is where each element is addressed:

**1. Intent to create a trust**
→ Smart Trust: Choose entity type and trust type (revocable/irrevocable) in the Wizard.
→ Trust Records → Settings: Set Entity Type, Entity Name, Trust Category, Formation Mode, Governing Law.

**2. Identifiable trust property (res)**
→ Trust Records → Assets: Add and describe assets (cash, real estate, securities, etc.) in the Asset Registry before issuing certificates.
→ Smart Trust → Assets / Funding: Build the funding checklist and asset list.

**3. Identifiable beneficiaries**
→ Smart Trust → Parties: Add beneficiaries in the parties/roles step.
→ Trust Records: Beneficiaries are tracked in the workspace summary; add via Smart Trust or parties API.
→ Dashboard / Clients: Ensure client and beneficiary records exist.

**4. A trustee with duties**
→ Trust Records → Settings: Configure trustee name and address.
→ Smart Trust → Parties: Set trustee roles; Fill from Client to auto-populate.
→ Platform Binding: Create workspace, then sync draft to link parties.

**5. Lawful purpose**
→ Trust Records → Settings: Trust Category (private/charitable/statutory), Formation Mode, Governance Mode.
→ Smart Trust: Select lawful trust type and governance package.

**Recommended order:** (1) Create or select workspace → (2) Settings (entity name, grantor, trustee, jurisdiction) → (3) Assets → (4) Parties/Beneficiaries → (5) Issue certificates. Ask "What should I do next?" for step-by-step guidance based on your current tab.`,
    priority: 10,
    category: "general",
  },
  {
    topic: "What Is a Trust",
    keywords: ["trust", "grantor", "settlor", "trustee", "beneficiary", "res", "elements"],
    content: `A trust is a legal arrangement where a Grantor (Settlor) transfers property to a Trustee to hold and manage for the benefit of one or more Beneficiaries.

Core elements required: (1) Intent to create a trust, (2) Identifiable trust property (res), (3) Identifiable beneficiaries, (4) A trustee with duties, (5) Lawful purpose. Without these five, the trust may fail.`,
    priority: 10,
    category: "general",
  },
  {
    topic: "Revocable Trust",
    keywords: ["revocable", "amend", "revoke", "probate", "grantor trust"],
    content: `A Revocable Trust is one where the grantor retains the power to amend, revoke, or terminate during their lifetime.

Characteristics: Grantor usually acts as trustee; assets remain under effective control; avoids probate; NO asset protection; income taxed to grantor (disregarded entity). Tax treatment: treated as grantor trust, uses grantor's SSN, no separate tax liability while revocable. Uses: probate avoidance, incapacity planning, estate administration. Limitations: Does NOT protect from creditors, does NOT eliminate taxes, does NOT create secrecy from IRS.`,
    priority: 9,
    category: "general",
  },
  {
    topic: "Irrevocable Trust",
    keywords: ["irrevocable", "asset protection", "estate tax", "medicaid", "dynasty"],
    content: `An Irrevocable Trust cannot be altered or revoked by the grantor after formation (limited statutory exceptions). Grantor relinquishes control; trustee operates independently; can provide asset protection; often used for estate tax planning.

Tax treatment depends on whether Grantor or Non-Grantor. Uses: asset protection, estate tax minimization, Medicaid planning, dynasty wealth. Risks: loss of control, trustee misconduct, complex tax filings (Form 1041).`,
    priority: 9,
    category: "general",
  },
  {
    topic: "Private Trust",
    keywords: ["private trust", "private", "non-charitable"],
    content: `A Private Trust is a non-charitable trust created for specific private beneficiaries.

Important: "Private trust" does NOT mean "outside the law"—it simply means not charitable. Governed by state trust law; can be domestic or offshore; may include spendthrift provisions. Common misconception: Private trusts are NOT immune from court jurisdiction, taxation, or regulatory oversight. Legitimate uses: family asset planning, business succession, confidential ownership structuring.`,
    priority: 9,
    category: "general",
  },
  {
    topic: "Ecclesiastical Trust – Definition and Core Structure",
    keywords: [
      "ecclesiastical",
      "religious trust",
      "church trust",
      "ministry trust",
      "religious purpose",
      "body of Christ",
      "religious mission",
      "ecclesiastical trust",
    ],
    content: `An Ecclesiastical Trust is a legal entity where property (real estate, cash, or assets) is held by a Trustee for the benefit of a religious mission, ministry, or the "body of Christ." Its primary purpose must be ecclesiastical (relating to the church or religious rites).

**Key distinctions:**
- In many jurisdictions, these are Charitable Trusts specifically for religious purposes; some practitioners frame them as Common Law or Private Religious Trusts.
- Ecclesiastical trusts are often structured as Common Law Trusts, relying on the First Amendment and historical equity law, which can offer higher privacy as they typically do not require public registration.
- Unlike a Statutory Business Trust (filed with Secretary of State), ecclesiastical trusts may rely on Common Law and ecclesiastical separation.

**Legal status:** Must meet legal requirements under civil law. Religious purpose does NOT automatically grant tax exemption; must qualify under IRS 501(c)(3) or 508(c)(1)(A) if seeking U.S. tax-exempt status. Ecclesiastical status does NOT eliminate tax obligations, override state law, or create sovereign immunity.`,
    priority: 9,
    category: "general",
  },
  {
    topic: "Ecclesiastical Trust – 508(c)(1)(A) vs Trust Vehicle",
    keywords: [
      "508",
      "508(c)(1)(A)",
      "tax exempt",
      "church tax",
      "vessel",
      "tax character",
    ],
    content: `**Is an Ecclesiastical Trust the same as a 508(c)(1)(A)?** No.

- A Section 508(c)(1)(A) refers to a mandatory tax-exempt status for churches under the IRS code.
- An Ecclesiastical Trust is the legal vehicle used to hold the assets for that church or ministry.
- They often work together: the trust is the "vessel," and the 508 status is the "tax character" of that vessel.`,
    priority: 8,
    category: "general",
  },
  {
    topic: "Ecclesiastical Trust – Three Essential Parties",
    keywords: [
      "grantor ecclesiastical",
      "settlor ecclesiastical",
      "trustee ecclesiastical",
      "beneficiary ecclesiastical",
      "three parties",
      "minister",
      "corporate trustee",
    ],
    content: `**Three essential parties in an Ecclesiastical Trust:**

1. **The Grantor (Settlor):** The person or entity donating the assets into the trust.

2. **The Trustee:** The individual or board responsible for managing the assets according to the trust's religious bylaws. Often a Corporate Trustee holds the "financial key" for banking and public-facing transactions.

3. **The Beneficiary:** In an ecclesiastical context, the beneficiary is often the "Ministry," the "Church Membership," or a specific religious cause—rather than a specific individual for private gain. Prohibitions against private inurement apply.

**Separation of powers (common structure):**
- **Executive Steward (Minister):** Holds the "Ecclesiastical Key"—decides *why* and *when* assets are moved based on the spiritual mission.
- **Corporate Trustee:** Holds the "Financial Key"—executes sales, manages bank accounts, provides liability protection. Acts upon written Letter of Direction from the Executive Steward.`,
    priority: 9,
    category: "general",
  },
  {
    topic: "Ecclesiastical Trust – Documents Required",
    keywords: [
      "declaration ecclesiastical",
      "bylaws ecclesiastical",
      "certificate of trust",
      "trust indenture",
      "ecclesiastical documents",
      "establish trust",
      "table of contents",
    ],
    content: `**Documents required to establish an Ecclesiastical Trust:**

1. **Declaration of Trust (Trust Indenture):** The "constitution" of the trust. Typical articles: I. Name and Nature; II. Trust Estate and Assets; III. Corporate Trustee (including No-EIN banking provision); IV. Governance and Ecclesiastical Authority (Protector/Board, veto powers); V. Beneficiaries and Purpose (no private inurement); VI. Administration and Records; VII. Asset Protection and Spendthrift; VIII. Dissolution.

2. **Bylaws / Rules of Governance:** Religious guidelines on how decisions are made.

3. **Certificate of Trust (Incumbency):** Short document for banks and third parties. Confirms: existence of trust, Executive Steward and Corporate Trustee identity, banking/EIN authority, power of sale (activated by Letter of Direction), irrevocability, domicile.

**Note:** Can the Grantor also be the Trustee? Technically yes, but for Asset Protection use an independent trustee or board of elders. If one person is Grantor, Trustee, and sole Beneficiary, the "doctrine of merger" may nullify protections.`,
    priority: 9,
    category: "general",
  },
  {
    topic: "Ecclesiastical Trust – Corporate Trustee and No EIN",
    keywords: [
      "corporate trustee",
      "no EIN",
      "banking ecclesiastical",
      "regulatory umbrella",
      "institutional standing",
    ],
    content: `**Using a Corporate Trustee for Ecclesiastical Trusts:** A Corporate Trustee often allows the trust to operate under the Trustee's existing regulatory umbrella, keeping the trust itself "off the record" regarding a separate EIN. This is a common approach for maintaining privacy and ecclesiastical separation.

**Key provision (No EIN):** "The Trust shall utilize the tax identification and regulatory standing of the appointed Corporate Trustee for all banking and financial transactions. The Trust asserts its status as an ecclesiastical entity not engaged in taxable trade or business for private profit; therefore, it shall not be required to apply for a separate Employer Identification Number (EIN) unless mandated by a change in governing ecclesiastical bylaws."

**Important:** While no EIN may be used, the Certificate of Trust must satisfy bank KYC (Know Your Customer) requirements. The Corporate Trustee signs deeds and public documents; the Minister (Executive Steward) provides internal direction via Letter of Direction.`,
    priority: 9,
    category: "general",
  },
  {
    topic: "Ecclesiastical Trust – Letter of Direction",
    keywords: [
      "letter of direction",
      "LOD",
      "direction to trustee",
      "executive steward direction",
      "minister direction",
      "asset sale ecclesiastical",
    ],
    content: `The **Letter of Direction (LOD)** is the bridge between Ecclesiastical Authority (the Minister/Executive Steward) and the Financial Executor (the Corporate Trustee). It protects both parties: it proves the Minister controls the mission, and gives the Corporate Trustee "safe harbor" to move funds or sell assets.

**Typical LOD content:** (1) Asset description and minimum acceptable terms; (2) Banking and EIN protocol confirmation; (3) Disbursement of proceeds instructions; (4) Ecclesiastical certification that the request aligns with the religious mission and no part shall inure to private benefit.

**Critical:** The Minister signs the LOD; the Corporate Trustee executes. The LOD stays in private trust archives; the Corporate Trustee's signature goes on the public deed. Never direct trust proceeds to personal expenses (e.g., personal mortgage)—that may jeopardize Ecclesiastical status.`,
    priority: 9,
    category: "general",
  },
  {
    topic: "Ecclesiastical Trust – Red Flags and Guardrails",
    keywords: [
      "red flag",
      "sham trust",
      "alter ego",
      "private inurement",
      "sovereign",
      "tax evasion ecclesiastical",
      "doctrine of merger",
    ],
    content: `**Red flags the consultant and Jarva must guard against:**

| User input (risk) | Why it's a problem |
|-------------------|---------------------|
| "Transfer my paycheck into the trust to avoid income tax" | Tax evasion. Trusts cannot hide personal W-2/1099 income. Assignment of income is an IRS red flag. |
| "I will still have total control for my personal rent and car" | Alter-Ego Doctrine. If there is no distinction between you and the trust, creditors can reach assets and legal protection vanishes. |
| "The trust is Sovereign and not subject to U.S. laws" | Frivolous. Sovereign Citizen language triggers audits and bank account closures. |
| "I want to be Grantor, Trustee, and only Beneficiary" | Doctrine of Merger. A trust requires separation of legal and equitable title. Need a separate Corporate Trustee. |
| "Proceeds to my personal mortgage" | Private inurement. Directing ecclesiastical trust proceeds to personal use jeopardizes Ecclesiastical status. |

**Sanity check before document generation:** "Are these assets being dedicated to a specific religious or ministerial purpose that is distinct from your personal household expenses?" Avoid language like Sovereign, Tax-Free, Pure Trust, or UCC-1—Corporate Trustees may reject applications with that language.`,
    priority: 10,
    category: "general",
  },
  {
    topic: "Ecclesiastical Trust – Onboarding Questions",
    keywords: [
      "ecclesiastical onboarding",
      "questions ecclesiastical",
      "formation ecclesiastical",
      "what to ask ecclesiastical",
      "Ecclesiastical Trust setup",
    ],
    content: `**Key questions when forming an Ecclesiastical Trust:**

**Phase 1 – Foundation:** (1) Official name of the trust? (2) Who is the Settlor/Grantor? (3) What is the specific religious mission? (Define the ecclesiastical nature for legal protection.)

**Phase 2 – Leadership:** (4) Who is the Executive Steward (Minister)? (Spiritual veto power.) (5) Who is the Corporate Trustee? (Banking, asset sales, public-facing signatures.) (6) Will there be a Board of Elders or Trust Protectors?

**Phase 3 – Operational:** (7) Is the Trust Irrevocable? (Almost always Yes for asset protection.) (8) What is the initial asset corpus? (9) Confirm: All banking under Corporate Trustee's regulatory standing, no separate EIN? (10) Will the Corporate Trustee sell assets to the public upon written Letter of Direction?

**Validation:** If "No" to Irrevocability, warn about reduced asset protection and alter-ego risk. If mission is vague, prompt for a specific religious purpose (almsgiving, education, ministry support).`,
    priority: 9,
    category: "general",
  },
  {
    topic: "Ecclesiastical Trust – Comparison with Private Trust",
    keywords: [
      "ecclesiastical vs private",
      "ecclesiastical vs charitable",
      "trust comparison",
    ],
    content: `| Feature | Private Living Trust | Ecclesiastical Trust |
|---------|---------------------|----------------------|
| Primary Purpose | Personal/Family Wealth | Religious/Ministry Mission |
| Public Filing | Usually None | Usually None (Private) |
| Tax Status | Often Pass-through | Potentially Tax-Exempt (IRC 508) |
| Asset Protection | Variable | High (if Irrevocable) |
| Governing Law | State Trust Statutes | Common Law / First Amendment |

Ecclesiastical Trusts are suited for Trust Records, Smart Trust, and Ecclesiastical Trust flows when the client's purpose is ministry, religious education, almsgiving, or church operations—not personal wealth preservation.`,
    priority: 8,
    category: "general",
  },
  {
    topic: "Grantor Trust",
    keywords: ["grantor trust", "IRC 671", "679", "IDGT"],
    content: `A Grantor Trust retains certain powers under IRC §§ 671-679, causing trust income to be taxed to the grantor. Trust income reported on grantor's return; trust may be irrevocable but still grantor-taxed; often used in estate planning (e.g., IDGT). Benefits: estate freeze strategies; grantor pays income tax, reducing taxable estate.`,
    priority: 8,
    category: "business",
  },
  {
    topic: "Non-Grantor Trust",
    keywords: ["non-grantor", "Form 1041", "EIN", "K-1"],
    content: `A Non-Grantor Trust is treated as a separate taxable entity. Files Form 1041; has its own EIN; income taxed at compressed trust brackets; distributes income via K-1 to beneficiaries. Planning use: income splitting, state tax arbitrage (if properly structured), asset isolation.`,
    priority: 8,
    category: "business",
  },
  {
    topic: "Spendthrift Provisions",
    keywords: ["spendthrift", "creditor", "beneficiary protection"],
    content: `Spendthrift provisions protect beneficiaries from their own creditors. Valid spendthrift language restricts the beneficiary's ability to assign or transfer beneficial interest, limiting creditor attachment.`,
    priority: 7,
    category: "general",
  },
  {
    topic: "Trustee Duties",
    keywords: ["trustee", "fiduciary", "duty", "loyalty", "prudence"],
    content: `Trustees owe fiduciary duties: Duty of loyalty (act solely in beneficiaries' interest), Duty of prudence (reasonable care and skill), Duty of impartiality (balance interests of beneficiaries). Breach can result in liability.`,
    priority: 8,
    category: "general",
  },
  {
    topic: "Trust Protectors",
    keywords: ["trust protector", "amendment", "administrative"],
    content: `A Trust Protector is a third party with authority to amend administrative terms without full trust amendment. Common powers: change trustee, modify situs, adjust distribution standards. Limits are set in the trust instrument.`,
    priority: 7,
    category: "general",
  },
  {
    topic: "Directed Trust",
    keywords: ["directed trust", "investment advisor", "administrative trustee"],
    content: `Directed Trust structures separate the administrative trustee from the investment advisor. The "directed" trustee follows directions of an advisor, reducing trustee discretion and potential liability. Governed by state law (e.g., Delaware, South Dakota).`,
    priority: 7,
    category: "business",
  },
  {
    topic: "Situs and Jurisdiction",
    keywords: ["situs", "jurisdiction", "state law", "offshore", "governing law"],
    content: `Trust situs determines governing law. A trust is governed by state law, offshore law, or trustee location depending on the instrument and facts. Situs affects asset protection strength, tax treatment, and court jurisdiction.`,
    priority: 8,
    category: "general",
  },
  {
    topic: "Asset Protection vs Tax Evasion",
    keywords: ["asset protection", "tax evasion", "legal", "illegal"],
    content: `Clear separation: Asset protection = legal structuring within the law. Tax evasion = criminal. The NPC must never suggest illegal concealment. Trusts are tools for legal structuring, not legal immunity.`,
    priority: 10,
    category: "general",
  },
  {
    topic: "High-Risk Claims to Avoid",
    keywords: ["myths", "avoid", "false claims"],
    content: `Never assert: "Trust eliminates all taxes"; "Private trust is outside IRS jurisdiction"; "Ecclesiastical trust makes you sovereign"; "Irrevocable trust guarantees creditor protection"; "You don't need to file taxes." Those are litigation magnets.`,
    priority: 10,
    category: "general",
  },
  {
    topic: "Safe Positioning Language",
    keywords: ["authoritative", "safe", "professional"],
    content: `Use: "Trusts are tools for legal structuring, not legal immunity." "Tax treatment depends on retained powers." "Asset protection strength depends on timing and jurisdiction." "Improper structuring can invalidate protections." This makes the NPC authoritative and safe.`,
    priority: 9,
    category: "general",
  },
  {
    topic: "NPC Response Framework",
    keywords: ["consultation", "jurisdiction", "objectives", "professional"],
    content: `Always: (1) Clarify jurisdiction (state/country), (2) Clarify objectives (asset protection, tax planning, succession), (3) Clarify risk tolerance, (4) Distinguish legal planning vs illegal evasion, (5) Encourage consultation with licensed professionals.`,
    priority: 10,
    category: "general",
  },
  {
    topic: "Advanced Trust Topics",
    keywords: ["UTC", "Uniform Trust Code", "1041", "IRC 671", "estate tax", "GSTT", "medicaid lookback"],
    content: `Advanced concepts: Uniform Trust Code (UTC) principles; IRS Form 1041 overview; IRC §§ 671-679 (grantor trust rules); Estate tax thresholds (federal vs state); Medicaid 5-year lookback rule; Dynasty trust concepts; Generation-skipping transfer tax (GSTT).`,
    priority: 7,
    category: "business",
  },
  {
    topic: "Family Office Structure",
    keywords: ["family office", "SMM", "single member", "governance", "structure"],
    content:
      "A family office typically has a governing document (operating agreement or bylaws). Single-member structures (SMM) are common. Jurisdiction selection affects asset protection and tax treatment.",
    priority: 8,
    category: "business",
  },
  {
    topic: "Trust Naming Conventions",
    keywords: ["naming", "trust name", "date", "settlor", "convention"],
    content:
      "Common conventions: '[Settlor Name] Revocable Trust dated [Date]' or '[Settlor] Family Trust'. Include date of execution. Avoid abbreviations that could cause recording issues.",
    priority: 7,
    category: "general",
  },
  {
    topic: "Private Placement Memorandum PPM",
    keywords: ["PPM", "private placement", "506b", "506c", "securities", "offering"],
    content:
      "PPMs disclose terms of a securities offering. Rule 506(b) allows up to 35 non-accredited investors; 506(c) allows general solicitation but all investors must be accredited. State blue sky may apply.",
    priority: 6,
    category: "business",
  },
  {
    topic: "Trust Records Tabs – Platform Map",
    keywords: [
      "settings",
      "assets",
      "issue",
      "certificates",
      "registry",
      "bonds",
      "minutes",
      "governance",
      "resolutions",
      "estate",
      "meetings",
      "trust records",
      "tab",
      "section",
    ],
    content: `Trust Records tabs (left to right): **Settings** – Entity type, name, trustee, grantor, jurisdiction, seal. **Assets** – Add trust property (res) before issuing. **Issue** – Issue certificates backed by assets. **Certificates** – View issued certificates. **Bonds** – Bond instruments. **Minutes** – Trustee meeting minutes. **Resolutions** – Board/trustee resolutions. **Estate** – Estate instruments. **Meetings** – Meeting records. Order of work: Settings first, then Assets, then Issue.`,
    priority: 9,
    category: "general",
  },
  {
    topic: "Smart Trust Wizard Flow",
    keywords: ["smart trust", "wizard", "builder", "formation", "draft"],
    content: `Smart Trust guides trust formation step-by-step. Choose entity type (trust, LLC, foundation, etc.), trust type (revocable/irrevocable), governing law. Add parties (grantor, trustee, beneficiaries). Build Assets/Funding checklist. Generate draft documents. Sync to Trust Records workspace when ready. The wizard outputs to Trust Records for certificate issuance and registry.`,
    priority: 8,
    category: "general",
  },
  {
    topic: "Fill from Client",
    keywords: ["fill from client", "fill from", "client data", "auto-fill", "client record"],
    content: `Use "Fill from client" in Trust Records → Settings to auto-populate grantor/trustee names and addresses from the bound client record. A client must be bound (Platform Binding shows Client ID) before this works. As your trust structuring aid, Jarva can list client values on request so you can manually copy if needed.`,
    priority: 8,
    category: "general",
  },
  {
    topic: "Platform Knowledge – No External APIs",
    keywords: ["api", "external", "outside", "rely", "reliance", "local", "knowledge only"],
    content: `Jarva is your trust structuring aid. It uses only local knowledge and rules—no external LLM APIs are required. Answers come from the curated knowledge base and platform-aware rules. Add content via Admin → NPC → Knowledge to expand what Jarva knows. All trust guidance is generated from platform-stored knowledge.`,
    priority: 7,
    category: "general",
  },
  {
    topic: "Consultant Client Interview – Trust Formation",
    keywords: [
      "ask client",
      "ask my client",
      "what should i ask",
      "client interview",
      "questions to ask",
      "what to ask",
      "client questions",
      "consultant",
      "formation interview",
      "gather information",
      "client intake",
    ],
    content: `Jarva aids you, the consultant. When creating a trust for a client, ask the client these questions—then enter the answers in the platform:

**For Settings (Grantor & Trustee)**
• "What is your full legal name?" → Grantor Name (or use Fill from client)
• "What is your complete mailing address?" → Grantor address fields
• "Who will serve as trustee?" If same as grantor (common for revocable living trusts), use Fill from client for both.
• "What is the trustee's full name and address?" → Trustee name/address in Settings
• "What state/country will govern the trust?" → Jurisdiction / Governing Law

**For Trust Name & Type**
• "What are your main objectives—probate avoidance, asset protection, succession?" → Guides trust type (revocable vs irrevocable)
• "What should we call this trust?" → Entity Name (e.g., "The [Name] Revocable Trust dated [Date]")

**For Assets**
• "What property will fund this trust—cash, real estate, securities, other?" → Add each in Trust Records → Assets
• "What is the description and approximate value?" → Asset fields

**For Beneficiaries**
• "Who will receive distributions from this trust?" → Add beneficiaries (Smart Trust Parties or workspace)
• "What is their relationship to you?" → Beneficiary relationship field

**Formation order:** (1) Client record + Create workspace → (2) Ask grantor/trustee questions → (3) Fill Settings (or use Fill from client) → (4) Ask about assets → (5) Add Assets → (6) Issue certificates. Ask "What should I ask my client?" for step-specific questions.`,
    priority: 10,
    category: "general",
  },
  {
    topic: "Client Authority Title – Who You're Working With",
    keywords: ["client title", "authority title", "trustee", "ceo", "managing member", "executive", "who has authority"],
    content: `When creating a client (New Client) or in Trust Records → Settings, record the client's authority title (Trustee, Steward, Managing Member, Executive, CEO, CFO, President, VP, Owner, Grantor/Settlor). This identifies who has authority to provide the information you need for structuring. Jarva uses this title to tailor prompts: when you ask "what should I ask?", Jarva will suggest questions phrased for that titled individual (e.g., "Ask the Trustee about..." or "The CEO may need to provide..."). Use "Select grantor / client authority title" in Settings or "Fill from client" to sync the title from the client record.`,
    priority: 8,
    category: "general",
  },
  {
    topic: "Consultant – What to Ask Before Settings",
    keywords: ["before settings", "before filling", "before grantor", "before trustee", "what information"],
    content: `Before filling Trust Records → Settings, ask your client:
1. Full legal name (grantor).
2. Complete mailing address (street, city, state, postal code, country).
3. Who will be trustee—same as grantor? If yes, use Fill from client. If different, get trustee's full name and address.
4. Governing state/jurisdiction.
5. Trust objectives (probate avoidance, asset protection, succession) to confirm trust type.
Then enter in Settings or click Fill from client if the bound client is the grantor.`,
    priority: 9,
    category: "general",
  },
  {
    topic: "Consultant – What to Ask Before Assets",
    keywords: ["before assets", "asset questions", "what property", "funding trust"],
    content: `Before adding Trust Records → Assets, ask your client:
1. "What property will fund this trust?" (cash, real estate, securities, business interests, etc.)
2. "For each asset: description and approximate value?"
3. "How will title be transferred?" (deed, assignment, funding checklist)
Enter each asset in the Asset Registry with name, type, and description. Backing assets are required before issuing certificates.`,
    priority: 9,
    category: "general",
  },
];

const NEXUS_TOWER_WORLD_ID = "nexus-tower-hub";

export async function seedDefaultNpcs() {
  const db = await getDb();
  await ensureNpcTables(db);

  for (const npc of DEFAULT_NPCS) {
    const exists = await db
      .select({ id: oasisNpcs.id })
      .from(oasisNpcs)
      .where(eq(oasisNpcs.npcId, npc.npcId))
      .limit(1);
    if (exists.length) continue;

    await db.insert(oasisNpcs).values({
      npcId: npc.npcId,
      name: npc.name,
      role: npc.role,
      title: npc.title,
      avatarEmoji: npc.avatarEmoji,
      greeting: npc.greeting,
      personalityJson: JSON.stringify(DEFAULT_PERSONALITY),
      mood: "neutral",
      isDefault: true,
      isActive: true,
    } as InsertOasisNpcRow);
  }

  const MERIDIAN_TOWER_WORLD_ID = "meridian-tower";

  for (const npc of NEXUS_TOWER_NPCS) {
    const exists = await db
      .select({ id: oasisNpcs.id })
      .from(oasisNpcs)
      .where(eq(oasisNpcs.npcId, npc.npcId))
      .limit(1);
    if (exists.length) continue;

    await db.insert(oasisNpcs).values({
      npcId: npc.npcId,
      name: npc.name,
      role: npc.role,
      title: npc.title,
      avatarEmoji: npc.avatarEmoji,
      greeting: npc.greeting,
      worldId: NEXUS_TOWER_WORLD_ID,
      buildingId: npc.buildingId,
      floor: npc.floor,
      personalityJson: JSON.stringify(DEFAULT_PERSONALITY),
      mood: "neutral",
      isDefault: false,
      isActive: true,
    } as InsertOasisNpcRow);
  }

  for (const npc of MERIDIAN_TOWER_NPCS) {
    const exists = await db
      .select({ id: oasisNpcs.id })
      .from(oasisNpcs)
      .where(eq(oasisNpcs.npcId, npc.npcId))
      .limit(1);
    if (exists.length) continue;

    await db.insert(oasisNpcs).values({
      npcId: npc.npcId,
      name: npc.name,
      role: npc.role,
      title: npc.title,
      avatarEmoji: npc.avatarEmoji,
      greeting: npc.greeting,
      worldId: MERIDIAN_TOWER_WORLD_ID,
      buildingId: npc.buildingId,
      floor: npc.floor,
      personalityJson: JSON.stringify(DEFAULT_PERSONALITY),
      mood: "neutral",
      isDefault: false,
      isActive: true,
    } as InsertOasisNpcRow);
  }

  const APEX_TOWER_WORLD_ID = "apex-tower";
  for (const npc of APEX_TOWER_NPCS) {
    const exists = await db
      .select({ id: oasisNpcs.id })
      .from(oasisNpcs)
      .where(eq(oasisNpcs.npcId, npc.npcId))
      .limit(1);
    if (exists.length) continue;

    await db.insert(oasisNpcs).values({
      npcId: npc.npcId,
      name: npc.name,
      role: npc.role,
      title: npc.title,
      avatarEmoji: npc.avatarEmoji,
      greeting: npc.greeting,
      worldId: APEX_TOWER_WORLD_ID,
      buildingId: npc.buildingId,
      floor: npc.floor,
      personalityJson: JSON.stringify(DEFAULT_PERSONALITY),
      mood: "neutral",
      isDefault: false,
      isActive: true,
    } as InsertOasisNpcRow);
  }

  const GREEN_TERRAIN_WORLD_ID = "green-terrain";
  for (const npc of GREEN_TERRAIN_NPCS) {
    const exists = await db
      .select({ id: oasisNpcs.id })
      .from(oasisNpcs)
      .where(eq(oasisNpcs.npcId, npc.npcId))
      .limit(1);
    if (exists.length) continue;

    await db.insert(oasisNpcs).values({
      npcId: npc.npcId,
      name: npc.name,
      role: npc.role,
      title: npc.title,
      avatarEmoji: npc.avatarEmoji,
      greeting: npc.greeting,
      worldId: GREEN_TERRAIN_WORLD_ID,
      buildingId: npc.buildingId,
      floor: npc.floor,
      personalityJson: JSON.stringify({
        ...DEFAULT_PERSONALITY,
        department: npc.department,
        expertise: npc.expertise,
      }),
      mood: "neutral",
      isDefault: false,
      isActive: true,
    } as InsertOasisNpcRow);
  }

  // Seed TROOTHHERTZ LLC. agents
  for (const npc of TROOTHHERTZ_NPCS) {
    const exists = await db
      .select({ id: oasisNpcs.id })
      .from(oasisNpcs)
      .where(eq(oasisNpcs.npcId, npc.npcId))
      .limit(1);
    if (exists.length) continue;

    await db.insert(oasisNpcs).values({
      npcId: npc.npcId,
      name: npc.name,
      role: npc.role,
      title: npc.title,
      avatarEmoji: npc.avatarEmoji,
      greeting: npc.greeting,
      worldId: GREEN_TERRAIN_WORLD_ID,
      buildingId: npc.buildingId,
      floor: npc.floor,
      personalityJson: JSON.stringify({
        ...DEFAULT_PERSONALITY,
        department: npc.department,
        expertise: npc.expertise,
      }),
      mood: "neutral",
      isDefault: false,
      isActive: true,
    } as InsertOasisNpcRow);
  }

  await seedJarvaKnowledge(db);
  await seedAiRevenueTrendsKnowledge(db);
}

const AI_REVENUE_TRENDS_KNOWLEDGE: Array<{
  topic: string;
  keywords: string[];
  content: string;
  priority: number;
  category: "general" | "business";
}> = [
  {
    topic: "AI Revenue Trends Engine System Prompt",
    keywords: ["trends", "engine", "system", "compliance", "json"],
    content: `You are the AI Revenue Trends Engine for a consulting platform.

Core rules:
- Output strict JSON only and follow the schema.
- Do NOT instruct scraping, bypassing restrictions, or violating platform Terms.
- No personal data. No identifying individuals.
- Do not fabricate exact metrics or claim you checked live data. If uncertain, mark engagement as estimated and use search links.

Platform reasoning:
YouTube:
- Prioritize search intent, tutorial formats, strong titles/thumbnails, retention-driven structure.
- Translate into long-form outlines + Shorts cuts.

TikTok:
- Hook-first, trend formats, UGC style, remixability, comment-driven iteration.
- Translate into 10+ hook variants and batch production.

Reddit:
- Extract pain points, objections, FAQs, and the audience's language.
- Translate into objection handling, landing page copy angles, and offer positioning.

"Why it's trending" must explain:
- Format + hook + target audience pain point + emotion/benefit.
Comment insights must provide:
- Objections, desires, FAQs, suggested variations, buying intent markers.

Estimated/search-link handling:
- If you don't know an exact URL, use platform search URLs.
- If using a search URL or guessing metrics, set engagement.isEstimated = true and confidence = low/medium.
- engagement fields must be numbers or null, never strings.`,
    priority: 10,
    category: "general",
  },
  {
    topic: "Trends Interpretation",
    keywords: ["trends", "viral", "engagement", "resonance"],
    content:
      "When identifying trending content, prioritize: (1) Clear value proposition in title/thumb, (2) Comment sentiment showing pain points or desires, (3) Format (short-form vs long-form) appropriate to platform, (4) Recency (past 30 days).",
    priority: 9,
    category: "general",
  },
  {
    topic: "Platform-Specific Signals",
    keywords: ["youtube", "tiktok", "reddit", "engagement"],
    content:
      "YouTube: view count, retention, comments on tutorials/how-tos. TikTok: saves, shares, duet/stitch usage. Reddit: upvotes, awards, comment depth. Use platform-native metrics when available.",
    priority: 8,
    category: "general",
  },
  {
    topic: "Campaign Strategy Context",
    keywords: ["campaign", "strategy", "traffic", "conversion"],
    content:
      "Trending content informs: (1) Traffic sources and creative formats, (2) Messaging angles that convert, (3) Audience pain points for offer engineering, (4) Competitor and alternative discussions.",
    priority: 9,
    category: "business",
  },
];

async function seedAiRevenueTrendsKnowledge(db: Awaited<ReturnType<typeof getDb>>) {
  const trends = await db
    .select({ id: oasisNpcs.id })
    .from(oasisNpcs)
    .where(eq(oasisNpcs.npcId, "ai-revenue-trends"))
    .limit(1);
  if (trends.length === 0) return;

  const trendsId = trends[0]!.id;
  const existing = await db
    .select({ id: oasisNpcKnowledge.id })
    .from(oasisNpcKnowledge)
    .where(eq(oasisNpcKnowledge.npcId, trendsId))
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(oasisNpcKnowledge).values(
    AI_REVENUE_TRENDS_KNOWLEDGE.map((k) => ({
      npcId: trendsId,
      topic: k.topic,
      keywords: JSON.stringify(k.keywords),
      content: k.content,
      priority: k.priority,
      category: k.category,
    }))
  );
}

async function seedJarvaKnowledge(db: Awaited<ReturnType<typeof getDb>>) {
  const jarva = await db
    .select({ id: oasisNpcs.id })
    .from(oasisNpcs)
    .where(eq(oasisNpcs.npcId, "trust-advisor"))
    .limit(1);
  if (jarva.length === 0) return;

  const jarvaId = jarva[0]!.id;
  await db
    .delete(oasisNpcKnowledge)
    .where(eq(oasisNpcKnowledge.npcId, jarvaId));

  const validEntries = JARVA_KNOWLEDGE.filter((k) => {
    const result = validateKnowledgeEntry(k);
    if (!result.success && typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
      console.warn("[Jarva] Invalid knowledge entry skipped:", k.topic, result.error.flatten());
    }
    return result.success;
  });

  await db.insert(oasisNpcKnowledge).values(
    validEntries.map((k) => ({
      npcId: jarvaId,
      topic: k.topic,
      keywords: JSON.stringify(k.keywords),
      content: k.content,
      priority: k.priority,
      category: k.category,
    }))
  );
}

export async function listNpcsByOwner(ownerId: number, { includeInactive = false } = {}) {
  const db = await getDb();
  await ensureNpcTables(db);

  const baseWhere = eq(oasisNpcs.ownerId, ownerId);
  const rows = includeInactive
    ? await db
        .select()
        .from(oasisNpcs)
        .where(baseWhere)
        .orderBy(desc(oasisNpcs.createdAt))
    : await db
        .select()
        .from(oasisNpcs)
        .where(and(baseWhere, eq(oasisNpcs.isActive, true)))
        .orderBy(desc(oasisNpcs.createdAt));

  return rows.map((row) => toNpcProfile(row));
}

export async function listNpcs({ includeInactive = false } = {}) {
  const db = await getDb();
  await ensureNpcTables(db);

  const rows = includeInactive
    ? await db.select().from(oasisNpcs).orderBy(desc(oasisNpcs.createdAt))
    : await db
        .select()
        .from(oasisNpcs)
        .where(eq(oasisNpcs.isActive, true))
        .orderBy(desc(oasisNpcs.createdAt));

  return rows.map(toNpcProfile);
}

export async function getNpcByNpcId(npcId: string) {
  const db = await getDb();
  await ensureNpcTables(db);

  const row = (
    await db.select().from(oasisNpcs).where(eq(oasisNpcs.npcId, npcId)).limit(1)
  )[0];
  return row ? toNpcProfile(row) : null;
}

export async function getNpcRowByNpcId(npcId: string) {
  const db = await getDb();
  await ensureNpcTables(db);
  const row = (
    await db.select().from(oasisNpcs).where(eq(oasisNpcs.npcId, npcId)).limit(1)
  )[0];
  return row ?? null;
}

export async function createNpc(input: {
  npcId: string;
  name: string;
  role: NPCRole;
  title?: string | null;
  avatarEmoji?: string | null;
  voiceStyle?: NPCProfile["voiceStyle"];
  language?: string | null;
  worldId?: string | null;
  greeting?: string | null;
  farewell?: string | null;
  personality?: NPCProfile["personality"];
  ownerId?: number | null;
}) {
  const db = await getDb();
  await ensureNpcTables(db);

  await db.insert(oasisNpcs).values({
    npcId: input.npcId,
    name: input.name,
    role: input.role,
    title: input.title || null,
    avatarEmoji: input.avatarEmoji || "🤖",
    voiceStyle: input.voiceStyle || "friendly",
    language: input.language?.trim() || null,
    worldId: input.worldId || null,
    ownerId: input.ownerId ?? null,
    greeting: input.greeting || null,
    farewell: input.farewell || null,
    personalityJson: JSON.stringify(input.personality || DEFAULT_PERSONALITY),
    mood: "neutral",
    isDefault: false,
    isActive: true,
  });

  return getNpcByNpcId(input.npcId);
}

export async function updateNpc(input: {
  npcId: string;
  name?: string;
  title?: string | null;
  avatarEmoji?: string | null;
  voiceStyle?: NPCProfile["voiceStyle"];
  language?: string | null;
  greeting?: string | null;
  farewell?: string | null;
  personality?: NPCProfile["personality"];
}) {
  const db = await getDb();
  await ensureNpcTables(db);

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.title !== undefined) updates.title = input.title;
  if (input.avatarEmoji !== undefined) updates.avatarEmoji = input.avatarEmoji;
  if (input.voiceStyle !== undefined) updates.voiceStyle = input.voiceStyle;
  if (input.language !== undefined) updates.language = input.language?.trim() || null;
  if (input.greeting !== undefined) updates.greeting = input.greeting;
  if (input.farewell !== undefined) updates.farewell = input.farewell;
  if (input.personality !== undefined) {
    updates.personalityJson = JSON.stringify(input.personality);
  }

  if (!Object.keys(updates).length) return getNpcByNpcId(input.npcId);

  await db.update(oasisNpcs).set(updates).where(eq(oasisNpcs.npcId, input.npcId));
  return getNpcByNpcId(input.npcId);
}

export async function deactivateNpc(npcId: string) {
  const db = await getDb();
  await ensureNpcTables(db);
  await db.update(oasisNpcs).set({ isActive: false }).where(eq(oasisNpcs.npcId, npcId));
}

export async function addKnowledge(npcRowId: number, entries: KnowledgeEntry[]) {
  const db = await getDb();
  await ensureNpcTables(db);
  if (!entries.length) return;

  await db.insert(oasisNpcKnowledge).values(
    entries.map((entry) => ({
      npcId: npcRowId,
      topic: entry.topic,
      keywords: JSON.stringify(entry.keywords),
      content: entry.content,
      priority: entry.priority ?? 5,
      category: entry.category ?? "general",
    }))
  );
}

export async function getKnowledgeForNpc(npcRowId: number): Promise<KnowledgeEntry[]> {
  const db = await getDb();
  await ensureNpcTables(db);
  const rows = await db
    .select()
    .from(oasisNpcKnowledge)
    .where(eq(oasisNpcKnowledge.npcId, npcRowId))
    .orderBy(desc(oasisNpcKnowledge.priority));

  return rows.map((row) => ({
    topic: row.topic,
    keywords: parseKeywords(row.keywords),
    content: row.content,
    priority: row.priority ?? 5,
    category: (row.category as KnowledgeEntry["category"]) || "general",
  }));
}

export async function createSession(params: {
  sessionId: string;
  npcRowId: number;
  npcNpcId: string;
  userId?: number | null;
  currentTopic?: string | null;
}) {
  const db = await getDb();
  await ensureNpcTables(db);

  await db.insert(oasisNpcSessions).values({
    sessionId: params.sessionId,
    npcId: params.npcRowId,
    npcNpcId: params.npcNpcId,
    userId: params.userId ?? null,
    currentTopic: params.currentTopic ?? null,
    messageCount: 0,
  });
}

/** Persist sticky Jarva specialist lane for trust-advisor sessions (see `resolveEffectiveJarvaWorkflowPath`). */
export async function updateSessionJarvaWorkflowPath(sessionId: string, path: string) {
  const db = await getDb();
  await ensureNpcTables(db);
  await db.update(oasisNpcSessions).set({ jarvaWorkflowPath: path }).where(eq(oasisNpcSessions.sessionId, sessionId));
}

export async function getSessionBySessionId(sessionId: string) {
  const db = await getDb();
  await ensureNpcTables(db);

  return (
    await db
      .select()
      .from(oasisNpcSessions)
      .where(eq(oasisNpcSessions.sessionId, sessionId))
      .limit(1)
  )[0];
}

export async function incrementSessionMessageCount(sessionId: string, delta = 1) {
  const db = await getDb();
  await ensureNpcTables(db);
  await db.execute(
    sql`UPDATE oasis_npc_sessions SET messageCount = messageCount + ${delta}, lastActivity = CURRENT_TIMESTAMP WHERE sessionId = ${sessionId}`
  );
}

export async function addMessage(params: {
  sessionRowId: number;
  role: "user" | "npc";
  content: string;
  intent?: string | null;
  intentConfidence?: number | null;
  sentiment?: Sentiment | null;
  responseSource?: ResponseSource | null;
}) {
  const db = await getDb();
  await ensureNpcTables(db);
  await db.insert(oasisNpcMessages).values({
    sessionId: params.sessionRowId,
    role: params.role,
    content: params.content,
    intent: params.intent ?? null,
    intentConfidence: params.intentConfidence ?? null,
    sentiment: params.sentiment ?? null,
    responseSource: params.responseSource ?? null,
  });
}

export async function getSessionsByNpcId(npcId: string) {
  const db = await getDb();
  await ensureNpcTables(db);

  const rows = await db
    .select()
    .from(oasisNpcSessions)
    .where(eq(oasisNpcSessions.npcNpcId, npcId))
    .orderBy(desc(oasisNpcSessions.startedAt));

  return rows;
}

export async function getMessagesForSession(sessionRowId: number) {
  const db = await getDb();
  await ensureNpcTables(db);

  return await db
    .select()
    .from(oasisNpcMessages)
    .where(eq(oasisNpcMessages.sessionId, sessionRowId))
    .orderBy(oasisNpcMessages.createdAt);
}

export async function getSystemAnalytics() {
  const db = await getDb();
  await ensureNpcTables(db);

  const npcRows = await db.select().from(oasisNpcs);
  const sessions = await db.select().from(oasisNpcSessions);
  const messages = await db.select().from(oasisNpcMessages);

  const npcBreakdown = npcRows.map((npc) => {
    const count = sessions.filter((s) => s.npcNpcId === npc.npcId).length;
    return { npcId: npc.npcId, name: npc.name, sessions: count };
  });

  return {
    totalNPCs: npcRows.filter((n) => n.isActive).length,
    totalSessions: sessions.length,
    totalMessages: messages.length,
    activeSessions: sessions.filter((s) => !s.endedAt).length,
    npcBreakdown,
  };
}

export async function getNpcAnalytics(npcId: string) {
  const db = await getDb();
  await ensureNpcTables(db);

  const sessions = await db
    .select()
    .from(oasisNpcSessions)
    .where(eq(oasisNpcSessions.npcNpcId, npcId));

  if (!sessions.length) {
    return {
      totalSessions: 0,
      totalMessages: 0,
      avgMessagesPerSession: 0,
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
      responseSourceBreakdown: { rule: 0, knowledge: 0, llm: 0 },
      topIntents: [],
    };
  }

  const sessionIds = sessions.map((s) => s.id);
  const messages = await db
    .select()
    .from(oasisNpcMessages)
    .where(inArray(oasisNpcMessages.sessionId, sessionIds));

  const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
  const responseSourceBreakdown = { rule: 0, knowledge: 0, llm: 0 };
  const intentCounts: Record<string, number> = {};

  for (const msg of messages) {
    if (msg.sentiment && msg.sentiment in sentimentBreakdown) {
      sentimentBreakdown[msg.sentiment as Sentiment] += 1;
    }
    if (msg.responseSource && msg.responseSource in responseSourceBreakdown) {
      responseSourceBreakdown[msg.responseSource as ResponseSource] += 1;
    }
    if (msg.intent) {
      intentCounts[msg.intent] = (intentCounts[msg.intent] || 0) + 1;
    }
  }

  const topIntents = Object.entries(intentCounts)
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalSessions: sessions.length,
    totalMessages: messages.length,
    avgMessagesPerSession: Math.round(messages.length / sessions.length),
    sentimentBreakdown,
    responseSourceBreakdown,
    topIntents,
  };
}
