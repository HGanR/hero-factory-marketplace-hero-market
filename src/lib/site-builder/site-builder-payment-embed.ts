/**
 * PayPal payment wall injection for static HTML, preview, and handoff (mirrors widget embed patterns).
 */

import type { PaymentIntegration } from "@/lib/site-builder/payment-integration-schema";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { sanitizePaypalButtonHtml, sanitizePaypalPaymentUrl } from "@/lib/site-builder/payment-sanitize";

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function normalizeSlugForMatch(slug: string): string {
  const t = slug.trim();
  if (!t || t === "/") return "/";
  return t.startsWith("/") ? t.replace(/\/+$/, "") || "/" : `/${t.replace(/\/+$/, "")}`;
}

export function paymentAppliesToPage(schema: SiteSchemaDocumentType, pageSlug: string): boolean {
  const p = schema.metadata?.paymentIntegration;
  if (!p || p.provider !== "paypal") return false;
  if (p.placement === "page_body_end" && p.pageSlug?.trim()) {
    return normalizeSlugForMatch(pageSlug) === normalizeSlugForMatch(p.pageSlug);
  }
  return true;
}

/** Where to inject payment markup for this placement (main column vs after main). */
function splitPlacement(p: PaymentIntegration): { useMainEnd: boolean; useBodyBeforeClose: boolean } {
  if (p.placement === "global_footer") return { useMainEnd: false, useBodyBeforeClose: true };
  return { useMainEnd: true, useBodyBeforeClose: false };
}

function ctaLabel(intent: PaymentIntegration["intent"]): string {
  switch (intent) {
    case "deposit":
      return "Pay deposit";
    case "consultation":
      return "Book consultation";
    case "invoice":
      return "Pay invoice";
    case "full_payment":
    default:
      return "Complete payment";
  }
}

function buildPaymentBlock(p: PaymentIntegration): string {
  const pp = p.paypal ?? {};
  if (p.mode === "payment_link") {
    const href = pp.paymentLink ? sanitizePaypalPaymentUrl(pp.paymentLink) : null;
    if (!href) {
      return `<p class="site-builder-payment-invalid">Configure a valid HTTPS PayPal payment link in the builder.</p>`;
    }
    const label = escapeHtmlAttr(ctaLabel(p.intent));
    return `<a class="btn site-builder-payment-link" href="${escapeHtmlAttr(href)}" rel="noopener noreferrer" target="_blank" data-paypal-intent="${escapeHtmlAttr(p.intent)}">${label}</a>`;
  }
  if (p.mode === "buy_button") {
    const raw = pp.buttonHtml?.trim();
    if (!raw) {
      return `<p class="site-builder-payment-invalid">Paste your PayPal button or embed snippet in the builder.</p>`;
    }
    return `<div class="site-builder-payment-button-host">${sanitizePaypalButtonHtml(raw)}</div>`;
  }
  const env = pp.environment === "live" ? "live" : "sandbox";
  const cur = (pp.currency || "USD").toUpperCase().slice(0, 8);
  const cid = pp.clientId?.trim() ? escapeHtmlAttr(pp.clientId.trim()) : "";
  return `<section class="site-builder-paypal-sdk-placeholder" data-site-builder-paypal="checkout_sdk" data-paypal-env="${env}" data-currency="${escapeHtmlAttr(cur)}"${cid ? ` data-paypal-client-id="${cid}"` : ""}>
  <p style="margin:0 0 8px;font-size:14px;color:#94a3b8">PayPal checkout (SDK) — wire your client ID and loader in production; export includes placeholders only.</p>
  <p style="margin:0;font-size:12px;color:#64748b">Intent: ${escapeHtmlAttr(p.intent)} · Environment: ${env}</p>
</section>`;
}

export function buildPaymentIntegrationHtml(
  schema: SiteSchemaDocumentType,
  pageSlug: string,
): { insideMainEnd: string; bodyBeforeClose: string } {
  const p = schema.metadata?.paymentIntegration;
  if (!p || p.provider !== "paypal" || !paymentAppliesToPage(schema, pageSlug)) {
    return { insideMainEnd: "", bodyBeforeClose: "" };
  }

  const inner = buildPaymentBlock(p);
  const wrapped = `<aside class="site-builder-payment-wall" data-provider="paypal" data-mode="${escapeHtmlAttr(p.mode)}" data-intent="${escapeHtmlAttr(p.intent)}" data-placement="${escapeHtmlAttr(p.placement)}">${inner}</aside>`;

  const { useMainEnd, useBodyBeforeClose } = splitPlacement(p);
  return {
    insideMainEnd: useMainEnd ? wrapped : "",
    bodyBeforeClose: useBodyBeforeClose ? wrapped : "",
  };
}

/** Preview tab — append after primary preview column (home route). */
export function buildPaymentEmbedForIsolatedPreviewHtml(schema: SiteSchemaDocumentType): string {
  const { insideMainEnd, bodyBeforeClose } = buildPaymentIntegrationHtml(schema, "/");
  return `${insideMainEnd}${bodyBeforeClose}`;
}
