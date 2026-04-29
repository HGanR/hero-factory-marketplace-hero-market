/**
 * HTTP smoke checks for Site Builder → Widget → Client Hub (staging-oriented).
 * Optional MySQL verification when QA_DATABASE_URL or DATABASE_URL is set.
 *
 * Run from hero-market/:  npm run qa:site-builder-client-flow
 *
 * Env (HTTP):
 *   QA_BASE_URL          — required, e.g. https://staging.example (no trailing slash)
 *   QA_AUTH_TOKEN        — optional; JWT value only → sends Cookie: auth-token=<value>
 *   QA_COOKIE_HEADER     — optional; full Cookie header value (overrides QA_AUTH_TOKEN)
 *   QA_CLIENT_ID         — required for Client Hub + summary checks
 *   QA_SITE_ID           — required for site + agency-widget checks
 *   QA_WIDGET_KEY        — required for public widget config check
 *   QA_WIDGET_ORIGIN     — optional Origin for widget calls (default https://example.com)
 *   QA_WIDGET_MESSAGE=1 — optional; POST one widget message (writes DB)
 *   QA_CREATE=1          — reserved; no destructive creates implemented (see MD)
 *
 * Env (optional SQL — skipped entirely if no DB URL; never fails the run for “missing DB”):
 *   QA_DATABASE_URL      — optional; overrides DATABASE_URL for QA read-only user
 *   DATABASE_URL         — used when QA_DATABASE_URL unset
 *   QA_WIDGET_SESSION_ID — optional; defaults when QA_WIDGET_MESSAGE=1; required for CRM/widget
 *                           SQL rows (4–8) if you did not POST in this run
 *   QA_SQL_VERIFY=0      — optional; set to 0 to skip SQL even when DATABASE_URL is set
 */

import mysql from "mysql2/promise";

function env(name: string, required = false): string | undefined {
  const v = process.env[name]?.trim();
  if (required && !v) throw new Error(`Missing required env: ${name}`);
  return v || undefined;
}

function cookieHeader(): string {
  const full = env("QA_COOKIE_HEADER");
  if (full) return full;
  const token = env("QA_AUTH_TOKEN");
  if (token) return `auth-token=${token}`;
  throw new Error("Set QA_COOKIE_HEADER or QA_AUTH_TOKEN for authenticated requests");
}

function databaseUrlForQa(): string | undefined {
  return env("QA_DATABASE_URL") || env("DATABASE_URL");
}

type FetchInit = RequestInit & { expect?: number[] };

async function req(
  label: string,
  url: string,
  init: FetchInit = {},
): Promise<{ ok: boolean; status: number; snippet: string; text: string }> {
  const expect = init.expect ?? [200];
  const rest: RequestInit = { ...init };
  delete (rest as FetchInit).expect;
  let res: Response;
  try {
    res = await fetch(url, rest);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`FAIL ${label} — fetch error: ${msg}`);
    return { ok: false, status: 0, snippet: msg, text: "" };
  }
  const text = await res.text();
  const snippet = text.length > 280 ? `${text.slice(0, 280)}…` : text;
  const ok = expect.includes(res.status);
  console.log(`${ok ? "PASS" : "FAIL"} ${label} — HTTP ${res.status}`);
  if (!ok) console.log(`   body: ${snippet}`);
  return { ok, status: res.status, snippet, text };
}

type SqlCtx = {
  conn: mysql.Connection;
  clientId: string;
  siteId: string;
  widgetKey: string;
  sessionId?: string;
};

async function scalar(conn: mysql.Connection, sql: string, params: unknown[]): Promise<number> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(sql, params);
  const r = rows[0] as Record<string, unknown> | undefined;
  if (!r) return 0;
  const v = Object.values(r)[0];
  return typeof v === "number" ? v : Number(v) || 0;
}

async function runSqlVerification(ctx: SqlCtx): Promise<boolean[]> {
  const { conn, clientId, siteId, widgetKey, sessionId } = ctx;
  const results: boolean[] = [];

  console.log("=== SQL verification (read-only) ===");

  // 1. web3_sites.clientId = QA_CLIENT_ID
  const siteClient = await scalar(
    conn,
    "SELECT COUNT(*) AS c FROM web3_sites WHERE id = ? AND clientId = ?",
    [siteId, clientId],
  );
  const ok1 = siteClient >= 1;
  results.push(ok1);
  console.log(`${ok1 ? "PASS" : "FAIL"} SQL (1) web3_sites.clientId matches QA_CLIENT_ID for site`);

  // 2. ai_agent_site_bindings.widgetKey + site
  const bindKey = await scalar(
    conn,
    "SELECT COUNT(*) AS c FROM ai_agent_site_bindings WHERE siteId = ? AND widgetKey = ? AND isActive = 1",
    [siteId, widgetKey],
  );
  const ok2 = bindKey >= 1;
  results.push(ok2);
  console.log(`${ok2 ? "PASS" : "FAIL"} SQL (2) ai_agent_site_bindings active row for site + widgetKey`);

  // 3. ai_agent_site_bindings.clientId = QA_CLIENT_ID
  const bindClient = await scalar(
    conn,
    "SELECT COUNT(*) AS c FROM ai_agent_site_bindings WHERE siteId = ? AND widgetKey = ? AND clientId = ?",
    [siteId, widgetKey, clientId],
  );
  const ok3 = bindClient >= 1;
  results.push(ok3);
  console.log(
    `${ok3 ? "PASS" : "FAIL"} SQL (3) ai_agent_site_bindings.clientId matches QA_CLIENT_ID (CRM inbox attribution)`,
  );

  if (!sessionId?.trim()) {
    console.log(
      "SKIP SQL (4–8) — no session id (set QA_WIDGET_SESSION_ID or run with QA_WIDGET_MESSAGE=1 to capture session)",
    );
    return results;
  }

  const sid = sessionId.trim();

  // 4. widget_conversations for session + widget key snapshot
  const wcRows = await scalar(
    conn,
    "SELECT COUNT(*) AS c FROM widget_conversations WHERE session_id = ? AND widget_key_snapshot = ?",
    [sid, widgetKey],
  );
  const ok4 = wcRows >= 1;
  results.push(ok4);
  console.log(`${ok4 ? "PASS" : "FAIL"} SQL (4) widget_conversations for sessionId + widget_key_snapshot`);

  // 5. widget_messages linked to that conversation
  const wmRows = await scalar(
    conn,
    `SELECT COUNT(*) AS c FROM widget_messages wm
     INNER JOIN widget_conversations wcv ON wcv.id = wm.conversation_id
     WHERE wcv.session_id = ? AND wcv.widget_key_snapshot = ?`,
    [sid, widgetKey],
  );
  const ok5 = wmRows >= 1;
  results.push(ok5);
  console.log(`${ok5 ? "PASS" : "FAIL"} SQL (5) widget_messages exist for that conversation/session`);

  const emailLike = `webchat+${sid}@%`;

  // 6. crm_contacts with clientId + synthetic webchat email for session
  const crmContact = await scalar(
    conn,
    "SELECT COUNT(*) AS c FROM crm_contacts WHERE clientId = ? AND email LIKE ?",
    [clientId, emailLike],
  );
  const ok6 = crmContact >= 1;
  results.push(ok6);
  console.log(`${ok6 ? "PASS" : "FAIL"} SQL (6) crm_contacts for clientId + webchat session email pattern`);

  // 7. crm_conversations for that contact (webchat)
  const crmConv = await scalar(
    conn,
    `SELECT COUNT(*) AS c FROM crm_conversations cv
     INNER JOIN crm_contacts ct ON ct.id = cv.contactId
     WHERE ct.clientId = ? AND ct.email LIKE ? AND cv.channel = 'webchat'`,
    [clientId, emailLike],
  );
  const ok7 = crmConv >= 1;
  results.push(ok7);
  console.log(`${ok7 ? "PASS" : "FAIL"} SQL (7) crm_conversations webchat for that contact`);

  // 8. crm_messages for that conversation
  const crmMsg = await scalar(
    conn,
    `SELECT COUNT(*) AS c FROM crm_messages m
     INNER JOIN crm_conversations cv ON cv.id = m.conversationId
     INNER JOIN crm_contacts ct ON ct.id = cv.contactId
     WHERE ct.clientId = ? AND ct.email LIKE ? AND cv.channel = 'webchat'`,
    [clientId, emailLike],
  );
  const ok8 = crmMsg >= 1;
  results.push(ok8);
  console.log(`${ok8 ? "PASS" : "FAIL"} SQL (8) crm_messages for that webchat conversation`);

  return results;
}

function verifyInboxContainsWebchatSession(inboxJsonText: string, sessionId: string): boolean {
  try {
    const data = JSON.parse(inboxJsonText) as { inbox?: unknown[] };
    const inbox = Array.isArray(data.inbox) ? data.inbox : [];
    const needle = `webchat+${sessionId}@`;
    for (const row of inbox) {
      const r = row as {
        conversation?: { channel?: string };
        contact?: { email?: string | null };
      };
      if (r?.conversation?.channel === "webchat" && typeof r?.contact?.email === "string" && r.contact.email.includes(needle)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function main() {
  const base = env("QA_BASE_URL", true)!;
  const clientId = env("QA_CLIENT_ID", true)!;
  const siteId = env("QA_SITE_ID", true)!;
  const widgetKey = env("QA_WIDGET_KEY", true)!;
  const origin = env("QA_WIDGET_ORIGIN") || "https://example.com";
  const cookie = cookieHeader();

  console.log("=== Environment checks (soft) ===");
  const soft: string[] = [];
  if (!process.env.QA_BASE_URL?.trim()) soft.push("QA_BASE_URL");
  if (!databaseUrlForQa()) soft.push("QA_DATABASE_URL / DATABASE_URL (SQL block skipped)");
  if (!process.env.NEXT_PUBLIC_SITE_URL?.trim()) soft.push("NEXT_PUBLIC_SITE_URL (app build — loader/snippet may be incomplete)");
  if (soft.length) console.log("Note:", soft.join(", ") || "none");
  else console.log("Note: local env hints only; staging truth is on the server.");

  const authHeaders = { Cookie: cookie };
  const results: boolean[] = [];

  results.push(
    (
      await req("GET client summary", `${base}/api/revenue-os/clients/${clientId}/summary`, {
        headers: authHeaders,
        expect: [200],
      })
    ).ok,
  );

  results.push(
    (
      await req("GET site", `${base}/api/site-builder/sites/${siteId}`, {
        headers: authHeaders,
        expect: [200],
      })
    ).ok,
  );

  results.push(
    (
      await req("GET site versions", `${base}/api/site-builder/sites/${siteId}/versions`, {
        headers: authHeaders,
        expect: [200],
      })
    ).ok,
  );

  results.push(
    (
      await req("GET agency-widget", `${base}/api/site-builder/sites/${siteId}/agency-widget`, {
        headers: authHeaders,
        expect: [200],
      })
    ).ok,
  );

  const wc = await req("GET widget config", `${base}/api/widget/${encodeURIComponent(widgetKey)}/config`, {
    headers: { Origin: origin },
    expect: [200],
  });
  results.push(wc.ok);
  if (!wc.ok && (wc.status === 403 || wc.status === 404)) {
    console.log("   hint: 403 = Origin not allowlisted; 404 = inactive/missing binding — fix WIDGET_ORIGIN / binding.");
  }

  let sessionUsed = env("QA_WIDGET_SESSION_ID")?.trim() || undefined;

  if (process.env.QA_WIDGET_MESSAGE === "1") {
    sessionUsed = env("QA_WIDGET_SESSION_ID")?.trim() || `qa-smoke-${Date.now()}`;
    const body = JSON.stringify({
      message: "QA smoke message",
      sessionId: sessionUsed,
      page: { url: `${origin}/qa-smoke`, title: "smoke" },
    });
    results.push(
      (
        await req("POST widget message", `${base}/api/widget/${encodeURIComponent(widgetKey)}/message`, {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body,
          expect: [200],
        })
      ).ok,
    );
    await new Promise((r) => setTimeout(r, 400));
  }

  const inboxRes = await req("GET client inbox", `${base}/api/revenue-os/clients/${clientId}/inbox`, {
    headers: authHeaders,
    expect: [200],
  });
  results.push(inboxRes.ok);

  results.push(
    (
      await req("GET client activity", `${base}/api/revenue-os/clients/${clientId}/activity`, {
        headers: authHeaders,
        expect: [200],
      })
    ).ok,
  );

  results.push(
    (
      await req("GET client analytics", `${base}/api/revenue-os/clients/${clientId}/analytics`, {
        headers: authHeaders,
        expect: [200, 404],
      })
    ).ok,
  );

  // 9. Inbox API lists webchat conversation for synthetic session email (needs session + successful inbox JSON)
  if (inboxRes.ok && sessionUsed) {
    const ok9 = verifyInboxContainsWebchatSession(inboxRes.text, sessionUsed);
    results.push(ok9);
    console.log(
      `${ok9 ? "PASS" : "FAIL"} API (9) Client Hub inbox JSON includes webchat row for QA_WIDGET_SESSION_ID / POST session`,
    );
    if (!ok9) {
      console.log("   hint: ensure binding + site clientId, POST included sessionId, CRM not swallowed (server logs).");
    }
  } else if (!sessionUsed) {
    console.log("SKIP API (9) inbox webchat row — no session id to match");
  } else {
    console.log("SKIP API (9) inbox webchat row — inbox HTTP not 200");
  }

  const dbUrl = databaseUrlForQa();
  const skipSql = process.env.QA_SQL_VERIFY === "0";
  if (!dbUrl || skipSql) {
    if (skipSql && dbUrl) console.log("SKIP SQL verification — QA_SQL_VERIFY=0");
    else if (!dbUrl) console.log("SKIP SQL verification — no QA_DATABASE_URL / DATABASE_URL");
  } else {
    let conn: mysql.Connection | undefined;
    try {
      conn = await mysql.createConnection(dbUrl);
      const sqlResults = await runSqlVerification({
        conn,
        clientId,
        siteId,
        widgetKey,
        sessionId: sessionUsed,
      });
      results.push(...sqlResults);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`FAIL SQL — connection or query error: ${msg}`);
      results.push(false);
    } finally {
      if (conn) await conn.end().catch(() => undefined);
    }
  }

  const failed = results.filter((r) => !r).length;
  console.log("=== Summary ===");
  console.log(failed === 0 ? "ALL CHECKED STEPS PASSED (see FAIL/SKIP lines above)" : `${failed} step(s) reported FAIL`);
  if (process.env.QA_CREATE === "1") {
    console.log("QA_CREATE=1: no automated site/client creation in this script (manual / future).");
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});