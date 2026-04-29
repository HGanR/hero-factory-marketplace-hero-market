"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface GovernanceHealthIndicatorProps {
  trustId: string;
}

interface HealthScore {
  status: "healthy" | "warning" | "critical";
  score: number;
  issues: Array<{
    severity: "critical" | "warning";
    category: string;
    message: string;
    actionUrl?: string;
  }>;
  lastReviewDate: string | null;
  nextReviewDue: string | null;
}

export function GovernanceHealthIndicator({ trustId }: GovernanceHealthIndicatorProps) {
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/governance/complex-trust/health-score?trustId=${trustId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setHealth(data.health);
        } else {
          setError(data.error?.message || "Failed to load health score");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [trustId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Governance Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !health) {
    return null; // Don't show if not Complex Trust or error
  }

  const getStatusIcon = () => {
    switch (health.status) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "critical":
        return <XCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const getStatusBadge = () => {
    switch (health.status) {
      case "healthy":
        return <Badge variant="default" className="bg-green-100 text-green-800">All Current</Badge>;
      case "warning":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Needs Attention</Badge>;
      case "critical":
        return <Badge variant="destructive">Action Required</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Governance Health</span>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score */}
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div className="flex-1">
            <div className="text-2xl font-bold">{health.score}/100</div>
            <div className="text-sm text-muted-foreground">Compliance Score</div>
          </div>
        </div>

        {/* Issues */}
        {health.issues.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Issues:</div>
            {health.issues.map((issue, idx) => (
              <Alert
                key={idx}
                variant={issue.severity === "critical" ? "destructive" : "default"}
                className={issue.severity === "warning" ? "border-yellow-200 bg-yellow-50" : ""}
              >
                <AlertDescription className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{issue.category}</div>
                    <div className="text-sm mt-1">{issue.message}</div>
                  </div>
                  {issue.actionUrl && (
                    <Button variant="link" size="sm" className="h-auto p-0 ml-2" asChild>
                      <Link href={issue.actionUrl}>
                        Fix
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Review Dates */}
        {health.lastReviewDate && (
          <div className="text-sm">
            <span className="font-medium">Last Review:</span> {new Date(health.lastReviewDate).toLocaleDateString()}
          </div>
        )}
        {health.nextReviewDue && (
          <div className="text-sm">
            <span className="font-medium">Next Review Due:</span> {new Date(health.nextReviewDue).toLocaleDateString()}
          </div>
        )}

        {health.issues.length === 0 && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              All required governance actions are current.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
