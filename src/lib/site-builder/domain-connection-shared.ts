import { z } from "zod";

export const DomainTypeSchema = z.enum(["web2", "freename_web3", "other_web3"]);
export type DomainType = z.infer<typeof DomainTypeSchema>;

export const DomainProviderSchema = z.enum(["freename", "vercel", "external"]);
export type DomainProvider = z.infer<typeof DomainProviderSchema>;

export const DomainConnectionStatusSchema = z.enum([
  "draft",
  "instructions_ready",
  "pending_verification",
  "connected",
  "failed",
]);
export type DomainConnectionStatus = z.infer<typeof DomainConnectionStatusSchema>;

export const DeploymentTargetSchema = z.enum([
  "vercel_deployment_url",
  "vercel_custom_domain",
  "static_export_url",
]);
export type DeploymentTarget = z.infer<typeof DeploymentTargetSchema>;

/** Flexible payload for DNS rows + assistant-facing instructions. */
export const RequiredRecordsPayloadSchema = z.object({
  records: z
    .array(
      z.object({
        type: z.string().max(16),
        name: z.string().max(255),
        value: z.string().max(2000),
        ttl: z.number().int().min(0).optional(),
        purpose: z.string().max(400).optional(),
      }),
    )
    .max(32)
    .optional(),
  instructionsMarkdown: z.string().max(12000).optional(),
  checklist: z.array(z.string().max(400)).max(24).optional(),
  vercelDomainResponse: z.record(z.string(), z.unknown()).optional(),
});

export type RequiredRecordsPayload = z.infer<typeof RequiredRecordsPayloadSchema>;
