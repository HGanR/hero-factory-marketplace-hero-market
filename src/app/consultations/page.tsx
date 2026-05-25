"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Consultant = {
  userId: number;
  displayName: string;
  specialty: string;
  note?: string;
  avatarUrl?: string;
};

export default function ConsultationsPage() {
  const router = useRouter();

  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const selected = useMemo(
    () => consultants.find((c) => c.userId === selectedUserId) || null,
    [consultants, selectedUserId]
  );

  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [clientNote, setClientNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    try {
      setIsLoggedIn(!!localStorage.getItem("user"));
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      setWarning(null);
      try {
        const res = await fetch("/api/consultants", { cache: "no-store" });

        // Guard against non-JSON responses (e.g. HTML error page / empty body)
        const raw = await res.text();
        let data: unknown = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          data = null;
        }
        const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : null;

        if (!res.ok) {
          const errMsg =
            (payload?.error != null && String(payload.error)) ||
            (raw?.trim()
              ? `Failed to load consultants (HTTP ${res.status}).`
              : `Failed to load consultants (HTTP ${res.status}). Empty response.`);
          throw new Error(errMsg);
        }

        const rawList = payload?.consultants;
        const list: Consultant[] = Array.isArray(rawList) ? (rawList as Consultant[]) : [];
        if (!mounted) return;
        if (payload?.warning != null) setWarning(String(payload.warning));
        setConsultants(list);
        setSelectedUserId(list[0]?.userId ?? null);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load consultants");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function submitBooking() {
    setSuccess(null);
    setError(null);
    if (!selected) {
      setError("Please select a consultant.");
      return;
    }
    if (!scheduledAtLocal) {
      setError("Please choose a date/time.");
      return;
    }
    const ms = new Date(scheduledAtLocal).getTime();
    if (!Number.isFinite(ms)) {
      setError("Invalid date/time.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/consultations/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          consultantUserId: selected.userId,
          scheduledAtMs: ms,
          clientNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError("Please login first to schedule a consultation.");
          return;
        }
        throw new Error(data?.error || "Failed to schedule consultation");
      }
      setSuccess(
        `Scheduled with ${data?.booking?.consultantUsername || selected.displayName} on ${new Date(
          data?.booking?.scheduledAtMs || ms
        ).toLocaleString()}.`
      );
      setClientNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule consultation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Consultations</h1>
            <p className="text-xs text-slate-400">
              Choose a specialist and schedule a consultation call.
            </p>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/" className="text-slate-300 hover:text-cyan-300 text-sm">
              Home
            </Link>
            <Link href="/dashboard" className="text-slate-300 hover:text-cyan-300 text-sm">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {!isLoggedIn && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 text-sm">
            You’re viewing the public list of consultants. To schedule a call, please{" "}
            <button
              type="button"
              className="underline font-semibold"
              onClick={() => router.push("/")}
            >
              login
            </button>
            .
          </div>
        )}

        {warning && (
          <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-200 text-sm">
            {warning}
          </div>
        )}

        {loading ? (
          <div className="text-slate-300">Loading consultants…</div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 text-sm">
            {error}
          </div>
        ) : consultants.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-300 text-sm">
            No consultants have been assigned yet. Ask an admin to assign specialists in{" "}
            <span className="font-semibold">Admin → Approved</span>.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <section className="md:col-span-1 rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">
                Specialists
              </div>
              <div className="space-y-2">
                {consultants.map((c) => {
                  const active = c.userId === selectedUserId;
                  return (
                    <button
                      key={c.userId}
                      type="button"
                      onClick={() => setSelectedUserId(c.userId)}
                      className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                        active
                          ? "border-cyan-500/60 bg-cyan-500/10"
                          : "border-slate-800 bg-slate-900/30 hover:bg-slate-900/50"
                      }`}
                    >
                      <div className="font-semibold">{c.displayName}</div>
                      <div className="text-xs text-slate-400 mt-1">{c.specialty}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4 min-w-0">
                  <span
                    className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-cyan-500/40 bg-slate-800 text-sm font-bold text-slate-400 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
                    aria-hidden
                  >
                    {selected?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selected.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (selected?.displayName || "—").slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider text-slate-400">
                      Selected specialist
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {selected?.displayName || "—"}
                    </div>
                    <div className="mt-1 text-sm text-cyan-200">
                      {selected?.specialty || ""}
                    </div>
                  </div>
                </div>
              </div>

              {selected?.note ? (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="text-xs uppercase tracking-wider text-slate-400">
                    Specialist note
                  </div>
                  <div className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">
                    {selected.note}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-400">
                  No note provided for this specialist.
                </div>
              )}

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">
                    Schedule date & time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAtLocal}
                    onChange={(e) => setScheduledAtLocal(e.target.value)}
                    className="w-full px-3 py-3 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <div className="mt-1 text-xs text-slate-400">
                    Must be at least 5 minutes in the future.
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">
                    Note for the specialist (optional)
                  </label>
                  <textarea
                    value={clientNote}
                    onChange={(e) => setClientNote(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-3 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="What do you want to discuss?"
                  />
                </div>
              </div>

              {success && (
                <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-200 text-sm">
                  {success}
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={submitBooking}
                  disabled={submitting || !selected}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
                >
                  {selected?.avatarUrl ? (
                    <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-full border border-black/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selected.avatarUrl} alt="" className="h-full w-full object-cover" />
                    </span>
                  ) : null}
                  {submitting ? "Scheduling..." : "Schedule Consultation"}
                </button>
                <Link href="/dashboard" className="text-sm text-slate-300 hover:text-cyan-300">
                  View my account
                </Link>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}


