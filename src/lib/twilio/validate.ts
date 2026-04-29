import { createHmac } from "crypto";

/**
 * Validate Twilio webhook signature.
 * Set TWILIO_AUTH_TOKEN in env. If not set, skips validation (dev mode).
 * See: https://www.twilio.com/docs/usage/security#validating-requests
 */
export function validateTwilioRequest(
  authToken: string | undefined,
  signature: string | undefined,
  url: string,
  params: Record<string, string>
): boolean {
  if (!authToken) return true; // Skip validation when token not configured (dev)
  if (!signature) return false;

  const data = url + Object.keys(params)
    .sort()
    .map((k) => k + params[k])
    .join("");

  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  return signature === expected;
}

/** Build params from FormData for Twilio validation */
export function formDataToParams(formData: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  formData.forEach((v, k) => {
    params[k] = typeof v === "string" ? v : (v instanceof File ? v.name : String(v));
  });
  return params;
}
