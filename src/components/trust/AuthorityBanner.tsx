"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, ExternalLink, Lock } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

interface AuthorityBannerProps {
  entityId: string;
  entityType: "LLC" | "C-Corp";
  trustId: string | null;
  trustName: string | null;
}

export function AuthorityBanner({ entityId, entityType, trustId, trustName }: AuthorityBannerProps) {
  const [authority, setAuthority] = useState<{
    hasApproval: boolean;
    approvalId: string | null;
    approvalDate: string | null;
    status: "approved" | "outdated" | "missing";
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trustId) {
      setLoading(false);
      return;
    }

    // TODO: Fetch authority approval from API
    // For now, this is a placeholder
    setLoading(false);
  }, [entityId, trustId]);

  if (!trustId || !trustName) {
    return null; // Not trust-owned
  }

  if (loading) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Loading authority information...</AlertDescription>
      </Alert>
    );
  }

  const getStatusBadge = () => {
    if (!authority) return null;

    switch (authority.status) {
      case "approved":
        return (
          <Badge variant="default" className="gap-1 ml-2">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "outdated":
        return (
          <Badge variant="secondary" className="gap-1 ml-2">
            <AlertCircle className="h-3 w-3" />
            Outdated
          </Badge>
        );
      case "missing":
        return (
          <Badge variant="destructive" className="gap-1 ml-2">
            <AlertCircle className="h-3 w-3" />
            Missing
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Alert className={authority?.status === "missing" ? "border-yellow-200 bg-yellow-50" : "border-blue-200 bg-blue-50"}>
      <Lock className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <div className="font-medium">
            Authority Source: This {entityType} is owned by {trustName}
            {getStatusBadge()}
          </div>
          <div className="text-sm mt-1">
            Manager authority is subject to trustee approval.
            {authority?.approvalId && (
              <>
                {" "}
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link href={`/trust-records/${trustId}/governance/resolutions/${authority.approvalId}`}>
                    View latest trustee approval resolution
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
        {authority?.status === "missing" && (
          <Button size="sm" asChild>
            <Link href={`/trust-records/${trustId}/governance/minutes/new?action=LLC_MANAGER_APPOINTMENT&entityId=${entityId}`}>
              Create Resolution
            </Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
