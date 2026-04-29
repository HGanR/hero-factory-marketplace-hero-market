"use client";

import { useEffect } from "react";

/**
 * Opt-in: append <code>?airos_debug=1</code> to <code>/ai-revenue-os</code> to log uncaught errors
 * with a clear prefix (helps separate app errors from extension noise).
 */
export function AiRevenueOsDebugListeners() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("airos_debug") !== "1") return;

    console.info("[ai-revenue-os debug] listeners active (remove ?airos_debug=1 when done)");

    const onError = (e: ErrorEvent) => {
      console.error("[ai-revenue-os debug: window.error]", {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        stack: e.error?.stack,
      });
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      console.error("[ai-revenue-os debug: unhandledrejection]", {
        reason: r,
        stack: r instanceof Error ? r.stack : undefined,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
