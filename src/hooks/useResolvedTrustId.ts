import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchTrustRecordsMeActive } from "@/lib/trust-records-me-client";

function isPlausibleId(v: string | null | undefined) {
  if (!v) return false;
  const s = String(v).trim();
  if (!s || s === "undefined" || s === "null") return false;
  return true;
}

export function useResolvedTrustId(paramsTrustId?: string) {
  const router = useRouter();
  const [resolved, setResolved] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (isPlausibleId(paramsTrustId)) {
        setResolved(paramsTrustId!);
        setState("ready");
        return;
      }

      try {
        const snap = await fetchTrustRecordsMeActive();

        if (cancelled) return;

        const tid = snap?.trustId ?? null;

        if (tid) {
          router.replace(`/trusts/${encodeURIComponent(tid)}/issue-security`);
          return;
        }

        setState("missing");
      } catch {
        if (!cancelled) setState("missing");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paramsTrustId, router]);

  return { trustId: resolved, state };
}
