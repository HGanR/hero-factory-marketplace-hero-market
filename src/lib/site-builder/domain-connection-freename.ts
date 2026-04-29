import type { RequiredRecordsPayload } from "@/lib/site-builder/domain-connection-shared";

export function buildFreenameWeb3SetupInstructions(args: {
  domain: string;
  targetUrl: string;
}): RequiredRecordsPayload {
  const md = [
    `## Freename / Web3 domain → your hosted site`,
    ``,
    `**Your Web3 domain:** \`${args.domain}\``,
    `**Point traffic to:** \`${args.targetUrl}\``,
    ``,
    `### In Freename (or your Web3 DNS provider)`,
    `1. Open the domain’s DNS / “Web3 routing” / resolution settings.`,
    `2. Set the primary target to the **public URL** of your Vercel deployment (or the static URL you published from Site Builder).`,
    `3. If the provider offers an **HTTP redirect** or **proxy** to an https URL, use that and enter \`${args.targetUrl}\`.`,
    `4. Web3 TLDs often resolve through a partner resolver; changes may take **minutes to several hours** to propagate.`,
    ``,
    `### Verification in TroothHurtz`,
    `Use **Re-check** after DNS/Web3 resolution updates. We mark **Connected** only when checks pass or you confirm manual verification for blockchain-only resolution.`,
  ].join("\n");

  return {
    instructionsMarkdown: md,
    checklist: [
      "Saved the target URL in Freename / Web3 DNS",
      "Waited for resolver propagation",
      "Tested the domain in a browser with a Web3-capable DNS or Unstoppable/Freename extension if needed",
    ],
  };
}
