"use client";

import { Badge } from "@/components/ui/badge";

export type DisclosureState = "not_shared" | "shared" | "shared_with_conditions" | "revoked";

export function DisclosureBadge({ state }: { state: DisclosureState }) {
  if (state === "shared") return <Badge className="rounded-2xl">Shared</Badge>;
  if (state === "shared_with_conditions") return <Badge variant="secondary" className="rounded-2xl">Shared (conditions)</Badge>;
  if (state === "revoked") return <Badge variant="destructive" className="rounded-2xl">Revoked</Badge>;
  return <Badge variant="outline" className="rounded-2xl">Not shared</Badge>;
}




