"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { landingCtaMetadata, LANDING_HOME_SITE_EVENTS } from "@/lib/analytics/landing-site-event-metadata";
import { trackSiteEvent } from "@/lib/analytics/site-analytics-client";

/**
 * Landing home: first paint `page_view` for `/` with current UTM/referrer attribution.
 */
export function LandingSiteAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname !== "/") return;
    void trackSiteEvent({
      path: "/",
      eventType: "page_view",
      metadata: {
        ...landingCtaMetadata({
          eventName: LANDING_HOME_SITE_EVENTS.PAGE_VIEW,
          source: "landing_home",
          route: "/",
          label: "Landing home first paint",
        }),
      },
    });
  }, [pathname, searchParams]);

  return null;
}
