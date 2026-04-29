/**
 * AgentChatPanel.tsx
 * AI agent chatbot panel with:
 * - Database-backed agent responses via /api/troo-world/npc-chat
 * - Fallback to local responses if API unavailable
 * - Text / Voice toggle (Web Speech API)
 * - Conversation history
 * - Draggable panel
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface AgentData {
  id: string;
  name: string;
  role: string;
  floor: number;
  floorLabel?: string;
  expertise: string;
  avatar?: string;
  avatarEmoji?: string;
  department: string;
  greeting: string;
  title?: string;
  worldId?: string;
  buildingId?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

interface AgentChatPanelProps {
  agent: AgentData;
  worldId?: string;
  onClose: () => void;
  onElevatorAccessGranted?: () => void;
}

// ── Voice helpers ──────────────────────────────────────────────────────────────
const hasSpeechRecognition =
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

const hasSpeechSynthesis =
  typeof window !== "undefined" && "speechSynthesis" in window;

function speakText(text: string) {
  if (!hasSpeechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      (v.name.includes("Natural") ||
        v.name.includes("Neural") ||
        v.name.includes("Google") ||
        v.name.includes("Samantha"))
  );
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

// ── Department accent colors ───────────────────────────────────────────────────
const DEPT_COLORS: Record<string, string> = {
  Administration: "#2a6fbd",
  Security: "#8b4513",
  Legal: "#5a2d82",
  Finance: "#1a6b3a",
  "Human Resources": "#c0392b",
  Technology: "#0d5c8a",
};

// ── Suggested starter questions ────────────────────────────────────────────────
function getSuggestedQuestions(agent: AgentData): string[] {
  const map: Record<string, string[]> = {
    Administration: ["Where is the elevator?", "How do I book a meeting room?", "What floors are in this building?"],
    Security: ["What are the access control policies?", "What should I do in an emergency?", "How do I report an incident?"],
    Legal: ["What makes a contract valid?", "How do I protect our IP?", "What compliance laws apply to us?"],
    Finance: ["What is our capital allocation strategy?", "How do you calculate ROI?", "What financial metrics matter most?"],
    "Human Resources": ["How does the hiring process work?", "What are our DEI initiatives?", "How does performance management work?"],
    Technology: ["What is our cloud architecture?", "How do AI agents work?", "What cybersecurity practices do you recommend?"],
  };
  return (map[agent.department] ?? ["How can you help me?", "What is your expertise?"]).slice(0, 3);
}

// ── Local response generator ───────────────────────────────────────────────────
function generateAgentResponse(agent: AgentData, userMessage: string): string {
  const lowerMsg = userMessage.toLowerCase();
  const roleTitle = agent.title || agent.role;
  const floorName = agent.floorLabel || (agent.floor === 0 ? "Lobby" : `Floor ${agent.floor}`);
  
  // Generic helpful responses based on keywords
  if (lowerMsg.includes("hello") || lowerMsg.includes("hi") || lowerMsg.includes("hey")) {
    return `Hello! Great to meet you. I'm ${agent.name}, and I specialize in ${agent.expertise}. How can I help you today?`;
  }
  
  if (lowerMsg.includes("help") || lowerMsg.includes("assist")) {
    return `Of course! As the ${roleTitle} here at ${floorName}, I can assist you with matters related to ${agent.expertise}. What specific area would you like to discuss?`;
  }
  
  if (lowerMsg.includes("elevator") || lowerMsg.includes("floor")) {
    return `The elevator is located in the central shaft of each building. You can access any floor from there. Currently, we have 5 floors in Nexus Tower and 9 floors in Meridian Tower. Is there a specific floor you'd like to visit?`;
  }
  
  if (lowerMsg.includes("thank")) {
    return `You're welcome! It's my pleasure to assist. Feel free to reach out anytime you need help with ${agent.department.toLowerCase()} matters.`;
  }
  
  if (lowerMsg.includes("who are you") || lowerMsg.includes("introduce")) {
    return `I'm ${agent.name}, the ${roleTitle} here at ${floorName}. My expertise includes ${agent.expertise}. I'm part of the ${agent.department} department and I'm here to help with any questions you might have.`;
  }
  
  if (lowerMsg.includes("expertise") || lowerMsg.includes("specialize")) {
    return `My areas of expertise include: ${agent.expertise}. I've been working in ${agent.department} for several years and I'm always happy to share my knowledge.`;
  }
  
  // Department-specific responses
  if (agent.department === "Security") {
    if (lowerMsg.includes("emergency") || lowerMsg.includes("incident")) {
      return "In case of an emergency, please remain calm and follow the evacuation signs. Report any incidents immediately to the security desk in the lobby. We have protocols in place for various scenarios including fire, medical emergencies, and security threats.";
    }
    if (lowerMsg.includes("access") || lowerMsg.includes("badge")) {
      return "Access control is managed through our badge system. All visitors must check in at the lobby and receive a temporary badge. Employees have permanent badges with floor-specific access. Contact security if you need access modifications.";
    }
  }
  
  if (agent.department === "Legal") {
    if (lowerMsg.includes("contract") || lowerMsg.includes("agreement")) {
      return "For any contract or agreement matters, we follow a thorough review process. All contracts must be reviewed by our legal team before signing. We ensure compliance with applicable laws and protect the company's interests.";
    }
    if (lowerMsg.includes("compliance") || lowerMsg.includes("regulation")) {
      return "We maintain strict compliance with all applicable regulations including data protection laws, industry standards, and corporate governance requirements. Regular audits ensure we stay up to date.";
    }
  }
  
  if (agent.department === "Finance") {
    if (lowerMsg.includes("budget") || lowerMsg.includes("expense")) {
      return "Budget planning and expense management are handled quarterly. Each department submits their projections, and we consolidate them into the company-wide financial plan. For expense reports, please use our digital submission system.";
    }
    if (lowerMsg.includes("investment") || lowerMsg.includes("roi")) {
      return "Investment decisions are made based on careful ROI analysis, risk assessment, and alignment with our strategic goals. We use multiple financial metrics to evaluate opportunities and ensure sustainable growth.";
    }
  }
  
  if (agent.department === "Human Resources") {
    if (lowerMsg.includes("hiring") || lowerMsg.includes("recruit")) {
      return "Our hiring process includes resume screening, initial interviews, skills assessments, and final interviews with department heads. We focus on finding candidates who align with our values and culture.";
    }
    if (lowerMsg.includes("benefit") || lowerMsg.includes("leave") || lowerMsg.includes("vacation")) {
      return "We offer comprehensive benefits including health insurance, retirement plans, paid time off, and professional development opportunities. For specific questions about your benefits, please schedule a meeting with HR.";
    }
  }
  
  if (agent.department === "Technology") {
    if (lowerMsg.includes("system") || lowerMsg.includes("software")) {
      return "Our technology infrastructure includes cloud-based systems, enterprise software solutions, and custom-built applications. We prioritize security, scalability, and user experience in all our technology decisions.";
    }
    if (lowerMsg.includes("ai") || lowerMsg.includes("agent")) {
      return "AI agents like myself are designed to assist with various tasks and provide information. We're built using advanced language models and are continuously learning to better serve your needs.";
    }
  }
  
  // Default contextual response
  const responses = [
    `That's an interesting question about ${agent.department.toLowerCase()}. Based on my expertise in ${agent.expertise.split(",")[0]}, I'd be happy to discuss this further. Could you provide more specific details?`,
    `As the ${roleTitle}, I deal with questions like this regularly. Let me share some insights from my experience in ${agent.department}.`,
    `Great question! In my role here at ${floorName}, I often help with similar inquiries. The key aspects to consider are related to ${agent.expertise.split(",")[0]}.`,
    `I appreciate you asking. While this touches on my area of ${agent.expertise.split(",")[0]}, I'd recommend we explore the specific aspects that matter most to your situation.`,
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

// ── Simple markdown renderer (supports **bold**, *italic*, [link](url)) ─────────
function SimpleMarkdown({ children }: { children: string }) {
  const html = children
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#5a9fd4;text-decoration:underline">$1</a>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
  
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Evaana Gatekeeper Logic (step-based flow with progress persistence) ────────
const EVAANA_STORAGE_KEY = "evaana_verified_user";
const BARCODES_LINK = "https://www.barcodestalk.com/gepir/79584745265/baf261c78f256d3d";
const STAMPS_LINK = "https://mystampready.com";
const QR_GEN_LINK = "/qr-maker";

type EvaanaStep =
  | "name"
  | "q1_ceo"
  | "q2_first_step"
  | "q3_certificate"
  | "q4_cert_number"
  | "q5_barcodes"
  | "q6_seals"
  | "q7_wallet"
  | "q7_wallet_return"
  | "q8_cloud_folder"
  | "q9_qr_code"
  | "verified";

interface EvaanaUserData {
  name: string;
  step: EvaanaStep;
  certificateNumber?: string;
  waitingForWallet?: boolean;
  verifiedAt?: string;
  accessGranted?: boolean;
}

function getEvaanaStoredUser(): EvaanaUserData | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(EVAANA_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as EvaanaUserData;
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

function storeEvaanaUser(data: Partial<EvaanaUserData> & { name: string }): void {
  if (typeof window === "undefined") return;
  const existing = getEvaanaStoredUser();
  const merged: EvaanaUserData = {
    name: data.name,
    step: data.step ?? existing?.step ?? "name",
    certificateNumber: data.certificateNumber ?? existing?.certificateNumber,
    waitingForWallet: data.waitingForWallet ?? existing?.waitingForWallet,
    verifiedAt: data.verifiedAt ?? existing?.verifiedAt,
    accessGranted: data.accessGranted ?? existing?.accessGranted,
  };
  localStorage.setItem(EVAANA_STORAGE_KEY, JSON.stringify(merged));
}

function storeEvaanaStep(step: EvaanaStep, extras?: Partial<EvaanaUserData>): void {
  if (typeof window === "undefined") return;
  const existing = getEvaanaStoredUser();
  if (!existing) return;
  const merged: EvaanaUserData = { ...existing, step, ...extras };
  localStorage.setItem(EVAANA_STORAGE_KEY, JSON.stringify(merged));
}

const EVAANA_ELEANOR_VICTORIA_BLOCK = `One of our key updates: you can now go see **Eleanor**, the CFO, in the Corporate Tower next door — Floor 2. She handles currency reporting, trust securities, and brokerage procedures. But be aware of **Victoria Hale**, Head Receptionist in Administration, Lobby — she's a stickler for rules and won't let you pass unless you've taken care of the prerequisites. If you need directions, just let me know.`;

function getEvaanaReturningUserGreeting(userName: string): string {
  return `Hello, **${userName}**! Welcome back to TROOTHHERTZ LLC. Have you heard about our new updates?\n\n${EVAANA_ELEANOR_VICTORIA_BLOCK}\n\nYour elevator access is still active — feel free to proceed to Floor 1 to meet with Charles whenever you're ready.`;
}

function isUserAskingForDirections(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    /^(yes|yeah|yep|sure|please|ok|okay)(\s+(please|i would|i'd like))?\.?$/i.test(t) ||
    /\b(directions?|how do i get there|how to get there|where is it|lead the way)\b/i.test(t) ||
    /^(i need|give me|can you give me)\s+(the )?directions?\.?$/i.test(t)
  );
}

const EVAANA_DIRECTIONS_REPLY = "Just exit the building and make a right — **Nexus Corporate Tower**. Have a great day!";

function isYes(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(yes|yeah|yep|yup|correct|affirmative|absolutely|indeed|sure|ok|okay)$/i.test(t) || t === "y";
}

function isNo(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(no|nope|nah|negative|not yet|not really)$/i.test(t) || t === "n";
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AgentChatPanel({ agent, worldId = "green-terrain", onClose, onElevatorAccessGranted }: AgentChatPanelProps) {
  const accentColor = DEPT_COLORS[agent.department] ?? "#2a6fbd";
  const isEvaana = agent.id === "troothhertz-evaana";
  
  // Check for returning user (verified = access granted)
  const storedUser = isEvaana ? getEvaanaStoredUser() : null;
  const isReturningUser = storedUser?.accessGranted === true;
  
  // Evaana step-based state (synced with localStorage for persistence)
  const [evaanaStep, setEvaanaStep] = useState<EvaanaStep>(() => {
    if (storedUser?.waitingForWallet) return "q7_wallet_return";
    return (storedUser?.step as EvaanaStep) || "name";
  });
  const [evaanaUserName, setEvaanaUserName] = useState<string>(storedUser?.name || "");
  const [evaanaAccessGranted, setEvaanaAccessGranted] = useState(isReturningUser);
  const [evaanaCertificateNumber, setEvaanaCertificateNumber] = useState<string>(storedUser?.certificateNumber || "");

  // Grant elevator access immediately for returning verified users
  useEffect(() => {
    if (isEvaana && isReturningUser && onElevatorAccessGranted) {
      onElevatorAccessGranted();
    }
  }, [isEvaana, isReturningUser, onElevatorAccessGranted]);

  const getInitialGreeting = useCallback(() => {
    if (isEvaana) {
      // Returning verified user
      if (isReturningUser && storedUser?.name) {
        return getEvaanaReturningUserGreeting(storedUser.name);
      }
      // Returning user mid-flow (has name, waiting for wallet)
      if (storedUser?.name && storedUser?.waitingForWallet) {
        return `Welcome back, **${storedUser.name}**! You have your wallet, I presume? We can continue. Yes or No?`;
      }
      // Returning user mid-flow (has name, resume at step)
      if (storedUser?.name && storedUser?.step && storedUser.step !== "name" && storedUser.step !== "verified") {
        const stepGreetings: Record<string, string> = {
          q1_ceo: `Welcome back, **${storedUser.name}**! Let's continue. **What is the Name of the CEO?**`,
          q2_first_step: `Welcome back, **${storedUser.name}**! **Do you know what the first step is?**`,
          q3_certificate: `Welcome back, **${storedUser.name}**! **Have you received your Certificate under the PMA or Online Ordination?** Yes or No?`,
          q4_cert_number: `Welcome back, **${storedUser.name}**! **Can you provide your Certificate Number?**`,
          q5_barcodes: `Welcome back, **${storedUser.name}**! **Have you obtained Barcodes for Administration purposes?** Yes or No?`,
          q6_seals: `Welcome back, **${storedUser.name}**! **Have you created seals for the Entity you represent?** Yes or No?`,
          q7_wallet: `Welcome back, **${storedUser.name}**! **Have you as the Grantor set up a MetaMask Wallet?** Yes or No?`,
          q7_wallet_return: `Welcome back, **${storedUser.name}**! You have your wallet, I presume we can continue? Yes or No?`,
          q8_cloud_folder: `Welcome back, **${storedUser.name}**! **Have you Created your Cloud Folder with Proton or Gmail?** Yes or No?`,
          q9_qr_code: `Welcome back, **${storedUser.name}**! **Have you created a QR Code for this Folder?** Yes or No?`,
        };
        return stepGreetings[storedUser.step] || `Welcome back, **${storedUser.name}**! Let's continue where we left off.`;
      }
      // New user - ask for name first
      return `Welcome to TROOTHHERTZ LLC. I'm **Evaana**, Head Receptionist.\n\nBefore I can grant you access to the executive floor, I'll need to ask you a few questions. First, **may I have your name?**`;
    }
    return agent.greeting || `Hello! I'm **${agent.name}**, ${agent.role || agent.title} on ${agent.floor === 0 ? "the Lobby" : `Floor ${agent.floor}`}. My expertise covers **${agent.expertise}**.\n\nHow can I assist you today? Feel free to ask me anything related to ${agent.department}.`;
  }, [isEvaana, isReturningUser, storedUser?.name, storedUser?.step, storedUser?.waitingForWallet, agent]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Initialize messages
  useEffect(() => {
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: getInitialGreeting(),
      timestamp: new Date(),
    }]);
  }, [getInitialGreeting]);

  // Draggable
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isPending) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };
      const typingMsg: Message = {
        id: "typing",
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isTyping: true,
      };

      setMessages((prev) => [...prev, userMsg, typingMsg]);
      setInput("");
      setIsPending(true);

      let reply: string;

      // Special handling for Evaana's step-based gatekeeper flow
      if (isEvaana && evaanaStep !== "verified") {
        const step = evaanaStep;
        const t = text.trim().toLowerCase();

        // ── Step: name ──
        if (step === "name") {
          const cleanedName = text.trim()
            .replace(/^(my name is|i'm|i am|it's|call me|they call me)\s*/i, "")
            .replace(/[.,!?]$/, "")
            .trim();
          const formattedName = cleanedName
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ") || "there";
          setEvaanaUserName(formattedName);
          storeEvaanaUser({ name: formattedName, step: "q1_ceo" });
          storeEvaanaStep("q1_ceo");
          setEvaanaStep("q1_ceo");
          reply = `Hello, **${formattedName}**! Nice to meet you. **What is the Name of the CEO?**`;
        }
        // ── Step: q1_ceo (CEO name = Charles) ──
        else if (step === "q1_ceo") {
          if (t.includes("charles")) {
            storeEvaanaStep("q2_first_step");
            setEvaanaStep("q2_first_step");
            reply = `Correct! **Do you know what the first step is?**`;
          } else {
            reply = `I'm sorry, that's not correct. Please try again. **What is the Name of the CEO?**`;
          }
        }
        // ── Step: q2_first_step (Separation - accept "separation" or "seperation") ──
        else if (step === "q2_first_step") {
          if (t.includes("separation") || t.includes("seperation")) {
            storeEvaanaStep("q3_certificate");
            setEvaanaStep("q3_certificate");
            reply = `Correct! **Have you received your Certificate under the PMA or Online Ordination?** Yes or No?`;
          } else {
            reply = `I'm sorry, that's not correct. Please try again. **Do you know what the first step is?**`;
          }
        }
        // ── Step: q3_certificate (Yes/No) ──
        else if (step === "q3_certificate") {
          if (isYes(text)) {
            storeEvaanaStep("q4_cert_number");
            setEvaanaStep("q4_cert_number");
            reply = `**Can you provide your Certificate Number?**`;
          } else if (isNo(text)) {
            reply = `I understand. Please return when you have received your Certificate under the PMA or Online Ordination. We can continue then.`;
          } else {
            reply = `Please answer Yes or No. **Have you received your Certificate under the PMA or Online Ordination?**`;
          }
        }
        // ── Step: q4_cert_number (free text) ──
        else if (step === "q4_cert_number") {
          const certNum = text.trim();
          setEvaanaCertificateNumber(certNum);
          storeEvaanaStep("q5_barcodes", { certificateNumber: certNum });
          setEvaanaStep("q5_barcodes");
          reply = `Thank you. **Have you obtained Barcodes for Administration purposes?** Yes or No?`;
        }
        // ── Step: q5_barcodes (Yes/No) ──
        else if (step === "q5_barcodes") {
          if (isYes(text)) {
            storeEvaanaStep("q6_seals");
            setEvaanaStep("q6_seals");
            reply = `**Have you created seals for the Entity you represent?** Yes or No?`;
          } else if (isNo(text)) {
            reply = `You'll need barcodes for administration purposes. [Obtain 5 barcodes here](${BARCODES_LINK}). Please return when you have obtained them.`;
          } else {
            reply = `Please answer Yes or No. **Have you obtained Barcodes for Administration purposes?**`;
          }
        }
        // ── Step: q6_seals (Yes/No) ──
        else if (step === "q6_seals") {
          if (isYes(text)) {
            storeEvaanaStep("q7_wallet");
            setEvaanaStep("q7_wallet");
            reply = `**Have you as the Grantor set up a MetaMask Wallet?** Yes or No?`;
          } else if (isNo(text)) {
            reply = `You'll need seals for the entity you represent. [Create Stamps Here](${STAMPS_LINK}). Please return when you have created them.`;
          } else {
            reply = `Please answer Yes or No. **Have you created seals for the Entity you represent?**`;
          }
        }
        // ── Step: q7_wallet (Yes/No) ──
        else if (step === "q7_wallet") {
          if (isYes(text)) {
            storeEvaanaStep("q8_cloud_folder", { waitingForWallet: false });
            setEvaanaStep("q8_cloud_folder");
            reply = `**Have you Created your Cloud Folder with Proton or Gmail?** Yes or No?`;
          } else if (isNo(text)) {
            storeEvaanaStep("q7_wallet", { waitingForWallet: true });
            reply = `You should know that this platform utilizes Blockchain technology because of its Ledger. You will have the ability to create and assign your creations to a receptacle wallet on Networks you build on, like Polygon, Solana, Ethereum, Base, and more. Please return when you have your wallet.`;
          } else {
            reply = `Please answer Yes or No. **Have you as the Grantor set up a MetaMask Wallet?**`;
          }
        }
        // ── Step: q7_wallet_return (returning after wallet) ──
        else if (step === "q7_wallet_return") {
          if (isYes(text)) {
            storeEvaanaStep("q8_cloud_folder", { waitingForWallet: false });
            setEvaanaStep("q8_cloud_folder");
            reply = `**Have you Created your Cloud Folder with Proton or Gmail?** Yes or No?`;
          } else if (isNo(text)) {
            reply = `No problem. Please return when you have your wallet set up. We can continue then.`;
          } else {
            reply = `Please answer Yes or No. **You have your wallet, I presume we can continue?**`;
          }
        }
        // ── Step: q8_cloud_folder (Yes/No) ──
        else if (step === "q8_cloud_folder") {
          if (isYes(text)) {
            storeEvaanaStep("q9_qr_code");
            setEvaanaStep("q9_qr_code");
            reply = `**Have you created a QR Code for this Folder?** Yes or No?`;
          } else if (isNo(text)) {
            reply = `Please create your Cloud Folder with Proton or Gmail, then return. We can continue.`;
          } else {
            reply = `Please answer Yes or No. **Have you Created your Cloud Folder with Proton or Gmail?**`;
          }
        }
        // ── Step: q9_qr_code (Yes/No) ──
        else if (step === "q9_qr_code") {
          if (isYes(text)) {
            const name = evaanaUserName || storedUser?.name || "there";
            storeEvaanaUser({
              name: evaanaUserName || storedUser?.name || "",
              step: "verified",
              accessGranted: true,
              verifiedAt: new Date().toISOString(),
            });
            setEvaanaStep("verified");
            setEvaanaAccessGranted(true);
            onElevatorAccessGranted?.();
            reply = `You have now gained access to proceed to the Executive Floor. I will notify Charles of your arrival.`;
          } else if (isNo(text)) {
            const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
            reply = `You know we have a built-in QR code generator here on the site. [Generate QR code](${baseUrl}${QR_GEN_LINK}) — just copy your Folder address to the URL section and download the QR Code for your records. Please return when you have your QR code.`;
          } else {
            reply = `Please answer Yes or No. **Have you created a QR Code for this Folder?**`;
          }
        } else {
          reply = `Let's continue. How can I help you?`;
        }
      } else if (isEvaana && evaanaStep === "verified") {
        const name = evaanaUserName || storedUser?.name || "there";
        if (isUserAskingForDirections(text)) {
          reply = EVAANA_DIRECTIONS_REPLY;
        } else {
          reply = `Hello, **${name}**! Have you heard about our new updates? We're always working on exciting improvements at TROOTHHERTZ LLC.\n\n${EVAANA_ELEANOR_VICTORIA_BLOCK}\n\nYour elevator access is still active — feel free to proceed to Floor 1 to meet with Charles whenever you're ready. Is there anything else I can help you with?`;
        }
      } else {
        // Normal NPC chat flow
        try {
          // Try database API first
          const res = await fetch("/api/troo-world/npc-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              npcId: agent.id,
              message: text.trim(),
              sessionId,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            reply = data.response;
            if (data.sessionId) {
              setSessionId(data.sessionId);
            }
          } else {
            // Fallback to local response
            reply = generateAgentResponse(agent, text.trim());
          }
        } catch {
          // Fallback to local response on network error
          reply = generateAgentResponse(agent, text.trim());
        }
      }

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev.filter((m) => m.id !== "typing"), assistantMsg]);
      setIsPending(false);

      if (voiceMode && hasSpeechSynthesis) {
        const plainText = reply
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/#{1,6}\s/g, "")
          .replace(/\n/g, " ");
        speakText(plainText);
      }
    },
    [agent, isPending, voiceMode, sessionId, isEvaana, evaanaStep, evaanaUserName, storedUser, onElevatorAccessGranted]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const startListening = useCallback(() => {
    if (!hasSpeechRecognition) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      sendMessage(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [sendMessage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // Drag
  const onDragStart = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({ x: dragStart.current.px + e.clientX - dragStart.current.mx, y: dragStart.current.py + e.clientY - dragStart.current.my });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  return (
    <div
      style={{
        position: "fixed",
        right: Math.max(8, 20 - pos.x),
        bottom: Math.max(8, 20 - pos.y),
        width: 420,
        maxHeight: "76vh",
        display: "flex",
        flexDirection: "column",
        background: "rgba(8, 14, 26, 0.97)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${accentColor}55`,
        borderRadius: 16,
        boxShadow: `0 8px 48px rgba(0,0,0,0.75), 0 0 0 1px ${accentColor}22`,
        fontFamily: "system-ui, -apple-system, sans-serif",
        zIndex: 200,
        overflow: "hidden",
        userSelect: dragging ? "none" : "auto",
      }}
    >
      {/* ── Header ── */}
      <div
        onMouseDown={onDragStart}
        style={{
          background: `linear-gradient(135deg, ${accentColor}ee 0%, ${accentColor}66 100%)`,
          padding: "13px 14px",
          cursor: "grab",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, border: "2px solid rgba(255,255,255,0.35)" }}>
          {agent.department === "Security" ? "🛡️" : agent.department === "Legal" ? "⚖️" : agent.department === "Finance" ? "💼" : agent.department === "Human Resources" ? "👥" : agent.department === "Technology" ? "💻" : "🏢"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agent.name}</div>
          <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 11 }}>{agent.role} · {agent.floor === 0 ? "Lobby" : `Floor ${agent.floor}`}</div>
        </div>
        <button
          onClick={() => { setVoiceMode((v) => !v); if (isListening) stopListening(); if (hasSpeechSynthesis) window.speechSynthesis.cancel(); }}
          style={{ background: voiceMode ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, color: "#fff", padding: "5px 10px", cursor: "pointer", fontSize: 12, flexShrink: 0 }}
        >
          {voiceMode ? "🎙️ Voice" : "💬 Text"}
        </button>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#fff", width: 28, height: 28, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
      </div>

      {/* ── Knowledge badge ── */}
      <div style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "5px 14px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: `${accentColor}bb` }}>🧠</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Agent: {agent.expertise.split(",")[0]}</span>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 6px", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: 7, alignItems: "flex-start" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: msg.role === "user" ? "rgba(255,255,255,0.13)" : `${accentColor}77`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, marginTop: 2 }}>
              {msg.role === "user" ? "👤" : "🤖"}
            </div>
            <div style={{
              maxWidth: "78%",
              background: msg.role === "user" ? `${accentColor}99` : "rgba(255,255,255,0.06)",
              border: `1px solid ${msg.role === "user" ? `${accentColor}55` : "rgba(255,255,255,0.09)"}`,
              borderRadius: msg.role === "user" ? "13px 4px 13px 13px" : "4px 13px 13px 13px",
              padding: "9px 11px",
            }}>
              {msg.isTyping ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "3px 0" }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: `${accentColor}cc`, animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                  <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
                </div>
              ) : (
                <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 13, lineHeight: 1.55 }}>
                  <SimpleMarkdown>{msg.content}</SimpleMarkdown>
                </div>
              )}
              {!msg.isTyping && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", marginTop: 3, textAlign: msg.role === "user" ? "right" : "left" }}>
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <div style={{ padding: "9px 11px 11px", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, background: "rgba(0,0,0,0.25)" }}>
        {voiceMode ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "4px 0" }}>
            <button
              onMouseDown={startListening}
              onMouseUp={stopListening}
              onTouchStart={startListening}
              onTouchEnd={stopListening}
              disabled={!hasSpeechRecognition}
              style={{ width: 60, height: 60, borderRadius: "50%", background: isListening ? "#e74c3c" : `${accentColor}cc`, border: isListening ? "3px solid #ff6b6b" : `3px solid ${accentColor}`, color: "#fff", fontSize: 22, cursor: hasSpeechRecognition ? "pointer" : "not-allowed", boxShadow: isListening ? "0 0 20px rgba(231,76,60,0.6)" : `0 0 12px ${accentColor}44`, transition: "all 0.2s" }}
            >
              {isListening ? "⏹" : "🎤"}
            </button>
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
              {isListening ? "Listening... release to send" : hasSpeechRecognition ? "Hold to speak" : "Speech not supported in this browser"}
            </span>
            {input && <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, fontStyle: "italic", textAlign: "center" }}>"{input}"</div>}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${agent.name.split(" ")[0]} about ${agent.department.toLowerCase()}...`}
              rows={2}
              disabled={isPending}
              style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 10, color: "#fff", padding: "8px 11px", fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.4 }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isPending}
              style={{ background: input.trim() && !isPending ? `${accentColor}cc` : "rgba(255,255,255,0.07)", border: "none", borderRadius: 10, color: "#fff", width: 38, height: 38, cursor: input.trim() && !isPending ? "pointer" : "not-allowed", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s", flexShrink: 0 }}
            >
              {isPending ? "⏳" : "➤"}
            </button>
          </form>
        )}

        {/* Suggested questions — only shown on first message */}
        {messages.length <= 1 && (
          <div style={{ marginTop: 7, display: "flex", flexWrap: "wrap", gap: 5 }}>
            {getSuggestedQuestions(agent).map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={isPending}
                style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${accentColor}44`, borderRadius: 20, color: "rgba(255,255,255,0.55)", padding: "4px 10px", fontSize: 11, cursor: "pointer" }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
