"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

interface OwnedEntity {
  id: string;
  name: string;
  entityType: "LLC" | "C-Corp";
  ownershipPercent: number;
  role: "Sole Member" | "Majority Member" | "Minority Member";
  managers: string[];
  lastTrustApprovalId: string | null;
  lastTrustApprovalDate: string | null;
  governanceStatus: "approved" | "outdated" | "missing";
}

interface OwnedEntitiesCardProps {
  trustId: string;
  trustName: string;
}

export function OwnedEntitiesCard({ trustId, trustName }: OwnedEntitiesCardProps) {
  const [entities, setEntities] = useState<OwnedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Fetch owned entities from API
    // For now, this is a placeholder structure
    setLoading(false);
  }, [trustId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "outdated":
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Outdated
          </Badge>
        );
      case "missing":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Action Required
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Owned Entities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Owned Entities</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Owned Entities</CardTitle>
        <div className="text-sm text-muted-foreground">
          Entities owned by {trustName}. Manager authority is subject to trustee approval.
        </div>
      </CardHeader>
      <CardContent>
        {entities.length === 0 ? (
          <div className="text-sm text-muted-foreground">No owned entities recorded.</div>
        ) : (
          <div className="space-y-4">
            {entities.map((entity) => (
              <div key={entity.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{entity.name}</div>
                    <div className="text-sm text-muted-foreground">{entity.entityType}</div>
                  </div>
                  {getStatusBadge(entity.governanceStatus)}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Ownership:</span> {entity.ownershipPercent}%
                  </div>
                  <div>
                    <span className="font-medium">Role:</span> {entity.role}
                  </div>
                </div>

                {entity.managers.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">Manager(s):</span> {entity.managers.join(", ")}
                  </div>
                )}

                {entity.lastTrustApprovalId ? (
                  <div className="text-sm">
                    <span className="font-medium">Last Trust Approval:</span>{" "}
                    {entity.lastTrustApprovalDate ? new Date(entity.lastTrustApprovalDate).toLocaleDateString() : "—"}
                    <Button variant="link" size="sm" className="h-auto p-0 ml-2" asChild>
                      <Link href={`/trust-records/${trustId}/governance/resolutions/${entity.lastTrustApprovalId}`}>
                        View Resolution
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>No trustee approval resolution on file.</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/star-fleet/entities/${entity.id}`}>
                      View Entity Dashboard
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                  {entity.governanceStatus === "missing" && (
                    <Button size="sm" asChild>
                      <Link href={`/trust-records/${trustId}/governance/minutes/new?action=LLC_MANAGER_APPOINTMENT&entityId=${entity.id}`}>
                        Create Trustee Resolution
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
