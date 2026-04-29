"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Church, FileText } from "lucide-react";

export function EstateInstrumentsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estate Instruments (Post-Mortem)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Pour-Over Will / Last Will & Testament</div>
            <div className="text-sm text-muted-foreground">
              Probate-based fallback instrument to support your Trust plan.
            </div>
          </div>
          <Button asChild variant="secondary">
            <Link href="/trust-records/estate/will">Start</Link>
          </Button>
        </div>

        <div className="flex items-center justify-between opacity-90">
          <div>
            <div className="font-medium">Testamentary Trust</div>
            <div className="text-sm text-muted-foreground">
              Advanced: trust created under a Will (probate-triggered).
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/trust-records/estate/testamentary-trust">
              <Church className="mr-2 h-4 w-4" />
              Start
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}




