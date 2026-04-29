"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "@/lib/avatar-library/src/ui/avatar-library.css";

type LibraryCreator = {
  destroy: () => void;
  resetToDefaults: () => Promise<void>;
};

/**
 * Embeds the 3D avatar creator from `src/lib/avatar-library` (Avatar Creator Library).
 * Mounts on client only; cleans up WebGL on unmount.
 */
export function AvatarLibraryStudio() {
  const rootRef = useRef<HTMLDivElement>(null);
  const creatorRef = useRef<LibraryCreator | null>(null);
  const [ready, setReady] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let creatorInstance: LibraryCreator | null = null;

    void import("@/lib/avatar-library/src/AvatarCreator.js").then(
      ({ AvatarCreator }) => {
        if (cancelled || !rootRef.current) return;
        creatorInstance = new AvatarCreator(rootRef.current, {
          engine: {
            backgroundColor: 0x0f172a,
            ambientIntensity: 0.72,
            directionalIntensity: 1.28,
          },
        });
        creatorRef.current = creatorInstance;
        setReady(true);
        if (cancelled) {
          creatorInstance.destroy();
          creatorRef.current = null;
          setReady(false);
        }
      }
    );

    return () => {
      cancelled = true;
      creatorRef.current = null;
      setReady(false);
      creatorInstance?.destroy();
    };
  }, []);

  const handleReset = useCallback(() => {
    const c = creatorRef.current;
    if (!c || resetting) return;
    setResetting(true);
    void c
      .resetToDefaults()
      .catch(() => {})
      .finally(() => setResetting(false));
  }, [resetting]);

  return (
    <section className="rounded-xl border border-slate-600/80 bg-[#0a0a14] overflow-hidden shadow-xl">
      <div className="px-4 py-3 border-b border-slate-700/80 flex flex-wrap items-center gap-3 bg-[#0f0f1a]/95">
        <h2 className="text-base font-semibold text-slate-100 tracking-tight">
          3D Avatar Studio
        </h2>
        <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded-full">
          Library
        </span>
        <button
          type="button"
          onClick={handleReset}
          disabled={!ready || resetting}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-500 text-slate-200 hover:bg-slate-800 hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {resetting ? "Resetting…" : "Reset design"}
        </button>
        <p className="text-xs text-slate-400 ml-auto max-w-md text-right">
          Customize body, face, and wardrobe. Use Save in the viewport to download JSON.
        </p>
      </div>
      <div
        ref={rootRef}
        className="w-full min-h-[min(85vh,900px)] h-[70vh] md:h-[75vh]"
        aria-label="3D avatar creator"
      />
    </section>
  );
}
