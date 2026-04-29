"use client";

type Props = {
  title: string;
  languageHint?: string;
  code: string;
};

export function SiteBuilderCodeViewer({ title, languageHint, code }: Props) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80">
      <header className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs">
        <span className="font-medium text-slate-200">{title}</span>
        <span className="text-slate-500">{languageHint || "text"}</span>
      </header>
      <pre className="max-h-[420px] overflow-auto p-3 text-[11px] leading-relaxed text-slate-300">
        <code>{code}</code>
      </pre>
    </section>
  );
}
