"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackSiteEvent } from "@/lib/analytics/site-analytics-client";

function hasMarketplaceSessionCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("auth-token=") || document.cookie.includes("admin-token=");
}

/**
 * Tracks authenticated marketplace page views for Executive Analytics (approved-user activity).
 */
export function MarketplaceSessionAnalytics() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === lastPathRef.current) return;
    if (!hasMarketplaceSessionCookie()) return;
    lastPathRef.current = pathname;
    void trackSiteEvent({
      path: pathname,
      eventType: "page_view",
      metadata: {
        eventName: "marketplace.session.page_view",
        source: "authenticated_session",
        route: pathname,
        label: "Authenticated page view",
      },
    });
  }, [pathname]);

  return null;
}
