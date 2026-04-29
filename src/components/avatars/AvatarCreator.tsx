"use client";

import { useState } from "react";
import { AVATAR_PRESETS } from "@/lib/avatars/avatar-presets";

interface AvatarCreatorProps {
  onCreated: () => void;
  onCancel: () => void;
}

export function AvatarCreator({ onCreated, onCancel }: AvatarCreatorProps) {
  const [displayName, setDisplayName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<typeof AVATAR_PRESETS[0] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPreset || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          displayName: displayName.trim() || selectedPreset.label,
          avatarModelUrl: selectedPreset.avatarModelUrl,
          thumbnailUrl: selectedPreset.thumbnailUrl,
          configJson: { presetId: selectedPreset.id },
          sourceType: "preset",
          isDefault: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Failed to create avatar");
        setSaving(false);
        return;
      }
      onCreated();
    } catch {
      setError("Network error");
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-600 bg-slate-900/95 p-6 max-w-lg">
      <h3 className="text-lg font-semibold text-slate-100 mb-2">Create Avatar</h3>
      <p className="text-sm text-slate-400 mb-4">
        Choose a preset and set your display name. This avatar will appear in meeting rooms.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 64))}
            placeholder="e.g. Alex Chen"
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">Choose Preset</label>
          <div className="grid grid-cols-3 gap-3">
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedPreset(preset)}
                className={`
                  p-3 rounded-lg border-2 text-left transition-all
                  ${selectedPreset?.id === preset.id
                    ? "border-cyan-400 bg-cyan-500/10"
                    : "border-slate-600 bg-slate-800/60 hover:border-slate-500"}
                `}
              >
                <div className="aspect-square rounded overflow-hidden bg-slate-700 mb-2">
                  <img
                    src={preset.thumbnailUrl}
                    alt={preset.label}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "https://via.placeholder.com/64/334155/94a3b8?text=•";
                    }}
                  />
                </div>
                <p className="text-xs text-slate-300 truncate">{preset.label}</p>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-4">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!selectedPreset || saving}
            className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Creating..." : "Create Avatar"}
          </button>
        </div>
      </form>
    </div>
  );
}
