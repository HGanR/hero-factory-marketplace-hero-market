import { z } from "zod";

/** ~1.2MB binary in base64 is ~1.6M chars; keep headroom under LONGTEXT. Must match `/clients/new` LOGO_MAX_BYTES. */
export const MAX_BUSINESS_LOGO_DATA_URL_CHARS = 2_500_000;

export const CLIENT_SERVICE_OPTIONS = [
  "NFT LINE",
  "TRUST",
  "ACCOUNTING",
  "3D WORLD",
  "WEBSITE",
  "SEALS",
  "OS REVENUE",
  "EMAIL MARKETING",
  "AI AGENT",
  "FINANCIAL READINESS",
  "APP DEV",
  "GRANT WRITING",
  "FAMILY OFFICE",
  "LLC",
] as const;

const ClientServiceOptionSchema = z.enum(CLIENT_SERVICE_OPTIONS);

export function formatZodError(err: unknown): string {
  if (err instanceof z.ZodError) {
    const flat = err.flatten();
    const fieldMsgs = Object.entries(flat.fieldErrors)
      .map(([k, v]) => (Array.isArray(v) && v[0] ? `${k}: ${v[0]}` : null))
      .filter(Boolean) as string[];
    if (fieldMsgs.length) return fieldMsgs.join("; ");
    const form = flat.formErrors?.filter(Boolean);
    if (form?.length) return form.join("; ");
  }
  return err instanceof Error ? err.message : "Invalid body";
}

export function normalizeIsoCountry2(
  raw: string | null | undefined,
): { ok: true; code: string } | { ok: false; message: string } {
  const s0 = (raw ?? "").trim().toUpperCase();
  if (!s0) return { ok: true, code: "US" };
  if (/^[A-Z]{2}$/.test(s0)) return { ok: true, code: s0 };

  const compact = s0.replace(/[^A-Z]/g, "");
  const map: Record<string, string> = {
    USA: "US",
    UNITEDSTATES: "US",
    UNITEDSTATESOFAMERICA: "US",
    AMERICA: "US",
    UK: "GB",
    UNITEDKINGDOM: "GB",
    GREATBRITAIN: "GB",
    ENGLAND: "GB",
    SCOTLAND: "GB",
    WALES: "GB",
    CANADA: "CA",
    MEXICO: "MX",
    AUSTRALIA: "AU",
    NEWZEALAND: "NZ",
    GERMANY: "DE",
    FRANCE: "FR",
    SPAIN: "ES",
    ITALY: "IT",
    BRAZIL: "BR",
    INDIA: "IN",
    CHINA: "CN",
    JAPAN: "JP",
  };
  if (map[compact]) return { ok: true, code: map[compact] };

  return {
    ok: false,
    message: `Unknown country "${String(raw).trim()}". Use a 2-letter ISO code (e.g. US) or a common English name (e.g. United States).`,
  };
}

export const CreateClientSchema = z.object({
  first_name: z.string().min(1),
  middle_name: z.string().min(1).optional().nullable(),
  last_name: z.string().min(1),
  suffix: z.string().min(1).optional().nullable(),
  date_of_birth: z.string().min(4).optional().nullable(),
  email: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().email()),
  /** Trim; empty or fewer than 3 chars → null (matches `/clients/new`: short partial dial is treated as blank). */
  phone: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null) return null;
      const t = String(v).trim();
      if (t === "" || t.length < 3) return null;
      return t;
    }),
  entity_name: z.string().max(500).optional().nullable(),
  business_logo_data_url: z.string().max(MAX_BUSINESS_LOGO_DATA_URL_CHARS).optional().nullable(),
  requested_services: z.array(ClientServiceOptionSchema).optional().default([]),
  address: z.object({
    line1: z.string().min(1),
    line2: z.string().min(1).optional().nullable(),
    city: z.string().min(1),
    state: z.string().min(1),
    postal_code: z.string().min(1),
    country: z.union([z.string().max(80), z.null()]).optional(),
  }),
});

export type ParsedCreateClientBody = z.infer<typeof CreateClientSchema>;

export type ValidatedCreateClient = ParsedCreateClientBody & {
  countryCode: string;
  logoDataUrlTrimmed: string;
};

/**
 * Parse + normalize POST /api/clients JSON (no DB).
 * Used by the route handler and unit tests.
 */
export function validateCreateClientPayload(
  raw: unknown,
): { ok: true; value: ValidatedCreateClient } | { ok: false; status: 400; error: string } {
  let body: ParsedCreateClientBody;
  try {
    body = CreateClientSchema.parse(raw);
  } catch (err) {
    return { ok: false, status: 400, error: formatZodError(err) };
  }

  const countryNorm = normalizeIsoCountry2(body.address.country ?? null);
  if (!countryNorm.ok) {
    return { ok: false, status: 400, error: countryNorm.message };
  }

  const logoIn =
    typeof body.business_logo_data_url === "string"
      ? body.business_logo_data_url.trim().slice(0, MAX_BUSINESS_LOGO_DATA_URL_CHARS)
      : "";

  return {
    ok: true,
    value: {
      ...body,
      countryCode: countryNorm.code,
      logoDataUrlTrimmed: logoIn,
    },
  };
}

/** PATCH `/api/clients/:id` logo body — same max length as POST. */
export const PatchClientLogoBodySchema = z.object({
  business_logo_data_url: z.union([
    z.string().max(MAX_BUSINESS_LOGO_DATA_URL_CHARS),
    z.null(),
  ]),
});

export type ParsedPatchClientLogoBody = z.infer<typeof PatchClientLogoBodySchema>;

export function validatePatchClientLogoPayload(
  raw: unknown,
): { ok: true; value: ParsedPatchClientLogoBody } | { ok: false; status: 400; error: string } {
  const r = PatchClientLogoBodySchema.safeParse(raw);
  if (!r.success) return { ok: false, status: 400, error: formatZodError(r.error) };
  return { ok: true, value: r.data };
}

/** PATCH `/api/clients/:id` — logo and/or requested services (multi-select catalog). */
export const PatchClientBodySchema = z
  .object({
    business_logo_data_url: z
      .union([z.string().max(MAX_BUSINESS_LOGO_DATA_URL_CHARS), z.null()])
      .optional(),
    requested_services: z.array(ClientServiceOptionSchema).optional(),
  })
  .refine(
    (d) => d.business_logo_data_url !== undefined || d.requested_services !== undefined,
    { message: "Provide business_logo_data_url and/or requested_services" },
  );

export type ParsedPatchClientBody = z.infer<typeof PatchClientBodySchema>;

export function validatePatchClientBody(
  raw: unknown,
): { ok: true; value: ParsedPatchClientBody } | { ok: false; status: 400; error: string } {
  const r = PatchClientBodySchema.safeParse(raw);
  if (!r.success) return { ok: false, status: 400, error: formatZodError(r.error) };
  return { ok: true, value: r.data };
}
