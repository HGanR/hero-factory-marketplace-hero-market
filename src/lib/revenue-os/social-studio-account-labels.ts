import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import { normalizeAccountPlatformToSocialPlatform } from "@/lib/social/platform-identity";

type Acc = {
  id: string;
  platform: string;
  displayName: string | null;
  directOrganicPublishAvailable?: boolean;
  status?: string;
  capabilities?: {
    canPublishText: boolean;
    canPublishImage: boolean;
    canSchedule: boolean;
  };
};

/**
 * One-line option label for &lt;select&gt; in Social Studio (capability-honest, no false parity).
 */
export function labelSocialStudioAccountOption(account: Acc, targetPlatform: string): string {
  const want = normalizeAccountPlatformToSocialPlatform(targetPlatform);
  const have = normalizeAccountPlatformToSocialPlatform(account.platform);
  const name = coerceTrimmedString(account.displayName) || account.id.slice(0, 8);
  const base = `${account.platform} · ${name}`;
  if (account.status === "expired") return `${base} — token expired, reconnect`;
  if (want && have && want !== have) return `${base} — wrong network for ${targetPlatform}`;
  if (want && have && want === have) {
    if (account.directOrganicPublishAvailable) return `${base} — publish/schedule (with media + approval rules)`;
    return `${base} — limited in-app, prefer draft + export`;
  }
  return base;
}

export function filterSocialStudioAccountsForTarget(accounts: Acc[], targetPlatform: string): Acc[] {
  const want = normalizeAccountPlatformToSocialPlatform(targetPlatform);
  if (!want) return accounts;
  return accounts.filter((a) => normalizeAccountPlatformToSocialPlatform(a.platform) === want);
}
