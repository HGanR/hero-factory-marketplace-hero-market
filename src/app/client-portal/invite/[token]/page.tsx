"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function ClientPortalInvitePage() {
  const params = useParams();
  const token = typeof params?.token === "string" ? params.token : "";
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/client-portal/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not accept invite");
        return;
      }
      router.push("/client-portal");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-center text-2xl font-semibold text-slate-900">Accept invite</h1>
      <p className="mt-1 text-center text-sm text-slate-600">Create your client portal account.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <label className="block text-sm text-slate-700">
          Your name
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-700">
          Password (min. 8 characters)
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={loading || !token}
          className="w-full rounded-md bg-cyan-600 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
