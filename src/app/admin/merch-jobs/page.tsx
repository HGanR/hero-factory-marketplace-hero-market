"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type AdminMerchJobRow = {
  id: string;
  type: "RENDER" | "INPAINT" | "EXPORT_ZIP" | "EXPORT_PDF";
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  inputJson: Record<string, unknown> | null;
  outputJson: Record<string, unknown> | null;
  error: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export default function AdminMerchJobsPage() {
  const [jobs, setJobs] = useState<AdminMerchJobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED">("ALL");
  const [error, setError] = useState<string | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  async function fetchJobs() {
    setLoading(true);
    setError(null);
    try {
      const query = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
      const res = await fetch(`/api/admin/merch-jobs${query}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load jobs");
      }
      setJobs(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    const t = window.setInterval(() => {
      void fetchJobs();
    }, 5000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function retryJob(jobId: string) {
    setRetryingJobId(jobId);
    try {
      const res = await fetch(`/api/admin/merch-jobs/${encodeURIComponent(jobId)}/retry`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Retry failed");
      }
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryingJobId(null);
    }
  }

  const counts = useMemo(() => {
    return jobs.reduce(
      (acc, job) => {
        acc.total += 1;
        acc[job.status] += 1;
        return acc;
      },
      { total: 0, QUEUED: 0, RUNNING: 0, SUCCEEDED: 0, FAILED: 0 }
    );
  }, [jobs]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin Merch Jobs</h1>
            <p className="mt-1 text-sm text-slate-300">
              Monitor worker queue and retry failed jobs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="rounded-lg border border-slate-500 px-3 py-2 text-sm hover:border-cyan-400">
              Back to Admin
            </Link>
            <button
              type="button"
              onClick={() => void fetchJobs()}
              className="rounded-lg border border-cyan-500 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/30"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-5">
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">Total: {counts.total}</div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">Queued: {counts.QUEUED}</div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">Running: {counts.RUNNING}</div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">Succeeded: {counts.SUCCEEDED}</div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">Failed: {counts.FAILED}</div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(["ALL", "QUEUED", "RUNNING", "SUCCEEDED", "FAILED"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg border px-3 py-2 text-sm ${
                statusFilter === status
                  ? "border-cyan-500 bg-cyan-500/20 text-cyan-100"
                  : "border-slate-600 text-slate-300 hover:border-cyan-400"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-950/60">
          <table className="w-full min-w-[980px]">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="px-3 py-2 text-left text-xs text-slate-400">Job</th>
                <th className="px-3 py-2 text-left text-xs text-slate-400">Type</th>
                <th className="px-3 py-2 text-left text-xs text-slate-400">Status</th>
                <th className="px-3 py-2 text-left text-xs text-slate-400">Updated</th>
                <th className="px-3 py-2 text-left text-xs text-slate-400">Error</th>
                <th className="px-3 py-2 text-left text-xs text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && jobs.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-sm text-slate-300" colSpan={6}>
                    Loading jobs...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-sm text-slate-300" colSpan={6}>
                    No jobs found.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-xs font-mono text-slate-200">{job.id}</td>
                    <td className="px-3 py-2 text-xs text-slate-200">{job.type}</td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={`rounded px-2 py-0.5 ${
                          job.status === "FAILED"
                            ? "bg-red-500/20 text-red-300"
                            : job.status === "SUCCEEDED"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : job.status === "RUNNING"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-cyan-500/20 text-cyan-300"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      {new Date(job.updatedAt).toLocaleString()}
                    </td>
                    <td className="max-w-[360px] px-3 py-2 text-xs text-slate-300">
                      {job.error || "-"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={job.status !== "FAILED" || retryingJobId === job.id}
                          onClick={() => void retryJob(job.id)}
                          className="rounded border border-cyan-500 px-2 py-1 text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {retryingJobId === job.id ? "Retrying..." : "Retry"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

