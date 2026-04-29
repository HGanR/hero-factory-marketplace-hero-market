"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ENTITY_PLAYBOOKS } from "@/lib/entity-playbooks";

export default function EntityBuilderPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <div className="text-2xl font-semibold">Entity Builder</div>
        <div className="text-sm text-muted-foreground">
          Launch a guided, auditable construction flow for each structure.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ENTITY_PLAYBOOKS.map((playbook) => (
          <Card key={playbook.id} className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">{playbook.title}</CardTitle>
              <CardDescription>{playbook.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{playbook.structureType}</Badge>
                {playbook.documents.map((doc) => (
                  <Badge key={`${doc.docType}-${doc.subtype ?? "base"}`} variant="outline">
                    {doc.docType}{doc.subtype ? `:${doc.subtype}` : ""}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href={playbook.launchPath}>Start</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
