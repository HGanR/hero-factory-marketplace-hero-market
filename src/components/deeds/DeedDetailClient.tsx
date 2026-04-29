"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Lock, FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export function DeedDetailClient({ deed, trustId }: { deed: any; trustId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleAction(action: string, body?: any) {
    setBusy(true);
    setErr(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/assets/deeds/${deed.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data?.error?.message || "Action failed");
      
      if (action === "authority-summary") {
        setSuccess(`Authority Summary PDF generated: ${data.fileName || data.exhibitId}`);
      } else {
        setSuccess(`Deed ${action} completed successfully`);
        // Reload page to show updated state
        window.location.reload();
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const canGeneratePdf = deed.approvingResolutionId && deed.approvingResolution?.status === "approved";
  const canMarkExecuted = deed.status === "approved" && canGeneratePdf && !deed.lockedAt;
  const canMarkRecorded = deed.status === "executed" && !deed.lockedAt;
  const canLock = (deed.status === "recorded" || deed.status === "executed") && !deed.lockedAt;

  return (
    <div className="space-y-4">
      {err && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Status Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!deed.draftPdfExhibitId && (
            <div>
              <Button
                onClick={() => handleAction("generate-draft-pdf")}
                disabled={busy || !canGeneratePdf}
                className="w-full"
              >
                <FileText className="mr-2 h-4 w-4" />
                Generate Draft PDF
              </Button>
              {!canGeneratePdf && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Requires linked and approved resolution
                </div>
              )}
            </div>
          )}

          <Button asChild variant="outline" className="w-full">
            <a
              href={`/api/assets/deeds/${deed.id}/generate-checklist-pdf?format=zip`}
              target="_blank"
              rel="noreferrer"
            >
              Download Deed Prep Packet (ZIP)
            </a>
          </Button>

          {deed.draftPdfExhibitId && (
            <div className="text-sm text-muted-foreground">
              Draft PDF: <span className="font-mono text-xs">{deed.draftPdfExhibitId}</span>
            </div>
          )}

          {canMarkExecuted && (
            <Button
              onClick={() => handleAction("mark-approved")}
              disabled={busy}
              variant="outline"
              className="w-full"
            >
              Mark as Approved
            </Button>
          )}

          {deed.status === "approved" && (
            <div>
              <Button
                onClick={() => handleAction("mark-executed", { method: "WET_IN_PERSON", notarized: true })}
                disabled={busy}
                variant="outline"
                className="w-full"
              >
                Mark as Executed
              </Button>
              <div className="mt-2 text-xs text-muted-foreground">
                After execution, upload the executed PDF and update execution details
              </div>
            </div>
          )}

          {deed.status === "executed" && (
            <div>
              <Button
                onClick={() =>
                  handleAction("mark-recorded", {
                    status: "RECORDED",
                    recordedAt: new Date().toISOString(),
                  })
                }
                disabled={busy}
                variant="outline"
                className="w-full"
              >
                Mark as Recorded
              </Button>
              <div className="mt-2 text-xs text-muted-foreground">
                Enter instrument number and recording details
              </div>
            </div>
          )}

          {canLock && (
            <Button
              onClick={() => handleAction("lock")}
              disabled={busy}
              variant="outline"
              className="w-full"
            >
              <Lock className="mr-2 h-4 w-4" />
              Lock Deed (Finalize)
            </Button>
          )}

          {/* Authority Summary Export */}
          {deed.approvingResolutionId && (
            <div>
              <Button
                onClick={() => handleAction("authority-summary")}
                disabled={busy}
                variant="outline"
                className="w-full"
              >
                <FileText className="mr-2 h-4 w-4" />
                Generate Authority Summary PDF
              </Button>
              <div className="mt-2 text-xs text-muted-foreground">
                Creates a complete authority packet with approval, deed info, and final hash
              </div>
            </div>
          )}

          {deed.lockedAt && (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                This deed was locked on {new Date(deed.lockedAt).toLocaleDateString()}. Final hash:{" "}
                <span className="font-mono text-xs">{deed.finalHash}</span>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Execution Details */}
      {deed.execution && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Execution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Method:</span> {deed.execution.method}
            </div>
            {deed.execution.signDate && (
              <div>
                <span className="font-medium">Sign Date:</span> {new Date(deed.execution.signDate).toLocaleDateString()}
              </div>
            )}
            {deed.execution.notarized && (
              <div>
                <span className="font-medium">Notarized:</span> Yes
                {deed.execution.notaryName && (
                  <div className="text-muted-foreground">
                    Notary: {deed.execution.notaryName}
                    {deed.execution.notaryState && `, ${deed.execution.notaryState}`}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recording Details */}
      {deed.recording && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recording</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Status:</span> {deed.recording.status}
            </div>
            {deed.recording.instrumentNumber && (
              <div>
                <span className="font-medium">Instrument Number:</span> {deed.recording.instrumentNumber}
              </div>
            )}
            {deed.recording.recordedAt && (
              <div>
                <span className="font-medium">Recorded:</span> {new Date(deed.recording.recordedAt).toLocaleDateString()}
              </div>
            )}
            {deed.recording.county && (
              <div>
                <span className="font-medium">County:</span> {deed.recording.county}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
