"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";

export default function TrustRecordsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Trust Records route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          {error?.message || "An unexpected error occurred while loading Trust Records."}
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset} variant="default">
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/trust-records">Trust Records</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/clients/new?origin=trust-records&returnTo=/trust-records">Create Client Record</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
