"use client";

/**
 * /worlds/new — Create a world and redirect to the editor.
 * Single URL that performs the full create → edit flow.
 * Requires auth (auth-token or admin-token cookie).
 */
import { useEffect, useState } from "react";
import Link from "next/link";

export default function WorldsNewPage() {
  const [status, setStatus] = useState<"checking" | "creating" | "error" | "redirecting">("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function create() {
      try {
        // 1. Pre-check auth — avoid POST if not signed in
        const authRes = await fetch("/api/auth/me", { credentials: "include" });
        if (cancelled) return;
        if (!authRes.ok) {
          setStatus("error");
          setError(
            "Please sign in to create a world. Use the Dashboard or Admin panel to sign in."
          );
          return;
        }

        setStatus("creating");

        // 2. Create world
        const res = await fetch("/api/worlds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: "My World", description: "Created from World Explorer" }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data?.world?.id) {
          setStatus("redirecting");
          window.location.href = `/worlds/${data.world.id}/edit`;
          return;
        }
        setStatus("error");
        const apiError =
          res.status === 401
            ? "Please sign in to create a world. Use the Dashboard or Admin panel to sign in."
            : data?.error ?? "Failed to create world";
        const detail = data?.detail;
        setError(detail ? `${apiError} — ${detail}` : apiError);
        console.warn("[worlds/new] Create failed", {
          status: res.status,
          statusText: res.statusText,
          data,
        });
      } catch (e) {
        if (cancelled) return;
        console.error("[worlds/new] Create error:", e);
        setStatus("error");
        setError("Failed to create world. Please check your connection and try again.");
      }
    }
    create();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking" || status === "creating" || status === "redirecting") {
    const message =
      status === "checking"
        ? "Checking sign-in..."
        : status === "creating"
          ? "Creating your world..."
          : "Opening editor...";
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0a1628 0%, #1a2d4a 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: "3px solid #10b981",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <p style={{ color: "#e0f4ff", fontSize: 16, fontWeight: 600 }}>{message}</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a1628 0%, #1a2d4a 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ color: "#e74c3c", fontSize: 24, fontWeight: 700 }}>Could not create world</h1>
      <p style={{ color: "rgba(224,244,255,0.9)", fontSize: 15, maxWidth: 400, textAlign: "center" }}>
        {error}
      </p>
      <p style={{ color: "rgba(224,244,255,0.6)", fontSize: 12, maxWidth: 400, textAlign: "center" }}>
        The 3D editor opens after a world is created. Check the browser console (F12 → Console) for details.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/worlds"
          style={{
            padding: "10px 20px",
            background: "linear-gradient(135deg, #1a3a6b, #2a6fbd)",
            color: "#fff",
            borderRadius: 8,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          ← Back to World Explorer
        </Link>
        <Link
          href="/dashboard"
          style={{
            padding: "10px 20px",
            background: "rgba(42,111,189,0.5)",
            border: "1px solid rgba(42,111,189,0.5)",
            color: "#5a9fd4",
            borderRadius: 8,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
