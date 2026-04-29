"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function StartClient() {
  const router = useRouter();
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!consented) {
      setError("Please acknowledge to continue");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/challenge/spring-2026/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ consented: true }),
      });
      let data: { error?: string; submissionId?: string };
      try {
        data = await res.json();
      } catch {
        data = { error: res.status === 401 ? "Please log in to continue" : "Unable to start. Please try again." };
      }
      if (!res.ok) {
        throw new Error(data.error || "Failed to start");
      }
      const { submissionId } = data;
      if (submissionId) {
        router.push(`/challenge/spring-entity-build/${submissionId}`);
      } else {
        throw new Error("No submission ID returned");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
          className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-cyan-500"
        />
        <span className="text-slate-300">
          I acknowledge this is a skill-based challenge and agree to participate.
        </span>
      </label>
      {error && (
        <div className="space-y-1">
          <p className="text-red-400 text-sm">{error}</p>
          {error.toLowerCase().includes("log in") && (
            <Link href="/" className="text-sm text-cyan-400 hover:text-cyan-300 underline">
              Go to home page to sign in
            </Link>
          )}
        </div>
      )}
      <button
        onClick={handleStart}
        disabled={loading}
        className="rounded-lg px-6 py-3 font-semibold bg-cyan-500/20 border border-cyan-500 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50"
      >
        {loading ? "Starting…" : "Start Challenge"}
      </button>
    </div>
  );
}
