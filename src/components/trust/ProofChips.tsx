"use client";

import { Badge } from "@/components/ui/badge";

export type ProofState = "not_hashed" | "hashed" | "archived" | "anchored";

export function ProofChips({
  proofState,
  hasHash,
  hasArchive,
  hasAnchor,
}: {
  proofState: ProofState;
  hasHash?: boolean;
  hasArchive?: boolean;
  hasAnchor?: boolean;
}) {
  const showHash = hasHash ?? proofState !== "not_hashed";
  const showArchive = hasArchive ?? proofState === "archived";
  const showAnchor = hasAnchor ?? proofState === "anchored";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={showHash ? "secondary" : "outline"} className="rounded-2xl">
        Hash
      </Badge>
      <Badge variant={showArchive ? "secondary" : "outline"} className="rounded-2xl">
        Archive
      </Badge>
      <Badge variant={showAnchor ? "secondary" : "outline"} className="rounded-2xl">
        Anchor
      </Badge>
    </div>
  );
}




