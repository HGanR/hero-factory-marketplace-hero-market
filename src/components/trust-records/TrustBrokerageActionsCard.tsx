"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Landmark, FileText, Building2 } from "lucide-react";

interface TrustBrokerageActionsCardProps {
  trustId: string;
}

export function TrustBrokerageActionsCard({ trustId }: TrustBrokerageActionsCardProps) {
  return (
    <Card className="border-cyan-500/30 bg-cyan-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-cyan-200">
          <Landmark className="h-5 w-5" />
          Trust Brokerage Actions
        </CardTitle>
        <p className="text-sm text-slate-400">
          Deposit assets into brokerage, generate compliance documentation, and manage brokerage accounts.
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
          <Link href={`/trust-records/${trustId}/brokerage-deposit`}>
            <Building2 className="h-4 w-4 mr-2" />
            Deposit Asset Into Brokerage
          </Link>
        </Button>
        <Button asChild variant="outline" className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10">
          <Link href={`/trust-records/${trustId}/brokerage-deposit?step=pack`}>
            <FileText className="h-4 w-4 mr-2" />
            Generate Compliance Pack
          </Link>
        </Button>
        <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
          <Link href={`/trust-records/${trustId}/brokerage-deposit?view=accounts`}>
            View Brokerage Accounts
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
