"use client";

import { useCallback, useState } from "react";
import type { NeuroSearchResultDto } from "@/lib/executive-agent/neuro/neuro-types";
import { useNeuroHud } from "./neuro-hud-context";
import { NeuroCitationHud } from "./NeuroCitationHud";

export function NeuroSourceSearchPanel() {
  const { setSearchResult, setSearching, searching, searchResult, openCitation } = useNeuroHud();
  const [query, setQuery] = useState("");

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const r = await fetch(
        `/api/admin/executive-agent/neuro/search?q=${encodeURIComponent(q)}`,
        { credentials: "include", cache: "no-store" }
      );
      const j = (await r.json()) as NeuroSearchResultDto & { ok?: boolean };
      if (r.ok) setSearchResult(j);
    } finally {
      setSearching(false);
    }
  }, [query, setSearchResult, setSearching]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void runSearch();
          }}
          placeholder="Ask Skipper from NEURO sources…"
          className="min-w-0 flex-1 rounded-xl border border-cyan-500/35 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-100 placeholder:text-slate-500"
        />
        <button
          type="button"
          disabled={searching || !query.trim()}
          onClick={() => void runSearch()}
          className="shrink-0 rounded-xl border border-cyan-500/45 bg-cyan-950/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-cyan-100 disabled:opacity-40"
        >
          {searching ? "…" : "Search"}
        </button>
      </div>
      {searchResult ? (
        <NeuroCitationHud
          hits={searchResult.hits}
          disclaimer={searchResult.disclaimer}
          onSelect={(hit) => void openCitation(hit)}
        />
      ) : null}
    </div>
  );
}
