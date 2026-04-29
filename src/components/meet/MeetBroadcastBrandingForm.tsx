"use client";

import React from "react";
import type { BroadcastBranding } from "@/lib/meet/broadcast-scene";

export function MeetBroadcastBrandingForm({
  branding,
  onChange,
}: {
  branding: BroadcastBranding;
  onChange: (next: BroadcastBranding) => void;
}) {
  return (
    <div className="space-y-2 text-xs" data-testid="meet-broadcast-branding-form">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">Branding (metadata V1)</div>
      <label className="block text-slate-400">
        Logo URL (https)
        <input
          className="mt-0.5 w-full rounded bg-slate-800 border border-slate-600 text-sm p-1.5 text-white"
          value={branding.logoUrl ?? ""}
          onChange={(e) => onChange({ ...branding, logoUrl: e.target.value })}
          placeholder="https://…"
        />
      </label>
      <label className="block text-slate-400">
        Brand name
        <input
          className="mt-0.5 w-full rounded bg-slate-800 border border-slate-600 text-sm p-1.5 text-white"
          value={branding.brandName ?? ""}
          onChange={(e) => onChange({ ...branding, brandName: e.target.value })}
        />
      </label>
      <label className="block text-slate-400">
        Footer text
        <input
          className="mt-0.5 w-full rounded bg-slate-800 border border-slate-600 text-sm p-1.5 text-white"
          value={branding.footerText ?? ""}
          onChange={(e) => onChange({ ...branding, footerText: e.target.value })}
        />
      </label>
      <label className="block text-slate-400">
        Accent #RRGGBB
        <input
          className="mt-0.5 w-full rounded bg-slate-800 border border-slate-600 text-sm p-1.5 text-white font-mono"
          value={branding.accentHex ?? ""}
          onChange={(e) => onChange({ ...branding, accentHex: e.target.value })}
          placeholder="#3366cc"
        />
      </label>
    </div>
  );
}
