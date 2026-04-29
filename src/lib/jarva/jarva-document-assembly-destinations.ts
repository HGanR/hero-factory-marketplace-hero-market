import type { JarvaDocumentAssemblyHints } from "@/lib/jarva/jarva-document-assembly-hints";

/** Row keys that map to navigation + copy (single source for panel + tests). */
export type JarvaAssemblyReadinessRowKey = keyof Pick<
  JarvaDocumentAssemblyHints,
  "ppmDraftReadyForGeneration" | "certificatePackageReady" | "bondDocumentationReady" | "trustReviewPacketReady"
>;

export type JarvaAssemblyReadinessRowMeta = {
  key: JarvaAssemblyReadinessRowKey;
  /** Consultant-visible row title — aligned with chat/banner vocabulary. */
  label: string;
  /** Primary link label (destination-specific). */
  primaryLinkLabel: string;
  /** Subtle secondary cue — same surface, minimal UI. */
  secondaryActionLabel: string;
  href: (trustId: string) => string;
};

const enc = (trustId: string) => encodeURIComponent(trustId);

/**
 * Existing app routes only — Trust Records tabs per `trust-records/page.tsx` `tab` allow-list.
 */
export const JARVA_ASSEMBLY_READINESS_ROWS: JarvaAssemblyReadinessRowMeta[] = [
  {
    key: "ppmDraftReadyForGeneration",
    label: "PPM draft assembly — proceed to issuance prep (DRAFT)",
    primaryLinkLabel: "Open Issue Security",
    secondaryActionLabel: "Continue in Issue Security",
    href: (trustId) => `/trusts/${enc(trustId)}/issue-security`,
  },
  {
    key: "certificatePackageReady",
    label: "Certificate package — review assembly (DRAFT)",
    primaryLinkLabel: "Open Certificates",
    secondaryActionLabel: "Trust Records → Certificates tab",
    href: (trustId) => `/trust-records?trustId=${enc(trustId)}&tab=registry`,
  },
  {
    key: "bondDocumentationReady",
    label: "Bond documentation — draft assembly (DRAFT)",
    primaryLinkLabel: "Open Bonds",
    secondaryActionLabel: "Trust Records → Bonds tab",
    href: (trustId) => `/trust-records?trustId=${enc(trustId)}&tab=bonds`,
  },
  {
    key: "trustReviewPacketReady",
    label: "Trust review packet — review assembly (DRAFT)",
    primaryLinkLabel: "Review in Jarva",
    secondaryActionLabel: "Jarva intake & review",
    href: (trustId) => `/trust-records/jarva?trustId=${enc(trustId)}`,
  },
];

export function jarvaAssemblyReadinessHref(trustId: string, key: JarvaAssemblyReadinessRowKey): string {
  const row = JARVA_ASSEMBLY_READINESS_ROWS.find((r) => r.key === key);
  return row ? row.href(trustId) : `/trusts/${enc(trustId)}`;
}
