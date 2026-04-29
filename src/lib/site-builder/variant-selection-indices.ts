/**
 * Maps a user-picked layout index to the intelligence API payload (selected + all other indices rejected).
 * Indices match pipeline order: 0 = primary, 1+ = alternates in order.
 */
export function computeVariantSelectionIndices(
  selectedIndex: number,
  totalVariantCount: number,
): { selectedIndex: number; rejectedIndices: number[] } {
  if (!Number.isFinite(totalVariantCount) || totalVariantCount < 1) {
    throw new Error("totalVariantCount must be >= 1");
  }
  if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || selectedIndex >= totalVariantCount) {
    throw new Error("selectedIndex out of range");
  }
  const rejectedIndices: number[] = [];
  for (let i = 0; i < totalVariantCount; i += 1) {
    if (i !== selectedIndex) rejectedIndices.push(i);
  }
  return { selectedIndex, rejectedIndices };
}
