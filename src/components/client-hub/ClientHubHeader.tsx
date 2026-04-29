import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string | null;
  meta?: ReactNode;
};

export function ClientHubHeader({ title, description, meta }: Props) {
  return (
    <header className="border-b border-white/5 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p> : null}
        </div>
        {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
      </div>
    </header>
  );
}
