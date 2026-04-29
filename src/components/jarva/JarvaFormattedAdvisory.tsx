"use client";

import React from "react";

type LineProps = { text: string; lineKey: number };

function JarvaLineWithBold({ text, lineKey }: LineProps) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\*\*(.+)\*\*$/);
        if (m) {
          return (
            <strong key={`${lineKey}-${i}`} className="font-semibold text-slate-100">
              {m[1]}
            </strong>
          );
        }
        return <span key={`${lineKey}-${i}`}>{part}</span>;
      })}
    </>
  );
}

/**
 * Trusted Jarva copy only: `**emphasis**` and newlines — no HTML, no full markdown.
 */
export function JarvaFormattedAdvisory({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <div className={className ?? "whitespace-pre-wrap break-words"}>
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {li > 0 ? <br /> : null}
          <JarvaLineWithBold text={line} lineKey={li} />
        </React.Fragment>
      ))}
    </div>
  );
}
