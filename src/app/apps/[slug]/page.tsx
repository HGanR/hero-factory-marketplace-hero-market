"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface AppDetail {
  id: string;
  slug: string;
  name: string;
  canEdit?: boolean;
  description?: string;
  category: string;
  creatorId: number;
  version: number;
  priceToken?: number;
  priceUSD?: number;
  revenueShare?: number;
  installCount: number;
  status: string;
  manifestJson?: unknown;
  capabilitiesJson?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export default function AppDetailPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [app, setApp] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/apps/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("App not found");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setApp(data.app);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? "Failed to load app");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handlePublish = async () => {
    if (!app || !app.canEdit || app.status === "published" || publishing) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/apps/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (res.ok) {
        setApp((prev) => (prev ? { ...prev, status: "published" } : null));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to publish");
      }
    } catch (e) {
      alert("Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const handleInstall = async () => {
    if (!app || installing) return;
    setInstalling(true);
    try {
      const res = await fetch("/api/apps/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: app.id, scope: "dashboard" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setInstalled(true);
      } else {
        alert(data.error ?? "Failed to install");
      }
    } catch (e) {
      alert("Failed to install");
    } finally {
      setInstalling(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0a1628 0%, #1a2d4a 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui",
        }}
      >
        <div style={{ color: "rgba(224,244,255,0.6)" }}>Loading...</div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0a1628 0%, #1a2d4a 100%)",
          padding: 24,
          fontFamily: "system-ui",
        }}
      >
        <Link href="/apps" style={{ color: "#5a9fd4", textDecoration: "none", marginBottom: 16, display: "inline-block" }}>
          ← App Marketplace
        </Link>
        <p style={{ color: "#e74c3c" }}>{error ?? "App not found"}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a1628 0%, #1a2d4a 100%)",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <Link
          href="/apps"
          style={{
            color: "#5a9fd4",
            textDecoration: "none",
            fontSize: 14,
            marginBottom: 24,
            display: "inline-block",
          }}
        >
          ← App Marketplace
        </Link>

        <div
          style={{
            background: "rgba(20,50,90,0.6)",
            border: "1px solid rgba(42,111,189,0.5)",
            borderRadius: 16,
            padding: 32,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(224,244,255,0.6)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            {app.category}
          </div>
          <h1 style={{ color: "#e0f4ff", fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
            {app.name}
          </h1>
          {app.description && (
            <p style={{ color: "rgba(224,244,255,0.9)", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
              {app.description}
            </p>
          )}
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "rgba(224,244,255,0.7)" }}>
              {app.installCount} installs · v{app.version}
            </span>
            {(app.priceToken ?? 0) > 0 && (
              <span style={{ fontSize: 14, color: "#5a9fd4", fontWeight: 600 }}>
                {app.priceToken} tokens
              </span>
            )}
            {(app.priceUSD ?? 0) > 0 && (
              <span style={{ fontSize: 14, color: "#10b981", fontWeight: 600 }}>
                ${app.priceUSD}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {app.canEdit && app.status === "draft" && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                style={{
                  background: "linear-gradient(135deg, #0d5c2e, #10b981)",
                  border: "1px solid rgba(16,185,129,0.5)",
                  borderRadius: 10,
                  padding: "12px 24px",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: publishing ? "not-allowed" : "pointer",
                  opacity: publishing ? 0.7 : 1,
                }}
              >
                {publishing ? "Publishing..." : "Publish"}
              </button>
            )}
            {(!app.canEdit || app.status === "published") && (
              <button
                onClick={handleInstall}
                disabled={installing || installed}
                style={{
                  background: installed
                    ? "rgba(16,185,129,0.3)"
                    : "linear-gradient(135deg, #1a3a6b, #2a6fbd)",
                  border: "1px solid rgba(42,111,189,0.5)",
                  borderRadius: 10,
                  padding: "12px 24px",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: installing || installed ? "not-allowed" : "pointer",
                  opacity: installing ? 0.7 : 1,
                }}
              >
                {installing ? "Installing..." : installed ? "Installed" : "Install"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
