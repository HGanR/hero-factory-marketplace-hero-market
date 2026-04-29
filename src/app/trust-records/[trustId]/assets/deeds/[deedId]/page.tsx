import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Lock, FileText, CheckCircle2, XCircle } from "lucide-react";
import { DeedDetailClient } from "@/components/deeds/DeedDetailClient";

export const dynamic = "force-dynamic";

async function fetchDeed(trustId: string, deedId: string) {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return null;
  }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  try {
    const res = await fetch(`${baseUrl}/api/assets/deeds/${deedId}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DeedDetailPage({ params }: { params: Promise<{ trustId: string; deedId: string }> }) {
  const { trustId, deedId } = await params;
  const data = await fetchDeed(trustId, deedId);

  if (!data?.ok || !data.deed) {
    return (
      <div className="space-y-4">
        <div className="text-xl font-semibold">Deed Not Found</div>
        <Button asChild variant="outline">
          <Link href={`/trust-records/${trustId}/assets/deeds`}>Back to Deeds</Link>
        </Button>
      </div>
    );
  }

  const deed = data.deed;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      draft: "outline",
      pending: "secondary",
      approved: "default",
      executed: "default",
      recorded: "default",
      void: "outline",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-xl font-semibold">Deed Details</div>
            {getStatusBadge(deed.status)}
            {deed.lockedAt && (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" />
                Locked
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">Deed ID: {deedId}</div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/trust-records/${trustId}/assets/deeds`}>Back to Deeds</Link>
        </Button>
      </div>

      {/* Authority Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Authority & Approval</CardTitle>
        </CardHeader>
        <CardContent>
          {!deed.approvingResolutionId ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This deed is not linked to an approving resolution. You must link an approved resolution before generating
                the deed PDF or marking it as executed.
              </AlertDescription>
            </Alert>
          ) : deed.approvingResolution?.status !== "approved" ? (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                The linked resolution is not approved. The resolution must be approved and its minutes must be
                approved/locked before this deed can progress.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <div className="font-medium">Approval Linked</div>
                <div className="text-sm mt-1">
                  Resolution: {deed.approvingResolution?.title || "—"}
                  <br />
                  Minutes: {deed.approvingMinutes?.title || "—"}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Property */}
      {deed.property && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Property</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Address:</span>{" "}
              {[
                deed.property.street1,
                deed.property.city,
                deed.property.state,
                deed.property.postalCode,
              ]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
            {deed.property.county && (
              <div>
                <span className="font-medium">County:</span> {deed.property.county}
              </div>
            )}
            {deed.property.parcelNumber && (
              <div>
                <span className="font-medium">Parcel/APN:</span> {deed.property.parcelNumber}
              </div>
            )}
            {deed.property.legalDescription && (
              <div>
                <span className="font-medium">Legal Description:</span>
                <div className="mt-1 text-muted-foreground whitespace-pre-wrap">{deed.property.legalDescription}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Parties */}
      {deed.parties && deed.parties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {deed.parties.map((party: any) => (
              <div key={party.id} className="text-sm">
                <div className="font-medium">{party.role}</div>
                <div>{party.displayName}</div>
                {party.capacityLine && <div className="text-muted-foreground">{party.capacityLine}</div>}
                {party.address && <div className="text-muted-foreground">{party.address}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Client-side component for status transitions */}
      <DeedDetailClient deed={deed} trustId={trustId} />
    </div>
  );
}
