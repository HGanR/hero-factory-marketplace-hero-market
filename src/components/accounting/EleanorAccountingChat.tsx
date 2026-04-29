"use client";

import { useCallback } from "react";
import { FloatingNPCChat } from "@/components/npc/FloatingNPCChat";
import {
  buildEleanorAccountingPostGreeting,
  handleEleanorAccountingMessage,
} from "@/lib/accounting/pre-accounting/eleanor-guided";
import { useOptionalAccountingPreAccounting } from "./AccountingPreAccountingContext";

const ELEANOR_NPC_ID = "gt-eleanor-voss";

const INITIAL_GREETING = [
  "I’m **Eleanor**, your **pre-accounting intake** assistant. I help you organize books, documents, and summaries so a **licensed tax preparer or CPA** can review and finalize your return positions.",
  "",
  "Tell me your **entity type** (e.g. sole proprietor, S-corp), **tax year**, and whether your books are **cash** or **accrual**. Ask for **missing documents**, **quarterly** checklists, **probable forms**, or a **handoff** summary anytime.",
  "",
  "**Important:** I am not a CPA, EA, or attorney. Filing positions and submissions require **professional review**.",
].join("\n");

/**
 * Accounting workspace — floating trigger uses REALITY-style neon preset; chat runs guided pre-accounting flow with optional server-backed context.
 */
export function EleanorAccountingChat() {
  const ctx = useOptionalAccountingPreAccounting();
  const serverWorkspace = ctx?.serverWorkspace ?? null;

  const guidedHandler = useCallback(
    (message: string) => handleEleanorAccountingMessage(message, { serverWorkspace }),
    [serverWorkspace]
  );

  const postGreetingBuilder = useCallback(
    () => buildEleanorAccountingPostGreeting({ serverWorkspace }),
    [serverWorkspace]
  );

  return (
    <FloatingNPCChat
      npcId={ELEANOR_NPC_ID}
      floatingTriggerPreset="reality_neon"
      panelTitle="Eleanor · Pre-accounting intake"
      bubbleLabel="ELEANOR"
      bubbleAriaLabel="Open Eleanor — pre-accounting assistant for tax preparer handoff"
      avatarSrc="/npc/eleanor-avatar.png"
      avatarAlt="Eleanor — pre-accounting intake"
      inputPlaceholder="Describe your entity, year, documents, or ask for checklists…"
      initialGreeting={INITIAL_GREETING}
      guidedHandler={guidedHandler}
      postGreetingBuilder={postGreetingBuilder}
      className="border-cyan-500/35 shadow-[0_8px_40px_rgba(0,209,255,0.12)]"
    />
  );
}
