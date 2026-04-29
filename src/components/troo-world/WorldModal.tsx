"use client";

/**
 * WorldModal — Modal dialogs for creating/renaming Troo Worlds.
 */
import { useState, useEffect, useRef } from "react";

interface WorldModalProps {
  isOpen: boolean;
  mode: "create" | "rename";
  currentName?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  loading?: boolean;
}

export default function WorldModal({
  isOpen,
  mode,
  currentName = "",
  onClose,
  onSubmit,
  loading = false,
}: WorldModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(mode === "rename" ? currentName : "");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, mode, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("World name is required");
      return;
    }
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    setError("");
    try {
      await onSubmit(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-cyan-400">
            {mode === "create" ? "Create New World" : "Rename World"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              World Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={mode === "create" ? "e.g., Beach Resort Campus" : "Enter new name"}
              className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              disabled={loading}
            />
            {error && (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            )}
          </div>

          {mode === "create" && (
            <p className="text-xs text-slate-500">
              The new world will start empty. You can add buildings and elements using the editor tools.
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg border border-white/20 text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </span>
              ) : mode === "create" ? "Create World" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
