"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BENTLEY_SCOPE_DEFAULT_CLIENT,
  setBentleyStorageScope,
} from "@/lib/revenue-os/bentley-storage-scope";
import {
  loadSmartTrustPlatformBinding,
  SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT,
} from "@/lib/smart-trust-platform-binding";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

/**
 * Aligns Bentley sessionStorage namespacing on `/ai-revenue-os`:
 * - `?clientId=` in the URL wins (deep links)
 * - otherwise uses the same workspace / client binding as the main dashboard (`WorkspaceSelector`)
 * Must render under `<Suspense>` because `useSearchParams` may suspend.
 */
export function BentleyAiRevenueOsScopeSync({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const clientIdFromUrl = searchParams?.get("clientId")?.trim() || "";

  const [bindingTick, setBindingTick] = useState(0);
  useEffect(() => {
    const onBinding = () => setBindingTick((t) => t + 1);
    window.addEventListener(SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT, onBinding);
    return () => window.removeEventListener(SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT, onBinding);
  }, []);

  useEffect(() => {
    const cid =
      clientIdFromUrl ||
      coerceTrimmedString(loadSmartTrustPlatformBinding().clientId) ||
      BENTLEY_SCOPE_DEFAULT_CLIENT;
    setBentleyStorageScope({ userId, clientId: cid });
  }, [userId, clientIdFromUrl, bindingTick]);

  return null;
}
