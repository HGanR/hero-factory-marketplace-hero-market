import type { NativeSocialImageLayout, NativeSocialImageSpec } from "@/lib/revenue-os/native-social-asset-image";

/**
 * Merges content-derived image lines with a layout branch + optional footnote brand.
 */
export function buildNativeImageSpecForContent(
  base: NativeSocialImageSpec,
  ext: { layout: NativeSocialImageLayout; brandName: string }
): NativeSocialImageSpec {
  return {
    ...base,
    layout: ext.layout,
    brandFootline: ext.brandName,
  };
}
