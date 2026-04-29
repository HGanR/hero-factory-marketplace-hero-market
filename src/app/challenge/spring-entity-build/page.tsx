"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StartClient from "./StartClient";

export default function SpringEntityBuildPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user") || localStorage.getItem("adminLoggedIn");
      setIsLoggedIn(!!stored);
    } catch {
      setIsLoggedIn(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!isChecking && !isLoggedIn) {
      router.push("/");
    }
  }, [isChecking, isLoggedIn, router]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Spring 2026 Entity Build</h1>
          <Link
            href="/dashboard"
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="prose prose-invert max-w-none mb-8">
          <h2 className="text-2xl font-bold mb-4">Skill-Based Challenge</h2>
          <p className="text-slate-300 mb-4">
            This is a skill-based challenge to demonstrate entity formation knowledge. It is simulation-only: no real EIN filing, bank accounts, or legal filings are involved.
          </p>
          <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
            <li>5 phases covering entity type, ownership, documents, compliance, and governance</li>
            <li>Deterministic scoring based on your answers</li>
            <li>Platform-only credits for qualifying scores (score ≥ 85). Credits are non-transferable and have no cash value.</li>
          </ul>
          <p className="text-slate-400 text-sm">
            By starting, you acknowledge this is a skill-based challenge, not a lottery or sweepstakes.
          </p>
        </div>

        <StartClient />
      </main>
    </div>
  );
}
