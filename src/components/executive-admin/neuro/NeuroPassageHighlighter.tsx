"use client";

type Props = {
  text: string;
  highlightStart?: number;
  highlightEnd?: number;
  queryTerms?: string[];
};

export function NeuroPassageHighlighter({ text, highlightStart, highlightEnd, queryTerms }: Props) {
  if (highlightStart != null && highlightEnd != null && highlightEnd > highlightStart) {
    const before = text.slice(0, highlightStart);
    const mid = text.slice(highlightStart, highlightEnd);
    const after = text.slice(highlightEnd);
    return (
      <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-200">
        {before}
        <mark className="rounded bg-cyan-400/25 px-0.5 text-cyan-50">{mid}</mark>
        {after}
      </p>
    );
  }

  if (queryTerms?.length) {
    const pattern = new RegExp(`(${queryTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    const parts = text.split(pattern);
    return (
      <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-200">
        {parts.map((part, i) => {
          const isMatch = queryTerms.some((t) => part.toLowerCase() === t.toLowerCase());
          return isMatch ? (
            <mark key={i} className="rounded bg-cyan-400/25 px-0.5 text-cyan-50">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          );
        })}
      </p>
    );
  }

  return <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-200">{text}</p>;
}
