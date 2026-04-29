"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const defaultClient = sp.get("client") ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clientId, setClientId] = useState(defaultClient);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/client-portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(clientId.trim() ? { clientId: clientId.trim() } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Sign in failed");
        return;
      }
      router.push("/client-portal");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <label className="block text-sm text-slate-700">
        Email
        <input
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block text-sm text-slate-700">
        Password
        <input
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label className="block text-sm text-slate-700">
        Client account ID (if you were asked)
        <input
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"
          type="text"
          placeholder="Optional UUID from your host"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-cyan-600 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
