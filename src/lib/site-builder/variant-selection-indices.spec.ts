import { computeVariantSelectionIndices } from "@/lib/site-builder/variant-selection-indices";

describe("computeVariantSelectionIndices", () => {
  it("3 variants: selecting B (index 1) records rejected [0, 2]", () => {
    expect(computeVariantSelectionIndices(1, 3)).toEqual({
      selectedIndex: 1,
      rejectedIndices: [0, 2],
    });
  });

  it("3 variants: selecting A (index 0) records rejected [1, 2]", () => {
    expect(computeVariantSelectionIndices(0, 3)).toEqual({
      selectedIndex: 0,
      rejectedIndices: [1, 2],
    });
  });

  it("single variant: only primary, rejected list empty", () => {
    expect(computeVariantSelectionIndices(0, 1)).toEqual({
      selectedIndex: 0,
      rejectedIndices: [],
    });
  });

  it("2 variants: select alternate", () => {
    expect(computeVariantSelectionIndices(1, 2)).toEqual({
      selectedIndex: 1,
      rejectedIndices: [0],
    });
  });
});
