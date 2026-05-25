"use client";

import type { ReactNode } from "react";

type Props = {
  preview: ReactNode;
  assistant: ReactNode;
  fileDrawer?: ReactNode;
};

export function SiteBuilderWorkspaceLayout({ preview, assistant, fileDrawer }: Props) {
  return (
    <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
      <aside className="min-h-[72vh] min-w-0 xl:order-1">{assistant}</aside>
      <div className="min-w-0 space-y-4 xl:order-2">
        {preview}
        {fileDrawer}
      </div>
    </section>
  );
}
