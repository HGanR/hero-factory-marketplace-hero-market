"use client";

/**
 * WorldSelector — Pill-style dropdown for switching between Troo Worlds.
 * Admin-only component for the editor interface.
 * Note: Green Terrain worlds redirect to the standalone /green-terrain page.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export type TerrainType = "urban-flat" | "green-hills" | "desert" | "snow" | "water-city";

export interface WorldInfo {
  id: string;
  name: string;
  slug: string;
  terrainType?: TerrainType;
  isDefault: boolean;
  isPublished: boolean;
}

export type { TerrainType as WorldTerrainType };

interface WorldSelectorProps {
  worlds: WorldInfo[];
  currentWorldId: string;
  currentWorldName: string;
  onSelectWorld: (worldId: string) => void;
  onCreateWorld: () => void;
  onRenameWorld: () => void;
  onDeleteWorld?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export default function WorldSelector({
  worlds,
  currentWorldId,
  currentWorldName,
  onSelectWorld,
  onCreateWorld,
  onRenameWorld,
  onDeleteWorld,
  loading = false,
  disabled = false,
}: WorldSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, handleClickOutside]);

  const currentWorld = worlds.find((w) => w.id === currentWorldId);
  const isDefaultWorld = currentWorld?.isDefault ?? false;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((o) => !o)}
        disabled={disabled || loading}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
          transition-all duration-200 border-2
          ${isOpen 
            ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/20" 
            : "bg-slate-800/80 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <span className="text-xs opacity-70">World:</span>
        <span className="font-semibold max-w-[140px] truncate">
          {loading ? "Loading..." : currentWorldName || "Select World"}
        </span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 rounded-xl border border-cyan-500/30 bg-slate-900/95 backdrop-blur-sm shadow-2xl shadow-black/50 z-50 overflow-hidden">
          <div className="p-2 border-b border-white/10">
            <div className="text-xs text-slate-400 uppercase tracking-wider px-2 py-1">
              Available Worlds
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {worlds.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-400 text-sm">
                No worlds found
              </div>
            ) : (
              worlds.map((world) => (
                <button
                  key={world.id}
                  type="button"
                  onClick={() => {
                    if (world.terrainType === "green-hills") {
                      router.push("/green-terrain");
                      setIsOpen(false);
                      return;
                    }
                    onSelectWorld(world.id);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors
                    ${world.id === currentWorldId 
                      ? "bg-cyan-500/20 text-cyan-300" 
                      : "text-slate-300 hover:bg-white/5"
                    }
                  `}
                >
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center text-lg
                    ${world.id === currentWorldId 
                      ? "bg-cyan-500/30" 
                      : "bg-slate-700/50"
                    }
                  `}>
                    {world.terrainType === "green-hills" ? "🌲" : 
                     world.terrainType === "desert" ? "🏜️" :
                     world.terrainType === "snow" ? "❄️" :
                     world.terrainType === "water-city" ? "🌊" :
                     world.isDefault ? "🌍" : "🏙️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{world.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span className="truncate">{world.slug}</span>
                      {world.isDefault && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] uppercase">
                          Default
                        </span>
                      )}
                      {world.isPublished && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] uppercase">
                          Live
                        </span>
                      )}
                    </div>
                  </div>
                  {world.id === currentWorldId && (
                    <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="p-2 border-t border-white/10 space-y-1">
            <button
              type="button"
              onClick={() => {
                onRenameWorld();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 rounded-lg text-sm text-left text-slate-300 hover:bg-white/5 flex items-center gap-2"
            >
              <span className="text-base">✏️</span>
              <span>Rename Current World</span>
            </button>
            
            <button
              type="button"
              onClick={() => {
                onCreateWorld();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 rounded-lg text-sm text-left text-cyan-400 hover:bg-cyan-500/10 flex items-center gap-2"
            >
              <span className="text-base">➕</span>
              <span>Create New World</span>
            </button>

            {onDeleteWorld && !isDefaultWorld && (
              <button
                type="button"
                onClick={() => {
                  onDeleteWorld();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 rounded-lg text-sm text-left text-red-400 hover:bg-red-500/10 flex items-center gap-2"
              >
                <span className="text-base">🗑️</span>
                <span>Delete World</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
