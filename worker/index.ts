import { runMockupGenerate } from "./pipelines/mockup_generate";
import { runMockupInpaint } from "./pipelines/mockup_inpaint";
import { runTechpackCompose } from "./pipelines/techpack_compose";
import { failJob, finishJob, pollNextJob, saveRender } from "./queue_adapter";
import type { RenderJobInput } from "@/lib/jobs/types";

type WorkerJob =
  | { id: string; type: "RENDER"; input: RenderJobInput }
  | { id: string; type: "INPAINT"; input: any }
  | { id: string; type: "EXPORT_ZIP"; input: any }
  | { id: string; type: "EXPORT_PDF"; input: any };

async function processJob(job: WorkerJob): Promise<Record<string, unknown>> {
  if (job.type === "RENDER") {
    const out = await runMockupGenerate(job.input);
    const kinds = Array.isArray(job.input.kinds) ? job.input.kinds : ["MOCKUP_FRONT"];
    for (let index = 0; index < out.imageUrls.length; index += 1) {
      const kind = (kinds[index] || "MOCKUP_FRONT") as "MOCKUP_FRONT" | "MOCKUP_BACK" | "FLAT" | "LIFESTYLE";
      await saveRender({
        versionId: job.input.versionId,
        kind,
        width: job.input.sizePx,
        height: job.input.sizePx,
        url: out.imageUrls[index],
        metadata: out.metadata,
      });
    }
    return out as Record<string, unknown>;
  }
  if (job.type === "INPAINT") {
    return (await runMockupInpaint(job.input)) as Record<string, unknown>;
  }
  if (job.type === "EXPORT_ZIP") {
    return {
      url: `/downloads/mockup-pack-${String(job.input?.projectId || "project")}.zip`,
    };
  }
  if (job.type === "EXPORT_PDF") {
    return (await runTechpackCompose(job.input)) as Record<string, unknown>;
  }
  return { ok: true };
}

async function main() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const claimed = await pollNextJob(1200);
    const job: WorkerJob = {
      id: claimed.id,
      type: claimed.type,
      input: claimed.input,
    } as WorkerJob;
    try {
      const output = await processJob(job);
      await finishJob(job.id, output);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Worker execution failed";
      await failJob(job.id, message);
    }
  }
}

main().catch((error) => {
  console.error("Merch worker failed", error);
  process.exit(1);
});

