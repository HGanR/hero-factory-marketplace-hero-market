export type JobType = "RENDER" | "INPAINT" | "EXPORT_ZIP" | "EXPORT_PDF";
export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";

export type RenderJobInput = {
  projectId: string;
  versionId: string;
  lane: "CREATE" | "STUDIO";
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  garmentTemplateUrl: string;
  garmentColorHex?: string;
  placement: string;
  stylePreset: string;
  kinds: string[];
  sizePx: number;
};

