"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ClientDeliveryWorkspaceDto } from "@/lib/fulfillment/fulfillment-client-delivery-dtos";

export default function FulfillmentDeliveryWorkspacePage() {
  const params = useParams();
  const token = typeof params?.token === "string" ? params.token : "";
  const [data, setData] = useState<ClientDeliveryWorkspaceDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/fulfillment-delivery/${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ClientDeliveryWorkspaceDto & {
        ok?: boolean;
        message?: string;
      };
      if (!r.ok || !j.ok) {
        setError(j.message ?? "Unable to load this review workspace.");
        setData(null);
        return;
      }
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [load, token]);

  async function approve() {
    setBusy("approve");
    setMessage(null);
    try {
      const r = await fetch(`/api/fulfillment-delivery/${encodeURIComponent(token)}/approve`, {
        method: "POST",
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!r.ok) {
        setMessage(j.message ?? "Could not record approval.");
        return;
      }
      setMessage(j.message ?? "Approved.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function requestRevision() {
    setBusy("revision");
    setMessage(null);
    try {
      const r = await fetch(
        `/api/fulfillment-delivery/${encodeURIComponent(token)}/request-revision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revisionNote: revisionNote.trim() || null }),
        }
      );
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!r.ok) {
        setMessage(j.message ?? "Could not send revision request.");
        return;
      }
      setMessage(j.message ?? "Revision requested.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-600">
        Loading your website draft review…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Review unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">{error ?? "Link invalid or expired."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-700">
            Hero Factory · Website draft review
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Review your site package</h1>
          <p className="mt-1 text-sm text-slate-600">
            Draft v{data.draftVersion} · read-only workspace · expires{" "}
            {new Date(data.expiresAt).toLocaleString()}
          </p>
        </header>

        {message ? (
          <p className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-900">
            {message}
          </p>
        ) : null}

        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business summary</h2>
          <p className="mt-2 text-sm text-slate-700">
            {data.businessSummary ?? "—"}
          </p>
          {data.websiteGoals.length > 0 ? (
            <ul className="mt-3 list-inside list-disc text-sm text-slate-600">
              {data.websiteGoals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          ) : null}
        </section>

        {data.readinessSummary ? (
          <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Project readiness
            </h2>
            <p className="mt-2 text-sm text-slate-600">{data.readinessSummary}</p>
          </section>
        ) : null}

        <section className="mb-4 rounded-xl border border-cyan-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-cyan-800">Draft preview</h2>
          {data.draftPreview.title ? (
            <p className="mt-2 font-medium text-slate-900">{data.draftPreview.title}</p>
          ) : null}
          <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-sm leading-relaxed text-slate-700">
            {data.draftPreview.previewText ?? "No preview available."}
          </pre>
        </section>

        {data.timeline.length > 0 ? (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">History</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {data.timeline.map((t) => (
                <li key={t.id}>
                  <span className="font-medium text-slate-800">{t.label}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {new Date(t.occurredAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.canApprove || data.canRequestRevision ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your response</h2>
            <p className="mt-1 text-xs text-slate-500">
              Approving acknowledges the draft direction. Nothing is published or emailed automatically.
            </p>
            <label className="mt-3 block text-sm text-slate-600">
              Revision notes (optional)
              <textarea
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="What should change?"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy != null || !data.canApprove}
                onClick={() => void approve()}
                className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-50"
              >
                {busy === "approve" ? "Saving…" : "Approve draft"}
              </button>
              <button
                type="button"
                disabled={busy != null || !data.canRequestRevision}
                onClick={() => void requestRevision()}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === "revision" ? "Sending…" : "Request revision"}
              </button>
            </div>
          </section>
        ) : (
          <p className="text-center text-sm text-slate-500">
            {data.deliveryStatus === "client_approved"
              ? "You have already approved this draft. Thank you."
              : "This review workspace is closed for changes."}
          </p>
        )}
      </div>
    </div>
  );
}
