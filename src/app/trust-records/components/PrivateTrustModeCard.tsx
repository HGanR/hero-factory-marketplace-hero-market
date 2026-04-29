"use client";

import React from "react";
import type { TrustMode } from "@/lib/trust/types";
import { buildStateHelperOutput } from "@/lib/trust/stateHelper";

export function PrivateTrustModeCard(props: {
  trustMode: TrustMode;
  governingState?: string;
  onChange: (next: { trustMode: TrustMode; governingState?: string }) => void;
}) {
  const { trustMode, governingState, onChange } = props;
  const helper = buildStateHelperOutput({ trustMode, governingState });

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold">Trust Mode</div>
          <div className="text-sm text-muted-foreground">
            Use Private Trust Safe Mode to keep state selection advisory-only and block filing/EIN steps.
          </div>
        </div>

        <select
          className="border rounded-xl px-3 py-2 text-sm"
          value={trustMode}
          onChange={(e) => onChange({ trustMode: e.target.value as TrustMode, governingState })}
        >
          <option value="standard">Standard</option>
          <option value="private_safe">Private Trust Safe Mode</option>
        </select>
      </div>

      <div className="rounded-xl bg-muted p-3">
        <div className="font-medium">{helper.guidanceBanner.title}</div>
        <div className="text-sm text-muted-foreground mt-1">{helper.guidanceBanner.body}</div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Governing law (optional)</div>
        <input
          className="w-full border rounded-xl px-3 py-2 text-sm"
          placeholder="e.g., NY (optional)"
          value={governingState ?? ""}
          onChange={(e) =>
            onChange({
              trustMode,
              governingState: e.target.value.trim() === "" ? undefined : e.target.value.trim(),
            })
          }
        />
        <div className="text-xs text-muted-foreground">
          Private Safe Mode: leaving this blank is acceptable. The State helper will use neutral language.
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">State helper preview (suggested clauses)</div>
        <div className="space-y-2">
          {helper.suggestedClauses.map((c) => (
            <div key={c.id} className="rounded-xl border p-3">
              <div className="text-sm font-semibold">{c.title}</div>
              <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{c.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}




