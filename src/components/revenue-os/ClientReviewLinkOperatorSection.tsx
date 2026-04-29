"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildClientReviewShareEmailSubject,
  buildClientReviewShareMessage,
  prependRecipientGreeting,
} from "@/lib/social/client-review-share-message";

type TokenRow = {
  id: string;
  label: string | null;
  allowedRoles: string[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  status: "active" | "expired" | "revoked";
  createdByUserId: string;
};

type PostContext = {
  postId: string;
  pendingApproval: boolean;
  clientLinkCanAct: boolean;
  clientLinkGatedReason: string | null;
};

type SummaryResponse = {
  ok?: boolean;
  tokens?: TokenRow[];
  primaryActiveToken?: TokenRow | null;
  activeTokenCount?: number;
  lastExternalClientReview?: {
    at: string;
    decision: "approved" | "rejected";
    postId: string | null;
  } | null;
  postContext?: PostContext | null;
  error?: string;
};

function formatTokenStatusLine(t: TokenRow | null): string {
  if (!t) return "No active client review link.";
  if (t.status === "revoked") return "Latest token was revoked.";
  if (t.status === "expired") return "Latest token expired.";
  if (t.expiresAt) {
    return `Active link (primary) · expires ${new Date(t.expiresAt).toLocaleString()}`;
  }
  return "Active link (primary) · no expiry set";
}

function statusStyle(status: TokenRow["status"]): string {
  if (status === "active") return "text-emerald-300/95";
  if (status === "expired") return "text-amber-200/90";
  return "text-slate-500";
}

export function ClientReviewLinkOperatorSection(props: {
  campaignId: string;
  postId: string;
  approvalStatus: string;
  /** For default email subject line in mailto / UI. */
  campaignName?: string | null;
  onLinksChanged?: () => void;
}) {
  const { campaignId, postId, approvalStatus, campaignName, onLinksChanged } = props;
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [knownReviewUrls, setKnownReviewUrls] = useState<Record<string, string>>({});
  const [lastMint, setLastMint] = useState<{
    id: string;
    reviewUrl: string;
    expiresAt: string | null;
    label: string | null;
  } | null>(null);
  const [expiresChoice, setExpiresChoice] = useState<"7" | "30" | "90" | "none">("30");
  const [mintLabel, setMintLabel] = useState("");
  const [roleEditor, setRoleEditor] = useState(false);
  const [roleApprover, setRoleApprover] = useState(true);
  const [roleOwner, setRoleOwner] = useState(false);

  const [emailExpanded, setEmailExpanded] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailName, setEmailName] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [bulkRevoking, setBulkRevoking] = useState<"all_active" | "all_except_primary" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const q = new URLSearchParams({ campaignId, postId });
      const r = await fetch(`/api/social/external-review-tokens?${q.toString()}`);
      const j = (await r.json()) as SummaryResponse;
      if (!r.ok) {
        setLoadError((j as { message?: string }).message || "Could not load client review link state.");
        setSummary(null);
        return;
      }
      setSummary(j);
    } catch {
      setLoadError("Could not load client review link state.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId, postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rolesForMint = useMemo(() => {
    const r: ("editor" | "approver" | "owner")[] = [];
    if (roleEditor) r.push("editor");
    if (roleApprover) r.push("approver");
    if (roleOwner) r.push("owner");
    return r.length ? r : (["approver"] as const);
  }, [roleEditor, roleApprover, roleOwner]);

  const mintAndCopy = async () => {
    setMinting(true);
    setActionError(null);
    setCopyHint(null);
    try {
      const expiresInDays =
        expiresChoice === "none" ? undefined : Number.parseInt(expiresChoice, 10);
      const labelTrim = mintLabel.trim();
      const r = await fetch("/api/social/external-review-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          contextPostId: postId,
          ...(labelTrim ? { label: labelTrim } : {}),
          ...(expiresInDays != null && Number.isFinite(expiresInDays) ? { expiresInDays } : {}),
          allowedRoles: rolesForMint,
        }),
      });
      const j = (await r.json()) as {
        reviewUrl?: string;
        id?: string;
        error?: string;
        message?: string;
        expiresAt?: string | null;
        label?: string | null;
      };
      if (!r.ok || !j.reviewUrl || !j.id) {
        setActionError(j.message || j.error || "Could not create link.");
        return;
      }
      setKnownReviewUrls((prev) => ({ ...prev, [j.id!]: j.reviewUrl! }));
      setLastMint({
        id: j.id,
        reviewUrl: j.reviewUrl,
        expiresAt: j.expiresAt ?? null,
        label: j.label ?? null,
      });
      try {
        await navigator.clipboard.writeText(j.reviewUrl);
        setCopyHint("Review URL copied to clipboard.");
      } catch {
        setCopyHint("Link created — copy manually below or use Copy URL on this row.");
      }
      await load();
      onLinksChanged?.();
    } catch {
      setActionError("Could not create link.");
    } finally {
      setMinting(false);
    }
  };

  const bulkRevoke = async (mode: "all_active" | "all_except_primary") => {
    const count = summary?.activeTokenCount ?? 0;
    if (count <= 0) return;
    const msg =
      mode === "all_active"
        ? `Revoke ALL ${count} active client review link(s) for this campaign? Those URLs stop working. This cannot be undone.`
        : `Revoke every active link except the newest (primary)? ${count} active now — the newest stays valid.`;
    if (typeof window !== "undefined" && !window.confirm(msg)) return;
    setBulkRevoking(mode);
    setActionError(null);
    setCopyHint(null);
    try {
      const r = await fetch("/api/social/external-review-tokens/bulk-revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, mode, contextPostId: postId }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        revokedCount?: number;
        remainingActiveCount?: number;
      };
      if (!r.ok) {
        setActionError(j.error || "Bulk revoke failed.");
        return;
      }
      const rc = j.revokedCount ?? 0;
      const rem = j.remainingActiveCount ?? 0;
      setCopyHint(
        rc > 0
          ? `Revoked ${rc} link(s). ${rem} active remaining.`
          : "No active links matched that action (nothing to revoke)."
      );
      setKnownReviewUrls({});
      await load();
      onLinksChanged?.();
    } catch {
      setActionError("Bulk revoke failed.");
    } finally {
      setBulkRevoking(null);
    }
  };

  const revokeToken = async (tokenId: string) => {
    setRevokingTokenId(tokenId);
    setActionError(null);
    try {
      const r = await fetch(`/api/social/external-review-tokens/${encodeURIComponent(tokenId)}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextPostId: postId }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setActionError(j.error || "Revoke failed.");
        return;
      }
      setKnownReviewUrls((prev) => {
        const next = { ...prev };
        delete next[tokenId];
        return next;
      });
      await load();
      onLinksChanged?.();
    } catch {
      setActionError("Revoke failed.");
    } finally {
      setRevokingTokenId(null);
    }
  };

  const copyUrl = async (tokenId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyHint("URL copied.");
    } catch {
      setCopyHint("Select the URL field and copy manually.");
    }
  };

  const copyShareMessage = async (row: TokenRow, url: string) => {
    const msg = buildClientReviewShareMessage({
      reviewUrl: url,
      expiresAt: row.expiresAt,
      label: row.label,
    });
    try {
      await navigator.clipboard.writeText(msg);
      setCopyHint("Share message copied.");
    } catch {
      setCopyHint("Could not copy message — try again or copy manually.");
    }
  };

  const copyLastShareMessage = async () => {
    if (!lastMint) return;
    const msg = buildClientReviewShareMessage({
      reviewUrl: lastMint.reviewUrl,
      expiresAt: lastMint.expiresAt,
      label: lastMint.label,
    });
    try {
      await navigator.clipboard.writeText(msg);
      setCopyHint("Share message copied.");
    } catch {
      setCopyHint("Could not copy message.");
    }
  };

  const primary = summary?.primaryActiveToken ?? null;

  const reviewUrlForMailto = useMemo(() => {
    if (lastMint?.reviewUrl) return lastMint.reviewUrl;
    const pid = primary?.id;
    if (pid && knownReviewUrls[pid]) return knownReviewUrls[pid];
    return null;
  }, [lastMint, primary?.id, knownReviewUrls]);

  const mailtoHref = useMemo(() => {
    if (!reviewUrlForMailto) return null;
    const subj =
      emailSubject.trim() ||
      buildClientReviewShareEmailSubject({ label: mintLabel.trim() || null, campaignName: campaignName ?? null });
    const bodyDefault = prependRecipientGreeting(
      buildClientReviewShareMessage({
        reviewUrl: reviewUrlForMailto,
        expiresAt: primary?.expiresAt ?? lastMint?.expiresAt ?? null,
        label: mintLabel.trim() || null,
      }),
      emailName
    );
    const body = emailBody.trim() || bodyDefault;
    const params = new URLSearchParams();
    const to = emailTo.trim();
    if (to) params.set("to", to);
    params.set("subject", subj);
    params.set("body", body);
    const h = `mailto:?${params.toString()}`;
    return h.length > 1950 ? null : h;
  }, [
    reviewUrlForMailto,
    emailTo,
    emailSubject,
    emailBody,
    emailName,
    mintLabel,
    campaignName,
    primary?.expiresAt,
    lastMint?.expiresAt,
  ]);

  const openEmailPanel = () => {
    setEmailExpanded(true);
    setEmailSubject((s) =>
      s.trim() ? s : buildClientReviewShareEmailSubject({ label: mintLabel.trim() || null, campaignName: campaignName ?? null })
    );
    setEmailBody((b) => {
      if (b.trim()) return b;
      if (!reviewUrlForMailto) return "";
      return prependRecipientGreeting(
        buildClientReviewShareMessage({
          reviewUrl: reviewUrlForMailto,
          expiresAt: primary?.expiresAt ?? lastMint?.expiresAt ?? null,
          label: mintLabel.trim() || null,
        }),
        emailName
      );
    });
  };

  const sendEmailViaServer = async () => {
    const to = emailTo.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setActionError("Enter a valid recipient email.");
      return;
    }
    setEmailSending(true);
    setActionError(null);
    try {
      const expiresInDays = expiresChoice === "none" ? undefined : Number.parseInt(expiresChoice, 10);
      const r = await fetch("/api/social/external-review-link-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          recipientEmail: to,
          recipientName: emailName.trim() || undefined,
          subject: emailSubject.trim() || undefined,
          bodyText: emailBody.trim() || undefined,
          label: mintLabel.trim() || undefined,
          ...(expiresInDays != null && Number.isFinite(expiresInDays) ? { expiresInDays } : {}),
          allowedRoles: rolesForMint,
          contextPostId: postId,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        tokenId?: string;
      };
      if (!r.ok) {
        setActionError(j.message || j.error || "Email send failed.");
        if (j.tokenId) {
          setCopyHint("A new link was minted but the email did not send (check EMAIL_PROVIDER / SES).");
          await load();
          onLinksChanged?.();
        }
        return;
      }
      setCopyHint("Email sent. A new review link was minted for this delivery.");
      await load();
      onLinksChanged?.();
    } catch {
      setActionError("Email send failed.");
    } finally {
      setEmailSending(false);
    }
  };
  const postCtx = summary?.postContext ?? null;
  const lastExt = summary?.lastExternalClientReview ?? null;
  const activeCount = summary?.activeTokenCount ?? 0;
  const tokens = summary?.tokens ?? [];

  return (
    <div
      data-testid="planner-client-review-section"
      className="space-y-2 border-t border-slate-800 pt-2"
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Client review link
      </div>
      {loading ? (
        <p data-testid="planner-client-review-loading" className="text-[10px] text-slate-500">
          Loading link state…
        </p>
      ) : null}
      {loadError ? (
        <p data-testid="planner-client-review-load-error" className="text-[10px] text-rose-300">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError ? (
        <>
          <p data-testid="planner-client-review-token-status" className="text-[10px] text-slate-400 leading-snug">
            {formatTokenStatusLine(primary)}
            {activeCount > 1 ? ` · ${activeCount} active links total (any can be used until revoked/expired).` : ""}
          </p>
          <p className="text-[9px] text-slate-600 leading-snug">
            Secret URLs are only known when a link is created. This device remembers URLs you mint in-session for copy
            actions. Mint/revoke from this panel logs to this post&apos;s activity timeline when you opened it from a
            post.
          </p>

          {approvalStatus === "pending_approval" && postCtx ? (
            <div
              data-testid="planner-client-review-post-signal"
              className={`rounded border px-2 py-1 text-[10px] leading-snug ${
                postCtx.clientLinkCanAct
                  ? "border-emerald-500/35 bg-emerald-950/25 text-emerald-100"
                  : "border-slate-700 bg-slate-900/80 text-slate-400"
              }`}
            >
              {postCtx.clientLinkCanAct ? (
                <span>Client can act on this post with the primary active link (current approval step + link roles).</span>
              ) : (
                <span>{postCtx.clientLinkGatedReason ?? "Client link not usable for this post right now."}</span>
              )}
            </div>
          ) : null}

          {lastExt ? (
            <p data-testid="planner-client-review-last-external" className="text-[10px] text-slate-500">
              Last client-link decision: {lastExt.decision} · {new Date(lastExt.at).toLocaleString()}
              {lastExt.postId === postId ? " (this post)" : lastExt.postId ? " (another post in campaign)" : ""}
            </p>
          ) : (
            <p data-testid="planner-client-review-last-external" className="text-[10px] text-slate-600">
              No client-link approvals recorded yet for this campaign.
            </p>
          )}

          <div className="rounded border border-slate-800 bg-slate-900/50 p-2 space-y-2">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Create link</div>
            <label className="block text-[10px] text-slate-500">
              Label (optional)
              <input
                data-testid="planner-client-review-mint-label"
                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                placeholder="e.g. Client round 1"
                value={mintLabel}
                onChange={(e) => setMintLabel(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-3 text-[10px] text-slate-400">
              <span className="text-slate-500 w-full">Allowed roles on link</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={roleEditor} onChange={(e) => setRoleEditor(e.target.checked)} data-testid="planner-client-review-role-editor" />
                editor
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={roleApprover} onChange={(e) => setRoleApprover(e.target.checked)} data-testid="planner-client-review-role-approver" />
                approver
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={roleOwner} onChange={(e) => setRoleOwner(e.target.checked)} data-testid="planner-client-review-role-owner" />
                owner
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-[10px] text-slate-500">
                <span>Expires</span>
                <select
                  data-testid="planner-client-review-expires"
                  className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5"
                  value={expiresChoice}
                  onChange={(e) => setExpiresChoice(e.target.value as typeof expiresChoice)}
                >
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="none">Never</option>
                </select>
              </label>
              <button
                type="button"
                data-testid="planner-client-review-mint-copy"
                disabled={minting}
                className="rounded bg-violet-600/85 px-2 py-1 text-[10px] font-medium text-white disabled:opacity-50"
                onClick={() => void mintAndCopy()}
              >
                {minting ? "Creating…" : "Create link & copy URL"}
              </button>
              <button
                type="button"
                data-testid="planner-client-review-copy-last-message"
                disabled={!lastMint}
                className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-200 disabled:opacity-40"
                onClick={() => void copyLastShareMessage()}
              >
                Copy last share message
              </button>
              <button
                type="button"
                data-testid="planner-client-review-email-toggle"
                className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-200"
                onClick={() => {
                  if (emailExpanded) setEmailExpanded(false);
                  else openEmailPanel();
                }}
              >
                {emailExpanded ? "Hide email" : "Email delivery"}
              </button>
            </div>
          </div>

          {emailExpanded ? (
            <div
              data-testid="planner-client-review-email-panel"
              className="rounded border border-slate-700 bg-slate-900/40 p-2 space-y-2"
            >
              <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Email client review link</div>
              <p className="text-[9px] text-slate-500 leading-snug">
                <strong className="text-slate-400">mailto:</strong> uses a link you already have in this browser (mint first).
                <strong className="text-slate-400"> Send via server</strong> mints a <em>new</em> token and emails it through the
                configured provider (e.g. AWS SES).
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <label className="block text-[10px] text-slate-500">
                  Recipient email
                  <input
                    data-testid="planner-client-review-email-to"
                    type="email"
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="client@example.com"
                  />
                </label>
                <label className="block text-[10px] text-slate-500">
                  Recipient name (optional)
                  <input
                    data-testid="planner-client-review-email-name"
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                    value={emailName}
                    onChange={(e) => setEmailName(e.target.value)}
                    placeholder="Alex"
                  />
                </label>
              </div>
              <label className="block text-[10px] text-slate-500">
                Subject
                <input
                  data-testid="planner-client-review-email-subject"
                  className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Defaults if left blank when sending"
                />
              </label>
              <label className="block text-[10px] text-slate-500">
                Message (plain text)
                <textarea
                  data-testid="planner-client-review-email-body"
                  className="mt-0.5 w-full min-h-[120px] rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder={
                    reviewUrlForMailto
                      ? "Prefilled from share template when you opened this panel; edit freely."
                      : "Mint a link first for mailto, or use Send via server to generate a link in the email."
                  }
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {mailtoHref ? (
                  <a
                    data-testid="planner-client-review-mailto"
                    href={mailtoHref}
                    className="rounded border border-cyan-600/50 bg-cyan-950/30 px-2 py-1 text-[10px] text-cyan-100"
                  >
                    Open email app (draft)
                  </a>
                ) : (
                  <span className="text-[9px] text-slate-500" data-testid="planner-client-review-mailto-disabled">
                    {reviewUrlForMailto
                      ? "mailto link too long — shorten the message or use Send via server."
                      : "mailto: needs a known review URL — mint a link first."}
                  </span>
                )}
                <button
                  type="button"
                  data-testid="planner-client-review-email-send"
                  disabled={emailSending}
                  className="rounded bg-teal-700/90 px-2 py-1 text-[10px] font-medium text-white disabled:opacity-50"
                  onClick={() => void sendEmailViaServer()}
                >
                  {emailSending ? "Sending…" : "Send via server (new link)"}
                </button>
              </div>
            </div>
          ) : null}

          <div data-testid="planner-client-review-token-list" className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Recent links (newest first)</div>
            <div className="flex flex-wrap items-center gap-1.5 pb-1 border-b border-slate-800/80">
              <button
                type="button"
                data-testid="planner-client-review-bulk-revoke-all"
                disabled={activeCount <= 0 || bulkRevoking !== null}
                className="rounded border border-rose-500/45 px-2 py-0.5 text-[9px] text-rose-100 disabled:opacity-35"
                onClick={() => void bulkRevoke("all_active")}
              >
                {bulkRevoking === "all_active" ? "Revoking…" : "Revoke all active (campaign)"}
              </button>
              <button
                type="button"
                data-testid="planner-client-review-bulk-revoke-except-primary"
                disabled={activeCount <= 1 || bulkRevoking !== null}
                className="rounded border border-amber-600/40 px-2 py-0.5 text-[9px] text-amber-100/95 disabled:opacity-35"
                title={activeCount <= 1 ? "Need at least two active links" : undefined}
                onClick={() => void bulkRevoke("all_except_primary")}
              >
                {bulkRevoking === "all_except_primary" ? "Revoking…" : "Revoke all except newest active"}
              </button>
            </div>
            <p className="text-[8px] text-slate-600 leading-snug -mt-0.5">
              Bulk actions apply to the whole campaign. Mint/revoke from this panel can still log to this post&apos;s timeline.
            </p>
            {tokens.length === 0 ? (
              <p className="text-[10px] text-slate-600">No links issued yet.</p>
            ) : (
              tokens.map((row) => {
                const isPrimary = primary?.id === row.id;
                const url = knownReviewUrls[row.id];
                return (
                  <div
                    key={row.id}
                    data-testid={`planner-client-review-token-row-${row.id}`}
                    className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5 space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className={`text-[10px] font-medium ${statusStyle(row.status)}`}>
                        {row.status}
                        {isPrimary ? " · primary" : ""}
                      </span>
                      <span className="text-[9px] text-slate-600">{new Date(row.createdAt).toLocaleString()}</span>
                    </div>
                    {row.label ? <div className="text-[10px] text-slate-300">{row.label}</div> : null}
                    <div className="text-[9px] text-slate-500">
                      Roles: {row.allowedRoles.join(", ")} · by user {row.createdByUserId}
                    </div>
                    <div className="text-[9px] text-slate-500">
                      {row.expiresAt ? `Expires ${new Date(row.expiresAt).toLocaleString()}` : "No expiry"}
                      {row.revokedAt ? ` · Revoked ${new Date(row.revokedAt).toLocaleString()}` : ""}
                    </div>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      <button
                        type="button"
                        data-testid={`planner-client-review-copy-url-${row.id}`}
                        disabled={!url}
                        className="rounded border border-slate-600 px-1.5 py-0.5 text-[9px] text-slate-200 disabled:opacity-35"
                        title={url ? undefined : "URL unknown — only available right after mint on this browser"}
                        onClick={() => url && void copyUrl(row.id, url)}
                      >
                        Copy URL
                      </button>
                      <button
                        type="button"
                        data-testid={`planner-client-review-copy-msg-${row.id}`}
                        disabled={!url}
                        className="rounded border border-slate-600 px-1.5 py-0.5 text-[9px] text-slate-200 disabled:opacity-35"
                        onClick={() => url && void copyShareMessage(row, url)}
                      >
                        Copy message
                      </button>
                      <button
                        type="button"
                        data-testid={`planner-client-review-revoke-row-${row.id}`}
                        disabled={row.status !== "active" || revokingTokenId === row.id}
                        className="rounded border border-rose-500/40 px-1.5 py-0.5 text-[9px] text-rose-100 disabled:opacity-35"
                        onClick={() => void revokeToken(row.id)}
                      >
                        {revokingTokenId === row.id ? "Revoking…" : "Revoke"}
                      </button>
                    </div>
                    {url ? (
                      <input
                        readOnly
                        className="w-full text-[9px] bg-slate-900/80 text-slate-300 font-mono rounded border border-slate-800 px-1 py-0.5"
                        value={url}
                        onFocus={(e) => e.target.select()}
                      />
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          {copyHint ? (
            <p data-testid="planner-client-review-copy-hint" className="text-[10px] text-cyan-200/90">
              {copyHint}
            </p>
          ) : null}
          {lastMint?.reviewUrl ? (
            <div data-testid="planner-client-review-last-url" className="rounded border border-slate-700 bg-slate-900/90 px-2 py-1">
              <div className="text-[9px] text-slate-500 mb-0.5">Latest minted URL</div>
              <input
                readOnly
                className="w-full text-[10px] bg-transparent text-slate-200 font-mono"
                value={lastMint.reviewUrl}
                onFocus={(e) => e.target.select()}
              />
            </div>
          ) : null}
          {actionError ? (
            <p data-testid="planner-client-review-action-error" className="text-[10px] text-rose-300">
              {actionError}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
