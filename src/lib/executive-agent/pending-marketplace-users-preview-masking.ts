export type PendingMarketplaceUserFullRow = {
  id: number;
  email: string;
  username: string;
  createdAt: string;
};

export type PendingMarketplaceUserSafeRow = {
  displayIndex: number;
  emailMasked: string;
  usernameMasked: string;
  createdAt: string;
};

type PendingMarketplaceUserDbRow = {
  id: number;
  email: string | null;
  username: string | null;
  createdAt: Date | string | null;
};

export function maskMarketplaceEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return "[redacted]";
  const at = trimmed.indexOf("@");
  if (at <= 0) return "[redacted]";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return "[redacted]";
  const dot = domain.lastIndexOf(".");
  const domainName = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot + 1) : "";
  const localMasked = local.length <= 1 ? "*" : `${local[0]}***`;
  const domainMasked = domainName.length <= 1 ? "*" : `${domainName[0]}***`;
  return tld ? `${localMasked}@${domainMasked}.${tld}` : `${localMasked}@${domainMasked}`;
}

export function maskMarketplaceUsername(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return "[redacted]";
  if (trimmed.length <= 2) return "***";
  if (trimmed.length <= 4) return `${trimmed[0]}***`;
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-1)}`;
}

/** Mask phone for summaries — last four digits only when long enough. */
export function maskMarketplacePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "[redacted]";
  return `***-***-${digits.slice(-4)}`;
}

export function formatPhoneForVoice(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}, ${digits.slice(3, 6)}, ${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `${digits.slice(1, 4)}, ${digits.slice(4, 7)}, ${digits.slice(7)}`;
  }
  return phone.trim();
}

function formatCreatedAt(value: Date | string | null): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

export function mapPendingMarketplaceUserRowFull(row: PendingMarketplaceUserDbRow): PendingMarketplaceUserFullRow {
  return {
    id: row.id,
    email: String(row.email ?? ""),
    username: String(row.username ?? ""),
    createdAt: formatCreatedAt(row.createdAt),
  };
}

export function mapPendingMarketplaceUserRowSafe(
  row: PendingMarketplaceUserDbRow,
  displayIndex: number,
): PendingMarketplaceUserSafeRow {
  return {
    displayIndex,
    emailMasked: maskMarketplaceEmail(String(row.email ?? "")),
    usernameMasked: maskMarketplaceUsername(String(row.username ?? "")),
    createdAt: formatCreatedAt(row.createdAt),
  };
}
