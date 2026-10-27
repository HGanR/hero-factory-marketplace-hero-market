export function GET(request: Request) { return Response.redirect(new URL("/mobile", request.url), 307); }
