/**
 * RealityChatBot.tsx
 * Floating chatbot avatar for the landing page
 * NPC: REALITY - General assistant for Hero Market
 * Style: Neon Electric Blue, Glass HUD aesthetic
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Calendar, Clock } from "lucide-react";
import Image from "next/image";
import { generateRealityResponse, getAppointmentOfferResponse } from "@/lib/npc/reality-knowledge";
import { parseAppointmentDate } from "@/lib/parse-appointment-date";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

interface UserContext {
  isRegistered: boolean;
  hasJoinedCommunity: boolean;
  username?: string;
}

const NPC_ID = "reality-assistant";
const NPC_NAME = "REALITY";

// Neon Electric Blue color
const NEON_BLUE = "#00D4FF";
const NEON_BLUE_GLOW = "0 0 20px #00D4FF, 0 0 40px #00D4FF, 0 0 60px #00D4FF";

// Check user registration and community status
function getUserContext(): UserContext {
  if (typeof window === "undefined") {
    return { isRegistered: false, hasJoinedCommunity: false };
  }
  
  try {
    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;
    const hasJoinedCommunity = localStorage.getItem("hasJoinedCommunity") === "true";
    
    return {
      isRegistered: !!user,
      hasJoinedCommunity,
      username: user?.username || user?.name,
    };
  } catch {
    return { isRegistered: false, hasJoinedCommunity: false };
  }
}

function getInitialGreeting(context: UserContext): string {
  if (context.isRegistered && context.username) {
    if (context.hasJoinedCommunity) {
      return `Welcome back, **${context.username}**! Great to see you again. As a community member, you have access to all our exclusive features. How can I help you today?`;
    }
    return `Welcome back, **${context.username}**! Thanks for stopping by. I'm REALITY, your AI guide for Hero Market. I can help you understand our platform, explain features, answer questions, and guide you through next steps. What would you like to know?`;
  }
  if (context.hasJoinedCommunity) {
    return `Welcome back! Great to see you again as a **community member**. How can I help you today?`;
  }
  // New visitor — collect a name first (then business + optional state) before the Hero Factory prompt
  return `Hi! I'm **REALITY**, your AI guide for Hero Market. Do you mind sharing your **name** so I can address you correctly?`;
}

type IntakeStep = "await_name" | "await_email" | "await_business" | "await_state";

type BusinessIntent = "has_business" | "planning" | "neither";

function parseBusinessIntent(text: string): BusinessIntent | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (/^(neither|none|no|n\/a|na|personal|student|just browsing)$/i.test(t)) return "neither";
  if (/\b(neither|no business|not planning|no plans|don'?t have a business|no company)\b/i.test(t)) return "neither";
  if (/\b(plan|planning|going to start|starting|start a business|new business|will open|opening soon|soon)\b/i.test(t))
    return "planning";
  if (/\b(have|has|own|run|running|operate|current business|existing business|already)\b/i.test(t)) return "has_business";
  if (/^current$/i.test(t)) return "has_business";
  if (/^planning$/i.test(t)) return "planning";
  return null;
}

function looksLikeEmail(raw: string): boolean {
  const t = raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(t);
}

async function postRealityLead(payload: {
  sessionId: string;
  displayName?: string;
  email?: string;
  businessStatus?: BusinessIntent;
  businessState?: string | null;
}): Promise<void> {
  await fetch("/api/public/landing-reality-lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// Community join link
const COMMUNITY_JOIN_LINK = "https://www.paypal.com/ncp/payment/F2TG6ELW8M2B4";

// Render message content with links and formatting
function renderMessageContent(content: string): React.ReactNode {
  // Check for JOIN_COMMUNITY_LINK marker and replace with actual link
  if (content.includes("[[JOIN_COMMUNITY_LINK]]")) {
    const parts = content.split("[[JOIN_COMMUNITY_LINK]]");
    const result: React.ReactNode[] = [];
    
    parts.forEach((part, index) => {
      if (index > 0) {
        // Add the link before this part
        result.push(
          <a
            key={`join-link-${index}`}
            href={COMMUNITY_JOIN_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline hover:no-underline"
            style={{
              color: NEON_BLUE,
              textShadow: `0 0 8px ${NEON_BLUE}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            Join Community Here
          </a>
        );
      }
      // Add the text part with bold rendering
      result.push(...renderTextWithBold(part, index * 100));
    });
    
    return result;
  }
  
  // Default: just render with bold text support
  return renderTextWithBold(content, 0);
}

// Render text with **bold** markers
function renderTextWithBold(text: string, startKey: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;
  let key = startKey;
  
  while ((match = boldRegex.exec(text)) !== null) {
    // Add text before bold
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${key++}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    // Add bold text
    parts.push(
      <strong key={`bold-${key++}`} className="font-semibold" style={{ color: NEON_BLUE }}>
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${key++}`}>{text.slice(lastIndex)}</span>);
  }
  
  return parts.length > 0 ? parts : [<span key={`text-${key}`}>{text}</span>];
}

// Appointment booking state
interface AppointmentData {
  name: string;
  email: string;
  phone?: string;
  date?: string;
  time?: string;
  topic?: string;
}

type BookingStep = "idle" | "collecting_name" | "collecting_email" | "collecting_date" | "confirming_date" | "collecting_time" | "collecting_topic" | "confirming";

// Onboarding flow states
type OnboardingStep = "asked_if_know" | "asked_other_questions" | "complete";

export default function RealityChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userContext, setUserContext] = useState<UserContext>({ isRegistered: false, hasJoinedCommunity: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Stable per page load — merges CRM updates for one landing visitor. */
  const leadSessionRef = useRef<string | null>(null);
  function getLeadSessionId(): string {
    if (!leadSessionRef.current) {
      leadSessionRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `rv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return leadSessionRef.current;
  }
  
  // Appointment booking state
  const [bookingStep, setBookingStep] = useState<BookingStep>("idle");
  const [appointmentData, setAppointmentData] = useState<AppointmentData>({ name: "", email: "" });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  
  // Onboarding flow state (for new visitors)
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(null);
  /** Pre-qualification before “Welcome to the Hero Factory! Do you know how to begin?” */
  const [intakeStep, setIntakeStep] = useState<IntakeStep | null>(null);

  // Load user context on mount and when chat opens
  useEffect(() => {
    const context = getUserContext();
    setUserContext(context);
  }, [isOpen]);

  // Listen for community join events
  useEffect(() => {
    const handleStorageChange = () => {
      setUserContext(getUserContext());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const context = getUserContext();
      setUserContext(context);
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: getInitialGreeting(context),
          timestamp: new Date(),
        },
      ]);
      if (!context.isRegistered && !context.hasJoinedCommunity) {
        setIntakeStep("await_name");
        setOnboardingStep(null);
      } else {
        setIntakeStep(null);
      }
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Fetch available time slots for a date
  const fetchAvailableSlots = async (date: string) => {
    try {
      console.log("[RealityChatBot] Fetching slots for date:", date);
      const res = await fetch(`/api/appointments?action=available_slots&date=${date}`);
      const data = await res.json();
      console.log("[RealityChatBot] API response:", data);
      
      if (res.ok && data.availableSlots && data.availableSlots.length > 0) {
        setAvailableSlots(data.availableSlots);
        return data.availableSlots;
      }
      
      // If no slots from DB query, generate default slots based on day
      console.log("[RealityChatBot] No slots from API, generating defaults");
      const targetDate = new Date(date + "T12:00:00");
      const day = targetDate.getDay();
      const isWeekend = day === 0 || day === 6;
      const startHour = isWeekend ? 10 : 9;
      const endHour = isWeekend ? 22 : 21;
      
      const defaultSlots: string[] = [];
      for (let hour = startHour; hour < endHour; hour++) {
        const hourStr = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? "12:00 PM" : `${hour}:00 AM`;
        defaultSlots.push(hourStr);
      }
      
      setAvailableSlots(defaultSlots);
      return defaultSlots;
    } catch (err) {
      console.error("[RealityChatBot] Error fetching slots:", err);
      // Return default business hours on error
      const targetDate = new Date(date + "T12:00:00");
      const day = targetDate.getDay();
      const isWeekend = day === 0 || day === 6;
      const startHour = isWeekend ? 10 : 9;
      const endHour = isWeekend ? 22 : 21;
      
      const defaultSlots: string[] = [];
      for (let hour = startHour; hour < endHour; hour++) {
        const hourStr = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? "12:00 PM" : `${hour}:00 AM`;
        defaultSlots.push(hourStr);
      }
      
      setAvailableSlots(defaultSlots);
      return defaultSlots;
    }
  };

  // Book the appointment
  const bookAppointment = async (data: AppointmentData): Promise<{ success: boolean; message: string; appointmentId?: string }> => {
    try {
      // Parse date and time into a proper timestamp
      const dateStr = data.date || "";
      const timeStr = data.time || "";
      
      // Parse time like "9:00 AM" or "2:00 PM"
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!timeMatch) {
        return { success: false, message: "Invalid time format" };
      }
      
      let hour = parseInt(timeMatch[1]);
      const minute = parseInt(timeMatch[2]);
      const period = timeMatch[3].toUpperCase();
      
      if (period === "PM" && hour !== 12) hour += 12;
      if (period === "AM" && hour === 12) hour = 0;
      
      const appointmentDate = new Date(dateStr);
      appointmentDate.setHours(hour, minute, 0, 0);
      
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorName: data.name,
          visitorEmail: data.email,
          visitorPhone: data.phone,
          appointmentDate: appointmentDate.toISOString(),
          appointmentType: data.topic?.toLowerCase().includes("trust") ? "trust_consultation" 
            : data.topic?.toLowerCase().includes("family") ? "family_office" 
            : "general_consultation",
          topic: data.topic,
        }),
      });
      
      const result = await res.json();
      if (res.ok && result.success) {
        return { success: true, message: result.message, appointmentId: result.appointmentId };
      }
      return { success: false, message: result.error || "Failed to book appointment" };
    } catch {
      return { success: false, message: "Failed to connect to booking system" };
    }
  };

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
      const normalized = text.trim().toLowerCase();

      if (intakeStep) {
        const sid = getLeadSessionId();
        if (intakeStep === "await_name") {
          const name = text.trim();
          if (name.length < 2) {
            reply =
              "Could you share what you'd like me to call you? Even a **first name** is enough so I can address you properly.";
          } else {
            try {
              await postRealityLead({ sessionId: sid, displayName: name });
            } catch {
              /* non-blocking — chat continues even if CRM is offline */
            }
            setIntakeStep("await_email");
            reply = `Nice to meet you, **${name}**! Do you mind sharing your **email address**? I'll only use it so our team can follow up if needed, and it shows up in our CRM for the specialists who help new members.`;
          }
        } else if (intakeStep === "await_email") {
          const em = text.trim();
          if (!looksLikeEmail(em)) {
            reply =
              "That doesn't look like a complete email yet (for example **name@company.com**). Could you double-check and paste it again?";
          } else {
            try {
              await postRealityLead({ sessionId: sid, email: em.trim().toLowerCase() });
            } catch {
              /* non-blocking */
            }
            setIntakeStep("await_business");
            reply = `Thanks! I’ve noted **${em.trim()}**.\n\nDo you have a **current business** today, or are you **planning** to start one in the near future? Reply **current**, **planning**, or **neither**.`;
          }
        } else if (intakeStep === "await_business") {
          const intent = parseBusinessIntent(text);
          if (!intent) {
            reply =
              "I want to route your follow-up correctly: do you **already operate a business**, are you **planning to start one**, or **neither** for now? Reply with **current**, **planning**, or **neither**.";
          } else {
            try {
              await postRealityLead({ sessionId: sid, businessStatus: intent });
            } catch {
              /* non-blocking */
            }
            if (intent === "has_business" || intent === "planning") {
              setIntakeStep("await_state");
              reply =
                "Thanks! Do you mind sharing which **U.S. state** your business is located in—or will be located in? (A state abbreviation like **TX** or the full name is fine.)";
            } else {
              setIntakeStep(null);
              setOnboardingStep("asked_if_know");
              reply = `Welcome to the **Hero Factory**! Do you know how to begin?`;
            }
          }
        } else if (intakeStep === "await_state") {
          const st = text.trim().slice(0, 60);
          if (st.length < 2) {
            reply = "Which **state** should I note for your business (or future business)?";
          } else {
            try {
              await postRealityLead({ sessionId: sid, businessState: st });
            } catch {
              /* non-blocking */
            }
            setIntakeStep(null);
            setOnboardingStep("asked_if_know");
            reply = `Welcome to the **Hero Factory**! Do you know how to begin?`;
          }
        }

        setMessages((prev) =>
          prev.filter((m) => m.id !== "typing").concat({
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: reply,
            timestamp: new Date(),
          }),
        );
        setIsPending(false);
        return;
      }

      // Handle onboarding flow for new visitors
      if (onboardingStep && onboardingStep !== "complete") {
        const isYes = /^(yes|yeah|yep|sure|ok|okay|please|y)$/i.test(normalized) || /^yes/i.test(normalized);
        const isNo = /^(no|nope|nah|n|not really|i don'?t)$/i.test(normalized) || /^no/i.test(normalized);
        
        switch (onboardingStep) {
          case "asked_if_know":
            if (isNo) {
              // User doesn't know how to begin - provide link directly
              setOnboardingStep("complete");
              reply = `To begin, you can [[JOIN_COMMUNITY_LINK]] to get started.\n\nOnce your payment is confirmed, you will receive a link to the community.\n\nIf you need anything else, feel free to ask!`;
            } else if (isYes) {
              // User knows how to begin - transition to helpful assistant mode
              setOnboardingStep("complete");
              reply = "Great! I can help you understand our platform, explain features, and guide you through getting started. I can answer questions and schedule appointments with our Specialists.\n\nWhat would you like to know?";
            } else {
              // Unclear response - provide guidance
              reply = "I'm sorry, I didn't quite catch that. Do you know how to begin? Please answer **Yes** or **No**.";
            }
            break;
            
          case "asked_other_questions":
            if (isNo) {
              // User has no more questions - close conversation
              setOnboardingStep("complete");
              reply = "Thank you for visiting **Hero Factory**! If you have any questions in the future, feel free to chat with me anytime. Have a great day!";
            } else if (isYes) {
              // User has more questions - transition to helpful assistant mode
              setOnboardingStep("complete");
              reply = "I can help you understand our platform, explain features, and guide you through getting started. I can answer questions and schedule appointments with our Specialists.\n\nWhat would you like to know?";
            } else {
              // User asked a question directly - handle it and stay in assistant mode
              setOnboardingStep("complete");
              // Fall through to normal message handling below
              // Don't return here - let the message be processed normally
              break;
            }
            
            if (isNo || isYes) {
              setMessages((prev) =>
                prev.filter((m) => m.id !== "typing").concat({
                  id: `assistant-${Date.now()}`,
                  role: "assistant",
                  content: reply,
                  timestamp: new Date(),
                })
              );
              setIsPending(false);
              return;
            }
            break;
        }
        
        // If we have a reply from onboarding flow, send it
        if (reply! && onboardingStep !== "complete") {
          setMessages((prev) =>
            prev.filter((m) => m.id !== "typing").concat({
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: reply,
              timestamp: new Date(),
            })
          );
          setIsPending(false);
          return;
        }
      }

      // Handle appointment booking flow
      if (bookingStep !== "idle") {
        switch (bookingStep) {
          case "collecting_name":
            const name = text.trim();
            setAppointmentData(prev => ({ ...prev, name }));
            setBookingStep("collecting_email");
            reply = `Great, **${name}**! What email address should I use to send you the appointment confirmation?`;
            break;
            
          case "collecting_email":
            const email = text.trim();
            if (!email.includes("@")) {
              reply = "That doesn't look like a valid email address. Please provide a valid email so we can send you the confirmation.";
            } else {
              setAppointmentData(prev => ({ ...prev, email }));
              setBookingStep("collecting_date");
              reply = "Perfect! When would you like to schedule your appointment?\n\nYou can say things like:\n• **March 16, 2026** or **March 16th 2026**\n• **3/16/2026** or **3-16-2026** or **03 16 2026**\n• **March 16th 12pm** (date and time together)\n• **tomorrow** or **next Tuesday**\n\n**Available Hours:**\n• Monday - Friday: 9:00 AM - 9:00 PM\n• Saturday - Sunday: 10:00 AM - 10:00 PM";
            }
            break;
            
          case "collecting_date":
            // Extract time first if included (e.g., "March 16th 12pm", "March 16 at 2:00 PM")
            const dateInput = text.trim();
            const timePattern = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;
            const timeMatch = dateInput.match(timePattern);
            let extractedTime: string | null = null;
            let dateOnly = dateInput;
            
            if (timeMatch) {
              const hour = timeMatch[1];
              const minutes = timeMatch[2] || "00";
              const period = timeMatch[3].toUpperCase();
              extractedTime = `${hour}:${minutes} ${period}`;
              dateOnly = dateInput.replace(timePattern, "").replace(/\s+at\s*/i, " ").replace(/\s+/g, " ").trim();
            }
            
            const parsed = parseAppointmentDate(dateOnly);
            
            if (parsed) {
              const dateStr = parsed.date.toISOString().split("T")[0];
              setAppointmentData(prev => ({ ...prev, date: dateStr }));
              
              // If user also provided a time, skip confirmation and go straight to topic
              if (extractedTime) {
                let normalizedTime = extractedTime;
                const tMatch = extractedTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                if (tMatch) {
                  normalizedTime = `${tMatch[1]}:${tMatch[2]} ${tMatch[3].toUpperCase()}`;
                }
                setAppointmentData(prev => ({ ...prev, date: dateStr, time: normalizedTime }));
                setBookingStep("collecting_topic");
                reply = `Perfect! I've noted your appointment for **${parsed.formatted}** at **${normalizedTime}**.\n\nWhat topic would you like to discuss? For example:\n• Trust Structuring\n• Family Office Organization\n• Entity Setup\n• General Consultation`;
              } else {
                // Ask for confirmation before showing slots
                setBookingStep("confirming_date");
                reply = `Just to confirm, you'd like to schedule for **${parsed.formatted}**. Is that correct?`;
              }
            } else {
              reply = "I couldn't understand that date. You can try formats like:\n• **March 16, 2026** or **March 16th 2026**\n• **3/16/2026** or **3-16-2026** or **03 16 2026**\n• **tomorrow** or **next Tuesday**";
            }
            break;
            
          case "confirming_date":
            if (/^(yes|yeah|yep|correct|right|that's right|that is correct|confirm)/i.test(normalized)) {
              const dateStr = appointmentData.date!;
              const formattedDate = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
              const slots = await fetchAvailableSlots(dateStr);
              setBookingStep("collecting_time");
              
              if (slots.length > 0) {
                reply = `Great! For **${formattedDate}**, here are the available time slots:\n\n${slots.map((s: string) => `• ${s}`).join("\n")}\n\nWhich time works best for you?`;
              } else {
                reply = `I'm sorry, there are no available slots on ${formattedDate}. Would you like to try a different date?`;
                setBookingStep("collecting_date");
              }
            } else if (/^(no|nope|wrong|incorrect|different|change)/i.test(normalized)) {
              setBookingStep("collecting_date");
              reply = "No problem! What date would you like to schedule for?\n\nYou can say things like:\n• **March 16, 2026** or **March 16th 2026**\n• **3/16/2026** or **3-16-2026**\n• **tomorrow** or **next Tuesday**";
            } else {
              // User might have typed a corrected date (e.g. "March 17" or "3/17/2026")
              const corrected = parseAppointmentDate(text.trim());
              if (corrected) {
                const dateStr = corrected.date.toISOString().split("T")[0];
                setAppointmentData(prev => ({ ...prev, date: dateStr }));
                reply = `Got it! Just to confirm, you'd like to schedule for **${corrected.formatted}**. Is that correct?`;
              } else {
                reply = "Please confirm: is **" + new Date(appointmentData.date! + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) + "** the correct date? (Yes/No)";
              }
            }
            break;
            
          case "collecting_time":
            const time = text.trim();
            // More flexible time parsing - handles: "12pm", "12 pm", "12:00pm", "12:00 PM", "noon", etc.
            let formattedTime: string | null = null;
            
            // Handle "noon" and "midnight"
            if (/^noon$/i.test(time)) {
              formattedTime = "12:00 PM";
            } else if (/^midnight$/i.test(time)) {
              formattedTime = "12:00 AM";
            } else {
              // Try to extract time from input
              const timeExtract = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
              if (timeExtract) {
                let hour = parseInt(timeExtract[1]);
                const minutes = timeExtract[2] || "00";
                let period = (timeExtract[3] || "").replace(/\./g, "").toUpperCase();
                
                // If no AM/PM specified, try to infer from hour
                if (!period) {
                  // Assume PM for business hours if hour is 1-8
                  if (hour >= 1 && hour <= 8) {
                    period = "PM";
                  } else if (hour >= 9 && hour <= 11) {
                    period = "AM";
                  } else if (hour === 12) {
                    period = "PM";
                  } else {
                    // For hours like 13-23, convert to 12-hour format
                    if (hour > 12) {
                      hour = hour - 12;
                      period = "PM";
                    } else {
                      period = "AM";
                    }
                  }
                }
                
                formattedTime = `${hour}:${minutes} ${period}`;
              }
            }
            
            if (formattedTime) {
              setAppointmentData(prev => ({ ...prev, time: formattedTime! }));
              setBookingStep("collecting_topic");
              reply = `Great, **${formattedTime}** it is!\n\nWhat topic would you like to discuss? For example:\n• Trust Structuring\n• Family Office Organization\n• Entity Setup\n• General Consultation`;
            } else {
              reply = `I couldn't understand that time. Please select one of the available times:\n\n${availableSlots.map(s => `• ${s}`).join("\n")}\n\nOr type a time like **12pm**, **2:30 PM**, or **noon**.`;
            }
            break;
            
          case "collecting_topic":
            const topic = text.trim();
            setAppointmentData(prev => ({ ...prev, topic }));
            setBookingStep("confirming");
            
            const dateFormatted = new Date(appointmentData.date!).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
            reply = `Perfect! Let me confirm your appointment:\n\n**Name:** ${appointmentData.name}\n**Email:** ${appointmentData.email}\n**Date:** ${dateFormatted}\n**Time:** ${appointmentData.time}\n**Topic:** ${topic}\n\nShall I book this appointment? (Yes/No)`;
            break;
            
          case "confirming":
            if (/^(yes|yeah|yep|confirm|book|sure|ok|okay)/i.test(normalized)) {
              const finalData = { ...appointmentData, topic: appointmentData.topic || text.trim() };
              const result = await bookAppointment(finalData);
              
              if (result.success) {
                reply = `Excellent! Your appointment has been confirmed!\n\n**Confirmation ID:** ${result.appointmentId}\n\nYou'll receive a confirmation email at **${appointmentData.email}**. Our specialist will be ready to help you with ${appointmentData.topic}.\n\nIs there anything else I can help you with?`;
                setBookingStep("idle");
                setAppointmentData({ name: "", email: "" });
              } else {
                reply = `I'm sorry, there was an issue booking your appointment: ${result.message}\n\nWould you like to try a different time?`;
                setBookingStep("collecting_time");
              }
            } else if (/^(no|cancel|nevermind|stop)/i.test(normalized)) {
              reply = "No problem! I've cancelled the booking. Is there anything else I can help you with?";
              setBookingStep("idle");
              setAppointmentData({ name: "", email: "" });
            } else {
              reply = "Please confirm with **Yes** to book the appointment, or **No** to cancel.";
            }
            break;
        }
        
        setMessages((prev) =>
          prev.filter((m) => m.id !== "typing").concat({
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: reply,
            timestamp: new Date(),
          })
        );
        setIsPending(false);
        return;
      }

      // Check if user wants to schedule an appointment
      if (/(schedule|book|appointment|meet|speak.*specialist|consultation.*time)/i.test(normalized)) {
        setBookingStep("collecting_name");
        reply = getAppointmentOfferResponse() + "\n\nLet's start with your **name**. What should I call you?";
        
        setMessages((prev) =>
          prev.filter((m) => m.id !== "typing").concat({
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: reply,
            timestamp: new Date(),
          })
        );
        setIsPending(false);
        return;
      }

      // First, try the local knowledge base for instant response
      const localResponse = generateRealityResponse(text.trim(), userContext);
      
      // Check if the response indicates we should offer an appointment
      if (localResponse === "APPOINTMENT_OFFER") {
        setBookingStep("collecting_name");
        reply = getAppointmentOfferResponse() + "\n\nLet's start with your **name**. What should I call you?";
        
        setMessages((prev) =>
          prev.filter((m) => m.id !== "typing").concat({
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: reply,
            timestamp: new Date(),
          })
        );
        setIsPending(false);
        return;
      }
      
      try {
        // Also try the API for more dynamic responses
        const res = await fetch("/api/troo-world/npc-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            npcId: NPC_ID,
            message: text.trim(),
            sessionId,
            worldId: "landing-page",
            userContext: {
              isRegistered: userContext.isRegistered,
              hasJoinedCommunity: userContext.hasJoinedCommunity,
              username: userContext.username,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          // Use API response if available, otherwise use local knowledge base
          reply = data.response || data.reply || localResponse;
          if (data.sessionId) setSessionId(data.sessionId);
        } else {
          // Fall back to local knowledge base
          reply = localResponse;
        }
      } catch {
        // Fall back to local knowledge base
        reply = localResponse;
      }

      setMessages((prev) =>
        prev
          .filter((m) => m.id !== "typing")
          .concat({
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: reply,
            timestamp: new Date(),
          })
      );
      setIsPending(false);
    },
    [isPending, sessionId, userContext, bookingStep, appointmentData, availableSlots, onboardingStep, intakeStep]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Custom CSS for neon pulse animation */}
      <style jsx>{`
        @keyframes neonPulse {
          0%, 100% {
            box-shadow: 0 0 5px ${NEON_BLUE}, 0 0 10px ${NEON_BLUE}, 0 0 20px ${NEON_BLUE}, 0 0 40px ${NEON_BLUE};
            border-color: ${NEON_BLUE};
          }
          50% {
            box-shadow: 0 0 10px ${NEON_BLUE}, 0 0 20px ${NEON_BLUE}, 0 0 40px ${NEON_BLUE}, 0 0 80px ${NEON_BLUE};
            border-color: #fff;
          }
        }
        @keyframes hudFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>

      {/* Floating Avatar Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 group"
          aria-label="Open chat with REALITY"
        >
          <div className="relative flex flex-col items-center">
            {/* Name label with neon style - ABOVE the avatar */}
            <div className="mb-2 whitespace-nowrap">
              <span 
                className="text-sm font-bold px-4 py-1.5 rounded-full tracking-wider"
                style={{
                  color: NEON_BLUE,
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  border: `1px solid ${NEON_BLUE}`,
                  boxShadow: `0 0 10px ${NEON_BLUE}40`,
                  textShadow: `0 0 10px ${NEON_BLUE}`,
                }}
              >
                REALITY
              </span>
            </div>
            
            {/* Avatar container */}
            <div className="relative">
              {/* Neon glow effect */}
              <div 
                className="absolute inset-[-8px] rounded-full opacity-70 group-hover:opacity-100 transition-opacity"
                style={{
                  background: `radial-gradient(circle, ${NEON_BLUE}40 0%, transparent 70%)`,
                  filter: "blur(12px)",
                  animation: "neonPulse 2s ease-in-out infinite",
                }}
              />
              
              {/* Avatar image with neon border - doubled size from 64px to 128px */}
              <div 
                className="relative w-32 h-32 rounded-full overflow-hidden group-hover:scale-110 transition-transform cursor-pointer"
                style={{
                  border: `4px solid ${NEON_BLUE}`,
                  boxShadow: NEON_BLUE_GLOW,
                  animation: "neonPulse 2s ease-in-out infinite",
                }}
              >
                <Image
                  src="/reality-avatar.png"
                  alt="REALITY"
                  fill
                  className="object-cover"
                  sizes="128px"
                />
              </div>
              
              {/* Status indicator - scaled up proportionally */}
              <div 
                className="absolute -top-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: "#00FF88",
                  boxShadow: "0 0 10px #00FF88, 0 0 20px #00FF88",
                  border: "2px solid rgba(0,0,0,0.8)",
                }}
              >
                <span className="text-[10px] font-bold text-black">AI</span>
              </div>
            </div>
          </div>
        </button>
      )}

      {/* Chat Window - Glass HUD Style */}
      {isOpen && (
        <div 
          className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] h-[520px] max-h-[calc(100vh-120px)] flex flex-col overflow-hidden rounded-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(0, 20, 40, 0.85) 0%, rgba(0, 10, 30, 0.9) 50%, rgba(0, 20, 40, 0.85) 100%)",
            backdropFilter: "blur(20px)",
            border: `2px solid ${NEON_BLUE}`,
            boxShadow: `0 0 30px ${NEON_BLUE}40, inset 0 0 60px rgba(0, 212, 255, 0.05)`,
          }}
        >
          {/* Scanline overlay effect */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.03] z-10"
            style={{
              background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 212, 255, 0.1) 2px, rgba(0, 212, 255, 0.1) 4px)",
            }}
          />

          {/* Header */}
          <div 
            className="flex items-center justify-between px-4 py-3 border-b relative z-20"
            style={{
              background: "linear-gradient(90deg, rgba(0, 212, 255, 0.1) 0%, rgba(0, 212, 255, 0.05) 50%, rgba(0, 212, 255, 0.1) 100%)",
              borderColor: `${NEON_BLUE}60`,
            }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="relative w-11 h-11 rounded-full overflow-hidden"
                style={{
                  border: `2px solid ${NEON_BLUE}`,
                  boxShadow: `0 0 15px ${NEON_BLUE}60`,
                }}
              >
                <Image
                  src="/reality-avatar.png"
                  alt="REALITY"
                  fill
                  className="object-cover"
                  sizes="44px"
                />
              </div>
              <div style={{ animation: "hudFloat 3s ease-in-out infinite" }}>
                <h3 
                  className="font-bold tracking-wider"
                  style={{ 
                    color: NEON_BLUE, 
                    textShadow: `0 0 10px ${NEON_BLUE}`,
                    letterSpacing: "0.1em",
                  }}
                >
                  {NPC_NAME}
                </h3>
                <p 
                  className="text-xs tracking-wide"
                  style={{ 
                    color: "#00FF88",
                    textShadow: "0 0 8px #00FF88",
                  }}
                >
                  ● ONLINE
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-lg transition-all hover:scale-110"
              style={{
                color: NEON_BLUE,
                border: `1px solid ${NEON_BLUE}40`,
                backgroundColor: "rgba(0, 212, 255, 0.1)",
              }}
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages - HUD floating text style */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-20">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                style={{ animation: "hudFloat 4s ease-in-out infinite" }}
              >
                {msg.isTyping ? (
                  <div 
                    className="rounded-xl px-4 py-3"
                    style={{
                      background: "rgba(0, 212, 255, 0.1)",
                      border: `1px solid ${NEON_BLUE}40`,
                    }}
                  >
                    <div className="flex gap-1.5">
                      <span 
                        className="w-2 h-2 rounded-full animate-bounce" 
                        style={{ backgroundColor: NEON_BLUE, boxShadow: `0 0 8px ${NEON_BLUE}`, animationDelay: "0ms" }} 
                      />
                      <span 
                        className="w-2 h-2 rounded-full animate-bounce" 
                        style={{ backgroundColor: NEON_BLUE, boxShadow: `0 0 8px ${NEON_BLUE}`, animationDelay: "150ms" }} 
                      />
                      <span 
                        className="w-2 h-2 rounded-full animate-bounce" 
                        style={{ backgroundColor: NEON_BLUE, boxShadow: `0 0 8px ${NEON_BLUE}`, animationDelay: "300ms" }} 
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className="max-w-[85%] rounded-xl px-4 py-3"
                    style={{
                      background: msg.role === "user" 
                        ? "linear-gradient(135deg, rgba(0, 212, 255, 0.3) 0%, rgba(0, 150, 200, 0.2) 100%)"
                        : "rgba(0, 40, 60, 0.6)",
                      border: `1px solid ${msg.role === "user" ? NEON_BLUE : `${NEON_BLUE}40`}`,
                      boxShadow: msg.role === "user" ? `0 0 15px ${NEON_BLUE}30` : "none",
                    }}
                  >
                    <div 
                      className="text-sm whitespace-pre-wrap font-light tracking-wide"
                      style={{
                        color: msg.role === "user" ? "#fff" : "rgba(200, 240, 255, 0.95)",
                        textShadow: msg.role === "user" ? `0 0 8px ${NEON_BLUE}` : "none",
                      }}
                    >
                      {msg.role === "assistant" ? renderMessageContent(msg.content) : msg.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input - HUD style */}
          <form 
            onSubmit={handleSubmit} 
            className="p-3 relative z-20"
            style={{
              borderTop: `1px solid ${NEON_BLUE}40`,
              background: "rgba(0, 20, 40, 0.5)",
            }}
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter message..."
                disabled={isPending}
                className="flex-1 px-4 py-3 rounded-xl text-white placeholder:text-cyan-700 focus:outline-none disabled:opacity-50 tracking-wide"
                style={{
                  background: "rgba(0, 40, 60, 0.5)",
                  border: `1px solid ${NEON_BLUE}50`,
                  boxShadow: `inset 0 0 20px rgba(0, 212, 255, 0.05)`,
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isPending}
                className="px-5 py-3 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${NEON_BLUE} 0%, #0088AA 100%)`,
                  boxShadow: `0 0 20px ${NEON_BLUE}60`,
                  border: "none",
                }}
                aria-label="Send message"
              >
                <Send className="w-5 h-5 text-black" />
              </button>
            </div>
          </form>

          {/* Corner decorations - HUD style */}
          <div 
            className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 rounded-tl-2xl pointer-events-none"
            style={{ borderColor: NEON_BLUE }}
          />
          <div 
            className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 rounded-tr-2xl pointer-events-none"
            style={{ borderColor: NEON_BLUE }}
          />
          <div 
            className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 rounded-bl-2xl pointer-events-none"
            style={{ borderColor: NEON_BLUE }}
          />
          <div 
            className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 rounded-br-2xl pointer-events-none"
            style={{ borderColor: NEON_BLUE }}
          />
        </div>
      )}
    </>
  );
}
