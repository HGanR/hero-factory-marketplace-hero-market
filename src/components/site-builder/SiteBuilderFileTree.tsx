"use client";

export type SiteBuilderFileNode = {
  id: string;
  label: string;
  content: string;
  languageHint?: string;
};

type Props = {
  files: SiteBuilderFileNode[];
  activeId: string;
  onSelect: (id: string) => void;
};

export function SiteBuilderFileTree({ files, activeId, onSelect }: Props) {
  return (
    <nav className="rounded-xl border border-slate-800 bg-slate-950/60 p-2" aria-label="Site Builder file tree">
      <ul className="space-y-1">
        {files.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onSelect(f.id)}
              className={`w-full rounded-lg px-2 py-1.5 text-left text-xs transition ${
                activeId === f.id
                  ? "border border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                  : "border border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900/70"
              }`}
            >
              {f.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
