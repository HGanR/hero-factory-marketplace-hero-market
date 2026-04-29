"use client";

import { useEffect, useState } from "react";
import { AvatarPreviewCard } from "./AvatarPreviewCard";
import { AvatarCreator } from "./AvatarCreator";

interface AvatarRecord {
  id: string;
  displayName: string | null;
  avatarModelUrl: string;
  thumbnailUrl: string | null;
  isDefault: boolean;
  status: string;
}

export function AvatarManager() {
  const [avatars, setAvatars] = useState<AvatarRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAvatars = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/avatars/me", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.avatars)) {
        setAvatars(data.avatars);
      } else {
        setAvatars([]);
      }
    } catch {
      setAvatars([]);
      setError("Failed to load avatars");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvatars();
  }, []);

  const handleSetDefault = async (avatarId: string) => {
    try {
      const res = await fetch(`/api/avatars/${avatarId}/set-default`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        await loadAvatars();
      }
    } catch {
      setError("Failed to set default");
    }
  };

  if (showCreator) {
    return (
      <AvatarCreator
        onCreated={() => {
          setShowCreator(false);
          loadAvatars();
        }}
        onCancel={() => setShowCreator(false)}
      />
    );
  }

  return (
    <div className="rounded-xl border border-slate-600 bg-slate-900/95 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-100">My Avatars</h3>
        <button
          type="button"
          onClick={() => setShowCreator(true)}
          className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500"
        >
          Create Avatar
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 mb-4">{error}</p>
      )}

      {loading ? (
        <div className="py-8 text-center text-slate-400">Loading avatars...</div>
      ) : avatars.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-slate-400 mb-4">No avatars yet. Create one to use in meeting rooms.</p>
          <button
            type="button"
            onClick={() => setShowCreator(true)}
            className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500"
          >
            Create Avatar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {avatars.map((a) => (
            <AvatarPreviewCard
              key={a.id}
              displayName={a.displayName}
              avatarModelUrl={a.avatarModelUrl}
              thumbnailUrl={a.thumbnailUrl}
              isDefault={a.isDefault}
              onSetDefault={() => handleSetDefault(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
