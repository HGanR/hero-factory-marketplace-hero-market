"use client";

import React from "react";
import type { BroadcastGuestCard } from "@/lib/meet/broadcast-guest-cards";
import { summarizeGuestCard } from "@/lib/meet/broadcast-guest-cards";

export function BroadcastGuestCardList({
  cards,
  disabled,
  onApplyToEditor,
  onApplyLive,
}: {
  cards: BroadcastGuestCard[];
  disabled?: boolean;
  /** Merge guest into local lower-third draft (operator still clicks Apply overlays). */
  onApplyToEditor: (card: BroadcastGuestCard) => void;
  /** POST overlay merge with guestCardPackId + guestCardId (V2 live). */
  onApplyLive?: (card: BroadcastGuestCard) => void;
}) {
  if (!cards.length) {
    return <p className="text-[10px] text-slate-500">No cards in pack.</p>;
  }
  return (
    <ul className="space-y-1 max-h-32 overflow-y-auto" data-testid="broadcast-guest-card-list">
      {cards.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-1 text-[10px] text-slate-300 border border-slate-800 rounded px-1.5 py-1">
          <span className="flex-1 min-w-[120px]">{summarizeGuestCard(c)}</span>
          <button
            type="button"
            disabled={disabled}
            className="rounded bg-slate-700 px-1.5 py-0.5 hover:bg-slate-600 disabled:opacity-40"
            onClick={() => onApplyToEditor(c)}
          >
            → editor
          </button>
          {onApplyLive ? (
            <button
              type="button"
              disabled={disabled}
              className="rounded bg-cyan-900/80 px-1.5 py-0.5 hover:bg-cyan-800/80 disabled:opacity-40"
              onClick={() => onApplyLive(c)}
            >
              → live
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
