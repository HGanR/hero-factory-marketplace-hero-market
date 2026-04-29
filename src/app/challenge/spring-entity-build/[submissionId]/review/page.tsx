"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MIN_QUALIFY_SCORE } from "@/lib/challenge/spring2026/constants";

type Submission = {
  submissionId: string;
  status: string;
  answers: Record<string, unknown> | null;
  totalScore: number | null;
  phaseScores: Record<string, number> | null;
  credits: Array<{ creditType: string; amount: number; appliedAt: string }>;
};

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = (params?.submissionId ?? "") as string;
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!submissionId) return;
    fetch(`/api/challenge/spring-2026/submission?id=${encodeURIComponent(submissionId)}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load");
        }
        return res.json();
      })
      .then((data) => setSubmission(data))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [submissionId]);

  useEffect(() => {
    if (!loading && error) {
      router.push("/challenge/spring-entity-build");
    }
  }, [loading, error, router]);

  async function handleSubmit() {
    if (!submissionId || !submission?.answers) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/challenge/spring-2026/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ submissionId, answers: submission.answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setSubmission((prev) =>
        prev
          ? {
              ...prev,
              status: "submitted",
              totalScore: data.totalScore ?? prev.totalScore,
              phaseScores: data.phaseScores ?? prev.phaseScores,
            }
          : prev
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApplyCredit() {
    if (!submissionId) return;
    setApplying(true);
    try {
      const res = await fetch("/api/challenge/spring-2026/apply-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ submissionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply");
      setSubmission((prev) =>
        prev ? { ...prev, credits: [...prev.credits, { creditType: "platform_credit", amount: 1, appliedAt: new Date().toISOString() }] } : prev
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to apply credit");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading…</div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-red-400">{error || "Not found"}</div>
      </div>
    );
  }

  const qualified =
    submission.status === "submitted" &&
    (submission.totalScore ?? 0) >= MIN_QUALIFY_SCORE;
  const hasCredit = submission.credits?.length > 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Review & Submit</h1>
          <Link
            href={`/challenge/spring-entity-build/${submission.submissionId}`}
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            Back to Modules
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="rounded-xl border border-white/10 bg-slate-800/50 p-6 space-y-6">
          <div>
            <div className="text-sm font-medium text-slate-400">Status</div>
            <div className="mt-1 text-slate-200 capitalize">{submission.status}</div>
          </div>

          {submission.status !== "submitted" ? (
            <div>
              <p className="text-sm text-slate-400 mb-3">
                Submitting locks your answers and computes a deterministic score. Make sure all phases are complete.
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !submission.answers}
                className="rounded-lg bg-cyan-500/20 border border-cyan-500 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit for Deterministic Scoring"}
              </button>
              {!submission.answers && (
                <p className="mt-2 text-xs text-amber-400">
                  Complete at least one phase before submitting.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-white/10 p-4">
                <div className="text-sm font-medium text-slate-400">Score</div>
                <div className="mt-1 text-lg font-semibold text-slate-200">
                  Total: {submission.totalScore ?? 0} / 100
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  Qualified (≥{MIN_QUALIFY_SCORE}): {qualified ? "Yes" : "No"}
                </div>
                {submission.phaseScores && (
                  <div className="mt-2 text-xs text-slate-500">
                    Phases: P1={submission.phaseScores.phase1 ?? 0} | P2={submission.phaseScores.phase2 ?? 0} | P3={submission.phaseScores.phase3 ?? 0} | P4={submission.phaseScores.phase4 ?? 0} | P5={submission.phaseScores.phase5 ?? 0}
                  </div>
                )}
              </div>

              {qualified ? (
                hasCredit ? (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-300">
                    Credit already applied. Platform-only, non-transferable, no cash value.
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-slate-400 mb-3">
                      Credits are platform-only, non-transferable, and not redeemable for cash.
                    </p>
                    <button
                      type="button"
                      onClick={handleApplyCredit}
                      disabled={applying}
                      className="rounded-lg bg-cyan-500/20 border border-cyan-500 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50"
                    >
                      {applying ? "Applying…" : "Apply Consultant Advancement Credit"}
                    </button>
                  </div>
                )
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300 text-sm">
                  Score below {MIN_QUALIFY_SCORE}. Update modules and create a new submission in a future challenge window.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6">
          <Link
            href="/challenge/spring-entity-build"
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            ← Back to challenge landing
          </Link>
        </div>
      </main>
    </div>
  );
}
