/** Mask PII for broadcast context UI (never stream keys). */
export function maskEmailForBroadcast(email: string): string {
  const [local, domain] = email.trim().split("@");
  if (!domain || local === undefined || local === "") return "***";
  const head = local.slice(0, 1) || "*";
  return `${head}***@${domain}`;
}

export function maskWalletForBroadcast(addr: string): string {
  const a = addr.trim().toLowerCase();
  if (a.length < 12) return "…";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
