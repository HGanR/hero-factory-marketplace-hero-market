"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { InstrumentsSection } from "@/components/trust-records/InstrumentsSection";

function TrustInstrumentsPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const trustId = String(params?.trustId ?? "");
  const tab = searchParams?.get("tab") ?? "instruments";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center gap-4">
        <Button asChild variant="ghost" size="sm" className="gap-2 text-slate-400 hover:text-slate-200">
          <Link href={`/trust-records?trustId=${trustId}&tab=${tab}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to Trust Records
          </Link>
        </Button>
      </div>
      <InstrumentsSection trustId={trustId || null} />
    </div>
  );
}

export default function TrustInstrumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-12 text-slate-400">
          Loading…
        </div>
      }
    >
      <TrustInstrumentsPageContent />
    </Suspense>
  );
}
