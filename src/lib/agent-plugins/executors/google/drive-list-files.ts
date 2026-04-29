import type { AgentExecutionContext } from "@/lib/agent-plugins/types";
import { agentActionSuccess } from "@/lib/agent-plugins/action-result";
import { fetchGoogleJson } from "@/lib/agent-plugins/google-fetch";

export type DriveListFilesInput = {
  pageSize?: number;
};

export type DriveListFilesData = {
  files: Array<{ id: string; name?: string; mimeType?: string }>;
};

/**
 * GET drive/v3/files — normalized file list.
 */
export async function executeDriveListFiles(ctx: AgentExecutionContext, input: unknown) {
  const body = (input && typeof input === "object" ? input : {}) as DriveListFilesInput;
  const pageSize =
    typeof body.pageSize === "number" && body.pageSize > 0 && body.pageSize <= 50
      ? body.pageSize
      : 10;

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("fields", "files(id,name,mimeType),nextPageToken");

  const json = (await fetchGoogleJson(ctx, url.toString())) as {
    files?: Array<{ id?: string; name?: string; mimeType?: string }>;
  };

  const files: Array<{ id: string; name?: string; mimeType?: string }> = [];
  for (const f of json.files ?? []) {
    if (typeof f.id === "string") {
      files.push({
        id: f.id,
        name: typeof f.name === "string" ? f.name : undefined,
        mimeType: typeof f.mimeType === "string" ? f.mimeType : undefined,
      });
    }
  }

  const data: DriveListFilesData = { files };
  return agentActionSuccess("drive.listFiles", ctx.agentId, data);
}
