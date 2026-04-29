import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Request-time only — avoids self-fetch during `next build` (no server yet; can hang/time out). */
export const dynamic = "force-dynamic";

async function fetchDeeds(trustId: string) {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return { items: [] };
  }
  // Use server-side fetch
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  try {
    const res = await fetch(`${baseUrl}/api/assets/deeds?trustId=${trustId}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { items: [] };
    return res.json();
  } catch {
    return { items: [] };
  }
}

export default async function TrustDeedsPage({ params }: { params: Promise<{ trustId: string }> }) {
  const { trustId } = await params;
  const data = await fetchDeeds(trustId);

  const items = data?.items ?? [];

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
          <div className="text-xl font-semibold">Deeds</div>
          <div className="text-sm text-muted-foreground">Track deed drafts, execution, and recording.</div>
        </div>
        <Button asChild>
          <Link href={`/trust-records/${trustId}/assets/deeds/new`}>+ New deed</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-2 border-b p-3 text-sm font-medium">
            <div className="col-span-3">Property</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Approval</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {items.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No deeds yet.</div>
          ) : (
            items.map((d: any) => (
              <div key={d.id} className="grid grid-cols-12 gap-2 border-b p-3 text-sm last:border-b-0">
                <div className="col-span-3">
                  {d.property?.street1 ? `${d.property.street1}, ${d.property.city ?? ""}` : "—"}
                </div>
                <div className="col-span-2">{d.deedType}</div>
                <div className="col-span-2">{getStatusBadge(d.status)}</div>
                <div className="col-span-3">
                  {d.approvingResolutionId ? "Linked" : "Not linked"}
                </div>
                <div className="col-span-2 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/trust-records/${trustId}/assets/deeds/${d.id}`}>View</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
