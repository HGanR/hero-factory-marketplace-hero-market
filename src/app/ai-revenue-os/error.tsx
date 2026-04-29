"use client";

import { useEffect } from "react";

/**
 * Catches runtime errors for this route segment (including client components below /ai-revenue-os).
 * Check the browser console for the full stack; the UI shows a safe subset in production.
 */
export default function AiRevenueOsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const err = error;
    console.error("[ai-revenue-os / error.tsx] message:", err.message);
    console.error("[ai-revenue-os / error.tsx] stack:\n", err.stack);
    if (err.digest) console.error("[ai-revenue-os / error.tsx] digest:", err.digest);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8 gap-4">
      <h1 className="text-xl font-semibold text-cyan-400">AI Revenue OS — something went wrong</h1>
      <p className="text-slate-400 text-sm text-center max-w-lg">
        Open DevTools → Console and look for{" "}
        <code className="text-cyan-300">[ai-revenue-os / error.tsx]</code> for the full{" "}
        <code className="text-cyan-300">stack</code>. Add{" "}
        <code className="text-cyan-300">?airos_debug=1</code> to the URL, reload, and reproduce to capture extra
        window errors.
      </p>
      {process.env.NODE_ENV === "development" && (
        <pre className="text-xs text-red-300 max-w-2xl overflow-auto bg-black/50 p-4 rounded-lg border border-red-900/50">
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
      )}
      {error.digest ? (
        <p className="text-xs text-slate-500 font-mono">Digest: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
      >
        Try again
      </button>
    </div>
  );
}
