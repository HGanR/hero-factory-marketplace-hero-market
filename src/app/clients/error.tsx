"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ClientsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Clients route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          {error?.message || "An unexpected error occurred while loading this page."}
        </AlertDescription>
      </Alert>
      <div className="flex gap-3">
        <Button onClick={reset} variant="default">
          Try again
        </Button>
        <Button asChild variant="outline">
          <a href="/clients/new">New Client</a>
        </Button>
        <Button asChild variant="outline">
          <a href="/dashboard">Dashboard</a>
        </Button>
      </div>
    </div>
  );
}
