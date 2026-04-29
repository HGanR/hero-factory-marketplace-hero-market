/**
 * Platform API Error Responses
 */

import { NextResponse } from "next/server";

export function apiError(
  message: string,
  status: number = 400,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code: code ?? (status === 401 ? "unauthorized" : status === 403 ? "forbidden" : "bad_request"),
    },
    { status }
  );
}

export function unauthorized(message = "Invalid or missing API key"): NextResponse {
  return apiError(message, 401, "unauthorized");
}

export function forbidden(message = "Insufficient permissions"): NextResponse {
  return apiError(message, 403, "forbidden");
}

export function notFound(message = "Resource not found"): NextResponse {
  return apiError(message, 404, "not_found");
}
