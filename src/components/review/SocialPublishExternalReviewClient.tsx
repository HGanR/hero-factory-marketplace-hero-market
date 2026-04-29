"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ExternalPost = {
  id: string;
  provider: string;
  accountLabel: string | null;
  content: string;
  linkUrl: string | null;
  mediaSummary: string | null;
  scheduledFor: string | null;
  approvalStatus: string;
  rejectionReason: string | null;
  updatedAt: string | null;
  canDecide: boolean;
  awaitingRole: string | null;
  approvalReviewSnapshot: {
    expectedApprovalStatus: string;
    postUpdatedAt: string;
    expectedApprovalStepIndex?: number;
  };
};

export function SocialPublishExternalReviewClient({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken.trim());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState<string | null>(null);
  const [reviewLabel, setReviewLabel] = useState<string | null>(null);
  const [posts, setPosts] = useState<ExternalPost[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selected = useMemo(() => posts.find((p) => p.id === selectedId) ?? null, [posts, selectedId]);

  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async () => {
    if (!token.trim()) {
      setError("Add your review link token (from the URL) or paste the full link.");
      return;
    }
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const r = await fetch(`/api/external/social-publish-approval/posts`, { headers: authHeader });
      const j = (await r.json()) as {
        error?: string;
        message?: string;
        campaignName?: string | null;
        reviewLabel?: string | null;
        posts?: ExternalPost[];
      };
      if (!r.ok) {
        setError(j.message || j.error || "Could not load reviews.");
        setPosts([]);
        return;
      }
      setCampaignName(j.campaignName ?? null);
      setReviewLabel(j.reviewLabel ?? null);
      setPosts(j.posts ?? []);
      const first = (j.posts ?? []).find((p) => p.canDecide);
      setSelectedId(first?.id ?? (j.posts?.[0]?.id ?? null));
    } catch {
      setError("Network error loading reviews.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [authHeader, token]);

  useEffect(() => {
    if (initialToken.trim()) void load();
  }, [initialToken, load]);

  const submitDecision = async (decision: "approve" | "reject") => {
    if (!selected || !token.trim()) return;
    if (decision === "reject" && !rejectReason.trim()) {
      setFeedback("Please enter a rejection reason.");
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const r = await fetch(`/api/external/social-publish-approval/posts/${encodeURIComponent(selected.id)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          decision,
          reason: decision === "reject" ? rejectReason.trim() : undefined,
          approvalReviewSnapshot: selected.approvalReviewSnapshot,
        }),
      });
      const j = (await r.json()) as { error?: string; message?: string; outcome?: string };
      if (r.status === 409) {
        setFeedback(j.message || "This post changed — refresh the list.");
        return;
      }
      if (!r.ok) {
        setFeedback(j.message || j.error || "Action failed.");
        return;
      }
      setRejectReason("");
      setFeedback(j.outcome === "accepted_idempotent" ? "Already recorded — no change." : "Saved. Thank you.");
      await load();
    } catch {
      setFeedback("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const actionable = posts.filter((p) => p.canDecide);

  return (
    <div
      data-testid="external-social-review-page"
      className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 max-w-5xl mx-auto"
    >
      <header className="mb-6 border-b border-slate-800 pb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-white">Client post review</h1>
          <p className="text-sm text-slate-400 mt-1">
            Approve or reject governed social posts for this campaign. This page does not sign you into the operator
            dashboard.
          </p>
        </div>
        {token.trim() ? (
          <button
            type="button"
            className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-200"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </button>
        ) : null}
      </header>

      {!initialToken.trim() ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <label className="block text-xs text-slate-400">Review token (from your invite link)</label>
          <input
            data-testid="external-review-token-input"
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste token or full URL…"
          />
          <button
            type="button"
            data-testid="external-review-load"
            className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load queue"}
          </button>
        </div>
      ) : null}

      {error ? (
        <div data-testid="external-review-error" className="rounded border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {campaignName || reviewLabel ? (
        <div className="text-sm text-slate-300 mb-4">
          {campaignName ? <span className="font-medium text-white">{campaignName}</span> : null}
          {reviewLabel ? (
            <span className="text-slate-500">
              {campaignName ? " · " : ""}
              {reviewLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[minmax(200px,280px)_1fr]">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Queue</div>
          {loading && posts.length === 0 ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : posts.length === 0 ? (
            <p data-testid="external-review-empty" className="text-sm text-slate-500">
              No governed posts in this campaign, or nothing is waiting for approval on this link.
            </p>
          ) : (
            <ul className="space-y-1">
              {posts.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    data-testid={`external-review-row-${p.id}`}
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left rounded border px-2 py-2 text-xs transition ${
                      selectedId === p.id ? "border-cyan-500/50 bg-slate-900" : "border-slate-800 bg-slate-900/40"
                    }`}
                  >
                    <div className="text-slate-200 line-clamp-2">{p.content || "(no caption)"}</div>
                    <div className="text-slate-500 mt-0.5 capitalize">{p.provider}</div>
                    {!p.canDecide ? (
                      <div className="text-amber-200/80 mt-1">Not your step / not pending</div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {actionable.length === 0 && posts.length > 0 ? (
            <p className="text-xs text-slate-500">Nothing is waiting for action from this review link right now.</p>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 min-h-[280px]">
          {!selected ? (
            <p className="text-sm text-slate-500">Select a post.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="capitalize">{selected.provider}</span>
                {selected.accountLabel ? <span>· {selected.accountLabel}</span> : null}
                {selected.scheduledFor ? (
                  <span>· {new Date(selected.scheduledFor).toLocaleString()}</span>
                ) : (
                  <span>· Unscheduled</span>
                )}
              </div>
              <div className="text-slate-200 whitespace-pre-wrap">{selected.content || "—"}</div>
              {selected.linkUrl ? (
                <a className="text-cyan-400 text-xs break-all" href={selected.linkUrl} target="_blank" rel="noreferrer">
                  {selected.linkUrl}
                </a>
              ) : null}
              {selected.mediaSummary ? <p className="text-xs text-slate-500">{selected.mediaSummary}</p> : null}
              <p className="text-xs text-slate-500">
                Status: <span className="text-slate-300">{selected.approvalStatus}</span>
                {selected.awaitingRole ? (
                  <span>
                    {" "}
                    · Awaiting: <span className="text-slate-300">{selected.awaitingRole}</span>
                  </span>
                ) : null}
              </p>
              {selected.rejectionReason ? (
                <p className="text-xs text-rose-200/90">Last rejection reason: {selected.rejectionReason}</p>
              ) : null}

              {selected.canDecide ? (
                <div className="border-t border-slate-800 pt-4 space-y-2">
                  <label className="block text-xs text-slate-400">Rejection reason (required to reject)</label>
                  <textarea
                    data-testid="external-review-reject-reason"
                    className="w-full min-h-[72px] rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="external-review-approve"
                      disabled={busy}
                      className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      onClick={() => void submitDecision("approve")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      data-testid="external-review-reject"
                      disabled={busy}
                      className="rounded bg-rose-600/90 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      onClick={() => void submitDecision("reject")}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 pt-2">You cannot act on this post from this link (wrong step or already decided).</p>
              )}

              {feedback ? (
                <p data-testid="external-review-feedback" className="text-xs text-cyan-200/90">
                  {feedback}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
