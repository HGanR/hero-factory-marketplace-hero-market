"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText, Building2 } from "lucide-react";
import Link from "next/link";

interface GovernanceLink {
  type: "trust" | "resolution" | "entity";
  id: string;
  name: string;
  status: "approved" | "pending" | "draft";
  date: string;
  url: string;
}

interface GovernanceChainProps {
  trustId: string;
  trustName: string;
  links: GovernanceLink[];
}

export function GovernanceChain({ trustId, trustName, links }: GovernanceChainProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "trust":
        return <FileText className="h-4 w-4" />;
      case "resolution":
        return <CheckCircle2 className="h-4 w-4" />;
      case "entity":
        return <Building2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="default">Approved</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Governance Chain</CardTitle>
        <div className="text-sm text-muted-foreground">
          Visual representation of trust authority and entity actions
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Trust Root */}
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-blue-50">
            {getIcon("trust")}
            <div className="flex-1">
              <div className="font-medium">{trustName}</div>
              <div className="text-sm text-muted-foreground">Trust</div>
            </div>
            <Badge variant="default">Root Authority</Badge>
          </div>

          {/* Resolution and Entity Links */}
          {links.map((link, idx) => (
            <div key={link.id} className="space-y-2">
              {/* Connector Line */}
              {idx > 0 && <div className="ml-6 border-l-2 border-dashed h-4" />}

              <div className="flex items-center gap-3 p-3 border rounded-lg">
                {getIcon(link.type)}
                <div className="flex-1">
                  <Link href={link.url} className="font-medium hover:underline">
                    {link.name}
                  </Link>
                  <div className="text-sm text-muted-foreground">
                    {link.type === "resolution" ? "Trustee Resolution" : link.type === "entity" ? "Entity Action" : ""}
                    {" • "}
                    {new Date(link.date).toLocaleDateString()}
                  </div>
                </div>
                {getStatusBadge(link.status)}
              </div>

              {/* Nested Entity Actions */}
              {link.type === "resolution" && idx < links.length - 1 && links[idx + 1]?.type === "entity" && (
                <div className="ml-12 space-y-2">
                  <div className="border-l-2 border-dashed h-4" />
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                    {getIcon(links[idx + 1].type)}
                    <div className="flex-1">
                      <Link href={links[idx + 1].url} className="font-medium hover:underline">
                        {links[idx + 1].name}
                      </Link>
                      <div className="text-sm text-muted-foreground">
                        Entity Action • {new Date(links[idx + 1].date).toLocaleDateString()}
                      </div>
                    </div>
                    {getStatusBadge(links[idx + 1].status)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {links.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">
            No governance actions recorded yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
