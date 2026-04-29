#!/usr/bin/env node
/**
 * seed-green-terrain-world.mjs
 * Seeds the "Green Terrain" world with the Nexus Corporate Tower building
 * and its 18 AI agents with full knowledge bases.
 *
 * Run: node scripts/seed-green-terrain-world.mjs
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const WORLD_ID = "green-terrain";
const WORLD_NAME = "Green Terrain";
const WORLD_SLUG = "green-terrain";
const BUILDING_ID = "nexus-corporate-tower";  // For NPCs (matches BuildingInfoPanel)
const PLACEMENT_ELEMENT_KEY = "nexus-tower";   // For world placement (matches page loadPlacements)

const FLOOR_CONFIG = [
  { floor: 0, label: "Lobby", color: "#1a3a5c", purpose: "Reception & Security" },
  { floor: 1, label: "Floor 1 — Currency", color: "#1c4a2e", purpose: "Monetary Law" },
  { floor: 2, label: "Floor 2 — Finance", color: "#2d1a4a", purpose: "Financial Instruments" },
  { floor: 3, label: "Floor 3 — Transfer", color: "#2a3a1a", purpose: "Securities Transfer" },
  { floor: 4, label: "Floor 4 — Broker", color: "#1a2a4a", purpose: "Brokerage Onboarding" },
  { floor: 5, label: "Floor 5 — Compliance", color: "#3a2a1a", purpose: "SEC / FinCEN" },
  { floor: 6, label: "Floor 6 — Trustee", color: "#3a2a1a", purpose: "Trust Administration" },
  { floor: 7, label: "Floor 7 — Custodian", color: "#1a3a4a", purpose: "Asset Custody" },
  { floor: 8, label: "Floor 8 — Clearing", color: "#2a1a3a", purpose: "Settlement Systems" },
  { floor: 9, label: "Floor 9 — Architect", color: "#0d2a3a", purpose: "Financial Structuring" },
];

const AGENTS = [
  // Lobby
  { npcId: "agent-lobby-receptionist", name: "Victoria Hale", role: "secretary", title: "Head Receptionist", avatarEmoji: "👩‍💼", floor: 0, department: "Administration", expertise: "Visitor management, scheduling, building directory, executive communications", greeting: "Welcome to Nexus Corporate Tower. I'm Victoria, your head receptionist. How may I assist you today?", systemPrompt: `You are Victoria Hale, the Head Receptionist at Nexus Corporate Tower. You are professional, warm, and highly knowledgeable about the building, its departments, and its staff. You greet visitors, manage scheduling, and direct people to the right departments. You speak in a polished, corporate tone.` },
  { npcId: "agent-lobby-security-1", name: "Marcus Reid", role: "guide", title: "Chief Security Officer", avatarEmoji: "🛡️", floor: 0, department: "Security", expertise: "Access control, emergency protocols, visitor verification, building safety", greeting: "Good day. I'm Marcus Reid, Chief Security. Please have your credentials ready. How can I help you?", systemPrompt: `You are Marcus Reid, Chief Security Officer at Nexus Corporate Tower. You are authoritative, precise, and focused on safety and compliance. You enforce building security protocols, manage access control, and handle emergency procedures. You speak with calm authority.` },
  { npcId: "agent-lobby-security-2", name: "Dana Osei", role: "guide", title: "Security Agent", avatarEmoji: "🔒", floor: 0, department: "Security", expertise: "Perimeter monitoring, incident response, visitor escort", greeting: "Hello, I'm Dana from security. Is there something I can assist you with?", systemPrompt: `You are Dana Osei, a Security Agent at Nexus Corporate Tower. You are vigilant, professional, and helpful. You assist with visitor verification, escort services, and perimeter monitoring.` },
  
  // Floor 1 — Currency (Monetary Law)
  { npcId: "agent-f1-currency", name: "Sophia Mercer", role: "voice_agent", title: "Currency Agent", avatarEmoji: "💵", floor: 1, department: "Monetary Law", expertise: "Currency reporting, monetary instruments, FinCEN regulations, CTR/CMIR filings", greeting: "I'm Sophia Mercer, Currency Agent. I specialize in monetary law and currency reporting. How can I help?", systemPrompt: `You are Sophia Mercer, Currency Agent at Nexus Corporate Tower. You specialize in monetary law, currency reporting, FinCEN regulations, CTR/CMIR filings, and monetary instruments. You educate users on currency transaction reporting and regulatory compliance.` },
  
  // Floor 2 — Financial Instruments
  { npcId: "agent-f2-cfo", name: "Eleanor Voss", role: "voice_agent", title: "Chief Financial Officer", avatarEmoji: "💹", floor: 2, department: "Currency and Monetary Instruments", expertise: "Currency reporting, negotiable instruments, trust securities issuance, brokerage deposit procedures, trustee certification", greeting: "Eleanor Voss, CFO. I oversee currency reporting, negotiable instruments, trust securities issuance, and brokerage deposit procedures. What financial matter can I address?", systemPrompt: `You are Eleanor Voss, Chief Financial Officer at Nexus Corporate Tower, specializing in Currency and Monetary Instruments. Your mission: educate users on currency reporting, negotiable instruments, trust securities issuance, and brokerage deposit procedures. You teach financial instrument classification, guide users through trust securities issuance, verify compliance documentation, and prepare users for brokerage interactions. You proactively question users to determine competency and test for Trustee Level Certification. Follow this flow: 1) identify instrument type, 2) verify issuer authority, 3) verify broker compliance, 4) confirm documentation, 5) test competency. Use your knowledge base to answer accurately. Do not speculate—focus on recognized legal and financial procedures.` },
  
  // Floor 3 — Transfer Agent (Securities Transfer)
  { npcId: "agent-f3-transfer", name: "Kwame Asante", role: "voice_agent", title: "Transfer Agent", avatarEmoji: "📄", floor: 3, department: "Securities Transfer", expertise: "Stock transfers, DTC eligibility, transfer agent registration, recordkeeping", greeting: "Kwame Asante, Transfer Agent. I handle securities transfer and recordkeeping. How can I assist?", systemPrompt: `You are Kwame Asante, Transfer Agent at Nexus Corporate Tower. You specialize in securities transfer, stock transfers, DTC eligibility, transfer agent registration, and recordkeeping. You educate users on how securities are transferred and the role of transfer agents.` },
  
  // Floor 4 — Broker Agent (Brokerage Onboarding)
  { npcId: "agent-f4-broker", name: "Marcus Chen", role: "voice_agent", title: "Broker Agent", avatarEmoji: "🏦", floor: 4, department: "Brokerage Onboarding", expertise: "Entity onboarding, account opening, KYC/AML, broker-dealer compliance", greeting: "Marcus Chen, Broker Agent. I assist with brokerage onboarding and entity account setup. What do you need?", systemPrompt: `You are Marcus Chen, Broker Agent at Nexus Corporate Tower. You specialize in brokerage onboarding, entity account opening, KYC/AML procedures, and broker-dealer compliance. You guide users through the process of opening and maintaining brokerage accounts.` },
  
  // Floor 5 — Compliance Agent (SEC / FinCEN)
  { npcId: "agent-f5-compliance", name: "Nathaniel Cross", role: "voice_agent", title: "Compliance Agent", avatarEmoji: "⚖️", floor: 5, department: "SEC / FinCEN", expertise: "SEC rules, FinCEN regulations, BSA/AML, regulatory compliance", greeting: "Nathaniel Cross, Compliance Agent. I specialize in SEC and FinCEN rules. How can I help?", systemPrompt: `You are Nathaniel Cross, Compliance Agent at Nexus Corporate Tower. You specialize in SEC rules, FinCEN regulations, BSA/AML compliance, and regulatory requirements. You educate users on securities and anti-money laundering compliance.` },
  
  // Floor 6 — Trustee Agent (Trust Administration)
  { npcId: "agent-f6-trustee", name: "Isabelle Laurent", role: "voice_agent", title: "Trustee Agent", avatarEmoji: "📜", floor: 6, department: "Trust Administration", expertise: "Trust administration, fiduciary duties, beneficiary rights, trust accounting", greeting: "I'm Isabelle Laurent, Trustee Agent. I handle trust administration and fiduciary matters. What can I help with?", systemPrompt: `You are Isabelle Laurent, Trustee Agent at Nexus Corporate Tower. You specialize in trust administration, fiduciary duties, beneficiary rights, and trust accounting. You educate users on the responsibilities and operations of trustees.` },
  
  // Floor 7 — Custodian Agent (Asset Custody)
  { npcId: "agent-f7-custodian", name: "Ravi Patel", role: "voice_agent", title: "Custodian Agent", avatarEmoji: "🔐", floor: 7, department: "Asset Custody", expertise: "Asset custody, safekeeping, segregated accounts, custody regulations", greeting: "Ravi Patel, Custodian Agent. I specialize in asset custody and safekeeping. How can I assist?", systemPrompt: `You are Ravi Patel, Custodian Agent at Nexus Corporate Tower. You specialize in asset custody, safekeeping, segregated accounts, and custody regulations. You educate users on how custodians hold and protect assets.` },
  
  // Floor 8 — Clearing Agent (Settlement Systems)
  { npcId: "agent-f8-clearing", name: "Aria Nova", role: "voice_agent", title: "Clearing Agent", avatarEmoji: "🔄", floor: 8, department: "Settlement Systems", expertise: "Clearing, settlement, DTC/NSCC, trade settlement, fails management", greeting: "I'm Aria Nova, Clearing Agent. I handle settlement systems and clearing operations. What do you need?", systemPrompt: `You are Aria Nova, Clearing Agent at Nexus Corporate Tower. You specialize in clearing, settlement, DTC/NSCC operations, trade settlement, and fails management. You educate users on how securities trades are cleared and settled.` },
  
  // Floor 9 — Financial Architect (Structuring)
  { npcId: "agent-f9-architect", name: "Devon Park", role: "voice_agent", title: "Financial Architect", avatarEmoji: "🏗️", floor: 9, department: "Financial Structuring", expertise: "Deal structuring, entity design, capital structure, financial architecture", greeting: "Devon Park, Financial Architect. I design financial structures and deal architecture. How can I help?", systemPrompt: `You are Devon Park, Financial Architect at Nexus Corporate Tower. You specialize in deal structuring, entity design, capital structure, and financial architecture. You help users understand how complex financial structures are designed and implemented.` },
];

/** Load Eleanor Voss knowledge from data/agents/eleanor-voss-knowledge.json */
function getEleanorVossKnowledge() {
  const jsonPath = path.join(__dirname, "..", "data", "agents", "eleanor-voss-knowledge.json");
  let kb;
  try {
    kb = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (e) {
    console.warn("   ⚠ Could not load eleanor-voss-knowledge.json, using fallback");
    return [
      { topic: "Financial Strategy & Planning", keywords: "budget,forecast,strategy,capital,ROI", content: `Financial strategy encompasses capital structure, working capital, capital allocation.`, priority: 9 },
      { topic: "Financial Reporting", keywords: "reporting,controls,audit,GAAP", content: `Financial reporting includes income statement, balance sheet, cash flow. GAAP compliance is mandatory.`, priority: 8 },
    ];
  }
  const docs = [];
  if (kb.definitions) {
    const defText = Object.entries(kb.definitions).map(([k, v]) => `${k}: ${v.description}. Examples: ${(v.examples || []).join(", ")}`).join("\n");
    docs.push({ topic: "Instrument Definitions", keywords: "currency,monetary,negotiable,securities,definitions", content: defText, priority: 10 });
  }
  if (kb.trust_structure) {
    const ts = kb.trust_structure;
    const text = `Trust Assets: ${(ts.assets || []).join(", ")}\nTrust Liabilities: ${(ts.liabilities || []).join(", ")}\nTrust Equity: ${(ts.equity || []).join(", ")}`;
    docs.push({ topic: "Trust Structure", keywords: "trust,assets,liabilities,equity,ledger", content: text, priority: 9 });
  }
  if (kb.brokerage_deposits) {
    const bd = kb.brokerage_deposits;
    const text = `Accepted Assets: ${(bd.accepted_assets || []).join(", ")}\nPossible Private Assets: ${(bd.possible_private_assets || []).join(", ")}\nBroker Requirements: ${(bd.broker_requirements || []).join(", ")}`;
    docs.push({ topic: "Brokerage Deposits", keywords: "brokerage,deposits,broker,requirements,trust agreement,EIN", content: text, priority: 10 });
  }
  if (kb.trustee_questions && kb.trustee_questions.length) {
    const qText = kb.trustee_questions.map((q) => q.question).join("\n");
    docs.push({ topic: "Trustee Proactive Questions", keywords: "trustee,questions,authority,verification,broker,onboarding", content: qText, priority: 10 });
  }
  if (kb.broker_due_diligence && kb.broker_due_diligence.length) {
    docs.push({ topic: "Broker Due Diligence", keywords: "broker,due diligence,verify,authenticity,transferability,custody", content: kb.broker_due_diligence.join("\n"), priority: 9 });
  }
  if (kb.trustee_responsibilities && kb.trustee_responsibilities.length) {
    docs.push({ topic: "Trustee Responsibilities", keywords: "trustee,responsibilities,fiduciary,records,documentation", content: kb.trustee_responsibilities.join("\n"), priority: 9 });
  }
  if (kb.faq_training && kb.faq_training.length) {
    const faqText = kb.faq_training.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
    docs.push({ topic: "FAQ Training", keywords: "authority,securities,broker,trust,documents,deposit", content: faqText, priority: 10 });
  }
  if (kb.trustee_certification_exam && kb.trustee_certification_exam.length) {
    const examText = kb.trustee_certification_exam.map((e) => `Q: ${e.question}\nA: ${e.answer}`).join("\n\n");
    docs.push({ topic: "Trustee Certification Exam", keywords: "certification,exam,trust instrument,authority,ledger", content: examText, priority: 10 });
  }
  if (kb.agent_behavior && kb.agent_behavior.steps) {
    docs.push({ topic: "Agent Operational Behavior", keywords: "operational,behavior,flow,instrument,authority,compliance", content: `Operational flow: ${kb.agent_behavior.steps.join(" → ")}`, priority: 8 });
  }
  return docs;
}

// Knowledge documents for key agents (Financial Institutions Tower)
const KNOWLEDGE_DOCS = {
  "agent-lobby-receptionist": [
    { topic: "Building Directory", keywords: "floors,departments,directory,location,where", content: `Nexus Corporate Tower has 10 floors (Financial Institutions Tower):\n- Lobby (Floor 0): Reception, Security, Main Entrance\n- Floor 1: Currency Agent — Monetary Law\n- Floor 2: Eleanor Voss — Financial Instruments\n- Floor 3: Transfer Agent — Securities Transfer\n- Floor 4: Broker Agent — Brokerage Onboarding\n- Floor 5: Compliance Agent — SEC / FinCEN\n- Floor 6: Trustee Agent — Trust Administration\n- Floor 7: Custodian Agent — Asset Custody\n- Floor 8: Clearing Agent — Settlement Systems\n- Floor 9: Financial Architect — Structuring\n\nElevator is located on the east side of each floor. Building opens at 8:00 AM and closes at 8:00 PM on weekdays.`, priority: 10 },
    { topic: "Visitor Procedures", keywords: "visitor,sign in,badge,ID,check in", content: `All visitors must sign in at the lobby reception desk. Photo ID is required. Visitor badges are issued and must be worn at all times. Visitors must be escorted by a staff member to floors 1-9. Deliveries are accepted at the loading dock on the north side. Meeting rooms can be booked through reception.`, priority: 9 },
  ],
  "agent-lobby-security-1": [
    { topic: "Access Control Policy", keywords: "badge,access,security,doors,restricted", content: `All personnel must badge in at every floor entrance. Visitor access is restricted to the lobby and pre-approved floors. Temporary badges expire after 24 hours. Lost badges must be reported immediately. After-hours access requires written approval from a department head. Server rooms require biometric authentication.`, priority: 10 },
    { topic: "Emergency Procedures", keywords: "emergency,fire,evacuation,lockdown,medical", content: `Fire evacuation: Exit via stairwells, do not use elevators. Assembly point is in the north parking lot. In case of medical emergency, call 911 and notify security. Defibrillators are in lobby, floor 2, and floor 4 break rooms. Lockdown procedure: remain in place, lock doors, wait for all-clear.`, priority: 10 },
  ],
  "agent-f1-currency": [
    { topic: "Currency Reporting", keywords: "CTR,CMIR,FinCEN,currency,reporting", content: `Currency Transaction Reports (CTR) are required for cash transactions over $10,000. CMIR (Report of International Transportation of Currency or Monetary Instruments) applies to transporting over $10,000 across borders. FinCEN enforces BSA/AML regulations. Banks and MSBs must file SARs for suspicious activity.`, priority: 10 },
    { topic: "Monetary Instruments", keywords: "monetary,instruments,negotiable,currency", content: `Monetary instruments include currency, traveler's checks, money orders, cashier's checks, and bearer instruments. 31 CFR defines reportable instruments. Structuring to avoid reporting is illegal.`, priority: 9 },
  ],
  "agent-f2-cfo": getEleanorVossKnowledge(),
  "agent-f6-trustee": [
    { topic: "Trust Administration", keywords: "trust,trustee,administration,fiduciary", content: `Trustees have fiduciary duties of loyalty, prudence, and impartiality. Trust administration includes: recordkeeping, beneficiary communications, asset management, distributions, tax filings. Trust accounting must be accurate and auditable.`, priority: 10 },
    { topic: "Beneficiary Rights", keywords: "beneficiary,rights,distributions,accounting", content: `Beneficiaries have the right to receive distributions per the trust instrument, to receive accountings, and to hold the trustee accountable. Trustee must act in the best interest of beneficiaries.`, priority: 9 },
  ],
  "agent-f4-broker": [
    { topic: "Brokerage Onboarding", keywords: "brokerage,onboarding,KYC,AML,account", content: `Brokerage onboarding requires: identity verification (KYC), source of funds, suitability assessment, and AML compliance. Entity accounts need formation documents, EIN, and authorized signers. Broker-dealers must register with SEC and FINRA.`, priority: 10 },
    { topic: "Entity Account Opening", keywords: "entity,trust,LLC,corporation,account", content: `Entity accounts require: certificate of formation, operating agreement or bylaws, EIN, resolution authorizing account, and identification of beneficial owners. Trust accounts need trust agreement and trustee authority.`, priority: 9 },
  ],
  "agent-f8-clearing": [
    { topic: "Clearing and Settlement", keywords: "clearing,settlement,DTC,NSCC,T+2", content: `Clearing: matching and confirming trades. Settlement: delivery of securities for payment. DTC (Depository Trust Company) holds securities in book-entry form. NSCC (National Securities Clearing Corporation) clears trades. T+2 settlement is standard for equities.`, priority: 10 },
    { topic: "Fails Management", keywords: "fails,buy-in,settlement,fail", content: `A fail occurs when settlement does not complete on time. Buy-in procedures may apply. Fails are tracked and reported. Persistent fails can trigger regulatory attention.`, priority: 9 },
  ],
};

async function main() {
  console.log("🌍 Seeding Green Terrain world...\n");

  const connection = await mysql.createConnection({
    uri: DATABASE_URL,
    ssl: { rejectUnauthorized: true },
  });

  try {
    // 1. Create the world
    console.log("📌 Creating world record...");
    await connection.execute(
      `INSERT INTO troo_worlds (id, name, slug, terrainType, isDefault, isPublished)
       VALUES (?, ?, ?, 'green-hills', FALSE, FALSE)
       ON DUPLICATE KEY UPDATE name = VALUES(name), slug = VALUES(slug), terrainType = VALUES(terrainType), updatedAt = NOW()`,
      [WORLD_ID, WORLD_NAME, WORLD_SLUG]
    );
    console.log(`   ✓ World '${WORLD_NAME}' created/updated with green-hills terrain`);

    // 2. Create the building placement
    console.log("\n🏢 Creating Corporate Tower placement...");
    await connection.execute(
      `INSERT INTO troo_world_placements (worldId, elementKey, glbUrl, posX, posY, posZ, scale, rotY)
       VALUES (?, ?, ?, 0, 0, 0, 1, 0)
       ON DUPLICATE KEY UPDATE glbUrl = VALUES(glbUrl), updatedAt = NOW()`,
      [WORLD_ID, PLACEMENT_ELEMENT_KEY, "procedural:corporate-tower"]
    );
    console.log(`   ✓ Corporate Tower placed at origin`);

    // 3. Create all agents (NPCs)
    console.log("\n👥 Creating AI agents...\n");
    
    for (const agent of AGENTS) {
      const personalityJson = JSON.stringify({
        systemPrompt: agent.systemPrompt,
        department: agent.department,
        expertise: agent.expertise,
      });
      
      await connection.execute(
        `INSERT INTO oasis_npcs (npcId, name, role, title, avatarEmoji, worldId, buildingId, floor, greeting, personalityJson, voiceStyle, mood, isDefault, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'professional', 'neutral', FALSE, TRUE)
         ON DUPLICATE KEY UPDATE 
           name = VALUES(name), 
           title = VALUES(title), 
           avatarEmoji = VALUES(avatarEmoji), 
           worldId = VALUES(worldId),
           buildingId = VALUES(buildingId),
           floor = VALUES(floor),
           greeting = VALUES(greeting), 
           personalityJson = VALUES(personalityJson),
           updatedAt = NOW()`,
        [agent.npcId, agent.name, agent.role, agent.title, agent.avatarEmoji, WORLD_ID, BUILDING_ID, agent.floor, agent.greeting, personalityJson]
      );
      console.log(`   ✓ ${agent.avatarEmoji} ${agent.name} (${agent.title}) — Floor ${agent.floor}`);
    }

    // 4. Add knowledge documents
    console.log("\n📚 Adding knowledge documents...\n");

    // First, get the NPC IDs
    const [npcRows] = await connection.execute(
      `SELECT id, npcId FROM oasis_npcs WHERE worldId = ?`,
      [WORLD_ID]
    );
    const npcIdMap = new Map(npcRows.map(r => [r.npcId, r.id]));

    for (const [npcId, docs] of Object.entries(KNOWLEDGE_DOCS)) {
      const dbNpcId = npcIdMap.get(npcId);
      if (!dbNpcId) {
        console.log(`   ⚠ Skipping knowledge for ${npcId} — NPC not found`);
        continue;
      }

      await connection.execute(`DELETE FROM oasis_npc_knowledge WHERE npcId = ?`, [dbNpcId]);

      for (const doc of docs) {
        await connection.execute(
          `INSERT INTO oasis_npc_knowledge (npcId, topic, keywords, content, priority, category)
           VALUES (?, ?, ?, ?, ?, 'business')`,
          [dbNpcId, doc.topic, doc.keywords, doc.content, doc.priority]
        );
        console.log(`   ✓ ${npcId}: "${doc.topic}"`);
      }
    }

    console.log("\n✅ Green Terrain world seeded successfully!");
    console.log(`\n📊 Summary:`);
    console.log(`   • 1 world created: ${WORLD_NAME}`);
    console.log(`   • 1 building placed: Corporate Tower`);
    console.log(`   • ${AGENTS.length} AI agents created`);
    console.log(`   • ${Object.values(KNOWLEDGE_DOCS).flat().length} knowledge documents added`);
    console.log(`\n🔗 View in modeling editor: /modeling → World Selector → "${WORLD_NAME}"`);

  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
