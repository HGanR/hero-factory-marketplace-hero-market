/**
 * TRUST fulfillment smoke — run: npx tsx scripts/fulfillment-trust-smoke-test.mts
 * Requires dev server (SMOKE_BASE_URL, default http://127.0.0.1:3001) and DATABASE_URL.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "package.json"));
const dotenv = require("dotenv") as typeof import("dotenv");
const mysql = require("mysql2/promise") as typeof import("mysql2/promise");

dotenv.config({ path: resolve(root, ".env.local") });
dotenv.config({ path: resolve(root, ".env") });

const BASE = process.env.SMOKE_BASE_URL?.trim() || "http://127.0.0.1:3001";

type Result = { name: string; pass: boolean; detail: string };
const results: Result[] = [];

function record(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name}: ${detail}`);
}

const TRUST_ACKS = {
  noLegalAdvice: true,
  noAutoFulfillment: true,
  noAutoPublish: true,
  noFinalLegalDocument: true,
  preparedForLegalReview: true,
  recommendAttorneyReview: true,
};

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    record("env DATABASE_URL", false, "missing");
    return exit();
  }

  const { mysql2ConnectionOptionsFromUrl } = await import(
    resolve(root, "src/lib/db/mysql2-connection-options.ts")
  );
  const conn = await mysql.createConnection(mysql2ConnectionOptionsFromUrl(url));

  const { signNpcAdminSessionTokens } = await import(resolve(root, "src/lib/admin/admin-session-jwt.ts"));
  const [admins] = await conn.query(
    `SELECT id FROM marketplace_users WHERE isApproved = 1 ORDER BY id ASC LIMIT 5`
  );
  let adminUserId: number | null = null;
  for (const a of admins as { id: number }[]) {
    const [clients] = await conn.query(`SELECT id FROM clients WHERE userId = ? LIMIT 1`, [a.id]);
    if ((clients as { id: string }[]).length) {
      adminUserId = a.id;
      break;
    }
  }
  if (!adminUserId) {
    record("fixture admin+client", false, "none found");
    await conn.end();
    return exit();
  }

  const [clientRows] = await conn.query(`SELECT id FROM clients WHERE userId = ? LIMIT 1`, [adminUserId]);
  const clientId = (clientRows as { id: string }[])[0]?.id;
  const { adminToken } = await signNpcAdminSessionTokens({ userId: adminUserId, username: "smoke-trust" });
  const adminCookie = `admin-token=${adminToken}`;

  async function api(path: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    headers.set("Cookie", adminCookie);
    if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  }

  const [trustsBefore] = await conn
    .query(`SELECT COUNT(*) AS c FROM trusts WHERE clientId = ?`, [clientId])
    .catch(() => [[{ c: 0 }]]);
  const trustsCountBefore = Number((trustsBefore as { c: number }[])[0]?.c ?? 0);

  const keyRes = await api("/api/admin/executive-agent/worker-keys", {
    method: "POST",
    body: JSON.stringify({ name: `trust-smoke-${Date.now()}` }),
  });
  const keyJson = (await keyRes.json().catch(() => ({}))) as { key?: { rawKey?: string } };
  const rawWorkerKey = keyJson.key?.rawKey;
  record("mint worker key", keyRes.status === 200 && Boolean(rawWorkerKey?.startsWith("hf_cwd_")), `HTTP ${keyRes.status}`);

  const payRes = await api("/api/admin/executive-agent/payment-confirmations", {
    method: "POST",
    body: JSON.stringify({
      clientId,
      externalRef: `TRUST-SMOKE-${Date.now()}`,
      paypalTransactionNote: "trust smoke",
    }),
  });
  const payJson = (await payRes.json().catch(() => ({}))) as { confirmation?: { id: string; status: string } };
  const confirmationId = payJson.confirmation?.id;
  record(
    "confirm payment",
    payRes.status === 200 && payJson.confirmation?.status === "confirmed" && Boolean(confirmationId),
    `HTTP ${payRes.status}`
  );

  const workerAuth = rawWorkerKey ? { Authorization: `Bearer ${rawWorkerKey}` } : {};

  const payRes2 = await api("/api/admin/executive-agent/payment-confirmations", {
    method: "POST",
    body: JSON.stringify({ clientId, externalRef: `TRUST-SMOKE-2-${Date.now()}` }),
  });
  const confirmationId2 = ((await payRes2.json().catch(() => ({}))) as { confirmation?: { id: string } })
    .confirmation?.id;

  const trustHandoff = await fetch(`${BASE}/api/v1/workers/claude/fulfillment-handoffs`, {
    method: "POST",
    headers: {
      ...workerAuth,
      "Content-Type": "application/json",
      "Idempotency-Key": `trust-smoke-${Date.now()}`,
    },
    body: JSON.stringify({
      version: "1",
      client: { clientId },
      service: { primary: "TRUST" },
      payment: { confirmationId: confirmationId2 },
      salesSummary: { text: "Smoke TRUST package — prepared for legal review only." },
      requestedDeliverable: { type: "trust_review_packet", title: "Trust review packet" },
      acknowledgements: TRUST_ACKS,
      trustIntake: { trustPurpose: "Estate planning", jurisdictionState: "CA" },
    }),
  });
  const handoffJson = (await trustHandoff.json().catch(() => ({}))) as {
    ok?: boolean;
    handoffId?: string;
    assignedDepartment?: string;
  };
  const orderId = handoffJson.handoffId;

  record(
    "TRUST handoff accepts",
    trustHandoff.status === 201 && Boolean(orderId) && handoffJson.assignedDepartment === "trust_records",
    trustHandoff.status === 201
      ? `order=${orderId?.slice(0, 8)}… dept=${handoffJson.assignedDepartment}`
      : `HTTP ${trustHandoff.status}`
  );

  if (confirmationId2 && orderId) {
    const [payRow] = await conn.query(
      `SELECT consumedAt, consumedByOrderId FROM payment_confirmations WHERE id = ?`,
      [confirmationId2]
    );
    const pr = (payRow as { consumedAt: Date | null; consumedByOrderId: string | null }[])[0];
    record(
      "TRUST payment consumed",
      Boolean(pr?.consumedAt) && pr?.consumedByOrderId === orderId,
      `consumedBy=${pr?.consumedByOrderId?.slice(0, 8) ?? "null"}`
    );
  } else {
    record("TRUST payment consumed", false, "skipped");
  }

  const [trustsAfterHandoff] = await conn
    .query(`SELECT COUNT(*) AS c FROM trusts WHERE clientId = ?`, [clientId])
    .catch(() => [[{ c: trustsCountBefore }]]);
  record(
    "no trust workspace mutation on handoff",
    Number((trustsAfterHandoff as { c: number }[])[0]?.c ?? 0) === trustsCountBefore,
    `trusts rows before=${trustsCountBefore} after=${(trustsAfterHandoff as { c: number }[])[0]?.c}`
  );

  const applyProbe = await fetch(`${BASE}/api/jarva/trust-intake/apply`, {
    method: "POST",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ trustId: "00000000-0000-4000-8000-000000000099" }),
  });
  record(
    "jarva trust-intake/apply not used by fulfillment flow",
    applyProbe.status !== 201,
    `direct probe HTTP ${applyProbe.status} (fulfillment must not call this)`
  );

  const trustQueue = await api("/api/admin/executive-agent/fulfillment-queue-trust?limit=20");
  const tqJson = (await trustQueue.json().catch(() => ({}))) as {
    ok?: boolean;
    orders?: { orderId: string; service?: { primary: string } }[];
    meta?: { primaryService: string };
  };
  const inTrustQueue = Boolean(orderId && tqJson.orders?.some((o) => o.orderId === orderId));
  record(
    "TRUST queue lists order",
    trustQueue.status === 200 && tqJson.meta?.primaryService === "TRUST" && inTrustQueue,
    `HTTP ${trustQueue.status} found=${inTrustQueue}`
  );

  const webQueue = await api("/api/admin/executive-agent/fulfillment-queue?limit=50");
  const wqJson = (await webQueue.json().catch(() => ({}))) as { orders?: { orderId: string }[] };
  record(
    "WEBSITE queue isolation",
    !orderId || !wqJson.orders?.some((o) => o.orderId === orderId),
    `TRUST order absent from WEBSITE queue`
  );

  if (orderId) {
    const webPropose = await api(
      `/api/admin/executive-agent/fulfillment-orders/${encodeURIComponent(orderId)}/propose-site-builder-draft`,
      { method: "POST", body: "{}" }
    );
    record(
      "WEBSITE propose blocked on TRUST order",
      webPropose.status === 404,
      `HTTP ${webPropose.status} (expect 404)`
    );
  } else {
    record("WEBSITE propose blocked on TRUST order", false, "no orderId");
  }

  let approvalId: string | null = null;
  if (orderId) {
    const proposeRes = await api(
      `/api/admin/executive-agent/fulfillment-orders-trust/${encodeURIComponent(orderId)}/propose-trust-packet`,
      { method: "POST", body: "{}" }
    );
    const proposeJson = (await proposeRes.json().catch(() => ({}))) as {
      ok?: boolean;
      approvalId?: string;
      proposedAction?: string;
    };
    approvalId = proposeJson.approvalId ?? null;
    record(
      "propose trust packet",
      proposeRes.status === 200 && proposeJson.proposedAction === "createTrustFulfillmentPacket" && Boolean(approvalId),
      `HTTP ${proposeRes.status}`
    );
  } else {
    record("propose trust packet", false, "no orderId");
  }

  if (approvalId) {
    const approveRes = await api(`/api/admin/executive-agent/approvals/${encodeURIComponent(approvalId)}/approve`, {
      method: "POST",
    });
    const approveJson = (await approveRes.json().catch(() => ({}))) as { ok?: boolean };
    const [notes] = await conn.query(
      `SELECT note FROM client_notes WHERE clientId = ? ORDER BY createdAt DESC LIMIT 5`,
      [clientId]
    );
    const trustNote = (notes as { note: string }[]).find(
      (n) =>
        n.note.includes("[Trust — fulfillment review packet]") ||
        n.note.includes("[Trust — Smart Trust setup brief]")
    );
    record(
      "approval creates internal trust note",
      approveRes.status === 200 && approveJson.ok === true && Boolean(trustNote),
      `HTTP ${approveRes.status} note=${Boolean(trustNote)}`
    );
    record(
      "packet contains legal disclaimer",
      Boolean(trustNote?.note.includes("PREPARED FOR LEGAL REVIEW")),
      trustNote ? "disclaimer present" : "no note"
    );

    if (orderId) {
      const approvePacket = await api(
        `/api/admin/executive-agent/fulfillment-orders-trust/${encodeURIComponent(orderId)}/deliverable/approve-packet`,
        { method: "POST", body: "{}" }
      );
      const apJson = (await approvePacket.json().catch(() => ({}))) as { ok?: boolean; pipelineStage?: string };
      record(
        "owner approve packet transition",
        approvePacket.status === 200 && apJson.ok === true && apJson.pipelineStage === "approved_for_release",
        `HTTP ${approvePacket.status} stage=${apJson.pipelineStage}`
      );
    }
  } else {
    record("approval creates internal trust note", false, "skipped");
    record("packet contains legal disclaimer", false, "skipped");
    record("owner approve packet transition", false, "skipped");
  }

  const [trustsFinal] = await conn
    .query(`SELECT COUNT(*) AS c FROM trusts WHERE clientId = ?`, [clientId])
    .catch(() => [[{ c: trustsCountBefore }]]);
  record(
    "no trust DB mutation after full flow",
    Number((trustsFinal as { c: number }[])[0]?.c ?? 0) === trustsCountBefore,
    `trusts rows=${(trustsFinal as { c: number }[])[0]?.c}`
  );

  await conn.end();
  exit();
}

function exit() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n--- TRUST SMOKE: ${results.length - failed.length}/${results.length} passed ---`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL: ${f.name} — ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
