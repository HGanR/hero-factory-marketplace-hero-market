"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OAUTH_CONNECTABLE_PLATFORM_IDS } from "@/lib/social/platform-identity";
import { getAdapter } from "@/lib/social/adapters";
import type { SocialPlatform } from "@/lib/social/config";
import { normalizeAccountPlatformToSocialPlatform } from "@/lib/social/platform-identity";
import type { SocialAccountRow } from "@/lib/db/schema";
import { resolveSocialEngagementCapabilities } from "@/lib/social/engagement/social-engagement-capabilities";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

const ACC = "#00D1FF";
const SURFACED: readonly string[] = ["linkedin", "facebook", "instagram", "tiktok", "pinterest", "snapchat"].filter(
  (p) => (OAUTH_CONNECTABLE_PLATFORM_IDS as readonly string[]).includes(p)
);

type Row = {
  id: string;
  platform: string;
  displayName: string | null;
  externalAccountId: string | null;
  status?: string;
  tokenExpiresAt: string | null;
  createdAt: string | null;
  capabilities: {
    canPublishText: boolean;
    canPublishImage: boolean;
    canPublishCarousel: boolean;
    canPublishVideo: boolean;
    canSchedule: boolean;
    canReadComments: boolean;
    canReplyComments: boolean;
    canReadDMs: boolean;
    canSendDMs: boolean;
    canFetchAnalytics: boolean;
  };
  capabilityNotes: string[];
  directOrganicPublishAvailable: boolean;
  lastCapabilitySyncAt: string | null;
};

function fmtBool(v: boolean) {
  return v ? "Yes" : "—";
}

function accountToEngagementContext(r: Row, clientId: string): SocialAccountRow {
  return {
    id: r.id,
    userId: "",
    clientId: coerceTrimmedString(clientId) || "",
    platform: r.platform,
    authType: "OAUTH",
    accessTokenEnc: null,
    refreshTokenEnc: null,
    expiresAt: r.tokenExpiresAt ? (new Date(r.tokenExpiresAt) as never) : null,
    externalAccountId: r.externalAccountId,
    scopes: null,
    displayName: r.displayName,
    createdAt: new Date() as never,
    updatedAt: new Date() as never,
  } as SocialAccountRow;
}

export function RevenueOsConnectedAccountsPanel({
  clientId,
  returnToPath,
}: {
  clientId: unknown;
  returnToPath: string;
}) {
  const safeClientId = coerceTrimmedString(clientId);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [discId, setDiscId] = useState<string | null>(null);

  const byPlatform = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const a of rows) {
      const k = normalizeAccountPlatformToSocialPlatform(a.platform) ?? a.platform;
      const list = m.get(k) ?? [];
      list.push(a);
      m.set(k, list);
    }
    return m;
  }, [rows]);

  const load = useCallback(async () => {
    if (!safeClientId) return;
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch(
        `/api/revenue-os/social-studio/connection-summary?clientId=${encodeURIComponent(safeClientId)}`
      );
      const j = (await r.json()) as { accounts?: Row[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Load failed");
      setRows(Array.isArray(j.accounts) ? j.accounts : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }, [safeClientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function disconnect(id: string) {
    if (!window.confirm("Disconnect this account? You can reconnect with OAuth at any time.")) return;
    setDiscId(id);
    setErr(null);
    try {
      const r = await fetch(`/api/social/accounts/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Disconnect failed");
      }
      void load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setDiscId(null);
    }
  }

  function startOAuth(platform: string) {
    const rt = encodeURIComponent(returnToPath || "/revenue-os/dashboard#connected-accounts");
    if (!safeClientId) return;
    window.location.assign(
      `/api/social/oauth/${encodeURIComponent(platform)}/start?clientId=${encodeURIComponent(safeClientId)}&returnTo=${rt}`
    );
  }

  return (
    <div
      id="connected-accounts"
      className="rounded-2xl border border-cyan-500/30 bg-slate-950/80 p-6 shadow-[0_0_0_1px_rgba(6,182,212,0.12)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: ACC }}>
            Connected accounts
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl mt-1">
            OAuth-backed social identities for this client. Capabilities follow the in-app provider registry and your stored
            flags — we never show fake parity. Use <span className="text-slate-200">reconnect</span> when tokens expire.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5"
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {err && <p className="text-sm text-red-400 mb-3">{err}</p>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {SURFACED.map((platform) => {
          const pNorm = platform;
          const connected = (byPlatform.get(pNorm) ?? byPlatform.get(platform) ?? []) as Row[];
          const canon = normalizeAccountPlatformToSocialPlatform(platform);
          const hasAdapter = Boolean(canon && getAdapter(canon as SocialPlatform));
          return (
            <div
              key={platform}
              className="rounded-xl border border-white/10 bg-black/30 p-4 flex flex-col gap-2"
              data-testid={`conn-card-${platform}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium capitalize text-cyan-200/95">{platform}</span>
                <span
                  className={`text-[10px] font-semibold rounded px-2 py-0.5 ${
                    connected.length
                      ? connected.some((c) => c.status === "expired")
                        ? "bg-amber-500/20 text-amber-100"
                        : "bg-emerald-500/15 text-emerald-200"
                      : "bg-slate-600/30 text-slate-400"
                  }`}
                >
                  {connected.length ? (connected.some((c) => c.status === "expired") ? "Needs reconnect" : "Connected") : "Not connected"}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                Adapter: {hasAdapter ? "present (organic paths vary)" : "not implemented — manual export only in-app."}
              </p>
              {connected.length === 0 ? (
                <div className="text-[11px] text-slate-400 space-y-2">
                  <p>Connect to unlock in-app schedule/publish for supported networks (governed `campaign_posts`).</p>
                  <button
                    type="button"
                    onClick={() => startOAuth(platform)}
                    className="w-full rounded-lg border border-cyan-500/50 px-2 py-1.5 text-cyan-200 text-xs font-medium hover:bg-cyan-950/30"
                  >
                    Connect {platform}
                  </button>
                </div>
              ) : (
                <ul className="text-[10px] text-slate-300 space-y-2">
                  {connected.map((a) => (
                    <li key={a.id} className="border border-white/5 rounded-lg p-2 space-y-1">
                      <div className="font-medium text-slate-200">{a.displayName || "Unnamed account"}</div>
                      {a.externalAccountId ? <div className="text-slate-500 break-all">ID: {a.externalAccountId}</div> : null}
                      {a.tokenExpiresAt ? (
                        <div className="text-slate-500">Token expiry: {new Date(a.tokenExpiresAt).toLocaleString()}</div>
                      ) : null}
                      <div className="grid grid-cols-2 gap-1 text-[9px] text-slate-500">
                        <span>Publish text: {fmtBool(a.capabilities.canPublishText)}</span>
                        <span>Image: {fmtBool(a.capabilities.canPublishImage)}</span>
                        <span>Carousel: {fmtBool(a.capabilities.canPublishCarousel)}</span>
                        <span>Video: {fmtBool(a.capabilities.canPublishVideo)}</span>
                        <span>Schedule: {fmtBool(a.capabilities.canSchedule)}</span>
                        <span>Analytics: {fmtBool(a.capabilities.canFetchAnalytics)}</span>
                        <span>Comments: {fmtBool(a.capabilities.canReadComments || a.capabilities.canReplyComments)}</span>
                        <span>DMs: {fmtBool(a.capabilities.canReadDMs || a.capabilities.canSendDMs)}</span>
                      </div>
                      {a.capabilityNotes.length ? (
                        <ul className="list-disc pl-3 text-amber-200/80">
                          {a.capabilityNotes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      ) : null}
                      {(() => {
                        const eng = resolveSocialEngagementCapabilities({
                          provider: a.platform,
                          flagsOverride: a.capabilities,
                          socialAccount: accountToEngagementContext(a, safeClientId),
                        });
                        return (
                          <p className="text-[9px] text-slate-500 border-t border-white/5 pt-1 mt-1" data-testid="engagement-readiness">
                            <span className="text-slate-400">Inbox / engagement: </span>
                            {eng.requiresManualForReplies ? <span className="text-amber-200/80">manual-first</span> : <span className="text-emerald-200/80">some in-app paths</span>}
                            {" · "}
                            comments {eng.canReadComments ? "read" : "off"} / reply {eng.canReplyComments ? "on" : "off"} (inbox) · DMs {eng.canReadDMs ? "read" : "off"} / send {eng.canSendDMs ? "on" : "off"}
                          </p>
                        );
                      })()}
                      {!a.directOrganicPublishAvailable ? (
                        <p className="text-amber-200/80">In-app direct organic publish is not available for this account — use export or native app.</p>
                      ) : null}
                      {a.lastCapabilitySyncAt ? (
                        <p className="text-slate-600">Last capability sync: {a.lastCapabilitySyncAt}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => startOAuth(platform)}
                          className="rounded border border-white/15 px-2 py-0.5 text-slate-300 hover:bg-white/5"
                        >
                          Reconnect
                        </button>
                        <button
                          type="button"
                          onClick={() => void disconnect(a.id)}
                          disabled={discId === a.id}
                          className="rounded border border-red-500/40 px-2 py-0.5 text-red-200/90 hover:bg-red-950/20"
                        >
                          {discId === a.id ? "…" : "Disconnect"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
