"use client";

import { useState } from "react";
import { MessageSquarePlus, Upload, Loader2 } from "lucide-react";

const ACCENT = "#00D1FF";

/**
 * Manual engagement CSV ingest — same columns as Bentley SLI CSV (platform, commentText, authorHandle, …).
 * After success, operator runs analysis from Social Lead Intelligence as usual.
 */
export function EngagementCapturePanel() {
  const [csvText, setCsvText] = useState("");
  const [filename, setFilename] = useState("engagement-comments.csv");
  const [contentDeploymentId, setContentDeploymentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setMsg(null);
    setUploadId(null);
    try {
      const r = await fetch("/api/bentley-social-leads/engagement-ingest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText,
          filename: filename || "engagement.csv",
          contentDeploymentId: contentDeploymentId.trim() || undefined,
        }),
      });
      const data = (await r.json()) as { uploadId?: string; error?: string; nextStep?: string };
      if (!r.ok) throw new Error(data?.error ?? "Import failed");
      setUploadId(data.uploadId ?? null);
      setMsg(
        `Imported ${data.uploadId ? "batch" : ""} — run analysis in Social Lead Intelligence with upload id (or open runs UI). ${data.nextStep ?? ""}`
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-cyan-500/35 bg-slate-900/50 p-6">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquarePlus className="w-5 h-5" style={{ color: ACCENT }} />
        <h3 className="text-lg font-semibold text-white">Capture engagement (CSV)</h3>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Paste comments or replies using the same CSV shape as{" "}
        <strong className="text-slate-300">Bentley SLI import</strong> (platform, commentText, authorHandle, …). Rows
        are tagged as <span className="text-cyan-300">post-response</span> and feed the same classification pipeline.
      </p>
      <label className="block text-xs text-slate-500 mb-1">Filename</label>
      <input
        value={filename}
        onChange={(e) => setFilename(e.target.value)}
        className="w-full mb-3 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm"
      />
      <label className="block text-xs text-slate-500 mb-1">Optional content deployment id (provenance)</label>
      <input
        value={contentDeploymentId}
        onChange={(e) => setContentDeploymentId(e.target.value)}
        placeholder="uuid from Deploy Content save"
        className="w-full mb-3 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm font-mono"
      />
      <label className="block text-xs text-slate-500 mb-1">CSV text</label>
      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        rows={8}
        placeholder="platform,commentText,authorHandle,... "
        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm font-mono"
      />
      <button
        type="button"
        disabled={loading || csvText.trim().length < 10}
        onClick={() => void submit()}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        Ingest engagement batch
      </button>
      {uploadId ? (
        <p className="mt-3 text-xs text-emerald-400 font-mono">
          uploadId: {uploadId} — then POST /api/bentley-social-leads/runs with {"{"} uploadId {"}"}
        </p>
      ) : null}
      {msg ? <p className="mt-2 text-xs text-slate-400">{msg}</p> : null}
    </div>
  );
}
