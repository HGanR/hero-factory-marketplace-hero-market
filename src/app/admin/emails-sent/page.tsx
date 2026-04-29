// src/app/admin/emails-sent/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";

type EmailRecord = {
  id: string;
  recipientEmail: string;
  emailType: string;
  subject: string;
  body: string;
  status: string;
  failureReason: string | null;
  sentAt: string | null;
  createdAt: string;
};

export default function EmailsSentPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const isAdmin = localStorage.getItem("adminLoggedIn") === "true";
    if (!isAdmin) {
      router.push("/admin");
      return;
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/emails-sent");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load emails");
        if (active) setEmails(Array.isArray(data?.emails) ? data.emails : []);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load emails");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 text-white">
      <div className="px-6 py-5 border-b border-cyan-500/30 flex items-center justify-between">
        <div>
          <div className="text-xl font-bold flex items-center gap-2">
            <Mail className="h-5 w-5 text-cyan-300" />
            EMAILS SENT
          </div>
          <div className="text-xs text-slate-300 mt-1">
            Outbound emails tracked by the notification service (marketplace registrations, password resets, etc.)
          </div>
        </div>
        <Link
          href="/admin"
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 transition-colors text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </Link>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="text-slate-300">Loading…</div>
        ) : error ? (
          <div className="text-red-400">{error}</div>
        ) : emails.length === 0 ? (
          <div className="text-slate-300">No emails sent yet.</div>
        ) : (
          <div className="bg-black/50 rounded-lg border border-cyan-500/30 overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">Sent</th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">To</th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">Type</th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">Subject</th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.id} className="border-t border-slate-700">
                    <td className="px-4 py-3 text-sm text-slate-200">
                      {(e.sentAt ? new Date(e.sentAt) : new Date(e.createdAt)).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-200">{e.recipientEmail}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{e.emailType}</td>
                    <td className="px-4 py-3 text-sm text-slate-200 max-w-[280px] truncate" title={e.subject}>
                      {e.subject}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          e.status === "SENT"
                            ? "bg-green-500/30 text-green-300"
                            : e.status === "FAILED" || e.status === "BOUNCED"
                              ? "bg-red-500/30 text-red-300"
                              : "bg-amber-500/30 text-amber-300"
                        }`}
                      >
                        {e.status}
                      </span>
                      {e.failureReason && (
                        <div className="text-xs text-red-400 mt-1 truncate max-w-[200px]" title={e.failureReason}>
                          {e.failureReason}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
