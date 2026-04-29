#!/usr/bin/env bash
#
# Optional curl helper for Site Builder → Widget → Client Hub staging QA.
# Copy to a secure location, fill placeholders, run: bash site-builder-client-flow.curl.sh
#
# Usage:
#   export BASE_URL="https://staging.example"
#   export AUTH_COOKIE='auth-token=YOUR_JWT; Path=/; Secure'
#   export CLIENT_ID="uuid"
#   export SITE_ID="uuid"
#   export AGENT_ID="uuid"
#   export WIDGET_KEY="your-widget-key"
#   export VERSION_ID="uuid"   # optional, for attach body
#   export WIDGET_ORIGIN="https://your-allowlisted-site.example"
#

set -euo pipefail

: "${BASE_URL:?Set BASE_URL (no trailing slash)}"
: "${AUTH_COOKIE:?Set AUTH_COOKIE (full Cookie header value, e.g. auth-token=...)}"
: "${CLIENT_ID:?Set CLIENT_ID}"
: "${SITE_ID:?Set SITE_ID}"
: "${WIDGET_KEY:?Set WIDGET_KEY}"

hdr_auth=(-H "Cookie: ${AUTH_COOKIE}")

echo "=== GET client summary ==="
curl -sS -w "\nHTTP %{http_code}\n" "${hdr_auth[@]}" \
  "${BASE_URL}/api/revenue-os/clients/${CLIENT_ID}/summary" | tail -5

echo "=== GET site + current version ==="
curl -sS -w "\nHTTP %{http_code}\n" "${hdr_auth[@]}" \
  "${BASE_URL}/api/site-builder/sites/${SITE_ID}" | tail -8

echo "=== GET site versions ==="
curl -sS -w "\nHTTP %{http_code}\n" "${hdr_auth[@]}" \
  "${BASE_URL}/api/site-builder/sites/${SITE_ID}/versions" | tail -8

echo "=== GET agency-widget bindings ==="
curl -sS -w "\nHTTP %{http_code}\n" "${hdr_auth[@]}" \
  "${BASE_URL}/api/site-builder/sites/${SITE_ID}/agency-widget" | tail -12

if [[ -n "${AGENT_ID:-}" ]]; then
  echo "=== POST agency-widget attach (requires AGENT_ID) ==="
  apply="${APPLY_TO_SCHEMA:-false}"
  if [[ -n "${VERSION_ID:-}" ]]; then
    body="{\"agentId\":\"${AGENT_ID}\",\"clientId\":\"${CLIENT_ID}\",\"versionId\":\"${VERSION_ID}\",\"applyToSchema\":${apply}}"
  else
    body="{\"agentId\":\"${AGENT_ID}\",\"clientId\":\"${CLIENT_ID}\",\"applyToSchema\":${apply}}"
  fi
  curl -sS -w "\nHTTP %{http_code}\n" "${hdr_auth[@]}" \
    -H "Content-Type: application/json" \
    -X POST \
    -d "$body" \
    "${BASE_URL}/api/site-builder/sites/${SITE_ID}/agency-widget" | tail -15
fi

echo "=== GET widget config (public; Origin matters if allowedDomains set) ==="
origin="${WIDGET_ORIGIN:-https://example.com}"
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Origin: ${origin}" \
  "${BASE_URL}/api/widget/${WIDGET_KEY}/config" | tail -12

if [[ "${POST_WIDGET_MESSAGE:-0}" == "1" ]]; then
  echo "=== POST widget message (set POST_WIDGET_MESSAGE=1; writes DB) ==="
  sid="${WIDGET_SESSION_ID:-qa-curl-session-001}"
  msg_body="{\"message\":\"QA curl message\",\"sessionId\":\"${sid}\",\"page\":{\"url\":\"https://example.com/qa\",\"title\":\"curl\"}}"
  curl -sS -w "\nHTTP %{http_code}\n" \
    -H "Origin: ${origin}" \
    -H "Content-Type: application/json" \
    -X POST \
    -d "$msg_body" \
    "${BASE_URL}/api/widget/${WIDGET_KEY}/message" | tail -12
fi

echo "=== GET client inbox ==="
curl -sS -w "\nHTTP %{http_code}\n" "${hdr_auth[@]}" \
  "${BASE_URL}/api/revenue-os/clients/${CLIENT_ID}/inbox" | tail -10

echo "=== GET client activity ==="
curl -sS -w "\nHTTP %{http_code}\n" "${hdr_auth[@]}" \
  "${BASE_URL}/api/revenue-os/clients/${CLIENT_ID}/activity" | tail -10

echo "=== GET client analytics ==="
curl -sS -w "\nHTTP %{http_code}\n" "${hdr_auth[@]}" \
  "${BASE_URL}/api/revenue-os/clients/${CLIENT_ID}/analytics" | tail -10

echo "Done."
