import type { RenderJobInput } from "@/lib/jobs/types";

export type MockupGenerateOutput = {
  imageUrls: string[];
  metadata: {
    model: string;
    placement: string;
    stylePreset: string;
  };
};

export async function runMockupGenerate(input: RenderJobInput): Promise<MockupGenerateOutput> {
  // Placeholder pipeline contract for self-hosted GPU worker integration.
  // Replace this with ComfyUI / Diffusers invocation.
  const imageUrls = input.kinds.map((kind) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${input.sizePx}" height="${input.sizePx}"><rect width="100%" height="100%" fill="${input.garmentColorHex || "#111827"}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#f8fafc" font-size="48" font-family="Arial, sans-serif">${kind}</text></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  });
  return {
    imageUrls,
    metadata: {
      model: "mock-sdxl-v1",
      placement: input.placement,
      stylePreset: input.stylePreset,
    },
  };
}

