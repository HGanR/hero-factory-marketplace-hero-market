/**
 * Shared workspace summary for Trust Records / Jarva — same shape as GET /api/trusts/[trustId]/workspace/summary.
 * Call after apply so clients can refresh checklist without a separate round-trip.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { getDb } from "@/lib/db";
import { ensureClientsTitleColumn } from "@/lib/db/clients-ensure";
import {
  clients,
  securityCertificates,
  securityOfferings,
  trustAssets,
  trustBeneficiaries,
  trustDebtInstruments,
  trustDrafts,
  trustParties,
  trusts,
  workflowAssetCertificates,
} from "@/lib/db/schema";

export type WorkspaceSummaryPayload = NonNullable<Awaited<ReturnType<typeof buildWorkspaceSummaryForTrust>>>;

export async function buildWorkspaceSummaryForTrust(
  db: Awaited<ReturnType<typeof getDb>>,
  trustId: string,
  userId: number
): Promise<{
  trust: {
    id: string;
    clientId: string | null;
    name: string | null;
    trustType: string | null;
    jurisdictionState: string | null;
    workspaceStatus: string | null;
  };
  client: { id: string; fullName: string; title: string | null } | null;
  parties: {
    grantorName: string | null;
    trusteeName: string | null;
    grantorAddress: Record<string, string | null> | null;
    trusteeAddress: Record<string, string | null> | null;
  };
  firm: { name: string | null; address: string | null; phone: string | null; email: string | null };
  counts: { parties: number; beneficiaries: number; assets: number };
  checklist: {
    partiesAndRoles: boolean;
    beneficiaries: boolean;
    assetsAndFundingPlan: boolean;
    generateDraftDocuments: boolean;
  };
  /** Real work-product counts (Trust workflow DB), not chat heuristics */
  workProduct: {
    /** Rows in workflow_asset_certificates for this trust (Trust Records → Issue flow). */
    issuedAssetCertificateCount: number;
    /** Securities module: all certificate rows (any status). */
    securitiesCertificatesIssuedCount: number;
    /** Securities module: status === issued (excludes voided/replaced). */
    securitiesCertificatesIssuedActiveCount: number;
    /** Securities offerings (Issue Security) — any status. */
    securityOfferingCount: number;
    /** Offerings with status draft. */
    securityOfferingDraftCount: number;
    /** Offerings finalized (package generated / locked in module). */
    securityOfferingFinalizedCount: number;
    /** Bond / debt instruments anchored in DB (Trust Records bond flow). */
    bondInstrumentCount: number;
    /** Bonds in pre-issuance pipeline (draft → offering_configured). */
    bondPreIssuanceCount: number;
    /** Bonds with status issued. */
    bondIssuedCount: number;
    /** Offerings with status cancelled (Issue Security). */
    securityOfferingCancelledCount: number;
    /** Offerings with status error. */
    securityOfferingErrorCount: number;
    /** Securities certificates voided or replaced (not active issued lines). */
    securitiesCertificatesVoidedOrReplacedCount: number;
    /** Bonds with status closed (post-issuance lifecycle). */
    bondClosedCount: number;
    /** Bonds with status voided. */
    bondVoidedCount: number;
    /** Derived — no duplicate storage. */
    hasDraftOffering: boolean;
    hasFinalizedOffering: boolean;
    hasIssuedSecuritiesCertificate: boolean;
    hasIssuedWorkflowAssetCertificate: boolean;
    /** True if trust workflow and/or active (issued-status) securities certificates exist. */
    hasAnyIssuedCertificateLike: boolean;
    hasBondInstrument: boolean;
    hasActiveBondWorkflow: boolean;
    hasIssuedBond: boolean;
  };
} | null> {
  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, String(trustId)), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return null;
  const t: any = trustRows[0];

  const parties = await db.select().from(trustParties).where(eq(trustParties.trustId, String(trustId)));
  const beneficiaries = await db
    .select({ id: trustBeneficiaries.id })
    .from(trustBeneficiaries)
    .where(eq(trustBeneficiaries.trustId, String(trustId)));
  const assets = await db.select({ id: trustAssets.id }).from(trustAssets).where(eq(trustAssets.trustId, String(trustId)));

  const grantor = parties.find((p: any) => p.role === "grantor") ?? null;
  const trustee = parties.find((p: any) => p.role === "trustee") ?? null;

  let clientInfo: { id: string; fullName: string; title: string | null } | null = null;
  if (t.clientId) {
    await ensureClientsTitleColumn();
    const clientRows = await db
      .select({
        id: clients.id,
        firstName: clients.firstName,
        middleName: clients.middleName,
        lastName: clients.lastName,
        suffix: clients.suffix,
        title: clients.title,
      })
      .from(clients)
      .where(and(eq(clients.id, String(t.clientId)), eq(clients.userId, t.userId)))
      .limit(1);
    if (clientRows.length > 0) {
      const c = clientRows[0] as Record<string, unknown>;
      const fullName = [c.firstName, c.middleName, c.lastName, c.suffix]
        .filter((p) => p && String(p).trim())
        .map((p) => String(p).trim())
        .join(" ")
        .trim();
      clientInfo = {
        id: String(c.id),
        fullName,
        title: c.title && String(c.title).trim() ? String(c.title) : null,
      };
    }
  }

  const grantorAddress = grantor
    ? {
        line1: grantor.addressLine1 ?? null,
        line2: grantor.addressLine2 ?? null,
        city: grantor.city ?? null,
        state: grantor.state ?? null,
        postalCode: grantor.postalCode ?? null,
        country: grantor.country ?? null,
      }
    : null;
  const trusteeAddress = trustee
    ? {
        line1: trustee.addressLine1 ?? null,
        line2: trustee.addressLine2 ?? null,
        city: trustee.city ?? null,
        state: trustee.state ?? null,
        postalCode: trustee.postalCode ?? null,
        country: trustee.country ?? null,
      }
    : null;

  let firm = {
    name: (t as any).firmName ?? null,
    address: (t as any).firmAddress ?? null,
    phone: (t as any).firmPhone ?? null,
    email: (t as any).firmEmail ?? null,
  };
  try {
    const draftRows = await db
      .select({ payloadJson: trustDrafts.payloadJson })
      .from(trustDrafts)
      .where(and(eq(trustDrafts.trustId, String(trustId)), eq(trustDrafts.draftType, "smart-trust-draft")))
      .orderBy(desc(trustDrafts.version))
      .limit(1);
    if (draftRows.length > 0) {
      const raw = String(draftRows[0]?.payloadJson ?? "");
      const parsed = raw ? JSON.parse(raw) : null;
      const draft = parsed?.draft ?? null;
      firm = {
        name: firm.name ?? draft?.firmName ?? null,
        address: firm.address ?? draft?.firmAddress ?? null,
        phone: firm.phone ?? draft?.firmPhone ?? null,
        email: firm.email ?? draft?.firmEmail ?? null,
      };
    }
  } catch {
    /* best-effort */
  }

  const certCountRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(workflowAssetCertificates)
    .where(eq(workflowAssetCertificates.trustId, String(trustId)));
  const issuedAssetCertificateCount = Number(certCountRows[0]?.c ?? 0);

  const secCertRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(securityCertificates)
    .where(eq(securityCertificates.trustId, String(trustId)));
  const securitiesCertificatesIssuedCount = Number(secCertRows[0]?.c ?? 0);

  const secCertIssuedActiveRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(securityCertificates)
    .where(and(eq(securityCertificates.trustId, String(trustId)), eq(securityCertificates.status, "issued")));
  const securitiesCertificatesIssuedActiveCount = Number(secCertIssuedActiveRows[0]?.c ?? 0);

  const offeringCountRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(securityOfferings)
    .where(eq(securityOfferings.trustId, String(trustId)));
  const securityOfferingCount = Number(offeringCountRows[0]?.c ?? 0);

  const offeringDraftRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(securityOfferings)
    .where(and(eq(securityOfferings.trustId, String(trustId)), eq(securityOfferings.status, "draft")));
  const securityOfferingDraftCount = Number(offeringDraftRows[0]?.c ?? 0);

  const offeringFinalRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(securityOfferings)
    .where(and(eq(securityOfferings.trustId, String(trustId)), eq(securityOfferings.status, "finalized")));
  const securityOfferingFinalizedCount = Number(offeringFinalRows[0]?.c ?? 0);

  const offeringCancelledRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(securityOfferings)
    .where(and(eq(securityOfferings.trustId, String(trustId)), eq(securityOfferings.status, "cancelled")));
  const securityOfferingCancelledCount = Number(offeringCancelledRows[0]?.c ?? 0);

  const offeringErrorRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(securityOfferings)
    .where(and(eq(securityOfferings.trustId, String(trustId)), eq(securityOfferings.status, "error")));
  const securityOfferingErrorCount = Number(offeringErrorRows[0]?.c ?? 0);

  const secCertVoidedRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(securityCertificates)
    .where(
      and(
        eq(securityCertificates.trustId, String(trustId)),
        inArray(securityCertificates.status, ["voided", "replaced"])
      )
    );
  const securitiesCertificatesVoidedOrReplacedCount = Number(secCertVoidedRows[0]?.c ?? 0);

  const bondCountRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(trustDebtInstruments)
    .where(eq(trustDebtInstruments.trustId, String(trustId)));
  const bondInstrumentCount = Number(bondCountRows[0]?.c ?? 0);

  const bondPreIssuanceStatuses = [
    "draft",
    "authority_failed",
    "authority_passed",
    "resolution_adopted",
    "offering_configured",
  ] as const;

  const bondPreRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(trustDebtInstruments)
    .where(
      and(eq(trustDebtInstruments.trustId, String(trustId)), inArray(trustDebtInstruments.status, bondPreIssuanceStatuses))
    );
  const bondPreIssuanceCount = Number(bondPreRows[0]?.c ?? 0);

  const bondIssuedRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(trustDebtInstruments)
    .where(and(eq(trustDebtInstruments.trustId, String(trustId)), eq(trustDebtInstruments.status, "issued")));
  const bondIssuedCount = Number(bondIssuedRows[0]?.c ?? 0);

  const bondClosedRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(trustDebtInstruments)
    .where(and(eq(trustDebtInstruments.trustId, String(trustId)), eq(trustDebtInstruments.status, "closed")));
  const bondClosedCount = Number(bondClosedRows[0]?.c ?? 0);

  const bondVoidedRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(trustDebtInstruments)
    .where(and(eq(trustDebtInstruments.trustId, String(trustId)), eq(trustDebtInstruments.status, "voided")));
  const bondVoidedCount = Number(bondVoidedRows[0]?.c ?? 0);

  return {
    trust: {
      id: String(t.id),
      clientId: t.clientId ?? null,
      name: t.name ?? null,
      trustType: t.trustType ?? null,
      jurisdictionState: t.jurisdictionState ?? null,
      workspaceStatus: t.workspaceStatus ?? null,
    },
    client: clientInfo,
    parties: {
      grantorName: grantor?.displayName ?? null,
      trusteeName: trustee?.displayName ?? null,
      grantorAddress,
      trusteeAddress,
    },
    firm,
    counts: {
      parties: parties.length,
      beneficiaries: beneficiaries.length,
      assets: assets.length,
    },
    checklist: {
      partiesAndRoles: Boolean(grantor?.displayName) && Boolean(trustee?.displayName),
      beneficiaries: beneficiaries.length > 0,
      assetsAndFundingPlan: assets.length > 0,
      generateDraftDocuments: false,
    },
    workProduct: {
      issuedAssetCertificateCount,
      securitiesCertificatesIssuedCount,
      securitiesCertificatesIssuedActiveCount,
      securityOfferingCount,
      securityOfferingDraftCount,
      securityOfferingFinalizedCount,
      bondInstrumentCount,
      bondPreIssuanceCount,
      bondIssuedCount,
      securityOfferingCancelledCount,
      securityOfferingErrorCount,
      securitiesCertificatesVoidedOrReplacedCount,
      bondClosedCount,
      bondVoidedCount,
      hasDraftOffering: securityOfferingDraftCount > 0,
      hasFinalizedOffering: securityOfferingFinalizedCount > 0,
      hasIssuedSecuritiesCertificate: securitiesCertificatesIssuedActiveCount > 0,
      hasIssuedWorkflowAssetCertificate: issuedAssetCertificateCount > 0,
      hasAnyIssuedCertificateLike:
        issuedAssetCertificateCount > 0 || securitiesCertificatesIssuedActiveCount > 0,
      hasBondInstrument: bondInstrumentCount > 0,
      hasActiveBondWorkflow: bondPreIssuanceCount > 0,
      hasIssuedBond: bondIssuedCount > 0,
    },
  };
}
