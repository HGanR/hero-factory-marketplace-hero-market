"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function WorldEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[World Editor] Route error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a1628 0%, #1a2d4a 100%)",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <h1 style={{ color: "#e74c3c", fontSize: 24, fontWeight: 700 }}>
        Editor error
      </h1>
      <p style={{ color: "rgba(224,244,255,0.8)", fontSize: 15, maxWidth: 400, textAlign: "center" }}>
        {error?.message || "An unexpected error occurred while loading the world editor."}
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={reset}
          style={{
            background: "linear-gradient(135deg, #1a3a6b, #2a6fbd)",
            color: "#fff",
            border: "none",
            padding: "10px 20px",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <Link
          href="/worlds"
          style={{
            color: "#5a9fd4",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ← Back to World Explorer
        </Link>
        <Link
          href="/dashboard"
          style={{
            color: "#5a9fd4",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
