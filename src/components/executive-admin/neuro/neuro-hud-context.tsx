"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  NeuroDocumentViewerDto,
  NeuroNetworkOverviewDto,
  NeuroPassageCitationDto,
  NeuroSearchResultDto,
} from "@/lib/executive-agent/neuro/neuro-types";

type NeuroHudState = {
  overview: NeuroNetworkOverviewDto | null;
  searchResult: NeuroSearchResultDto | null;
  viewer: NeuroDocumentViewerDto | null;
  searching: boolean;
  selectedCitation: NeuroPassageCitationDto | null;
  pulseSearch: boolean;
  setOverview: (v: NeuroNetworkOverviewDto | null) => void;
  setSearchResult: (v: NeuroSearchResultDto | null) => void;
  setViewer: (v: NeuroDocumentViewerDto | null) => void;
  setSearching: (v: boolean) => void;
  setSelectedCitation: (v: NeuroPassageCitationDto | null) => void;
  openCitation: (citation: NeuroPassageCitationDto) => Promise<void>;
  refreshOverview: () => Promise<void>;
};

const NeuroHudContext = createContext<NeuroHudState | null>(null);

export function NeuroHudProvider({ children }: { children: ReactNode }) {
  const [overview, setOverview] = useState<NeuroNetworkOverviewDto | null>(null);
  const [searchResult, setSearchResult] = useState<NeuroSearchResultDto | null>(null);
  const [viewer, setViewer] = useState<NeuroDocumentViewerDto | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<NeuroPassageCitationDto | null>(null);
  const [pulseSearch, setPulseSearch] = useState(false);

  const refreshOverview = useCallback(async () => {
    const r = await fetch("/api/admin/executive-agent/neuro/overview", {
      credentials: "include",
      cache: "no-store",
    });
    const j = (await r.json()) as NeuroNetworkOverviewDto;
    if (r.ok && j.ok) setOverview(j);
  }, []);

  const openCitation = useCallback(async (citation: NeuroPassageCitationDto) => {
    setSelectedCitation(citation);
    const r = await fetch(
      `/api/admin/executive-agent/neuro/documents/${encodeURIComponent(citation.documentId)}/viewer?chunkId=${encodeURIComponent(citation.chunkId)}`,
      { credentials: "include", cache: "no-store" }
    );
    const j = (await r.json()) as { ok?: boolean; viewer?: NeuroDocumentViewerDto };
    if (r.ok && j.viewer) setViewer(j.viewer);
  }, []);

  const value = useMemo(
    () => ({
      overview,
      searchResult,
      viewer,
      searching,
      selectedCitation,
      pulseSearch,
      setOverview,
      setSearchResult,
      setViewer,
      setSearching,
      setSelectedCitation,
      openCitation,
      refreshOverview,
    }),
    [
      overview,
      searchResult,
      viewer,
      searching,
      selectedCitation,
      pulseSearch,
      openCitation,
      refreshOverview,
    ]
  );

  return <NeuroHudContext.Provider value={value}>{children}</NeuroHudContext.Provider>;
}

export function useNeuroHud() {
  const ctx = useContext(NeuroHudContext);
  if (!ctx) throw new Error("useNeuroHud requires NeuroHudProvider");
  return ctx;
}

export function useNeuroSearchPulse(active: boolean) {
  return active;
}
