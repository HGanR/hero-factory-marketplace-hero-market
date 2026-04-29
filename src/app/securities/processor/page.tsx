"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, FileText, ShieldCheck } from "lucide-react";

type Intake = {
  id: string;
  fileName: string;
  note: string;
  createdAt: string;
  status: "received" | "validated" | "rejected";
};

const KEY = "securities_processor_intake_v1";

function load(): Intake[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Intake[]) : [];
  } catch {
    return [];
  }
}

function save(rows: Intake[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export default function SecuritiesProcessorPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Intake[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  useEffect(() => setRows(load()), []);

  const onFile = (file: File | null) => {
    if (!file) return;
    const intake: Intake = {
      id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fileName: file.name,
      note: note.trim(),
      createdAt: new Date().toISOString(),
      status: "received",
    };
    const updated = [intake, ...rows];
    setRows(updated);
    save(updated);
    setNote("");
    alert("Instrument received (mock intake).");
  };

  const mark = (id: string, status: Intake["status"]) => {
    const updated = rows.map((r) => (r.id === id ? { ...r, status } : r));
    setRows(updated);
    save(updated);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-purple-300">XRPL IOU Instrument Processor</h1>
            <p className="text-slate-300 mt-1">
              Upload and process negotiable instruments as XRPL IOUs (intake workflow).
            </p>
          </div>
          <Link href="/securities" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
            ← Back to Securities
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Upload Instrument</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Notes (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-slate-950/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Instrument context, drawer/drawee, amount, dates..."
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
              <div className="flex items-center gap-2 text-slate-200 font-semibold">
                <Upload className="w-4 h-4" />
                <span>Choose file</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">PDF, PNG, JPG accepted (mock storage).</div>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => onFile(e.target.files?.[0] || null)}
                className="mt-3 block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-100"
              />
              <div className="mt-4 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-300" />
                  <span>Compliance metadata capture (coming next)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Intake</h2>
          {rows.length === 0 ? (
            <div className="text-slate-300">No intake items yet.</div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-300" />
                        <span className="break-words">{r.fileName}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{new Date(r.createdAt).toLocaleString()}</div>
                      {r.note ? <div className="text-sm text-slate-200 mt-2 whitespace-pre-wrap">{r.note}</div> : null}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs border ${pill(r.status)}`}>{r.status}</span>
                  </div>

                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button onClick={() => mark(r.id, "validated")} className="px-3 py-2 rounded-lg bg-green-500/20 text-green-200 border border-green-500/30 hover:bg-green-500/30 transition-colors">
                      Mark Validated
                    </button>
                    <button onClick={() => mark(r.id, "rejected")} className="px-3 py-2 rounded-lg bg-red-500/20 text-red-200 border border-red-500/30 hover:bg-red-500/30 transition-colors">
                      Mark Rejected
                    </button>
                    <button onClick={() => mark(r.id, "received")} className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors">
                      Back to Received
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function pill(status: Intake["status"]) {
  if (status === "validated") return "bg-green-500/20 text-green-200 border-green-500/30";
  if (status === "rejected") return "bg-red-500/20 text-red-200 border-red-500/30";
  return "bg-orange-500/20 text-orange-200 border-orange-500/30";
}


