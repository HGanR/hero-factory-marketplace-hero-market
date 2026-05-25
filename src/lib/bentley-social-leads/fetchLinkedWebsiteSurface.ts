import type { WebsiteSurface } from "@/lib/bentley-social-leads/types";

function emptySurface(url: string): WebsiteSurface {
  return {
    url,
    ok: false,
    hasEmailCaptureHint: false,
    hasBookingHint: false,
    hasReviewsHint: false,
    clearCtaPresent: false,
    bookingPathPresent: false,
    contactMethodSummary: "",
    reviewSignalPresent: false,
    leadCapturePresent: false,
    notes: ["Website fetch not configured for this surface — analysis uses social inputs only."],
  };
}

/** Bounded public fetch for a single URL; safe when URL missing or fetch fails. */
export async function fetchLinkedWebsiteSurface(url: string | null | undefined): Promise<WebsiteSurface> {
  const u = (url ?? "").trim();
  if (!u) return emptySurface("");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(u, { method: "GET", redirect: "follow", signal: ctrl.signal }).finally(() =>
      clearTimeout(t)
    );
    if (!res.ok) return { ...emptySurface(u), notes: [`HTTP ${res.status}`] };
    const html = (await res.text()).slice(0, 200_000).toLowerCase();
    const hasBooking = /calendly|book|schedule|appointment|reserve/i.test(html);
    const hasEmail = /newsletter|subscribe|email/i.test(html);
    const clearCta = /contact|get quote|call now|book a call/i.test(html);
    return {
      url: u,
      ok: true,
      title: undefined,
      description: undefined,
      hasEmailCaptureHint: hasEmail,
      hasBookingHint: hasBooking,
      hasReviewsHint: /review|testimonial|stars/i.test(html),
      clearCtaPresent: clearCta,
      bookingPathPresent: hasBooking,
      contactMethodSummary: hasEmail || clearCta ? "contact hints detected" : "",
      reviewSignalPresent: /review|testimonial/i.test(html),
      leadCapturePresent: hasEmail || /contact form|get in touch/i.test(html),
      notes: [],
    };
  } catch {
    return emptySurface(u);
  }
}
