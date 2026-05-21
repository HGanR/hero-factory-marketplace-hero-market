import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AdminManualPaymentConfirmBodySchema,
  ClaudeFulfillmentHandoffBodySchema,
} from "@/lib/fulfillment/fulfillment-payload-schemas";

const CLIENT_ID = "00000000-0000-4000-8000-000000000001";
const PAYMENT_ID = "00000000-0000-4000-8000-000000000099";

describe("manual payment confirmation payload", () => {
  it("accepts admin_manual confirm body with optional PayPal note", () => {
    const r = AdminManualPaymentConfirmBodySchema.safeParse({
      clientId: CLIENT_ID,
      externalRef: "PAYPAL-TXN-123",
      paypalTransactionNote: "Paid via approved PayPal link",
      amountCents: 50000,
    });
    assert.ok(r.success);
  });
});

describe("claude fulfillment handoff payload", () => {
  const valid = {
    version: "1" as const,
    client: { clientId: CLIENT_ID },
    service: { primary: "WEBSITE" as const },
    payment: { confirmationId: PAYMENT_ID },
    salesSummary: { text: "Client purchased website package." },
    requestedDeliverable: {
      type: "site_builder_package" as const,
      title: "Starter site",
    },
    acknowledgements: {
      noLegalAdvice: true as const,
      noAutoFulfillment: true as const,
      noAutoPublish: true as const,
    },
  };

  it("accepts WEBSITE handoff with acknowledgements", () => {
    assert.ok(ClaudeFulfillmentHandoffBodySchema.safeParse(valid).success);
  });

  it("accepts optional structured websiteIntake", () => {
    const r = ClaudeFulfillmentHandoffBodySchema.safeParse({
      ...valid,
      websiteIntake: {
        businessName: "Northline HVAC",
        industry: "Home services",
        desiredPages: ["Home", "Services", "Contact"],
        primaryCTA: "Request quote",
        contactInfo: { phone: "555-0101" },
        launchUrgency: "normal",
      },
    });
    assert.ok(r.success);
  });

  it("rejects non-WEBSITE primary service", () => {
    assert.equal(
      ClaudeFulfillmentHandoffBodySchema.safeParse({
        ...valid,
        service: { primary: "TRUST" },
      }).success,
      false
    );
  });

  it("rejects missing acknowledgements", () => {
    const { acknowledgements: _a, ...noAck } = valid;
    assert.equal(ClaudeFulfillmentHandoffBodySchema.safeParse(noAck).success, false);
  });
});
