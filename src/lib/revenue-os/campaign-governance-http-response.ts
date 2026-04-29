/**
 * Stable JSON error shapes for Revenue OS campaign governance HTTP routes (Part 29).
 * Use these instead of ad hoc `{ error: "Unauthorized" }` strings on governance surfaces.
 */

import { NextResponse } from "next/server";

export const GOVERNANCE_HTTP_ERROR = {
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NO_CHANGES: "NO_CHANGES",
  FORBIDDEN: "FORBIDDEN",
  FORBIDDEN_CAMPAIGN_SETTINGS: "FORBIDDEN_CAMPAIGN_SETTINGS",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export function governanceUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: GOVERNANCE_HTTP_ERROR.UNAUTHORIZED, message: "Authentication required." },
    { status: 401 }
  );
}

export function governanceNotFoundResponse(message = "Campaign not found."): NextResponse {
  return NextResponse.json({ error: GOVERNANCE_HTTP_ERROR.NOT_FOUND, message }, { status: 404 });
}

export function governanceBadRequestResponse(
  message: string,
  code: typeof GOVERNANCE_HTTP_ERROR.BAD_REQUEST | typeof GOVERNANCE_HTTP_ERROR.NO_CHANGES = GOVERNANCE_HTTP_ERROR.BAD_REQUEST
): NextResponse {
  return NextResponse.json({ error: code, message }, { status: 400 });
}

export function governanceValidationErrorResponse(
  message: string,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      error: GOVERNANCE_HTTP_ERROR.VALIDATION_ERROR,
      message,
      ...(details ? { details } : {}),
    },
    { status: 400 }
  );
}

export function governanceForbiddenCampaignSettingsResponse(): NextResponse {
  return NextResponse.json(
    {
      error: GOVERNANCE_HTTP_ERROR.FORBIDDEN_CAMPAIGN_SETTINGS,
      message: "Only the campaign owner or an admin can change these settings.",
    },
    { status: 403 }
  );
}

export function governanceInternalErrorResponse(): NextResponse {
  return NextResponse.json(
    {
      error: GOVERNANCE_HTTP_ERROR.INTERNAL_ERROR,
      message: "An unexpected error occurred.",
    },
    { status: 500 }
  );
}
