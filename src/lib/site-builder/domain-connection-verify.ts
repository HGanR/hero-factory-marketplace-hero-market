import { promises as dns } from "node:dns";
import type { DomainType } from "@/lib/site-builder/domain-connection-shared";
import { extractHostFromInput } from "@/lib/site-builder/domain-connection-sanitize";

export type DnsCheckResult = {
  status: "connected" | "pending_verification" | "failed";
  detail: string;
  method: string;
};

function isVercelDnsHost(h: string): boolean {
  const l = h.toLowerCase();
  return l === "cname.vercel-dns.com" || l.endsWith(".cname.vercel-dns.com") || l.endsWith(".vercel-dns.com");
}

/**
 * Web2: compare DNS to the deployment URL host (CNAME, then A-record IP match to target).
 * Web3: never auto-`connected` here — return pending or failed unless `manualConfirm` is handled by caller.
 */
export async function verifyDomainResolution(args: {
  domain: string;
  domainType: DomainType;
  targetUrl: string;
  manualWeb3Confirm?: boolean;
}): Promise<DnsCheckResult> {
  const domain = extractHostFromInput(args.domain);
  if (!domain) {
    return { status: "failed", detail: "Empty domain", method: "validation" };
  }
  let targetHost: string;
  try {
    targetHost = new URL(args.targetUrl).hostname.toLowerCase();
  } catch {
    return { status: "failed", detail: "Invalid target URL", method: "validation" };
  }

  if (args.domainType === "freename_web3" || args.domainType === "other_web3") {
    if (args.manualWeb3Confirm) {
      return { status: "connected", detail: "Operator confirmed Web3 DNS / resolver setup.", method: "manual" };
    }
    try {
      const lookup = await dns.lookup(domain, { all: true, verbatim: true });
      if (lookup && lookup.length > 0) {
        return {
          status: "pending_verification",
          detail:
            "Domain resolved in DNS, but Web3 domains are not always verifiable the same way as Web2. Confirm in browser or your Web3 DNS dashboard, or use operator confirm when satisfied.",
          method: "web3_lookup",
        };
      }
    } catch {
      /* continue */
    }
    return {
      status: "pending_verification",
      detail:
        "Web3 / Freename resolution not detected with standard DNS lookup yet (or still propagating). Try again after updating Freename, or confirm manually when the site loads.",
      method: "web3_pending",
    };
  }

  /* --- Web2 --- */
  try {
    const cnames = await dns.resolveCname(domain);
    for (const c of cnames) {
      const cl = c.toLowerCase();
      if (cl === targetHost || (isVercelDnsHost(cl) && targetHost.endsWith(".vercel.app"))) {
        return { status: "connected", detail: `CNAME ${domain} → ${c}`, method: "dns_cname" };
      }
    }
  } catch {
    /* not a CNAME or NXDOMAIN at this label */
  }

  try {
    const dest = await dns.resolve4(domain);
    const tgt = await dns.resolve4(targetHost);
    if (dest[0] && tgt[0] && dest[0] === tgt[0]) {
      return {
        status: "connected",
        detail: `A record for ${domain} matches deployment host ${targetHost} (${dest[0]})`,
        method: "dns_a_match",
      };
    }
  } catch {
    /* ignore */
  }

  return {
    status: "pending_verification",
    detail: `No CNAME to ${targetHost} (or matching Vercel) and A record does not match yet.`,
    method: "dns_mismatch",
  };
}
