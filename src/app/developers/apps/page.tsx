"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface AppSummary {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  creatorId: number;
  version: number;
  priceToken?: number;
  priceUSD?: number;
  revenueShare?: number;
  installCount: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function DevelopersAppsPage() {
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/apps?scope=my");
      if (res.ok) {
        const data = await res.json();
        setApps(data.apps ?? []);
      } else {
        if (res.status === 401) {
          window.location.href = "/dashboard";
          return;
        }
        setApps([]);
      }
    } catch {
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "My App",
          description: "Created from developer portal",
          category: "Business",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const slug = data.app?.slug;
        if (slug) {
          window.location.href = `/apps/${slug}`;
          return;
        }
      }
      const err = await res.json().catch(() => ({}));
      alert(err?.error ?? "Failed to create app");
    } catch (e) {
      alert("Failed to create app");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a1628 0%, #1a2d4a 100%)",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Link
          href="/developers"
          style={{
            color: "#5a9fd4",
            textDecoration: "none",
            fontSize: 14,
            marginBottom: 24,
            display: "inline-block",
          }}
        >
          ← Developer Portal
        </Link>
        <h1 style={{ color: "#e0f4ff", fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          My Apps
        </h1>
        <p style={{ color: "rgba(224,244,255,0.7)", fontSize: 15, marginBottom: 24 }}>
          Create and manage apps for the marketplace.
        </p>

        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            background: "linear-gradient(135deg, #1a3a6b, #2a6fbd)",
            border: "1px solid rgba(42,111,189,0.5)",
            borderRadius: 8,
            padding: "10px 20px",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: creating ? "not-allowed" : "pointer",
            opacity: creating ? 0.7 : 1,
            marginBottom: 24,
          }}
        >
          {creating ? "Creating..." : "+ Create App"}
        </button>

        {loading ? (
          <div style={{ color: "rgba(224,244,255,0.6)", fontSize: 14 }}>Loading...</div>
        ) : apps.length === 0 ? (
          <div
            style={{
              background: "rgba(10,30,60,0.6)",
              border: "1px solid rgba(42,111,189,0.3)",
              borderRadius: 12,
              padding: 32,
              color: "rgba(224,244,255,0.8)",
            }}
          >
            <p style={{ marginBottom: 16 }}>You haven&apos;t created any apps yet.</p>
            <p style={{ fontSize: 14, opacity: 0.8 }}>
              Create an app to publish AI agents, automations, or tools to the marketplace.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {apps.map((app) => (
              <div
                key={app.id}
                style={{
                  background: "rgba(20,50,90,0.6)",
                  border: "1px solid rgba(42,111,189,0.5)",
                  borderRadius: 12,
                  padding: 20,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{app.name}</div>
                  {app.description && (
                    <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>
                      {app.description.slice(0, 80)}
                      {app.description.length > 80 ? "…" : ""}
                    </div>
                  )}
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    {app.category} · {app.installCount} installs · {app.status}
                  </div>
                </div>
                <Link
                  href={`/apps/${app.slug}`}
                  style={{
                    background: "rgba(42,111,189,0.5)",
                    border: "1px solid rgba(42,111,189,0.5)",
                    borderRadius: 8,
                    padding: "8px 16px",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: "none",
                    flexShrink: 0,
                  }}
                >
                  View / Edit
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
