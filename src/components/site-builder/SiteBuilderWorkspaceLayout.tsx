"use client";

import type { ReactNode } from "react";

type Props = {
  preview: ReactNode;
  assistant: ReactNode;
  fileDrawer?: ReactNode;
};

export function SiteBuilderWorkspaceLayout({ preview, assistant, fileDrawer }: Props) {
  return (
    <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
      <div className="min-w-0 space-y-4">
        {preview}
        {fileDrawer}
      </div>
      <aside className="min-h-[72vh] min-w-0">{assistant}</aside>
    </section>
  );
}
