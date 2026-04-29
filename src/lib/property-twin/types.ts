/**
 * Contracts between app, API, reconstruction worker, and viewer.
 */

export const twinOutputFormats = ["glb", "gltf", "splat", "pointcloud"] as const;
export type TwinOutputFormat = (typeof twinOutputFormats)[number];

/** What the studio mounts when a job has usable output */
export type TwinSceneOutput = {
  format: TwinOutputFormat;
  outputUrl: string;
  previewImageUrl?: string;
  metadataUrl?: string;
};

export type ReconstructionJobPayload = {
  propertyId: string;
  mode: "photogrammetry" | "gaussian_splat" | "hybrid";
  assetIds: string[];
  options?: {
    generateMesh?: boolean;
    generatePreview?: boolean;
    inferRoomAnchors?: boolean;
    useFloorplanAlignment?: boolean;
  };
};

export type ReconstructionJobResult = {
  outputUrl: string;
  previewImageUrl?: string;
  metadataUrl?: string;
  format: TwinOutputFormat;
  roomAnchors?: Array<{ name: string; x: number; y: number; z: number }>;
  warnings?: string[];
};

/** Derive viewer input from job row fields */
export function sceneOutputFromJob(row: {
  outputUrl: string | null;
  resultJson: unknown;
}): TwinSceneOutput | null {
  if (!row.outputUrl?.trim()) return null;
  const raw = row.resultJson;
  if (raw && typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    const format = o.format;
    if (
      typeof format === "string" &&
      (twinOutputFormats as readonly string[]).includes(format)
    ) {
      return {
        format: format as TwinOutputFormat,
        outputUrl: row.outputUrl,
        previewImageUrl: typeof o.previewImageUrl === "string" ? o.previewImageUrl : undefined,
        metadataUrl: typeof o.metadataUrl === "string" ? o.metadataUrl : undefined,
      };
    }
  }
  const u = row.outputUrl.toLowerCase();
  let format: TwinOutputFormat = "glb";
  if (u.endsWith(".gltf") || u.includes(".gltf?")) format = "gltf";
  else if (u.endsWith(".splat") || u.includes("splat")) format = "splat";
  else if (u.includes("ply") || u.includes("pcd") || u.includes("pointcloud")) {
    format = "pointcloud";
  }
  return { format, outputUrl: row.outputUrl };
}
