import { z } from "zod";

/** Consultant-configured PayPal Business surface — hosted links/buttons first; SDK reserved for later wiring. */
export const PaymentIntegrationSchema = z.object({
  provider: z.literal("paypal"),
  mode: z.enum(["payment_link", "buy_button", "checkout_sdk"]),
  intent: z.enum(["full_payment", "deposit", "consultation", "invoice"]),
  placement: z.enum(["cta_section", "global_footer", "page_body_end"]),
  /** When placement is `page_body_end`, limit to this route (e.g. `/offer`). */
  pageSlug: z.string().max(200).optional(),
  paypal: z
    .object({
      paymentLink: z.string().max(4000).optional(),
      buttonHtml: z.string().max(50000).optional(),
      clientId: z.string().max(200).optional(),
      environment: z.enum(["sandbox", "live"]).optional(),
      currency: z.string().max(8).optional(),
    })
    .optional(),
});

export type PaymentIntegration = z.infer<typeof PaymentIntegrationSchema>;
