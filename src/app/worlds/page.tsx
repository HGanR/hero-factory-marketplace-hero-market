"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface WorldSummary {
  id: string;
  name: string;
  description?: string;
  visibility: string;
  status: string;
  terrainSeed: number;
  biomeType: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function WorldsPage() {
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [myWorlds, setMyWorlds] = useState<WorldSummary[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ worldId: string; shareUrl: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [publicRes, meRes] = await Promise.all([
        fetch("/api/worlds"),
        fetch("/api/worlds/me"),
      ]);
      if (publicRes.ok) {
        const data = await publicRes.json();
        setWorlds(data.worlds ?? []);
      }
      if (meRes.ok) {
        setIsAuthenticated(true);
        const data = await meRes.json();
        setMyWorlds(data.worlds ?? []);
      } else {
        setIsAuthenticated(false);
        setMyWorlds([]);
      }
    } catch {
      setWorlds([]);
      setMyWorlds([]);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = () => {
    window.location.href = "/worlds/new";
  };

  const handlePublish = async (worldId: string) => {
    setPublishingId(worldId);
    setPublishResult(null);
    try {
      const res = await fetch(`/api/worlds/${worldId}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const base = typeof window !== "undefined" ? window.location.origin : "";
        const shareUrl = data.shareUrl ?? `${base}/worlds/${worldId}`;
        setPublishResult({ worldId, shareUrl });
        load();
      } else {
        alert(data.error ?? "Failed to publish. Save a draft in the editor first.");
      }
    } catch (e) {
      console.error("[Worlds] Publish error:", e);
      alert("Failed to publish. Please try again.");
    } finally {
      setPublishingId(null);
    }
  };

  const copyShareLink = (url: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  return (
    <div
      style={{
        flex: 1,
        background: "linear-gradient(135deg, #0a1628 0%, #1a2d4a 100%)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
        <h1 style={{ color: "#e0f4ff", fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          World Explorer
        </h1>
        <p style={{ color: "rgba(224,244,255,0.7)", fontSize: 15, marginBottom: 16 }}>
          Browse and explore published worlds.
        </p>
        <p style={{ color: "rgba(224,244,255,0.6)", fontSize: 13, marginBottom: 32 }}>
          Create a world, then click Edit to place buildings, meeting nodes, and commerce nodes from the Asset Library.
        </p>

        {loading ? (
          <div style={{ color: "rgba(224,244,255,0.6)", fontSize: 14 }}>Loading...</div>
        ) : worlds.length === 0 && myWorlds.length === 0 ? (
          <div
            style={{
              background: "rgba(10,30,60,0.6)",
              border: "1px solid rgba(42,111,189,0.3)",
              borderRadius: 12,
              padding: 24,
              color: "rgba(224,244,255,0.8)",
            }}
          >
            <p style={{ marginBottom: 16 }}>
              {isAuthenticated
                ? "Create your first world to get started."
                : "No published worlds yet. Log in to create a world, or browse published worlds once they exist."}
            </p>
            {isAuthenticated ? (
              <button
                onClick={handleCreate}
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
                + Create World
              </button>
            ) : (
              <Link
                href="/dashboard"
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
                Go to Dashboard
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {(myWorlds.length > 0 || isAuthenticated) && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <h2 style={{ color: "#e0f4ff", fontSize: 18, fontWeight: 700 }}>My Worlds</h2>
                  <button
                    onClick={handleCreate}
                    style={{
                      background: "linear-gradient(135deg, #1a3a6b, #2a6fbd)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 16px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + Create World
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {myWorlds.map((w) => (
                    <div
                      key={w.id}
                      style={{
                        background: "rgba(20,50,90,0.6)",
                        border: "1px solid rgba(42,111,189,0.5)",
                        borderRadius: 12,
                        padding: 16,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: "#e0f4ff" }}>{w.name}</div>
                        {w.description && (
                          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4, color: "#e0f4ff" }}>
                            {w.description}
                          </div>
                        )}
                        <div style={{ fontSize: 12, opacity: 0.6, color: "#e0f4ff" }}>
                          {w.status} · {w.visibility}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <Link
                          href={`/worlds/${w.id}`}
                          style={{
                            background: "rgba(42,111,189,0.8)",
                            border: "1px solid rgba(42,111,189,0.5)",
                            borderRadius: 8,
                            padding: "8px 14px",
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          View
                        </Link>
                        <Link
                          href={`/worlds/${w.id}/edit`}
                          style={{
                            background: "rgba(42,111,189,0.8)",
                            border: "1px solid rgba(42,111,189,0.5)",
                            borderRadius: 8,
                            padding: "8px 14px",
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handlePublish(w.id)}
                          disabled={publishingId === w.id}
                          style={{
                            background: "linear-gradient(135deg, #0d5c2e, #10b981)",
                            border: "1px solid rgba(16,185,129,0.5)",
                            borderRadius: 8,
                            padding: "8px 14px",
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: publishingId === w.id ? "not-allowed" : "pointer",
                            opacity: publishingId === w.id ? 0.7 : 1,
                          }}
                        >
                          {publishingId === w.id ? "Publishing..." : "Publish"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {worlds.length > 0 && (
              <div>
                <h2 style={{ color: "#e0f4ff", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                  Public Worlds
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {worlds.map((w) => (
              <Link
                key={w.id}
                href={`/worlds/${w.id}`}
                style={{
                  background: "rgba(10,30,60,0.6)",
                  border: "1px solid rgba(42,111,189,0.3)",
                  borderRadius: 12,
                  padding: 16,
                  color: "#e0f4ff",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{w.name}</div>
                {w.description && (
                  <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>{w.description}</div>
                )}
                <div style={{ fontSize: 12, opacity: 0.6 }}>
                  {w.status} · {w.visibility}
                </div>
              </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {publishResult && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setPublishResult(null)}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #0a1628 0%, #1a2d4a 100%)",
              border: "1px solid rgba(42,111,189,0.5)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 420,
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: "#e0f4ff", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              World published
            </h3>
            <p style={{ color: "rgba(224,244,255,0.8)", fontSize: 14, marginBottom: 16 }}>
              Share this link so others can view your world:
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <input
                type="text"
                readOnly
                value={publishResult.shareUrl}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  background: "rgba(10,30,60,0.8)",
                  border: "1px solid rgba(42,111,189,0.5)",
                  borderRadius: 8,
                  color: "#e0f4ff",
                  fontSize: 13,
                }}
              />
              <button
                type="button"
                onClick={() => copyShareLink(publishResult.shareUrl)}
                style={{
                  padding: "10px 16px",
                  background: "linear-gradient(135deg, #1a3a6b, #2a6fbd)",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Copy
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Link
                href={publishResult.shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "8px 16px",
                  background: "rgba(16,185,129,0.4)",
                  border: "1px solid #10b981",
                  borderRadius: 8,
                  color: "#6ee7b7",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Open link
              </Link>
              <button
                type="button"
                onClick={() => setPublishResult(null)}
                style={{
                  padding: "8px 16px",
                  background: "rgba(60,80,100,0.5)",
                  border: "1px solid rgba(42,111,189,0.5)",
                  borderRadius: 8,
                  color: "#e0f4ff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
