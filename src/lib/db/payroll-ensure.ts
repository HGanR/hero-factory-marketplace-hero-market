import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export async function ensurePayrollTables() {
  const db = await getDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payroll_workspaces (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      clientId VARCHAR(36),
      trustId VARCHAR(36),
      workspaceId VARCHAR(36) NOT NULL,
      name VARCHAR(255),
      status VARCHAR(32) DEFAULT 'active',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_payroll_ws_user (userId),
      INDEX idx_payroll_ws_client (clientId),
      INDEX idx_payroll_ws_trust (trustId),
      INDEX idx_payroll_ws_workspace (workspaceId),
      UNIQUE KEY uniq_ws (userId, clientId, trustId, workspaceId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payroll_workers (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      clientId VARCHAR(36),
      trustId VARCHAR(36),
      workspaceId VARCHAR(36),
      name VARCHAR(255) NOT NULL,
      type VARCHAR(32) NOT NULL DEFAULT 'employee',
      email VARCHAR(320),
      residentLine1 VARCHAR(255),
      residentCity VARCHAR(100),
      residentState VARCHAR(32),
      residentPostal VARCHAR(20),
      residentCountry VARCHAR(2) DEFAULT 'US',
      workLine1 VARCHAR(255),
      workCity VARCHAR(100),
      workState VARCHAR(32),
      workPostal VARCHAR(20),
      workCountry VARCHAR(2) DEFAULT 'US',
      filingStatus VARCHAR(64),
      allowances INT DEFAULT 0,
      additionalWithholdingCents INT DEFAULT 0,
      status VARCHAR(32) DEFAULT 'active',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_payroll_worker_user (userId),
      INDEX idx_payroll_worker_workspace (workspaceId),
      INDEX idx_payroll_worker_client (clientId),
      INDEX idx_payroll_worker_trust (trustId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payroll_pay_runs (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      clientId VARCHAR(36),
      trustId VARCHAR(36),
      workspaceId VARCHAR(36),
      payDate DATE NOT NULL,
      periodStart DATE NOT NULL,
      periodEnd DATE NOT NULL,
      status VARCHAR(32) DEFAULT 'draft',
      grossCents BIGINT DEFAULT 0,
      netCents BIGINT DEFAULT 0,
      taxEngineKind VARCHAR(64) DEFAULT 'manual',
      metadata JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_payrun_user (userId),
      INDEX idx_payrun_workspace (workspaceId),
      INDEX idx_payrun_date (payDate)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payroll_run_items (
      id VARCHAR(36) PRIMARY KEY,
      runId VARCHAR(36) NOT NULL,
      workerId VARCHAR(36) NOT NULL,
      grossCents BIGINT NOT NULL,
      netCents BIGINT NOT NULL,
      taxBreakdown JSON,
      earnings JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_payrun_item_run (runId),
      INDEX idx_payrun_item_worker (workerId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payroll_provider_accounts (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      provider VARCHAR(64) NOT NULL,
      providerCompanyId VARCHAR(255),
      status VARCHAR(32) DEFAULT 'connected',
      metadata JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_ppa_user (userId),
      INDEX idx_ppa_provider (provider)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payroll_provider_workers (
      id VARCHAR(36) PRIMARY KEY,
      workerId VARCHAR(36) NOT NULL,
      providerWorkerId VARCHAR(255) NOT NULL,
      provider VARCHAR(64) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE KEY uniq_provider_worker (workerId, provider),
      INDEX idx_ppw_worker (workerId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payroll_provider_pay_runs (
      id VARCHAR(36) PRIMARY KEY,
      runId VARCHAR(36) NOT NULL,
      providerRunId VARCHAR(255) NOT NULL,
      provider VARCHAR(64) NOT NULL,
      status VARCHAR(32) DEFAULT 'pending',
      totals JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      UNIQUE KEY uniq_provider_run (runId, provider),
      INDEX idx_pppr_run (runId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payroll_tax_documents (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      clientId VARCHAR(36),
      trustId VARCHAR(36),
      workspaceId VARCHAR(36),
      runId VARCHAR(36),
      docType VARCHAR(32) NOT NULL,
      docYear INT NOT NULL,
      linkUrl VARCHAR(500),
      metadata JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_ptd_user (userId),
      INDEX idx_ptd_workspace (workspaceId),
      INDEX idx_ptd_run (runId),
      INDEX idx_ptd_type_year (docType, docYear)
    )
  `);
}
