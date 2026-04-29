/**
 * Shared secret auth for internal cron/worker routes (scheduled publish, performance sync, etc.).
 */

export function getInternalCronWorkerSecrets(): string[] {
  const a = process.env.SCHEDULED_PUBLISH_WORKER_SECRET?.trim();
  const b = process.env.CRON_SECRET?.trim();
  return [a, b].filter((x): x is string => Boolean(x));
}

export function isAuthorizedInternalCronRequest(req: {
  headers: Headers | { get(name: string): string | null };
}): boolean {
  const secrets = getInternalCronWorkerSecrets();
  if (secrets.length === 0) return false;
  const header =
    req.headers.get("x-scheduled-publish-secret")?.trim() ||
    req.headers.get("x-cron-secret")?.trim() ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  return Boolean(header) && secrets.includes(header);
}
