import { mobileShell } from "@/lib/mobile/shell";
export const dynamic = "force-dynamic";
export function GET() {
  if (process.env.SMART_TRUST_MOBILE_ENABLED !== "true") return new Response("Mobile preview is not enabled.", { status: 404 });
  return new Response(mobileShell, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  }});
}
