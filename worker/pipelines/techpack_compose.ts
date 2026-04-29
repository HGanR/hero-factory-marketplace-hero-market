export type TechpackComposeInput = {
  projectId: string;
  renderUrls: string[];
};

export type TechpackComposeOutput = {
  pdfUrl: string;
};

export async function runTechpackCompose(input: TechpackComposeInput): Promise<TechpackComposeOutput> {
  return {
    pdfUrl: `/downloads/tech-pack-${input.projectId}.pdf`,
  };
}

