"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChallengeRunnerClient } from "./runner-client";

type Submission = {
  submissionId: string;
  status: string;
  answers: Record<string, unknown> | null;
  totalScore: number | null;
  phaseScores: Record<string, number> | null;
  credits: Array<{ creditType: string; amount: number }>;
};

export default function ChallengeRunnerPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = (params?.submissionId ?? "") as string;
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-semibold">Spring 2026 Entity Build</h1>
            <p className="text-sm text-slate-400 mt-0.5">Submission: {submission.submissionId.slice(0, 12)}…</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/challenge/spring-entity-build/${submission.submissionId}/review`}
              className="rounded-lg border border-cyan-500/50 px-4 py-2 text-sm text-cyan-400 hover:bg-cyan-500/10"
            >
              Review / Submit
            </Link>
            <Link
              href="/challenge/spring-entity-build"
              className="text-sm text-slate-400 hover:text-slate-300"
            >
              Back to Challenge
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        <ChallengeRunnerClient
          submissionId={submission.submissionId}
          initialAnswers={(submission.answers as Record<string, unknown>) ?? {}}
          status={submission.status}
        />
      </main>
    </div>
  );
}
