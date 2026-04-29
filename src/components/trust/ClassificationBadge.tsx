"use client";

import { Badge } from "@/components/ui/badge";

export type DocumentClassification = "public" | "demandable" | "private";

export function ClassificationBadge({ classification }: { classification: DocumentClassification }) {
  if (classification === "public") return <Badge className="rounded-2xl">Public</Badge>;
  if (classification === "demandable") return <Badge variant="secondary" className="rounded-2xl">Demandable</Badge>;
  return <Badge variant="outline" className="rounded-2xl">Private</Badge>;
}




