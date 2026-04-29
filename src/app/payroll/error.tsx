"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PayrollError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Payroll error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-bold text-red-400">Something went wrong</h1>
        <p className="text-sm text-slate-400">{error?.message ?? "A client-side error occurred."}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium hover:bg-cyan-500"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Go home
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
