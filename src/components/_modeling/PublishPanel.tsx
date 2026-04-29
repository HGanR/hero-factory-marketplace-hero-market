"use client";

import React, { useEffect, useMemo, useState } from "react";

type Category = { id: string; name: string };
type OasisElement = { id: string; name: string; categoryId?: string };

export function PublishPanel(props: {
  contractOk: boolean;
  onPublish: (args: { name: string; categoryId: string }) => Promise<void>;
  onLoadPrefabs: (categoryId?: string) => Promise<void>;
  prefabs: OasisElement[];
}) {
  const { contractOk, onPublish, onLoadPrefabs, prefabs } = props;

  const [name, setName] = useState("Enterable Building");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    (async () => {
      // You can point this to whatever route your admin page uses
      const res = await fetch("/api/admin/oasis/categories");
      if (!res.ok) return;
      const json = await res.json();
      setCategories(json.categories ?? json.data ?? []);
      const first = (json.categories ?? json.data ?? [])[0]?.id;
      if (first) setCategoryId(first);
    })();
  }, []);

  const canPublish = useMemo(() => contractOk && name.trim().length > 2 && !!categoryId, [contractOk, name, categoryId]);

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">Publish to Oasis</div>

      <div className="space-y-2">
        <label className="text-xs opacity-80">Element Name</label>
        <input
          className="w-full rounded border bg-transparent px-2 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="text-xs opacity-80">Category</label>
        <select
          className="w-full rounded border bg-transparent px-2 py-2 text-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id} className="text-black">
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded border text-sm"
            onClick={() => onLoadPrefabs(categoryId)}
            type="button"
          >
            Load Prefabs
          </button>

          <button
            disabled={!canPublish}
            className={`px-3 py-2 rounded border text-sm ${canPublish ? "" : "opacity-40 cursor-not-allowed"}`}
            onClick={async () => {
              setStatus("");
              try {
                setStatus("Publishing...");
                await onPublish({ name, categoryId });
                setStatus("Published.");
              } catch (e: any) {
                setStatus(e?.message ?? "Publish failed.");
              }
            }}
            type="button"
          >
            Publish (GLB + Manifest)
          </button>
        </div>

        {status ? <div className="text-xs opacity-80">{status}</div> : null}
      </div>

      <div className="text-sm font-semibold pt-2">Available Prefabs</div>
      <div className="text-xs opacity-70">
        In editor: choose "Place Prefab", then click in the scene. Prefab will be placed into Interior/Exterior.
      </div>
      <div className="max-h-40 overflow-auto border rounded p-2">
        {prefabs.length === 0 ? (
          <div className="text-xs opacity-60">No prefabs loaded.</div>
        ) : (
          prefabs.map((p) => (
            <div key={p.id} className="text-xs py-1 border-b last:border-b-0">
              {p.name} <span className="opacity-60">({p.id})</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}