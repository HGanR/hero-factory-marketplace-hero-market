"use client";

import { useState, useEffect } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";

interface WorldAsset {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  tokenPrice: number;
  modelUrl: string;
  previewImageUrl: string | null;
}

export default function AdminWorldAssetsPage() {
  const [assets, setAssets] = useState<WorldAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"model" | "preview" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    name: "",
    slug: "",
    category: "props",
    description: "",
    modelUrl: "",
    previewImageUrl: "",
    tokenPrice: 0,
    status: "published",
  });

  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const fetchAssets = async () => {
    try {
      const res = await fetch("/api/admin/world-assets", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setAssets(data.assets ?? []);
      else setError(data.error || "Failed to load");
    } catch {
      setError("Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets =
    categoryFilter === "all"
      ? assets
      : assets.filter((a) => a.category === categoryFilter);

  useEffect(() => {
    fetchAssets();
  }, []);

  const slugForUpload =
    form.slug ||
    (form.name ? form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : null) ||
    `asset-${Math.random().toString(36).slice(2, 8)}`;

  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.name.toLowerCase().endsWith(".glb")) {
      setError("Please select a .glb file");
      return;
    }
    setError("");
    setUploading("model");
    try {
      const fd = new FormData();
      fd.append("glb", file);
      fd.append("slug", slugForUpload);
      const res = await fetch("/api/admin/world-assets/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.modelUrl) {
        setForm((f) => ({ ...f, modelUrl: data.modelUrl }));
        setSuccess("Model uploaded");
      } else {
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  const handlePreviewUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop() || "";
    if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      setError("Preview must be JPG, PNG, WebP, or GIF");
      return;
    }
    setError("");
    setUploading("preview");
    try {
      const fd = new FormData();
      fd.append("previewImage", file);
      fd.append("slug", slugForUpload);
      const res = await fetch("/api/admin/world-assets/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.previewImageUrl) {
        setForm((f) => ({ ...f, previewImageUrl: data.previewImageUrl }));
        setSuccess("Preview uploaded");
      } else {
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/world-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || undefined,
          category: form.category,
          description: form.description || undefined,
          modelUrl: form.modelUrl,
          previewImageUrl: form.previewImageUrl || undefined,
          tokenPrice: form.tokenPrice,
          status: form.status,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Asset "${form.name}" created.`);
        setForm({ name: "", slug: "", category: "props", description: "", modelUrl: "", previewImageUrl: "", tokenPrice: 0, status: "published" });
        fetchAssets();
      } else {
        setError(data.error || "Failed to create");
      }
    } catch {
      setError("Failed to create asset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-2">Asset Library</h1>
      <p className="text-slate-400 mb-4">
        Add assets here. Users browse and buy them with TROO tokens in the World Editor (Owned Assets → Browse & buy).
        TROO: 0xa7927231898293377Ce676CFC9bbD551Cb845695 (Polygon, 18 decimals).
      </p>
      <div className="flex gap-4 items-center mb-6">
        <button
          type="button"
          onClick={async () => {
            setError("");
            setSuccess("");
            try {
              const r = await fetch("/api/admin/world-assets/seed", { method: "POST", credentials: "include" });
              const d = await r.json().catch(() => ({}));
              if (r.ok) {
                setSuccess(d.message || "Seeded");
                fetchAssets();
              } else setError(d.error || "Seed failed");
            } catch {
              setError("Seed failed");
            }
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
        >
          Seed Troo Assets
        </button>
        <span className="text-slate-500 text-sm">
          Adds meeting node + buildings (Nexus, Meridian, Apex, Harborview) + Stadium Elyseum if missing
        </span>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-4 mb-8 p-6 bg-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-cyan-400">Add Asset</h2>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Name *</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            placeholder="e.g. Marble Table"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Slug (optional, auto from name)</label>
          <input
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            placeholder="marble-table"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
          >
            <option value="props">props</option>
            <option value="building">building</option>
            <option value="venue">venue</option>
            <option value="meeting_node">meeting_node</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Model (GLB) *</label>
          <div className="flex gap-2">
            <input
              value={form.modelUrl}
              onChange={(e) => setForm((f) => ({ ...f, modelUrl: e.target.value }))}
              className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              placeholder="Upload GLB or paste URL"
              required
            />
            <label className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg cursor-pointer text-sm font-medium disabled:opacity-50 shrink-0">
              <Upload className="h-4 w-4" />
              {uploading === "model" ? "Uploading..." : "Upload"}
              <input
                type="file"
                accept=".glb"
                className="hidden"
                onChange={handleModelUpload}
                disabled={uploading !== null}
              />
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Preview Image</label>
          <div className="flex gap-2">
            <input
              value={form.previewImageUrl}
              onChange={(e) => setForm((f) => ({ ...f, previewImageUrl: e.target.value }))}
              className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              placeholder="Upload image or paste URL"
            />
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg cursor-pointer text-sm font-medium disabled:opacity-50 shrink-0">
              <ImageIcon className="h-4 w-4" />
              {uploading === "preview" ? "Uploading..." : "Upload"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePreviewUpload}
                disabled={uploading !== null}
              />
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">TROO Price (0 = free)</label>
          <input
            type="number"
            min={0}
            value={form.tokenPrice}
            onChange={(e) => setForm((f) => ({ ...f, tokenPrice: Number(e.target.value) || 0 }))}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create Asset"}
        </button>
      </form>

      <h2 className="text-lg font-semibold mb-4">Existing Assets ({filteredAssets.length})</h2>
      <div className="flex gap-2 mb-4">
        <span className="text-slate-400 text-sm">Filter:</span>
        {["all", "props", "building", "venue", "meeting_node"].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1 rounded-lg text-sm ${categoryFilter === cat ? "bg-cyan-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
          >
            {cat === "all" ? "All" : cat.replace("_", " ")}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : filteredAssets.length === 0 ? (
        <p className="text-slate-400">No assets yet. Add one above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-600">
                <th className="py-2 px-4">Name</th>
                <th className="py-2 px-4">Slug</th>
                <th className="py-2 px-4">Category</th>
                <th className="py-2 px-4">Status</th>
                <th className="py-2 px-4">TROO Price</th>
                <th className="py-2 px-4">Model URL</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((a) => (
                <tr key={a.id} className="border-b border-slate-700">
                  <td className="py-2 px-4">{a.name}</td>
                  <td className="py-2 px-4">{a.slug}</td>
                  <td className="py-2 px-4">{a.category}</td>
                  <td className="py-2 px-4">{a.status}</td>
                  <td className="py-2 px-4">{a.tokenPrice}</td>
                  <td className="py-2 px-4">{a.modelUrl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
