import { Suspense } from "react";
import OasisWorldViewer from "@/components/oasis/OasisWorldViewer";

function ViewerShell({ modelUrl }: { modelUrl: string }) {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-2xl font-semibold">OASIS World Viewer</div>
        <div className="text-sm text-slate-400 mt-2">
          Provide a GLB URL via <span className="text-white">?model=</span> to preview.
        </div>

        <div className="mt-6 h-[70vh]">
          <OasisWorldViewer modelUrl={modelUrl} />
        </div>
      </div>
    </div>
  );
}

export default async function OasisViewerPage({
  searchParams,
}: {
  searchParams?: Promise<{ model?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const modelUrl = params?.model ?? "";

  return (
    <Suspense fallback={<ViewerShell modelUrl="" />}>
      <ViewerShell modelUrl={modelUrl} />
    </Suspense>
  );
}
