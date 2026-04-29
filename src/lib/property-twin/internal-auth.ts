/**
 * Reconstruction workers should set PROPERTY_TWIN_INTERNAL_SECRET and send it as
 * header `x-property-twin-internal` on job PATCH requests that transition
 * queued → running → succeeded/failed or write output payloads.
 *
 * In development, if the secret is unset, internal routes are allowed (local worker testing).
 */
export function canUsePropertyTwinInternalRoutes(req: Request): boolean {
  const secret = process.env.PROPERTY_TWIN_INTERNAL_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }
  return req.headers.get("x-property-twin-internal") === secret;
}
