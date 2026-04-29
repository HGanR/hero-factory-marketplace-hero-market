import path from "path";

export type BesuPublicCategory = "components" | "interfaces" | "abi" | "other";
export type BesuAdminCategory = "deployment" | "configuration" | "services" | "database" | "testing" | "other";

export type BesuPublicFile = {
  id: string;
  name: string;
  category: BesuPublicCategory;
  type: "tsx" | "ts" | "json" | "sql" | "md";
  description: string;
  tags: string[];
};

export type BesuAdminFile = {
  id: string;
  name: string;
  category: BesuAdminCategory;
  type: "tsx" | "ts" | "json" | "sql" | "md";
  description: string;
  tags: string[];
  sensitivity: "high" | "medium" | "low";
};

export const BESU_PUBLIC_FILES: BesuPublicFile[] = [
  {
    id: "verify-trust-component",
    name: "VerifyTrustComponent.tsx",
    category: "components",
    type: "tsx",
    description: "UI component for displaying blockchain verification status and results",
    tags: ["ui", "verification", "blockchain"],
  },
  {
    id: "trust-verification-button",
    name: "TrustVerificationButton.tsx",
    category: "components",
    type: "tsx",
    description: "Reusable button component for triggering trust verification",
    tags: ["ui", "button", "verification"],
  },
  {
    id: "trust-records-with-blockchain",
    name: "TrustRecordsPage-WithBlockchain.tsx",
    category: "components",
    type: "tsx",
    description: "Reference UI for trust records with blockchain integration",
    tags: ["ui", "records", "blockchain"],
  },
  {
    id: "blockchain-status-components",
    name: "BlockchainStatusComponents.tsx",
    category: "components",
    type: "tsx",
    description: "Status indicator components for blockchain operations",
    tags: ["ui", "status", "components"],
  },
  {
    id: "dashboard-blockchain-section",
    name: "DashboardBlockchainSection.tsx",
    category: "components",
    type: "tsx",
    description: "Dashboard section showing blockchain statistics and recent verifications",
    tags: ["ui", "dashboard", "stats"],
  },
  {
    id: "trust-verification-interface",
    name: "TrustVerification.interface.ts",
    category: "interfaces",
    type: "ts",
    description: "TypeScript interfaces for trust verification + blockchain types",
    tags: ["types", "interfaces", "typescript"],
  },
  {
    id: "certificate-types",
    name: "CertificateTypes.ts",
    category: "interfaces",
    type: "ts",
    description: "Type definitions for certificate generation and signing",
    tags: ["types", "certificates", "typescript"],
  },
  {
    id: "trust-record-types",
    name: "TrustRecordTypes-Updated.ts",
    category: "interfaces",
    type: "ts",
    description: "Updated type definitions for trust records with blockchain fields",
    tags: ["types", "records", "typescript"],
  },
  {
    id: "trust-verification-abi",
    name: "TrustVerification.abi.json",
    category: "abi",
    type: "json",
    description: "Smart contract ABI for interacting with TrustVerification",
    tags: ["abi", "contract", "blockchain"],
  },
  {
    id: "use-blockchain-trust",
    name: "useBlockchainTrust.ts",
    category: "other",
    type: "ts",
    description: "Reference hook for blockchain trust flows",
    tags: ["hook", "blockchain", "typescript"],
  },
];

export const BESU_ADMIN_FILES: BesuAdminFile[] = [
  // Deployment / configuration
  {
    id: "deploy-trustverification",
    name: "deploy-trustverification.ts",
    category: "deployment",
    type: "ts",
    description: "Deployment script for TrustVerification contract (Besu)",
    tags: ["deployment", "hardhat", "blockchain"],
    sensitivity: "high",
  },
  {
    id: "deploy-ts",
    name: "deploy.ts",
    category: "deployment",
    type: "ts",
    description: "Deployment orchestration script",
    tags: ["deployment", "orchestration"],
    sensitivity: "high",
  },
  {
    id: "authorize-issuer",
    name: "authorize-issuer.ts",
    category: "deployment",
    type: "ts",
    description: "Authorize issuers on the TrustVerification contract",
    tags: ["authorization", "issuer", "deployment"],
    sensitivity: "high",
  },
  {
    id: "hardhat-config",
    name: "hardhat.config.ts",
    category: "configuration",
    type: "ts",
    description: "Hardhat configuration for Besu networks",
    tags: ["configuration", "hardhat"],
    sensitivity: "high",
  },
  {
    id: "hardhat-config-complete",
    name: "hardhat.config.complete.ts",
    category: "configuration",
    type: "ts",
    description: "Complete Hardhat configuration (expanded)",
    tags: ["configuration", "hardhat"],
    sensitivity: "high",
  },

  // Services / procedures / routers
  {
    id: "besu-tx-service",
    name: "BesuTransactionService.ts",
    category: "services",
    type: "ts",
    description: "Service for managing Besu transactions and confirmations",
    tags: ["service", "transactions", "blockchain"],
    sensitivity: "medium",
  },
  {
    id: "besu-web3-service",
    name: "BesuWeb3Service.ts",
    category: "services",
    type: "ts",
    description: "Web3 service for interacting with Besu JSON-RPC",
    tags: ["service", "besu", "web3"],
    sensitivity: "medium",
  },
  {
    id: "blockchain-verification-service",
    name: "BlockchainVerificationService.ts",
    category: "services",
    type: "ts",
    description: "Core verification service for blockchain trust records",
    tags: ["service", "verification", "blockchain"],
    sensitivity: "high",
  },
  {
    id: "certificate-generation-service",
    name: "CertificateGenerationService.ts",
    category: "services",
    type: "ts",
    description: "Service for generating certificates and artifacts",
    tags: ["service", "certificates"],
    sensitivity: "high",
  },
  {
    id: "certificate-signing-service",
    name: "CertificateSigningService.ts",
    category: "services",
    type: "ts",
    description: "Digital signing service for certificates",
    tags: ["service", "signing", "security"],
    sensitivity: "high",
  },
  {
    id: "record-instrument-trpc",
    name: "recordInstrumentTrpcProcedure.ts",
    category: "services",
    type: "ts",
    description: "tRPC procedure for recording instruments on-chain",
    tags: ["trpc", "procedures", "blockchain"],
    sensitivity: "medium",
  },
  {
    id: "verify-trust-trpc",
    name: "verifyTrustTrpcProcedure.ts",
    category: "services",
    type: "ts",
    description: "tRPC procedure for verifying trusts on-chain",
    tags: ["trpc", "procedures", "verification"],
    sensitivity: "medium",
  },
  {
    id: "verification-trpc-procedures",
    name: "verificationTrpcProcedures.ts",
    category: "services",
    type: "ts",
    description: "Aggregated verification procedures router",
    tags: ["trpc", "router", "procedures"],
    sensitivity: "medium",
  },
  {
    id: "trust-blockchain-router",
    name: "trustBlockchainRouter.ts",
    category: "services",
    type: "ts",
    description: "Router for trust blockchain operations",
    tags: ["router", "blockchain"],
    sensitivity: "medium",
  },
  {
    id: "verified-trusts-router",
    name: "verifiedTrustsRouter.ts",
    category: "services",
    type: "ts",
    description: "Router for verified trusts",
    tags: ["router", "verification"],
    sensitivity: "medium",
  },
  {
    id: "verifytrust-procedure",
    name: "verifyTrustProcedure.ts",
    category: "services",
    type: "ts",
    description: "Verification procedure (reference implementation)",
    tags: ["verification", "procedure"],
    sensitivity: "medium",
  },
  {
    id: "verifytrust-procedure-complete",
    name: "verifyTrustProcedure-Complete.ts",
    category: "services",
    type: "ts",
    description: "Complete verification procedure (reference implementation)",
    tags: ["verification", "procedure"],
    sensitivity: "medium",
  },
  {
    id: "trust-records-with-verification",
    name: "TrustRecordsPage-WithVerification.tsx",
    category: "services",
    type: "tsx",
    description: "Reference page with verification UI (admin reference)",
    tags: ["ui", "verification", "reference"],
    sensitivity: "medium",
  },
  {
    id: "record-payment",
    name: "record-payment.ts",
    category: "services",
    type: "ts",
    description: "Script for recording payments (reference)",
    tags: ["payments", "script"],
    sensitivity: "medium",
  },
  {
    id: "record-instrument",
    name: "record-instrument.ts",
    category: "services",
    type: "ts",
    description: "Script for recording instruments (reference)",
    tags: ["records", "script"],
    sensitivity: "medium",
  },
  {
    id: "verify-instrument",
    name: "verify-instrument.ts",
    category: "services",
    type: "ts",
    description: "Script for verifying instruments (reference)",
    tags: ["verification", "script"],
    sensitivity: "medium",
  },
  {
    id: "certificate-export-procedure",
    name: "certificateExportProcedure.ts",
    category: "services",
    type: "ts",
    description: "Procedure for exporting certificates (reference)",
    tags: ["certificates", "export"],
    sensitivity: "medium",
  },

  // Database
  {
    id: "migration-blockchain-fields",
    name: "migration_add_blockchain_fields.sql",
    category: "database",
    type: "sql",
    description: "Database migration adding blockchain fields",
    tags: ["database", "migration", "schema"],
    sensitivity: "high",
  },

  // Testing
  {
    id: "trust-verification-test",
    name: "TrustVerification.test.ts",
    category: "testing",
    type: "ts",
    description: "Unit tests for TrustVerification flows (reference)",
    tags: ["testing", "unit-tests"],
    sensitivity: "low",
  },
];

export const BESU_PUBLIC_DIR = path.join(process.cwd(), "besu-bundle", "public");
export const BESU_ADMIN_DIR = path.join(process.cwd(), "besu-bundle", "admin");

export const BESU_PUBLIC_FILE_SET = new Set(BESU_PUBLIC_FILES.map((f) => f.name));
export const BESU_ADMIN_FILE_SET = new Set(BESU_ADMIN_FILES.map((f) => f.name));

export function isSafeDownloadName(filename: string) {
  // filename only, no paths
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return false;
  return /^[a-zA-Z0-9._-]+$/.test(filename);
}

export function contentTypeForFilename(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".sql")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (lower.endsWith(".tsx") || lower.endsWith(".ts")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}



