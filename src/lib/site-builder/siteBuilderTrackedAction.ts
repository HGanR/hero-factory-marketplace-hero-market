/**
 * Shared try/catch wrapper for site-builder analytics: one success + one failure event,
 * privacy-safe props only, rethrows after failure tracking (callers keep existing UX).
 */

import { deriveSiteBuilderFailureFields } from "./siteBuilderFailureCategory";
import {
  trackSiteBuilderEvent,
  type SiteBuilderAnalyticsEvent,
  type SiteBuilderAnalyticsProps,
} from "./siteBuilderAnalytics";

export async function runSiteBuilderTrackedAction<T>(options: {
  successEvent: SiteBuilderAnalyticsEvent;
  failureEvent: SiteBuilderAnalyticsEvent;
  baseProps: SiteBuilderAnalyticsProps;
  action: () => Promise<T>;
  /** Extra safe fields merged into the success payload only */
  mapSuccessProps?: (result: T) => SiteBuilderAnalyticsProps;
}): Promise<T> {
  try {
    const result = await options.action();
    trackSiteBuilderEvent(options.successEvent, {
      ...options.baseProps,
      ...(options.mapSuccessProps ? options.mapSuccessProps(result) : {}),
    });
    return result;
  } catch (err) {
    trackSiteBuilderEvent(options.failureEvent, {
      ...options.baseProps,
      ...deriveSiteBuilderFailureFields(err),
    });
    throw err;
  }
}
