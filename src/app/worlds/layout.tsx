"use client";

import { useCallback } from "react";
import { WorldExplorerNavBar } from "@/components/world-explorer/WorldExplorerNavBar";

export default function WorldsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const handleCreate = useCallback(() => {
    window.location.href = "/worlds/new";
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <WorldExplorerNavBar onCreateWorld={handleCreate} creating={false} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}
