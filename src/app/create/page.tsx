"use client";

import { useMemo, useState } from "react";

type RenderKind = "MOCKUP_FRONT" | "MOCKUP_BACK";

function fakeJobId() {
  return `job_${Math.random().toString(36).slice(2, 10)}`;
}

export default function CreatePage() {
  const [prompt, setPrompt] = useState("");
  const [garmentTemplateId, setGarmentTemplateId] = useState("tee_black_front_template_asset_id");
  const [garmentColorHex, setGarmentColorHex] = useState("#111111");
  const [placement, setPlacement] = useState<"CENTER_CHEST" | "LEFT_CHEST" | "FULL_FRONT">("CENTER_CHEST");
  const [stylePreset, setStylePreset] = useState<"STREETWEAR" | "MINIMAL" | "VINTAGE" | "Y2K">("STREETWEAR");
  const [kinds, setKinds] = useState<RenderKind[]>(["MOCKUP_FRONT"]);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = useMemo(() => prompt.trim().length >= 3, [prompt]);

  async function generate() {
    setBusy(true);
    setImages([]);
    setJobId(null);
    setError(null);
    try {
      // Endpoint scaffolding intentionally mirrors the production API plan.
      const projectRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lane: "CREATE", name: "Untitled Design" }),
      });
      if (!projectRes.ok) {
        throw new Error("Projects API is not wired yet. Route scaffolding is ready.");
      }
      const project = await projectRes.json();
      const versionRes = await fetch(`/api/projects/${project.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "GENERATE",
          prompt,
          params: { garmentTemplateId, garmentColorHex, placement, stylePreset, kinds },
        }),
      });
      if (!versionRes.ok) {
        throw new Error("Versions API is not wired yet.");
      }
      const version = await versionRes.json();
      const jobRes = await fetch(`/api/projects/${project.id}/versions/${version.id}/renders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lane: "CREATE",
          projectId: project.id,
          prompt,
          garmentTemplateId,
          garmentColorHex,
          placement,
          stylePreset,
          kinds,
          sizePx: 1024,
        }),
      });
      if (!jobRes.ok) {
        throw new Error("Render jobs API is not wired yet.");
      }
      const job = await jobRes.json();
      setJobId(job.jobId || fakeJobId());
    } catch (err) {
      setJobId(fakeJobId());
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-3xl font-bold">Create to Wear</h1>
        <p className="mt-2 text-sm text-slate-400">Type an idea, generate a mockup, then download or order.</p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
            <label className="text-sm font-semibold">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder="Example: minimalist black & white koi fish, clean vector vibe, center chest"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-400">Template Id</label>
                <input
                  value={garmentTemplateId}
                  onChange={(e) => setGarmentTemplateId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Garment Color</label>
                <input
                  type="color"
                  value={garmentColorHex}
                  onChange={(e) => setGarmentColorHex(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Placement</label>
                <select
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value as "CENTER_CHEST" | "LEFT_CHEST" | "FULL_FRONT")}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="CENTER_CHEST">Center chest</option>
                  <option value="LEFT_CHEST">Left chest</option>
                  <option value="FULL_FRONT">Full front</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Style</label>
                <select
                  value={stylePreset}
                  onChange={(e) => setStylePreset(e.target.value as "STREETWEAR" | "MINIMAL" | "VINTAGE" | "Y2K")}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="STREETWEAR">Streetwear</option>
                  <option value="MINIMAL">Minimal</option>
                  <option value="VINTAGE">Vintage</option>
                  <option value="Y2K">Y2K</option>
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={kinds.includes("MOCKUP_FRONT")}
                  onChange={(e) =>
                    setKinds((k) =>
                      e.target.checked ? Array.from(new Set([...k, "MOCKUP_FRONT"])) : k.filter((x) => x !== "MOCKUP_FRONT")
                    )
                  }
                />
                Front
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={kinds.includes("MOCKUP_BACK")}
                  onChange={(e) =>
                    setKinds((k) =>
                      e.target.checked ? Array.from(new Set([...k, "MOCKUP_BACK"])) : k.filter((x) => x !== "MOCKUP_BACK")
                    )
                  }
                />
                Back
              </label>
            </div>

            <button
              disabled={!canGenerate || busy}
              onClick={() => void generate()}
              className="mt-4 w-full rounded-xl border border-cyan-500 bg-cyan-500/20 px-4 py-3 font-semibold text-cyan-200 disabled:opacity-50"
            >
              {busy ? "Generating..." : "Generate Mockup"}
            </button>

            {jobId ? <div className="mt-2 text-xs text-slate-400">Job: {jobId}</div> : null}
            {error ? <div className="mt-2 text-xs text-amber-300">{error}</div> : null}
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
            <div className="text-sm font-semibold">Results</div>
            {images.length === 0 ? (
              <div className="mt-3 text-sm text-slate-400">Your mockups will appear here.</div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {images.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="mockup" className="w-full rounded-xl border border-slate-700" />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

