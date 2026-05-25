import type { ConnectionOptions } from "mysql2/promise";

function tlsRequiredForHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  /** TiDB Cloud public endpoints (serverless/starter/essential) require TLS; host shapes vary by region. */
  return (
    h.includes("tidbcloud") ||
    h.endsWith(".tidbcloud.com") ||
    h === "tidbcloud.com" ||
    h.endsWith(".tidb.io")
  );
}

function tryParseMysqlUrl(raw: string): URL | null {
  const s = raw.trim();
  try {
    return new URL(s);
  } catch {
    if (!s.includes("://")) {
      try {
        return new URL(`mysql://${s}`);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * TiDB Cloud (and similar) require TLS. Plain `mysql.createConnection(url)` can be rejected
 * with "insecure transport are prohibited".
 */
export function mysql2ConnectionOptionsFromUrl(databaseUrl: string): ConnectionOptions | string {
  const trimmed = databaseUrl.trim();
  const forceSsl =
    process.env.DATABASE_SSL === "1" ||
    process.env.DATABASE_SSL === "true" ||
    process.env.DATABASE_SSL === "required" ||
    /** Connection strings for TiDB Cloud always need TLS even if hostname parsing differs. */
    /tidbcloud/i.test(trimmed) ||
    /\.tidb\.io/i.test(trimmed);

  const u = tryParseMysqlUrl(trimmed);
  if (!u) {
    if (!forceSsl) return trimmed;
    throw new Error(
      "DATABASE_URL must be a valid URL when connecting to TiDB Cloud with TLS (example: mysql://user:pass@gateway.xxx.tidbcloud.com:4000/db)",
    );
  }

  const host = u.hostname;
  if (!forceSsl && !tlsRequiredForHost(host)) {
    return trimmed;
  }

  const user = decodeURIComponent(u.username || "");
  const password = decodeURIComponent(u.password || "");
  const database = u.pathname.replace(/^\//, "").split("?")[0] || undefined;
  const port = u.port ? Number(u.port) : 3306;

  return {
    host: u.hostname,
    port,
    user: user || undefined,
    password: password || undefined,
    database,
    ssl: { rejectUnauthorized: true },
  };
}
