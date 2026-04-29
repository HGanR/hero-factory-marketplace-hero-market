"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatJarvaQuestionCategory,
  jarvaFieldKeyToLabel,
  jarvaQuestionCategoryBadgeClass,
} from "@/lib/jarva/jarva-field-labels";
import {
  buildJarvaSpecialtyActions,
  isJarvaSpecialtyEntryIntent,
  JARVA_TRUST_TYPE_CHOICE_BUTTONS,
  formatJarvaWorkflowLaneLabel,
  jarvaTrustStyleHintChipClass,
  jarvaTrustStyleHintLabel,
  jarvaWorkflowPathSourceLabel,
  parseJarvaEntryIntent,
  parseJarvaTrustStyleHint,
  shouldShowJarvaTrustTypeButtons,
  type JarvaTrustStyleHintUi,
} from "@/lib/jarva/jarva-chat-ui-actions";
import type { JarvaEntryIntent } from "@/lib/jarva/jarva-entry-router";
import { appendJarvaHandoffParams } from "@/lib/jarva/jarva-handoff";
import { displayLabelForLaneMessage } from "@/lib/jarva/jarva-lane-control";
import type { JarvaWorkflowDestination } from "@/lib/jarva/jarva-workflow-destinations";
import { resolveJarvaWorkflowDestination } from "@/lib/jarva/jarva-workflow-destinations";
import type { JarvaNavIntent } from "@/lib/jarva/jarva-workflow-navigation";
import { sameAppDestination, shouldApplyWorkflowNavigation } from "@/lib/jarva/jarva-workflow-navigation";
import type { JarvaWorkflowPath } from "@/lib/jarva/jarva-workflow-path";
import {
  jarvaDocumentAssemblyHintsHaveSignals,
  parseJarvaDocumentAssemblyHintsFromApi,
  type JarvaDocumentAssemblyHints,
} from "@/lib/jarva/jarva-document-assembly-hints";
import { JarvaDocumentAssemblyReadinessPanel } from "@/components/jarva/JarvaDocumentAssemblyReadinessPanel";
import { JarvaChatNextUiActions } from "@/components/jarva/JarvaChatNextUiActions";
import { JarvaFormattedAdvisory } from "@/components/jarva/JarvaFormattedAdvisory";
import { parseJarvaNextUiActionBundleFromApi, type JarvaNextUiActionBundle } from "@/lib/jarva/jarva-next-ui-actions";
import { cn } from "@/lib/utils";

/** Matches landing `RealityChatBot` floating trigger (electric cyan neon). */
const REALITY_FLOAT_NEON = "#00D4FF";
const REALITY_FLOAT_NEON_GLOW = "0 0 20px #00D4FF, 0 0 40px #00D4FF, 0 0 60px #00D4FF";

function FloatingNpcAvatar({
  src,
  alt,
  size = "md",
}: {
  src: string;
  alt: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-9 w-9" : "h-14 w-14";
  return (
    <div
      className={cn("relative shrink-0 overflow-visible rounded-full animate-electric-gold-pulse", sizeClass)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic NPC avatar URLs from public/ */}
      <img
        src={src}
        alt={alt}
        className="relative z-10 h-full w-full rounded-full object-cover ring-2 ring-slate-900/95"
      />
    </div>
  );
}

/** Magic `message` strings — parsed in `/api/npc/chat` before classification (see `jarva-lane-control.ts`). */
const JARVA_LANE_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: "__jarva_set_lane__:revocable", label: "Revocable" },
  { value: "__jarva_set_lane__:irrevocable", label: "Irrevocable" },
  { value: "__jarva_set_lane__:ecclesiastical", label: "Ecclesiastical" },
  { value: "__jarva_set_lane__:certificate", label: "Certificate" },
  { value: "__jarva_set_lane__:ppm", label: "PPM" },
  { value: "__jarva_set_lane__:bond", label: "Bond" },
  { value: "__jarva_set_lane__:estate", label: "Estate" },
  { value: "__jarva_clear_lane__", label: "Reset lane" },
];

export type NPCChatContext = {
  source?: "trust-records" | "smart-trust" | "ecclesiastical" | "oasis-world" | "unknown";
  trustId?: string | null;
  workspaceId?: string | null;
  clientId?: string | null;
  clientTitle?: string | null;
  entityId?: string | null;
  currentStep?: string;
  stepFocus?: string;
  moduleType?: string;
  completionPct?: number;
  blockers?: string[];
  advisories?: string[];
  workspaceStatus?: string;
  workspaceCounts?: {
    parties?: number;
    beneficiaries?: number;
    assets?: number;
  };
  playbookId?: string;
  fieldFocus?: { key: string; label: string };
};

const QUICK_PROMPTS = [
  "What are my next steps?",
  "What should I ask my client?",
  "Client interview checklist for trust formation",
  "Explain this step",
  "How do I construct a trust on this platform?",
  "Naming convention help",
];

const QUICK_PROMPTS_WITH_CLIENT = [
  ...QUICK_PROMPTS,
  "Fill grantor from client record",
];

const SESSION_STORAGE_PREFIX = "npc_chat_session_";

function sessionStorageKey(npcId: string, context?: NPCChatContext | null): string {
  const parts = [npcId, context?.source ?? "", context?.trustId ?? ""];
  return SESSION_STORAGE_PREFIX + parts.join("_").replace(/\s/g, "");
}

function loadSessionId(npcId: string, context?: NPCChatContext | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(sessionStorageKey(npcId, context));
  } catch {
    return null;
  }
}

function saveSessionId(
  npcId: string,
  context: NPCChatContext | null | undefined,
  sessionId: string
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(sessionStorageKey(npcId, context), sessionId);
  } catch {
    // ignore
  }
}

interface ChatMessage {
  id: string;
  role: "user" | "npc";
  content: string;
  timestamp: Date;
}

export interface FloatingNPCChatProps {
  npcId?: string;
  context?: NPCChatContext | null;
  /** Default: "Need help structuring this trust record?" */
  bubbleLabel?: string;
  /** Default: "Jarva · Trust & Family Office Advisor" */
  panelTitle?: string;
  /** If set, add subtle pulse to bubble after this many ms of page idle (does not auto-open) */
  highlightAfterIdleMs?: number;
  /** When true, hide the default bubble; render only the panel (for use with custom triggers like AgentHudPills) */
  hideTrigger?: boolean;
  /** Controlled open state (use with hideTrigger) */
  open?: boolean;
  /** Called when panel is closed (use with hideTrigger) */
  onOpenChange?: (open: boolean) => void;
  /** Custom placeholder for "Ask X..." in input */
  inputPlaceholder?: string;
  /** Initial greeting when panel opens (NPC-specific) */
  initialGreeting?: string;
  /** When set, replaces default Jarva/trust quick prompts (use for non-Jarva NPCs) */
  quickPrompts?: string[];
  /**
   * When set, user messages are handled locally (no `/api/npc/chat`) — for deterministic
   * guided assistants (e.g. Bentley on AI Revenue OS).
   */
  guidedHandler?: (message: string) => Promise<{ reply: string }>;
  /**
   * When the panel opens, append a second NPC message after `initialGreeting` (e.g. page context summary).
   * Called when the chat is first shown so content reflects current form state.
   */
  postGreetingBuilder?: () => string | undefined;
  /** Accessible label for the floating bubble trigger */
  bubbleAriaLabel?: string;
  /**
   * `reality_neon` — same size and neon treatment as the home page REALITY floating bubble
   * (128px avatar, label pill above, pulse glow). Ignored when `avatarSrc` is missing.
   */
  floatingTriggerPreset?: "default" | "reality_neon";
  /** Optional circular avatar (shown on trigger + panel header) */
  avatarSrc?: string;
  avatarAlt?: string;
  className?: string;
  /** Optional region below the panel header (e.g. Bentley pipeline progress). */
  panelTopSlot?: ReactNode;
  /** When set, `window.dispatchEvent(new CustomEvent(name))` opens the panel (uncontrolled mode). */
  externalOpenEventName?: string;
}

export function FloatingNPCChat({
  npcId = "trust-advisor",
  context,
  bubbleLabel = "Your trust structuring aid",
  panelTitle = "Jarva · Your Trust Structuring Aid",
  highlightAfterIdleMs,
  hideTrigger = false,
  open: controlledOpen,
  onOpenChange,
  inputPlaceholder = "Ask Jarva...",
  initialGreeting,
  quickPrompts: quickPromptsProp,
  guidedHandler,
  postGreetingBuilder,
  bubbleAriaLabel,
  floatingTriggerPreset = "default",
  avatarSrc,
  avatarAlt,
  className,
  panelTopSlot,
  externalOpenEventName,
}: FloatingNPCChatProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  useEffect(() => {
    if (!externalOpenEventName || typeof window === "undefined") return;
    const openFromEvent = () => {
      if (isControlled) onOpenChange?.(true);
      else setInternalOpen(true);
    };
    window.addEventListener(externalOpenEventName, openFromEvent);
    return () => window.removeEventListener(externalOpenEventName, openFromEvent);
  }, [externalOpenEventName, isControlled, onOpenChange]);

  const [highlight, setHighlight] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [jarvaCompleteness, setJarvaCompleteness] = useState<number | null>(null);
  const [jarvaReadyToApply, setJarvaReadyToApply] = useState(false);
  const [jarvaAutoApplied, setJarvaAutoApplied] = useState(false);
  const [jarvaExtractedKeys, setJarvaExtractedKeys] = useState<string[]>([]);
  const [jarvaMissing, setJarvaMissing] = useState<string[]>([]);
  const [jarvaBlockers, setJarvaBlockers] = useState<string[]>([]);
  const [jarvaFollowUps, setJarvaFollowUps] = useState<string[]>([]);
  const [jarvaError, setJarvaError] = useState<string | null>(null);
  const [applyBusy, setApplyBusy] = useState(false);
  const [showLineageHint, setShowLineageHint] = useState(false);
  const [jarvaMode, setJarvaMode] = useState<"assist" | "build" | "review">("assist");
  const [jarvaNextQuestionItems, setJarvaNextQuestionItems] = useState<
    Array<{ category: string; question: string }>
  >([]);
  const [jarvaLastMappedAt, setJarvaLastMappedAt] = useState<Date | null>(null);
  const [jarvaSuggestedTiming, setJarvaSuggestedTiming] = useState<string | null>(null);
  const [jarvaNeedsTrustTypeChoice, setJarvaNeedsTrustTypeChoice] = useState(false);
  const [jarvaEntryIntent, setJarvaEntryIntent] = useState<JarvaEntryIntent | null>(null);
  const [jarvaTrustStyleHint, setJarvaTrustStyleHint] = useState<JarvaTrustStyleHintUi | null>(null);
  const [jarvaWorkflowLanePath, setJarvaWorkflowLanePath] = useState<string | null>(null);
  const [jarvaWorkflowPathSource, setJarvaWorkflowPathSource] = useState<
    | "explicit_turn"
    | "sticky_session"
    | "transcript_fallback"
    | "lane_control"
    | "lane_clear"
    | null
  >(null);
  const [jarvaDocumentAssemblyHints, setJarvaDocumentAssemblyHints] = useState<JarvaDocumentAssemblyHints | null>(null);
  const [jarvaNextUiActionBundle, setJarvaNextUiActionBundle] = useState<JarvaNextUiActionBundle | null>(null);
  const [advisoryPacketBusy, setAdvisoryPacketBusy] = useState(false);
  /** Shown only after explicit lane / trust-type / specialty chat actions (not passive sticky turns). */
  const [workflowNavUi, setWorkflowNavUi] = useState<
    | { kind: "notice"; title: string; dest: JarvaWorkflowDestination }
    | { kind: "suggest"; dest: JarvaWorkflowDestination; lanePath: JarvaWorkflowPath }
    | null
  >(null);
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevTrustIdForAssemblyRef = useRef<string | undefined>(undefined);
  const prevWorkflowLaneForAssemblyRef = useRef<string | null>(null);

  const trustWorkspaceActive = Boolean(context?.trustId) && npcId === "trust-advisor";

  const showTrustTypeFastActions = shouldShowJarvaTrustTypeButtons(
    npcId,
    jarvaNeedsTrustTypeChoice,
    trustWorkspaceActive
  );
  const specialtyIntentResolved: JarvaEntryIntent | null =
    npcId === "trust-advisor" && jarvaEntryIntent && isJarvaSpecialtyEntryIntent(jarvaEntryIntent)
      ? jarvaEntryIntent
      : null;
  const showSpecialtyActions = Boolean(specialtyIntentResolved) && !showTrustTypeFastActions;
  const specialtyActions = specialtyIntentResolved
    ? buildJarvaSpecialtyActions(specialtyIntentResolved, context?.trustId)
    : [];

  const documentAssemblyPanelEl = useMemo(() => {
    if (!trustWorkspaceActive || !context?.trustId || !jarvaDocumentAssemblyHints) return null;
    return (
      <JarvaDocumentAssemblyReadinessPanel trustId={context.trustId} hints={jarvaDocumentAssemblyHints} />
    );
  }, [trustWorkspaceActive, context?.trustId, jarvaDocumentAssemblyHints]);

  // Restore sessionId from sessionStorage when context changes
  useEffect(() => {
    const stored = loadSessionId(npcId, context);
    setSessionId(stored);
  }, [npcId, context?.source, context?.trustId]);

  /** Drop document-assembly hints when the bound trust workspace changes (avoid stale cues). */
  useEffect(() => {
    const tid = context?.trustId ?? undefined;
    if (
      prevTrustIdForAssemblyRef.current !== undefined &&
      tid !== undefined &&
      prevTrustIdForAssemblyRef.current !== tid
    ) {
      setJarvaDocumentAssemblyHints(null);
    }
    prevTrustIdForAssemblyRef.current = tid;
  }, [context?.trustId]);

  /** Lane switches can change which assembly rows apply — clear until the next reply refreshes hints. */
  useEffect(() => {
    const lane = jarvaWorkflowLanePath;
    if (
      prevWorkflowLaneForAssemblyRef.current !== null &&
      lane !== null &&
      prevWorkflowLaneForAssemblyRef.current !== lane
    ) {
      setJarvaDocumentAssemblyHints(null);
    }
    prevWorkflowLaneForAssemblyRef.current = lane;
  }, [jarvaWorkflowLanePath]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  /** Prime progress from saved intake when opening trust workspace chat */
  useEffect(() => {
    if (!open || !trustWorkspaceActive || !context?.trustId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/jarva/trust-intake/session?trustId=${encodeURIComponent(context.trustId!)}`,
          { credentials: "include" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        if (data?.jarvaMode === "build" || data?.jarvaMode === "review" || data?.jarvaMode === "assist") {
          setJarvaMode(data.jarvaMode);
        }
        if (data?.applyReadiness) {
          setJarvaCompleteness(data.applyReadiness.completenessPercent ?? null);
          setJarvaReadyToApply(Boolean(data.applyReadiness.canApply));
          setJarvaMissing(Array.isArray(data.applyReadiness.missing) ? data.applyReadiness.missing : []);
          setJarvaBlockers(Array.isArray(data.applyReadiness.blockers) ? data.applyReadiness.blockers : []);
        }
        if (data?.readinessFull?.suggestedApplyTiming) {
          setJarvaSuggestedTiming(data.readinessFull.suggestedApplyTiming);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, trustWorkspaceActive, context?.trustId]);

  const buildNpcChatBody = useCallback(
    (overrides: Record<string, unknown>) => ({
      npcId,
      sessionId: sessionId || undefined,
      jarvaIntakeSync: true,
      jarvaAutoApply: false,
      jarvaSyncTrustRecords: true,
      jarvaMode,
      context: context
        ? {
            source: context.source,
            trustId: context.trustId || undefined,
            workspaceId: context.workspaceId || undefined,
            clientId: context.clientId || undefined,
            clientTitle: context.clientTitle || undefined,
            entityId: context.entityId || undefined,
            currentStep: context.currentStep,
            stepFocus: context.stepFocus,
            moduleType: context.moduleType,
            completionPct: context.completionPct,
            blockers: context.blockers,
            advisories: context.advisories,
            workspaceStatus: context.workspaceStatus,
            workspaceCounts: context.workspaceCounts,
            playbookId: context.playbookId,
            fieldFocus: context.fieldFocus,
          }
        : undefined,
      ...overrides,
    }),
    [npcId, sessionId, jarvaMode, context]
  );

  const applyJarvaChatResponse = useCallback(
    (data: Record<string, unknown>) => {
      if (data.jarvaMode === "build" || data.jarvaMode === "review" || data.jarvaMode === "assist") {
        setJarvaMode(data.jarvaMode);
      }
      if (data.jarvaNextActions?.nextQuestionItems?.length) {
        setJarvaNextQuestionItems(data.jarvaNextActions.nextQuestionItems as Array<{ category: string; question: string }>);
      } else if (Array.isArray(data.jarvaNextActions?.nextQuestions) && data.jarvaNextActions.nextQuestions.length) {
        setJarvaNextQuestionItems(
          (data.jarvaNextActions.nextQuestions as string[]).map((q: string) => ({
            category: "suggested",
            question: q,
          }))
        );
      } else {
        setJarvaNextQuestionItems([]);
      }
      if (data.jarvaReadinessFull?.suggestedApplyTiming) {
        setJarvaSuggestedTiming(data.jarvaReadinessFull.suggestedApplyTiming as string);
      }

      if (data.jarvaIntakeUpdated) {
        setJarvaCompleteness(
          typeof data.jarvaIntakeCompletenessPct === "number" ? data.jarvaIntakeCompletenessPct : null
        );
        setJarvaReadyToApply(Boolean(data.jarvaReadyToApply));
        setJarvaAutoApplied(Boolean(data.jarvaAutoApplied));
        const keys = Array.isArray(data.jarvaExtractedFieldKeys) ? data.jarvaExtractedFieldKeys : [];
        setJarvaExtractedKeys(keys);
        if (keys.length > 0) setJarvaLastMappedAt(new Date());
        setJarvaMissing(Array.isArray(data.jarvaMissing) ? data.jarvaMissing : []);
        setJarvaBlockers(Array.isArray(data.jarvaBlockers) ? data.jarvaBlockers : []);
        setJarvaFollowUps(Array.isArray(data.jarvaFollowUps) ? data.jarvaFollowUps : []);
        setJarvaError(typeof data.jarvaIntakeError === "string" ? data.jarvaIntakeError : null);
        if (typeof window !== "undefined" && context?.trustId) {
          window.dispatchEvent(new CustomEvent("jarva-intake-updated", { detail: { trustId: context.trustId } }));
          if (data.jarvaWorkspaceSummary) {
            window.dispatchEvent(
              new CustomEvent("jarva-workspace-updated", {
                detail: { trustId: context.trustId, summary: data.jarvaWorkspaceSummary },
              })
            );
          }
        }
      } else {
        setJarvaError(typeof data.jarvaIntakeError === "string" ? data.jarvaIntakeError : null);
      }

      const newSessionId = data.sessionId || null;
      setSessionId(newSessionId);
      if (newSessionId) saveSessionId(npcId, context, newSessionId);

      if (npcId === "trust-advisor") {
        setJarvaNeedsTrustTypeChoice(Boolean(data.jarvaNeedsTrustTypeChoice));
        setJarvaEntryIntent(parseJarvaEntryIntent(data.jarvaEntryIntent));
        setJarvaTrustStyleHint(parseJarvaTrustStyleHint(data.jarvaTrustStyleHint));
        const lane =
          typeof data.jarvaWorkflowPath === "string" && data.jarvaWorkflowPath.trim()
            ? data.jarvaWorkflowPath.trim()
            : null;
        setJarvaWorkflowLanePath(lane);
        const src = data.jarvaWorkflowPathSource;
        setJarvaWorkflowPathSource(
          src === "explicit_turn" ||
            src === "sticky_session" ||
            src === "transcript_fallback" ||
            src === "lane_control" ||
            src === "lane_clear"
            ? src
            : null
        );
        const parsedHints = parseJarvaDocumentAssemblyHintsFromApi(data.jarvaDocumentAssemblyHints);
        setJarvaDocumentAssemblyHints(
          parsedHints && jarvaDocumentAssemblyHintsHaveSignals(parsedHints) ? parsedHints : null
        );
        setJarvaNextUiActionBundle(parseJarvaNextUiActionBundleFromApi(data.jarvaNextUiActionBundle));
      } else {
        setJarvaNeedsTrustTypeChoice(false);
        setJarvaEntryIntent(null);
        setJarvaTrustStyleHint(null);
        setJarvaWorkflowLanePath(null);
        setJarvaWorkflowPathSource(null);
        setJarvaDocumentAssemblyHints(null);
        setJarvaNextUiActionBundle(null);
      }
    },
    [npcId, context]
  );

  const appendJarvaAdvisoryFromNextUi = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `npc-jarva-next-ui-${Date.now()}`,
        role: "npc",
        content: text,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const handleWorkflowNavigationAfterResponse = useCallback(
    (data: Record<string, unknown>, navIntent: JarvaNavIntent | undefined) => {
      if (npcId !== "trust-advisor") return;
      const source = data.jarvaWorkflowPathSource as string | null | undefined;
      const path = data.jarvaWorkflowPath as string | null | undefined;
      if (!shouldApplyWorkflowNavigation(navIntent, source, path) || !path) return;

      const dest = resolveJarvaWorkflowDestination(path as JarvaWorkflowPath, {
        trustId: context?.trustId,
      });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
      const laneLabel = formatJarvaWorkflowLaneLabel(path);

      if (origin && here && sameAppDestination(dest.href, here, origin)) {
        setWorkflowNavUi({
          kind: "notice",
          title: `Workflow: ${laneLabel} — already on ${dest.label}. DRAFT — counsel review; not legal advice.`,
          dest,
        });
        window.setTimeout(() => setWorkflowNavUi(null), 6000);
        return;
      }

      const hrefWithHandoff = appendJarvaHandoffParams(dest.href, path as JarvaWorkflowPath);

      if (dest.autoOpenEligible) {
        setJarvaDocumentAssemblyHints(null);
        setWorkflowNavUi({
          kind: "notice",
          title: `Workflow changed to ${laneLabel} — opening ${dest.label}…`,
          dest,
        });
        router.push(hrefWithHandoff);
        window.setTimeout(() => setWorkflowNavUi(null), 5000);
      } else {
        setWorkflowNavUi({
          kind: "suggest",
          dest,
          lanePath: path as JarvaWorkflowPath,
        });
      }
    },
    [npcId, context?.trustId, router]
  );

  const sendMessage = useCallback(
    async (text?: string, opts?: { navIntent?: JarvaNavIntent }) => {
      const messageText = (text || inputValue).trim();
      if (!messageText || chatBusy) return;
      const userDisplay = displayLabelForLaneMessage(messageText) ?? messageText;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userDisplay,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputValue("");
      setChatBusy(true);
      if (npcId === "trust-advisor") {
        setJarvaDocumentAssemblyHints(null);
      }

      try {
        if (guidedHandler) {
          const { reply } = await guidedHandler(messageText);
          const npcMsg: ChatMessage = {
            id: `npc-${Date.now()}`,
            role: "npc",
            content: reply,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, npcMsg]);
        } else {
          const res = await fetch("/api/npc/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(buildNpcChatBody({ message: messageText })),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data?.error || "Chat failed");
          }

          const npcMsg: ChatMessage = {
            id: `npc-${Date.now()}`,
            role: "npc",
            content: data.response,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, npcMsg]);
          applyJarvaChatResponse(data as Record<string, unknown>);
          handleWorkflowNavigationAfterResponse(data as Record<string, unknown>, opts?.navIntent);
        }
      } catch (handlerErr) {
        console.error(
          guidedHandler ? "[FloatingNPCChat] guidedHandler failed" : "[FloatingNPCChat] /api/npc/chat failed",
          handlerErr
        );
        setWorkflowNavUi(null);
        const devHint =
          process.env.NODE_ENV === "development" && handlerErr instanceof Error
            ? ` (${handlerErr.message.slice(0, 280)})`
            : "";
        const npcMsg: ChatMessage = {
          id: `npc-${Date.now()}`,
          role: "npc",
          content: `I'm having trouble right now. Please try again.${devHint}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, npcMsg]);
        if (npcId === "trust-advisor") {
          setJarvaNeedsTrustTypeChoice(false);
          setJarvaEntryIntent(null);
          setJarvaTrustStyleHint(null);
          setJarvaWorkflowLanePath(null);
          setJarvaWorkflowPathSource(null);
          setJarvaDocumentAssemblyHints(null);
          setJarvaNextUiActionBundle(null);
        }
      } finally {
        setChatBusy(false);
      }
    },
    [
      npcId,
      context,
      inputValue,
      sessionId,
      chatBusy,
      jarvaMode,
      buildNpcChatBody,
      applyJarvaChatResponse,
      handleWorkflowNavigationAfterResponse,
      guidedHandler,
    ]
  );

  const downloadAdvisoryPacketBundle = useCallback(async () => {
    const tid = context?.trustId;
    if (!tid || advisoryPacketBusy) return;
    setAdvisoryPacketBusy(true);
    setJarvaError(null);
    try {
      const includeFull = Boolean(jarvaDocumentAssemblyHints?.trustReviewPacketReady);
      const res = await fetch("/api/jarva/advisory-packets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trustId: tid, includeFullReviewPacketMarkdown: includeFull }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Advisory packet preview failed");
      let md = String(data.bundleMarkdown ?? "");
      if (data.fullReviewPacketMarkdown && includeFull) {
        md += `\n\n---\n\n## Appendix — Full Jarva draft review packet (merge preview + lineage)\n\n${data.fullReviewPacketMarkdown}`;
      }
      if (!md.trim()) {
        setJarvaError(
          "No advisory packets for current readiness — refresh hints with a chat message or complete intake/workspace gates."
        );
        return;
      }
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jarva-advisory-packets-${tid.slice(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setJarvaError(e instanceof Error ? e.message : "Advisory packet download failed");
    } finally {
      setAdvisoryPacketBusy(false);
    }
  }, [context?.trustId, advisoryPacketBusy, jarvaDocumentAssemblyHints?.trustReviewPacketReady]);

  const applyJarvaToWorkspace = useCallback(async () => {
    const tid = context?.trustId;
    if (!tid || applyBusy) return;
    setApplyBusy(true);
    setJarvaError(null);
    try {
      const s = await fetch(`/api/jarva/trust-intake/session?trustId=${encodeURIComponent(tid)}`, {
        credentials: "include",
      });
      const sd = await s.json();
      if (!s.ok) throw new Error(sd?.error || "Could not load intake");
      const res = await fetch("/api/jarva/trust-intake/apply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trustId: tid, intake: sd.intake }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data?.readiness?.blockers?.length) {
          throw new Error(`Not ready: ${(data.readiness.blockers as string[]).join("; ")}`);
        }
        throw new Error(data?.message || data?.error || "Apply failed");
      }
      setJarvaAutoApplied(true);
      setJarvaDocumentAssemblyHints(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("jarva-intake-updated", { detail: { trustId: tid } }));
        if (data.workspaceSummary) {
          window.dispatchEvent(
            new CustomEvent("jarva-workspace-updated", { detail: { trustId: tid, summary: data.workspaceSummary } })
          );
        }
      }
    } catch (e) {
      setJarvaError(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplyBusy(false);
    }
  }, [applyBusy, context?.trustId]);

  useEffect(() => {
    if (!highlightAfterIdleMs || open) return;
    const t = setTimeout(() => setHighlight(true), highlightAfterIdleMs);
    return () => clearTimeout(t);
  }, [highlightAfterIdleMs, open]);

  const defaultJarvaGreeting =
    "I'm Jarva. I aid you, the consultant, in trust structuring—prompting you to ask clients the right questions and guiding you through the platform. What would you like to work on today?";

  const quickPromptsList =
    quickPromptsProp ??
    (context?.clientId ? QUICK_PROMPTS_WITH_CLIENT : QUICK_PROMPTS);

  const buildInitialNpcMessages = useCallback((): ChatMessage[] => {
    const greetingText = initialGreeting ?? defaultJarvaGreeting;
    const msgs: ChatMessage[] = [
      {
        id: "greeting",
        role: "npc",
        content: greetingText,
        timestamp: new Date(),
      },
    ];
    const extra = postGreetingBuilder?.()?.trim();
    if (extra) {
      msgs.push({
        id: "opening-context",
        role: "npc",
        content: extra,
        timestamp: new Date(),
      });
    }
    return msgs;
  }, [initialGreeting, postGreetingBuilder]);

  const handleOpen = () => {
    setHighlight(false);
    setOpen(true);
    if (messages.length === 0) {
      setMessages(buildInitialNpcMessages());
    }
  };

  // When opened via controlled mode (hideTrigger), show greeting if empty
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages(buildInitialNpcMessages());
    }
  }, [open, buildInitialNpcMessages]); // eslint-disable-line react-hooks/exhaustive-deps -- open + builder refresh

  const useRealityNeonTrigger = floatingTriggerPreset === "reality_neon" && Boolean(avatarSrc);

  return (
    <>
      {useRealityNeonTrigger ? (
        <style>{`
          @keyframes npcChatRealityNeonPulse {
            0%, 100% {
              box-shadow: 0 0 5px ${REALITY_FLOAT_NEON}, 0 0 10px ${REALITY_FLOAT_NEON}, 0 0 20px ${REALITY_FLOAT_NEON}, 0 0 40px ${REALITY_FLOAT_NEON};
              border-color: ${REALITY_FLOAT_NEON};
            }
            50% {
              box-shadow: 0 0 10px ${REALITY_FLOAT_NEON}, 0 0 20px ${REALITY_FLOAT_NEON}, 0 0 40px ${REALITY_FLOAT_NEON}, 0 0 80px ${REALITY_FLOAT_NEON};
              border-color: #fff;
            }
          }
        `}</style>
      ) : null}
      {!hideTrigger && !open ? (
        <button
          onClick={handleOpen}
          className={cn(
            useRealityNeonTrigger
              ? "fixed bottom-6 right-6 z-50 group p-0 border-0 bg-transparent shadow-none backdrop-blur-none hover:bg-transparent"
              : "fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2 rounded-2xl border border-slate-600/80 bg-slate-900/95 px-4 py-3 shadow-lg backdrop-blur transition hover:border-cyan-500/50 hover:bg-slate-800/95",
            !useRealityNeonTrigger && highlight && !avatarSrc && "animate-pulse ring-2 ring-cyan-500/40 ring-offset-2 ring-offset-slate-950",
            useRealityNeonTrigger && highlight && "ring-2 ring-cyan-500/40 ring-offset-2 ring-offset-slate-950 rounded-full",
            className
          )}
          aria-label={bubbleAriaLabel ?? "Open chat"}
        >
          {useRealityNeonTrigger && avatarSrc ? (
            <div className="relative flex flex-col items-center">
              <div className="mb-2 max-w-[min(100vw-3rem,280px)] whitespace-normal text-center sm:whitespace-nowrap">
                <span
                  className="inline-block text-sm font-bold px-4 py-1.5 rounded-full tracking-wider"
                  style={{
                    color: REALITY_FLOAT_NEON,
                    backgroundColor: "rgba(0, 0, 0, 0.7)",
                    border: `1px solid ${REALITY_FLOAT_NEON}`,
                    boxShadow: `0 0 10px ${REALITY_FLOAT_NEON}40`,
                    textShadow: `0 0 10px ${REALITY_FLOAT_NEON}`,
                  }}
                >
                  {bubbleLabel}
                </span>
              </div>
              <div className="relative">
                <div
                  className="absolute inset-[-8px] rounded-full opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${REALITY_FLOAT_NEON}40 0%, transparent 70%)`,
                    filter: "blur(12px)",
                    animation: "npcChatRealityNeonPulse 2s ease-in-out infinite",
                  }}
                />
                <div
                  className="relative w-32 h-32 rounded-full overflow-hidden group-hover:scale-110 transition-transform cursor-pointer"
                  style={{
                    border: `4px solid ${REALITY_FLOAT_NEON}`,
                    boxShadow: REALITY_FLOAT_NEON_GLOW,
                    animation: "npcChatRealityNeonPulse 2s ease-in-out infinite",
                  }}
                >
                  <Image
                    src={avatarSrc}
                    alt={avatarAlt ?? bubbleAriaLabel ?? "Chat assistant"}
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                </div>
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
          ) : avatarSrc ? (
            <FloatingNpcAvatar
              src={avatarSrc}
              alt={avatarAlt ?? bubbleAriaLabel ?? "Chat assistant"}
              size="md"
            />
          ) : (
            <MessageSquare className="h-6 w-6 text-cyan-400" />
          )}
          {!useRealityNeonTrigger ? (
            <span className="text-xs font-medium text-slate-300 max-w-[140px] text-center leading-tight">
              {bubbleLabel}
            </span>
          ) : null}
        </button>
      ) : open ? (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex w-[380px] max-w-[calc(100vw-3rem)] flex-col rounded-2xl border border-slate-600/80 bg-slate-900/95 shadow-xl backdrop-blur",
            className
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pr-2">
              {avatarSrc ? (
                useRealityNeonTrigger ? (
                  <div
                    className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full"
                    style={{
                      border: `2px solid ${REALITY_FLOAT_NEON}`,
                      boxShadow: `0 0 15px ${REALITY_FLOAT_NEON}60`,
                    }}
                  >
                    <Image
                      src={avatarSrc}
                      alt={avatarAlt ?? bubbleAriaLabel ?? "Chat assistant"}
                      fill
                      className="object-cover"
                      sizes="44px"
                    />
                  </div>
                ) : (
                  <FloatingNpcAvatar
                    src={avatarSrc}
                    alt={avatarAlt ?? bubbleAriaLabel ?? "Chat assistant"}
                    size="sm"
                  />
                )
              ) : null}
              <span className="text-sm font-semibold text-white">{panelTitle}</span>
              {npcId === "trust-advisor" && jarvaTrustStyleHint ? (
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    jarvaTrustStyleHintChipClass(jarvaTrustStyleHint)
                  )}
                  title="Current intake style from your last reply (routing hint)"
                >
                  {jarvaTrustStyleHintLabel(jarvaTrustStyleHint)}
                </span>
              ) : null}
              {npcId === "trust-advisor" && jarvaWorkflowLanePath ? (
                <span
                  className="shrink-0 rounded-full border border-slate-500/50 bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300"
                  title="Active Jarva specialist lane for this chat session"
                >
                  Lane: {formatJarvaWorkflowLaneLabel(jarvaWorkflowLanePath)}
                  {jarvaWorkflowPathSource ? ` · ${jarvaWorkflowPathSourceLabel(jarvaWorkflowPathSource)}` : ""}
                </span>
              ) : null}
              {npcId === "trust-advisor" ? (
                <div className="flex min-w-0 shrink items-center gap-1">
                  <label htmlFor="jarva-lane-select" className="sr-only">
                    Change workflow lane
                  </label>
                  <select
                    id="jarva-lane-select"
                    defaultValue=""
                    disabled={chatBusy}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      e.currentTarget.value = "";
                      if (!v) return;
                      void sendMessage(v, { navIntent: "lane_control" });
                    }}
                    className="max-w-[128px] cursor-pointer rounded border border-slate-600/80 bg-slate-900/90 py-0.5 pl-1 pr-0.5 text-[10px] font-medium text-slate-300 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Set or reset Jarva specialist lane for this chat session"
                  >
                    <option value="">Lane…</option>
                    {JARVA_LANE_SELECT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700/50 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {npcId === "trust-advisor" && workflowNavUi ? (
            <div
              className={cn(
                "border-b px-4 py-2 text-[11px] leading-snug",
                workflowNavUi.kind === "suggest"
                  ? "border-cyan-500/35 bg-cyan-950/30 text-cyan-100/95"
                  : "border-amber-500/35 bg-amber-950/35 text-amber-100/95"
              )}
            >
              {workflowNavUi.kind === "notice" ? (
                <p>{workflowNavUi.title}</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    <span className="font-semibold">{workflowNavUi.dest.label}</span> — open this workflow when you are
                    ready (DRAFT — not legal advice; counsel review applies).
                    {workflowNavUi.dest.reason ? ` ${workflowNavUi.dest.reason}` : ""}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 border-cyan-700/50 bg-cyan-900/50 text-[10px] text-cyan-100 hover:bg-cyan-800/60"
                    onClick={() => {
                      setJarvaDocumentAssemblyHints(null);
                      router.push(appendJarvaHandoffParams(workflowNavUi.dest.href, workflowNavUi.lanePath));
                      setWorkflowNavUi(null);
                    }}
                  >
                    Open workflow
                  </Button>
                  <button
                    type="button"
                    className="text-[10px] text-slate-400 underline underline-offset-2 hover:text-slate-300"
                    onClick={() => setWorkflowNavUi(null)}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {trustWorkspaceActive ? (
            <div className="space-y-2 border-b border-slate-700/40 px-4 py-2 text-[11px] leading-snug text-slate-400">
              <p className="text-amber-200/90">
                Information shared here can be mapped into your trust draft (DRAFT — for counsel review). Jarva merges
                labeled facts into the Jarva intake snapshot; apply pushes to Smart Trust + Trust Records store drafts.
                Not legal advice.
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {(["assist", "build", "review"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setJarvaMode(m)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      jarvaMode === m ? "bg-cyan-700/80 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">
                {jarvaMode === "review" && "Review: analysis only — no intake or workspace writes from chat."}
                {jarvaMode === "build" &&
                  "Build: auto-applies to workspace drafts when grantor, trustee, and situs state are complete."}
                {jarvaMode === "assist" && "Assist: merges intake from chat; you choose when to apply."}
              </p>
              {jarvaSuggestedTiming ? (
                <p className="text-slate-500">
                  <span className="text-slate-400">Apply timing:</span> {jarvaSuggestedTiming.replace(/_/g, " ")}
                </p>
              ) : null}
              {jarvaExtractedKeys.length > 0 ? (
                <div className="rounded border border-emerald-900/40 bg-emerald-950/20 p-2 text-[11px] text-slate-300">
                  <span className="font-semibold text-emerald-100/90">Recently mapped (last reply)</span>
                  <ul className="mt-1.5 space-y-1">
                    {jarvaExtractedKeys.slice(0, 6).map((k) => (
                      <li key={k} className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                        <span>{jarvaFieldKeyToLabel(k)}</span>
                        <span className="font-mono text-[10px] text-emerald-400/80">{k}</span>
                      </li>
                    ))}
                  </ul>
                  {jarvaLastMappedAt ? (
                    <p className="mt-1.5 text-[10px] text-slate-500">
                      Timestamp: {jarvaLastMappedAt.toLocaleString()}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[10px] text-amber-200/70">
                    DRAFT intake snapshot — legal review still required; Jarva does not finalize instruments.
                  </p>
                </div>
              ) : null}
              {jarvaNextQuestionItems.length > 0 ? (
                <div className="rounded border border-slate-700/50 bg-slate-950/40 p-2 text-slate-500">
                  <span className="font-medium text-slate-400">Next questions</span>
                  <ul className="mt-1.5 space-y-2">
                    {jarvaNextQuestionItems.slice(0, 8).map((item, i) => (
                      <li key={`${item.category}-${i}`} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
                        <span
                          className={cn(
                            "w-fit shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                            jarvaQuestionCategoryBadgeClass(item.category)
                          )}
                        >
                          {formatJarvaQuestionCategory(item.category)}
                        </span>
                        <span className="text-slate-400">{item.question}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {documentAssemblyPanelEl}
              {jarvaDocumentAssemblyHints && jarvaDocumentAssemblyHintsHaveSignals(jarvaDocumentAssemblyHints) ? (
                <div className="rounded border border-slate-700/50 bg-slate-950/40 p-2">
                  <p className="text-[10px] font-medium text-slate-500">Advisory packet bundle (DRAFT — not legal advice)</p>
                  <button
                    type="button"
                    disabled={advisoryPacketBusy}
                    onClick={() => void downloadAdvisoryPacketBundle()}
                    className="mt-1 w-full rounded border border-violet-600/50 bg-violet-950/40 px-2 py-1.5 text-[11px] font-medium text-violet-100 hover:bg-violet-900/50 disabled:opacity-50"
                  >
                    {advisoryPacketBusy ? "Preparing…" : "Download advisory packet bundle (Markdown)"}
                  </button>
                  <p className="mt-1 text-[9px] text-slate-500">
                    Server rebuilds readiness from workspace + intake; same gates as document assembly hints. Not
                    auto-finalized.
                  </p>
                </div>
              ) : null}
              {jarvaCompleteness !== null ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-500">
                    <span>Readiness / completeness</span>
                    <span>{jarvaCompleteness}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500/80 transition-all"
                      style={{ width: `${Math.min(100, jarvaCompleteness)}%` }}
                    />
                  </div>
                </div>
              ) : null}
              {jarvaMissing.length > 0 ? (
                <p className="text-slate-500">
                  <span className="text-slate-400">Missing:</span> {jarvaMissing.join("; ")}
                </p>
              ) : null}
              {jarvaBlockers.length > 0 ? (
                <p className="text-amber-400/80">
                  <span className="text-slate-400">Blockers:</span> {jarvaBlockers.join("; ")}
                </p>
              ) : null}
              {jarvaFollowUps.length > 0 ? (
                <p className="text-slate-500">
                  <span className="text-slate-400">Suggested follow-ups:</span> {jarvaFollowUps.slice(0, 3).join(" · ")}
                </p>
              ) : null}
              <div className="flex flex-col gap-1.5 pt-0.5">
                <Link
                  href={`/trust-records/jarva?trustId=${encodeURIComponent(context.trustId!)}`}
                  className="w-fit text-sm font-medium text-cyan-400/90 underline-offset-2 hover:underline"
                >
                  View mapped fields &amp; explainability
                </Link>
                <button
                  type="button"
                  className="w-fit text-left text-[11px] text-cyan-400/80 underline-offset-2 hover:underline"
                  onClick={() => setShowLineageHint((v) => !v)}
                >
                  {showLineageHint ? "Hide" : "View"} lineage / audit trail note
                </button>
              </div>
              {showLineageHint ? (
                <p className="rounded border border-slate-700/60 bg-slate-950/50 p-2 text-[11px] text-slate-500">
                  The link above opens <strong className="text-slate-300">Trust Records → Build with Jarva</strong> for
                  the full intake form, per-field explainability (source snippet, confidence, mapping hints, apply times),
                  and apply controls. Export and execution remain gated elsewhere; this stays draft / review only.
                </p>
              ) : null}
              {jarvaError ? <p className="text-red-400">{jarvaError}</p> : null}
              {jarvaAutoApplied ? (
                <p className="text-emerald-400/90">Apply status: workspace drafts were updated from Jarva (last apply).</p>
              ) : (
                <p className="text-slate-500">Apply status: not auto-applied — use the button below when ready.</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={!jarvaReadyToApply || applyBusy || jarvaMode === "review"}
                  onClick={() => void applyJarvaToWorkspace()}
                  className="rounded-lg bg-emerald-700/90 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {applyBusy ? "Applying…" : "Apply via Jarva"}
                </button>
                {jarvaMode === "review" ? (
                  <span className="text-slate-500">— switch to Assist or Build to persist intake from chat</span>
                ) : !jarvaReadyToApply ? (
                  <span className="text-slate-500">
                    — add grantor, trustee, and governing state (labeled lines work best)
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {panelTopSlot ? (
            <div className="max-h-[min(30vh,240px)] shrink-0 overflow-y-auto border-b border-slate-700/40 px-3 py-2">
              {panelTopSlot}
            </div>
          ) : null}

          <ScrollArea className="h-[280px] px-4 py-3">
            <div className="space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    m.role === "user"
                      ? "ml-8 bg-cyan-600/30 text-cyan-100"
                      : "mr-8 bg-slate-800/60 text-slate-200"
                  )}
                >
                  {m.role === "npc" ? <JarvaFormattedAdvisory text={m.content} /> : m.content}
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-slate-700/50 p-3 space-y-2">
            {npcId === "trust-advisor" ? (
              <Suspense fallback={null}>
                <JarvaChatNextUiActions
                  bundle={jarvaNextUiActionBundle}
                  trustId={context?.trustId}
                  wizardContext={
                    context
                      ? { currentStep: context.currentStep, stepFocus: context.stepFocus }
                      : undefined
                  }
                  onAppendAdvisoryLine={appendJarvaAdvisoryFromNextUi}
                />
              </Suspense>
            ) : null}
            {npcId === "trust-advisor" && (showTrustTypeFastActions || showSpecialtyActions) ? (
              <div className="space-y-2 rounded-lg border border-slate-700/50 bg-slate-950/30 p-2">
                {showTrustTypeFastActions ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Choose trust type
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {JARVA_TRUST_TYPE_CHOICE_BUTTONS.map((b) => (
                        <button
                          key={b.message}
                          type="button"
                          onClick={() => void sendMessage(b.message, { navIntent: "trust_type" })}
                          disabled={chatBusy}
                          className="rounded-lg border border-slate-600/80 bg-slate-800/90 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {showSpecialtyActions ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Quick links
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {specialtyActions.map((a, i) =>
                        a.kind === "link" ? (
                          <Link
                            key={`${a.href}-${i}`}
                            href={a.href}
                            className="rounded-lg border border-cyan-800/50 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-cyan-300/90 hover:bg-slate-800"
                          >
                            {a.label}
                          </Link>
                        ) : (
                          <button
                            key={a.label}
                            type="button"
                            onClick={() => void sendMessage(a.message, { navIntent: "specialty_chat" })}
                            disabled={chatBusy}
                            className="rounded-lg border border-slate-600/80 bg-slate-800/90 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                          >
                            {a.label}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {quickPromptsList.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={chatBusy}
                  className="rounded-lg bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-2"
            >
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputPlaceholder}
                className="flex-1 border-slate-600 bg-slate-800/80 text-sm text-white placeholder:text-slate-500"
                disabled={chatBusy}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputValue.trim() || chatBusy}
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
