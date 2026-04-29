"use client";

import { useState, useRef, useEffect } from "react";

export type EditorNavTab = "assets" | "commerce" | "portals" | "venue" | null;

interface EditorNavBarProps {
  activeTab: EditorNavTab;
  onTabChange: (tab: EditorNavTab) => void;
  assetsCount: number;
  commerceCount: number;
  portalsCount: number;
  panelContent: React.ReactNode;
}

const TAB_STYLE = {
  padding: "10px 16px",
  background: "transparent",
  border: "none",
  color: "rgba(224,244,255,0.9)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "system-ui, sans-serif",
  transition: "all 0.2s",
  borderBottom: "3px solid transparent",
} as const;

export function EditorNavBar({
  activeTab,
  onTabChange,
  assetsCount,
  commerceCount,
  portalsCount,
  panelContent,
}: EditorNavBarProps) {
  const [dropdownTop, setDropdownTop] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navRef.current) {
      const rect = navRef.current.getBoundingClientRect();
      setDropdownTop(rect.height);
    }
  }, [activeTab]);

  return (
    <div
      ref={navRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 15,
        background: "rgba(10,20,40,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(42,111,189,0.4)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 4,
          padding: "8px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          type="button"
          onClick={() => onTabChange(activeTab === "assets" ? null : "assets")}
          style={{
            ...TAB_STYLE,
            borderBottomColor: activeTab === "assets" ? "#10b981" : "transparent",
            color: activeTab === "assets" ? "#6ee7b7" : "rgba(224,244,255,0.85)",
          }}
        >
          📦 Owned Assets {assetsCount > 0 && `(${assetsCount})`}
        </button>
        <button
          type="button"
          onClick={() => onTabChange(activeTab === "commerce" ? null : "commerce")}
          style={{
            ...TAB_STYLE,
            borderBottomColor: activeTab === "commerce" ? "#10b981" : "transparent",
            color: activeTab === "commerce" ? "#6ee7b7" : "rgba(224,244,255,0.85)",
          }}
        >
          🏪 Commerce Nodes {commerceCount > 0 && `(${commerceCount})`}
        </button>
        <button
          type="button"
          onClick={() => onTabChange(activeTab === "portals" ? null : "portals")}
          style={{
            ...TAB_STYLE,
            borderBottomColor: activeTab === "portals" ? "#10b981" : "transparent",
            color: activeTab === "portals" ? "#6ee7b7" : "rgba(224,244,255,0.85)",
          }}
        >
          🌀 Portals {portalsCount > 0 && `(${portalsCount})`}
        </button>
        <button
          type="button"
          onClick={() => onTabChange(activeTab === "venue" ? null : "venue")}
          style={{
            ...TAB_STYLE,
            borderBottomColor: activeTab === "venue" ? "#10b981" : "transparent",
            color: activeTab === "venue" ? "#6ee7b7" : "rgba(224,244,255,0.85)",
          }}
        >
          🏛️ Venue Nodes
        </button>
        </div>
      </nav>

      {activeTab && (
        <div
          style={{
            position: "absolute",
            top: dropdownTop,
            left: 12,
            maxWidth: 320,
            maxHeight: "calc(100vh - 120px)",
            background: "rgba(10,20,40,0.98)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(42,111,189,0.5)",
            borderTop: "none",
            borderRadius: "0 0 12px 12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            overflow: "hidden",
            zIndex: 14,
          }}
        >
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 130px)", padding: 12 }}>
            {panelContent}
          </div>
        </div>
      )}
    </div>
  );
}
