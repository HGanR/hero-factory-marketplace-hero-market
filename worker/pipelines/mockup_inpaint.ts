export type InpaintInput = {
  projectId: string;
  versionId: string;
  baseRenderId: string;
  prompt: string;
  maskAssetUrl: string;
  sizePx: number;
};

export type InpaintOutput = {
  imageUrl: string;
  metadata: {
    model: string;
  };
};

export async function runMockupInpaint(input: InpaintInput): Promise<InpaintOutput> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${input.sizePx}" height="${input.sizePx}"><rect width="100%" height="100%" fill="#0f172a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#f8fafc" font-size="34" font-family="Arial, sans-serif">INPAINT</text></svg>`;
  return {
    imageUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    metadata: {
      model: "mock-inpaint-v1",
    },
  };
}

