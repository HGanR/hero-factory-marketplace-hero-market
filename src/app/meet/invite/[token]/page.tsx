"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * /meet/invite/[token] — Resolve invite token and redirect to room
 */
export default function MeetInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params?.token === "string" ? params.token : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("Invalid invite");
      return;
    }
    fetch(`/api/invites/${token}`, { credentials: "include" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.ok && data?.ok && data?.roomId) {
          const base = typeof window !== "undefined" ? window.location.origin : "";
          const url = `${base}/meet?room=${encodeURIComponent(data.roomId)}${data.roomName ? `&name=${encodeURIComponent(data.roomName)}` : ""}`;
          window.location.href = url;
          return;
        }
        setError(data?.error ?? (r.status === 404 ? "Invite not found" : r.status === 410 ? "Invite expired or no longer valid" : "Failed to load invite"));
      })
      .catch(() => setError("Failed to load invite"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4" />
          <p className="text-cyan-400">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-red-400 max-w-md px-4">
          <p className="mb-4 text-lg">{error}</p>
          <button
            onClick={() => router.push("/meet")}
            className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 text-white"
          >
            Go to Meetings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4" />
        <p className="text-cyan-400">Redirecting to meeting...</p>
      </div>
    </div>
  );
}
