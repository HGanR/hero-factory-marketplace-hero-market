"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { WalletConnectButton } from "@/components/world-editor/WalletConnectButton";
import { WorldAssetCatalogPanel } from "./WorldAssetCatalogPanel";

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
  textDecoration: "none",
} as const;

interface WorldExplorerNavBarProps {
  onCreateWorld?: () => void;
  creating?: boolean;
}

export function WorldExplorerNavBar({ onCreateWorld, creating }: WorldExplorerNavBarProps) {
  const [showAssets, setShowAssets] = useState(false);
  const [dropdownTop, setDropdownTop] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navRef.current) {
      const rect = navRef.current.getBoundingClientRect();
      setDropdownTop(rect.height);
    }
  }, [showAssets]);

  return (
    <div
      ref={navRef}
      style={{
        position: "sticky",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
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
          gap: 8,
          padding: "10px 20px",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Link
            href="/dashboard"
            style={{
              ...TAB_STYLE,
              borderBottomColor: "transparent",
              color: "rgba(224,244,255,0.85)",
            }}
          >
            ← Dashboard
          </Link>
          <Link
            href="/worlds"
            style={{
              ...TAB_STYLE,
              borderBottomColor: "transparent",
              color: "rgba(224,244,255,0.85)",
            }}
          >
            World Explorer
          </Link>
          <Link
            href="/avatars"
            style={{
              ...TAB_STYLE,
              borderBottomColor: "transparent",
              color: "rgba(224,244,255,0.85)",
            }}
          >
            Avatar
          </Link>
          <button
            type="button"
            onClick={() => setShowAssets(!showAssets)}
            style={{
              ...TAB_STYLE,
              borderBottomColor: showAssets ? "#10b981" : "transparent",
              color: showAssets ? "#6ee7b7" : "rgba(224,244,255,0.85)",
            }}
          >
            📦 Browse Assets
          </button>
          <button
            type="button"
            onClick={onCreateWorld}
            disabled={creating}
            style={{
              ...TAB_STYLE,
              background: "linear-gradient(135deg, #1a3a6b, #2a6fbd)",
              borderRadius: 8,
              padding: "8px 16px",
              borderBottom: "none",
              color: "#fff",
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? "Creating..." : "+ Create World"}
          </button>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <WalletConnectButton />
        </div>
      </nav>

      {showAssets && (
        <div
          style={{
            position: "absolute",
            top: dropdownTop,
            left: 20,
            background: "rgba(10,20,40,0.98)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(42,111,189,0.5)",
            borderTop: "none",
            borderRadius: "0 0 12px 12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            overflow: "hidden",
            zIndex: 19,
            padding: 16,
          }}
        >
          <WorldAssetCatalogPanel />
        </div>
      )}
    </div>
  );
}
