type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-3xl font-bold">Project Details</h1>
        <p className="mt-2 text-sm text-slate-400">Project ID: {projectId}</p>
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-5 text-sm text-slate-300">
          Version timeline, renders, and export actions placeholder.
        </div>
      </div>
    </div>
  );
}

