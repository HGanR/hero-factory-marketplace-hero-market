"use client";

import Link from "next/link";

interface DraftSaveBarProps {
  worldId: string;
  worldName: string;
  hasUnsavedChanges: boolean;
  saving: boolean;
  publishing: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
}

export function DraftSaveBar({
  worldId,
  worldName,
  hasUnsavedChanges,
  saving,
  publishing,
  onSaveDraft,
  onPublish,
}: DraftSaveBarProps) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "rgba(10,20,40,0.95)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(42,111,189,0.5)",
        borderRadius: 12,
        padding: "10px 16px",
        zIndex: 10,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <Link
        href={`/worlds/${worldId}`}
        style={{
          color: "#5a9fd4",
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        ← Exit Editor
      </Link>
      <span style={{ color: "rgba(224,244,255,0.5)", fontSize: 12 }}>|</span>
      <span style={{ color: "rgba(224,244,255,0.8)", fontSize: 12 }}>{worldName}</span>
      <span style={{ color: "rgba(224,244,255,0.5)", fontSize: 12 }}>|</span>
      <button
        onClick={onSaveDraft}
        disabled={saving || !hasUnsavedChanges}
        style={{
          background: hasUnsavedChanges ? "linear-gradient(135deg, #1a3a6b, #2a6fbd)" : "rgba(40,60,80,0.5)",
          border: "1px solid rgba(42,111,189,0.5)",
          borderRadius: 8,
          padding: "8px 16px",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          cursor: saving || !hasUnsavedChanges ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Saving..." : "Save Draft"}
      </button>
      <button
        onClick={onPublish}
        disabled={publishing}
        style={{
          background: "linear-gradient(135deg, #0d5c2e, #10b981)",
          border: "1px solid rgba(16,185,129,0.5)",
          borderRadius: 8,
          padding: "8px 16px",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          cursor: publishing ? "not-allowed" : "pointer",
          opacity: publishing ? 0.7 : 1,
        }}
      >
        {publishing ? "Publishing..." : "Publish"}
      </button>
    </div>
  );
}
