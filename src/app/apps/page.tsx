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

export default function AppsMarketplacePage() {
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [myApps, setMyApps] = useState<AppSummary[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const params = category ? `?category=${encodeURIComponent(category)}` : "";
      const [publicRes, meRes] = await Promise.all([
        fetch(`/api/apps${params}`),
        fetch("/api/apps?scope=my"),
      ]);
      if (publicRes.ok) {
        const data = await publicRes.json();
        setApps(data.apps ?? []);
      } else {
        setApps([]);
      }
      if (meRes.ok) {
        setIsAuthenticated(true);
        const data = await meRes.json();
        setMyApps(data.apps ?? []);
      } else {
        setIsAuthenticated(false);
        setMyApps([]);
      }
    } catch {
      setApps([]);
      setMyApps([]);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a1628 0%, #1a2d4a 100%)",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Link
          href="/dashboard"
          style={{
            color: "#5a9fd4",
            textDecoration: "none",
            fontSize: 14,
            marginBottom: 24,
            display: "inline-block",
          }}
        >
          ← Dashboard
        </Link>
        <h1 style={{ color: "#e0f4ff", fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          App Marketplace
        </h1>
        <p style={{ color: "rgba(224,244,255,0.7)", fontSize: 15, marginBottom: 24 }}>
          AI agents, automations, and tools for your worlds and businesses.
        </p>

        {isAuthenticated && (
          <div style={{ marginBottom: 24, display: "flex", gap: 12, alignItems: "center" }}>
            <Link
              href="/developers/apps"
              style={{
                background: "rgba(42,111,189,0.8)",
                border: "1px solid rgba(42,111,189,0.5)",
                borderRadius: 8,
                padding: "8px 16px",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              My Apps
            </Link>
          </div>
        )}

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
              textAlign: "center",
            }}
          >
            <p style={{ marginBottom: 16 }}>
              No published apps yet. Creators can publish AI agents and tools from the developer
              portal.
            </p>
            {isAuthenticated && (
              <Link
                href="/developers/apps"
                style={{
                  display: "inline-block",
                  background: "linear-gradient(135deg, #1a3a6b, #2a6fbd)",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: 8,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Publish Your First App
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {apps.map((app) => (
              <Link
                key={app.id}
                href={`/apps/${app.slug}`}
                style={{
                  background: "rgba(20,50,90,0.6)",
                  border: "1px solid rgba(42,111,189,0.5)",
                  borderRadius: 12,
                  padding: 20,
                  color: "#e0f4ff",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "rgba(224,244,255,0.6)",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        marginBottom: 4,
                      }}
                    >
                      {app.category}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{app.name}</div>
                    {app.description && (
                      <div
                        style={{
                          fontSize: 14,
                          opacity: 0.85,
                          marginBottom: 8,
                          lineHeight: 1.4,
                        }}
                      >
                        {app.description.slice(0, 120)}
                        {app.description.length > 120 ? "…" : ""}
                      </div>
                    )}
                    <div style={{ fontSize: 12, opacity: 0.6 }}>
                      {app.installCount} installs
                      {(app.priceToken ?? 0) > 0 && ` · ${app.priceToken} tokens`}
                      {(app.priceUSD ?? 0) > 0 && ` · $${app.priceUSD}`}
                    </div>
                  </div>
                  <span style={{ color: "#5a9fd4", fontSize: 14, flexShrink: 0 }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
