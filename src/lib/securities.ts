export type SecuritiesCertificateStatus = "active" | "pending_signature" | "revoked";

export type TrustCertificate = {
  id: string;
  serialNumber: string;
  beneficiary: string;
  assetBacking: string;
  assetValue: number;
  issueDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  status: SecuritiesCertificateStatus;
  signatureStatus: "verified" | "pending";
  tokenized: boolean;
  xrplAddress?: string;
  xrplCurrency?: string;
  xrplBalance?: string;
};

export type MemberAccount = {
  id: string;
  name: string;
  email: string;
  status: "verified" | "pending" | "rejected";
  kycStatus: "approved" | "pending" | "in_review" | "rejected";
  accountType: "Individual" | "Corporate" | "Trust" | "Non-Profit" | string;
  joinDate: string; // YYYY-MM-DD
  beneficialOwner: string;
  riskLevel: "low" | "medium" | "high";
  rippleWallet?: string | null;
};

const CERTS_KEY = "securities_trust_certificates_v1";
const MEMBERS_KEY = "securities_members_v1";

function safeParseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function loadCertificates(): TrustCertificate[] {
  if (typeof window === "undefined") return [];
  return safeParseArray<TrustCertificate>(localStorage.getItem(CERTS_KEY));
}

export function saveCertificates(certs: TrustCertificate[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CERTS_KEY, JSON.stringify(certs));
}

export function loadMembers(): MemberAccount[] {
  if (typeof window === "undefined") return [];
  return safeParseArray<MemberAccount>(localStorage.getItem(MEMBERS_KEY));
}

export function saveMembers(members: MemberAccount[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}


