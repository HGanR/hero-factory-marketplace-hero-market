/** @jest-environment node */
import { PaymentIntegrationSchema } from "@/lib/site-builder/payment-integration-schema";
import { sanitizePaypalButtonHtml, sanitizePaypalPaymentUrl } from "@/lib/site-builder/payment-sanitize";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { buildPaymentEmbedForIsolatedPreviewHtml } from "@/lib/site-builder/site-builder-payment-embed";
import { generateStaticBundle } from "@/lib/site-builder/static-generator";
import { buildDeploymentReadme } from "@/lib/site-builder/project-export/deployment-readme";
import { buildDeploymentProjectFromSchema } from "@/lib/site-builder/project-export/orchestrate";

function baseDoc() {
  return SiteSchemaDocument.parse({
    pages: [{ slug: "/", blocks: [{ type: "text", content: { body: "Hello" } }] }],
    metadata: {
      title: "T",
      governance: {},
      builderRefinement: {
        deploymentTarget: "static",
        routingMode: "single_page",
        assetStrategy: "local_bundle",
      },
    },
  });
}

describe("payment integration", () => {
  it("parses optional metadata.paymentIntegration and rejects unknown providers", () => {
    const ok = baseDoc();
    ok.metadata = {
      ...ok.metadata,
      paymentIntegration: {
        provider: "paypal",
        mode: "payment_link",
        intent: "deposit",
        placement: "cta_section",
        paypal: { paymentLink: "https://www.paypal.com/ncp/payment/ABC" },
      },
    };
    expect(() => SiteSchemaDocument.parse(ok)).not.toThrow();

    const bad = baseDoc();
    (bad.metadata as Record<string, unknown>).paymentIntegration = { provider: "stripe" };
    expect(() => SiteSchemaDocument.parse(bad)).toThrow();
  });

  it("embeds sanitized payment link HTML in static export and preview helpers", () => {
    const doc = baseDoc();
    doc.metadata = {
      ...doc.metadata,
      paymentIntegration: {
        provider: "paypal",
        mode: "payment_link",
        intent: "full_payment",
        placement: "cta_section",
        paypal: { paymentLink: "https://paypal.me/testuser" },
      },
    };
    const { files } = generateStaticBundle(doc);
    const index = files.find((f) => f.path === "index.html");
    expect(index?.content).toMatch(/site-builder-payment-wall/);
    expect(index?.content).toMatch(/paypal\.me\/testuser/);
    expect(index?.content).not.toMatch(/javascript:/);

    const prev = buildPaymentEmbedForIsolatedPreviewHtml(doc);
    expect(prev).toMatch(/site-builder-payment-link/);
  });

  it("places global_footer after main, not inside main", () => {
    const doc = baseDoc();
    doc.metadata = {
      ...doc.metadata,
      paymentIntegration: {
        provider: "paypal",
        mode: "payment_link",
        intent: "invoice",
        placement: "global_footer",
        paypal: { paymentLink: "https://www.paypal.com/ncp/payment/X" },
      },
    };
    const html = generateStaticBundle(doc).files.find((f) => f.path === "index.html")?.content ?? "";
    const mainClose = html.indexOf("</main>");
    const wall = html.indexOf("site-builder-payment-wall");
    expect(mainClose).toBeGreaterThan(0);
    expect(wall).toBeGreaterThan(mainClose);
  });

  it("respects page_slug for page_body_end", () => {
    const doc = SiteSchemaDocument.parse({
      pages: [
        { slug: "/", blocks: [{ type: "text", content: { body: "H" } }] },
        { slug: "/offer", blocks: [{ type: "text", content: { body: "O" } }] },
      ],
      metadata: {
        title: "T",
        governance: {},
        paymentIntegration: {
          provider: "paypal",
          mode: "payment_link",
          intent: "full_payment",
          placement: "page_body_end",
          pageSlug: "/offer",
          paypal: { paymentLink: "https://www.paypal.com/cgi-bin/webscr" },
        },
      },
    });
    const home = generateStaticBundle(doc).files.find((f) => f.path === "index.html")?.content ?? "";
    const offer = generateStaticBundle(doc).files.find((f) => f.path === "offer.html")?.content ?? "";
    expect(home).not.toMatch(/site-builder-payment-wall/);
    expect(offer).toMatch(/site-builder-payment-wall/);
  });

  it("sanitizes button HTML and keeps PayPal script src", () => {
    const raw = `<script src="https://www.paypal.com/sdk/js?client-id=x"></script><a onclick="alert(1)" href="#">x</a>`;
    const s = sanitizePaypalButtonHtml(raw);
    expect(s).not.toMatch(/onclick/);
    expect(s).toMatch(/paypal\.com\/sdk/);
  });

  it("payment URL sanitizer only allows PayPal hosts", () => {
    expect(sanitizePaypalPaymentUrl("https://evil.com/phish")).toBeNull();
    expect(sanitizePaypalPaymentUrl("https://www.paypal.com/pay/foo")).toMatch(/^https:\/\/www\.paypal\.com\//);
  });

  it("README and export include payment tokens without raw URLs", async () => {
    const doc = baseDoc();
    doc.metadata = {
      ...doc.metadata,
      paymentIntegration: {
        provider: "paypal",
        mode: "buy_button",
        intent: "consultation",
        placement: "cta_section",
        paypal: { buttonHtml: "<form action='https://www.paypal.com/cgi-bin/webscr'></form>" },
      },
    };
    const readme = buildDeploymentReadme(
      { target: "static", routingMode: "single_page", assetStrategy: "local_bundle" },
      doc,
    );
    expect(readme).toMatch(/PayPal/i);
    expect(readme).not.toMatch(/cgi-bin/);

    const files = await buildDeploymentProjectFromSchema(doc);
    const tokens = files.find((f) => f.path === "site.tokens.json")?.content ?? "";
    expect(tokens).toMatch(/"payment"/);
    expect(tokens).toMatch(/paypal/);
    expect(tokens).not.toMatch(/cgi-bin/);
  });

  it("sites without payment still export", () => {
    const doc = baseDoc();
    const { files } = generateStaticBundle(doc);
    expect(files.some((f) => f.path === "index.html")).toBe(true);
    expect(PaymentIntegrationSchema.safeParse((doc.metadata as { paymentIntegration?: unknown }).paymentIntegration).success).toBe(
      false,
    );
  });
});
