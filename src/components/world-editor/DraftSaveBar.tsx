"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DraftSaveBarProps {
  worldId: string;
  worldName: string;
  visibility: string;
  status: string;
  hasUnsavedChanges: boolean;
  saving: boolean;
  publishing: boolean;
  message?: string | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  onVisibilityChange: (visibility: string) => void;
}

export function DraftSaveBar({ worldId, worldName, visibility, status, hasUnsavedChanges,
  saving, publishing, message, onSaveDraft, onPublish, onVisibilityChange }: DraftSaveBarProps) {
  const [address, setAddress] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  useEffect(() => {
    setAddress(`${window.location.origin}/worlds/${encodeURIComponent(worldId)}`);
    setCopyMessage("");
  }, [worldId]);
  const busy = saving || publishing;
  const shareable = status === "published" && ["public", "unlisted"].includes(visibility);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(address);
      setCopyMessage("World link copied.");
    } catch {
      setCopyMessage("Select the world address below and copy it.");
    }
  }
  const buttonStyle = { minHeight: 44, padding: "10px 16px", borderRadius: 999,
    border: "1px solid #5a9fd4", background: "#173959", color: "#fff", fontSize: 14 };
  return (
    <section aria-label="Save and share my world" style={{ position: "absolute", bottom: 12,
      left: "50%", transform: "translateX(-50%)", width: "min(920px, calc(100vw - 24px))",
      maxHeight: "40dvh", overflowY: "auto", background: "#0a1428", border: "1px solid #5a9fd4",
      borderRadius: 16, padding: 12, zIndex: 10, color: "#e0f4ff", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <Link href={`/worlds/${encodeURIComponent(worldId)}`} onClick={(event) => {
          if ((hasUnsavedChanges || busy) && !window.confirm("Your latest changes may not be saved. Leave the editor?")) event.preventDefault();
        }} style={{ color: "#a0d4ff", padding: 10 }}>Exit Editor</Link>
        <strong style={{ overflowWrap: "anywhere" }}>{worldName}</strong>
        <button type="button" onClick={onSaveDraft} disabled={busy || !hasUnsavedChanges} style={buttonStyle}>
          {saving ? "Saving…" : "Save My World"}
        </button>
        <label>Visitors: <select aria-label="World visibility" value={visibility} disabled={busy}
          onChange={(event) => onVisibilityChange(event.target.value)}
          style={{ ...buttonStyle, background: "#102d47" }}>
          <option value="private">Private</option><option value="unlisted">Anyone with the link</option>
          <option value="public">Public</option>
          {visibility === "token_gated" && <option value="token_gated">Token gated</option>}
        </select></label>
        <button type="button" onClick={onPublish} disabled={busy} style={buttonStyle}>
          {publishing ? "Publishing…" : "Publish saved world"}
        </button>
        <button type="button" onClick={copyLink} disabled={!address} style={buttonStyle}>Copy world link</button>
      </div>
      <p role="status" aria-live="polite" style={{ fontSize: 13, margin: "10px 0" }}>
        {hasUnsavedChanges && "Unsaved changes — save before leaving. "}
        {message || (!hasUnsavedChanges ? "Your saved world will be here when you return." : "")}
        {" "}{shareable ? "Visitors see your last published version." : "Visitors need a published world with Public or Anyone with the link access."}
        {copyMessage && ` ${copyMessage}`}
      </p>
      <label style={{ fontSize: 13 }}>World address
        <input readOnly aria-label="World address" value={address} onFocus={(event) => event.target.select()}
          style={{ display: "block", width: "100%", boxSizing: "border-box", minHeight: 44,
            background: "#071322", color: "#d8f3ff", border: "1px solid #5a9fd4", borderRadius: 8, padding: 8 }} />
      </label>
    </section>
  );
}
