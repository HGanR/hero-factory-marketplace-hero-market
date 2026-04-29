/**
 * greenTerrainBuildingData.ts
 * Corporate Office Building — Agent Roster & Floor Configuration
 * Structured to match troo_world_elements / NPC agent DB schema
 */

export interface AgentData {
  id: string;
  name: string;
  role: string;
  floor: number;         // 0 = Lobby
  floorLabel: string;
  expertise: string;
  avatar: string;        // emoji fallback
  department: string;
  greeting: string;
}

export interface FloorConfig {
  floor: number;
  label: string;
  color: string;         // Interior accent color
  purpose: string;
}

export const BUILDING_CONFIG = {
  id: "corporate-tower-01",
  name: "Nexus Corporate Tower",
  elementKey: "corporate-tower-01",
  glbUrl: "procedural:corporate",
  floors: 10,            // 0 = Lobby, 1–9 = Financial Institutions Tower
  height: 32,            // world units total (10 * 3.2)
  floorHeight: 3.2,
  footprint: { w: 12, d: 10 },
};

export const FLOOR_CONFIG: FloorConfig[] = [
  { floor: 0, label: "Lobby",                    color: "#1a3a5c", purpose: "Reception & Security" },
  { floor: 1, label: "Floor 1 — Currency",      color: "#1c3d2e", purpose: "Monetary Law" },
  { floor: 2, label: "Floor 2 — Finance",        color: "#2d1a4a", purpose: "Financial Instruments" },
  { floor: 3, label: "Floor 3 — Transfer",      color: "#2a3d1a", purpose: "Securities Transfer" },
  { floor: 4, label: "Floor 4 — Broker",        color: "#1a2d4a", purpose: "Brokerage Onboarding" },
  { floor: 5, label: "Floor 5 — Compliance",     color: "#4a1a2d", purpose: "SEC / FinCEN Rules" },
  { floor: 6, label: "Floor 6 — Trustee",        color: "#3a2a1a", purpose: "Trust Administration" },
  { floor: 7, label: "Floor 7 — Custodian",     color: "#1a3a4a", purpose: "Asset Custody" },
  { floor: 8, label: "Floor 8 — Clearing",      color: "#2a1a3a", purpose: "Settlement Systems" },
  { floor: 9, label: "Floor 9 — Architect",     color: "#0d2a3a", purpose: "Financial Structuring" },
];

export const AGENTS: AgentData[] = [
  // ── Lobby ──────────────────────────────────────────────────────────
  {
    id: "agent-lobby-receptionist",
    name: "Victoria Hale",
    role: "Head Receptionist",
    floor: 0,
    floorLabel: "Lobby",
    department: "Administration",
    expertise: "Visitor management, scheduling, building directory, executive communications",
    avatar: "👩‍💼",
    greeting: "Welcome to Nexus Corporate Tower. I'm Victoria, your head receptionist. How may I assist you today?",
  },
  {
    id: "agent-lobby-security-1",
    name: "Marcus Reid",
    role: "Chief Security Officer",
    floor: 0,
    floorLabel: "Lobby",
    department: "Security",
    expertise: "Access control, emergency protocols, visitor verification, building safety",
    avatar: "🛡️",
    greeting: "Good day. I'm Marcus Reid, Chief Security. Please have your credentials ready. How can I help you?",
  },
  {
    id: "agent-lobby-security-2",
    name: "Dana Osei",
    role: "Security Agent",
    floor: 0,
    floorLabel: "Lobby",
    department: "Security",
    expertise: "Perimeter monitoring, incident response, visitor escort",
    avatar: "🔒",
    greeting: "Hello, I'm Dana from security. Is there something I can assist you with?",
  },

  // ── Floor 1 — Currency (Monetary Law) ──────────────────────────────
  {
    id: "agent-f1-currency",
    name: "Sophia Mercer",
    role: "Currency Agent",
    floor: 1,
    floorLabel: "Floor 1 — Currency",
    department: "Monetary Law",
    expertise: "Currency reporting, monetary instruments, FinCEN regulations, CTR/CMIR filings",
    avatar: "💵",
    greeting: "I'm Sophia Mercer, Currency Agent. I specialize in monetary law and currency reporting. How can I help?",
  },

  // ── Floor 2 — Financial Instruments ─────────────────────────────────
  {
    id: "agent-f2-cfo",
    name: "Eleanor Voss",
    role: "Chief Financial Officer",
    floor: 2,
    floorLabel: "Floor 2 — Finance",
    department: "Currency and Monetary Instruments",
    expertise: "Currency reporting, negotiable instruments, trust securities issuance, brokerage deposit procedures, trustee certification",
    avatar: "💹",
    greeting: "Eleanor Voss, CFO. I oversee currency reporting, negotiable instruments, trust securities issuance, and brokerage deposit procedures. What financial matter can I address?",
  },

  // ── Floor 3 — Transfer Agent (Securities Transfer) ──────────────────
  {
    id: "agent-f3-transfer",
    name: "Kwame Asante",
    role: "Transfer Agent",
    floor: 3,
    floorLabel: "Floor 3 — Transfer",
    department: "Securities Transfer",
    expertise: "Stock transfers, DTC eligibility, transfer agent registration, recordkeeping",
    avatar: "📄",
    greeting: "Kwame Asante, Transfer Agent. I handle securities transfer and recordkeeping. How can I assist?",
  },

  // ── Floor 4 — Broker Agent (Brokerage Onboarding) ───────────────────
  {
    id: "agent-f4-broker",
    name: "Marcus Chen",
    role: "Broker Agent",
    floor: 4,
    floorLabel: "Floor 4 — Broker",
    department: "Brokerage Onboarding",
    expertise: "Entity onboarding, account opening, KYC/AML, broker-dealer compliance",
    avatar: "🏦",
    greeting: "Marcus Chen, Broker Agent. I assist with brokerage onboarding and entity account setup. What do you need?",
  },

  // ── Floor 5 — Compliance Agent (SEC / FinCEN) ───────────────────────
  {
    id: "agent-f5-compliance",
    name: "Nathaniel Cross",
    role: "Compliance Agent",
    floor: 5,
    floorLabel: "Floor 5 — Compliance",
    department: "SEC / FinCEN",
    expertise: "SEC rules, FinCEN regulations, BSA/AML, regulatory compliance",
    avatar: "⚖️",
    greeting: "Nathaniel Cross, Compliance Agent. I specialize in SEC and FinCEN rules. How can I help?",
  },

  // ── Floor 6 — Trustee Agent (Trust Administration) ────────────────────
  {
    id: "agent-f6-trustee",
    name: "Isabelle Laurent",
    role: "Trustee Agent",
    floor: 6,
    floorLabel: "Floor 6 — Trustee",
    department: "Trust Administration",
    expertise: "Trust administration, fiduciary duties, beneficiary rights, trust accounting",
    avatar: "📜",
    greeting: "I'm Isabelle Laurent, Trustee Agent. I handle trust administration and fiduciary matters. What can I help with?",
  },

  // ── Floor 7 — Custodian Agent (Asset Custody) ───────────────────────
  {
    id: "agent-f7-custodian",
    name: "Ravi Patel",
    role: "Custodian Agent",
    floor: 7,
    floorLabel: "Floor 7 — Custodian",
    department: "Asset Custody",
    expertise: "Asset custody, safekeeping, segregated accounts, custody regulations",
    avatar: "🔐",
    greeting: "Ravi Patel, Custodian Agent. I specialize in asset custody and safekeeping. How can I assist?",
  },

  // ── Floor 8 — Clearing Agent (Settlement Systems) ───────────────────
  {
    id: "agent-f8-clearing",
    name: "Aria Nova",
    role: "Clearing Agent",
    floor: 8,
    floorLabel: "Floor 8 — Clearing",
    department: "Settlement Systems",
    expertise: "Clearing, settlement, DTC/NSCC, trade settlement, fails management",
    avatar: "🔄",
    greeting: "I'm Aria Nova, Clearing Agent. I handle settlement systems and clearing operations. What do you need?",
  },

  // ── Floor 9 — Financial Architect (Structuring) ─────────────────────
  {
    id: "agent-f9-architect",
    name: "Devon Park",
    role: "Financial Architect",
    floor: 9,
    floorLabel: "Floor 9 — Architect",
    department: "Financial Structuring",
    expertise: "Deal structuring, entity design, capital structure, financial architecture",
    avatar: "🏗️",
    greeting: "Devon Park, Financial Architect. I design financial structures and deal architecture. How can I help?",
  },
];

export function getAgentsByFloor(floor: number): AgentData[] {
  return AGENTS.filter(a => a.floor === floor);
}

export function getAgentById(id: string): AgentData | undefined {
  return AGENTS.find(a => a.id === id);
}
