import { z } from "zod";

export const ExportTypeSchema = z.enum(["MOCKUP_PACK_ZIP", "TECHPACK_PDF"]);

export const CreateExportSchema = z.object({
  projectId: z.string().min(1),
  type: ExportTypeSchema,
  selectedRenderIds: z.array(z.string().min(1)).optional(),
});

