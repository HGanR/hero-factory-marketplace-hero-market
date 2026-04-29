"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, FileText, Clock, Users, CheckCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { DraftModel } from "@/app/smart-trust/SmartTrustApp";
import { FilingAwarenessResult, FilingInstrumentId } from "@/lib/filing-awareness/types";

interface FilingAwarenessStepProps {
  draft: DraftModel;
}

const CATEGORY_ICONS = {
  authority: FileText,
  fiduciary_notice: Users,
  address_responsible_party: Info,
  tax_return: FileText,
  information_return: FileText,
  banking_kyc: CheckCircle,
  state_registration: AlertTriangle,
  other: Info,
};

const TIMELINE_COLORS = {
  immediate_after_event: "bg-red-100 text-red-800",
  before_transacting: "bg-orange-100 text-orange-800",
  within_first_tax_year: "bg-yellow-100 text-yellow-800",
  annual_or_recurring: "bg-blue-100 text-blue-800",
  event_driven_only: "bg-purple-100 text-purple-800",
  as_needed: "bg-gray-100 text-gray-800",
};

const CONFIDENCE_COLORS = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-green-100 text-green-800",
};

export function FilingAwarenessStep({ draft }: FilingAwarenessStepProps) {
  const [awareness, setAwareness] = useState<FilingAwarenessResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const computeAwareness = async () => {
      try {
        setLoading(true);

        // Map draft data to filing awareness input
        let entityContext: import("@/lib/filing-awareness/types").EntityContext;
        switch (draft.entityType) {
          case "foundation":
            entityContext = "charitable_foundation";
            break;
          case "religious_organization":
            entityContext = "religious_organization";
            break;
          case "family_office":
            entityContext = "family_office";
            break;
          case "company":
            // For company, check if it's C-Corp or parent holding
            entityContext = draft.companyDraft?.corpType === "c_corp" ? "company_c_corp" : "company_parent_holding";
            break;
          default:
            entityContext = "other";
        }

        const input: import("@/lib/filing-awareness/types").FilingAwarenessInput = {
          entityContext,
          hasEIN: false, // Draft stage - EIN not obtained yet
          formationState: draft.governingState || null,
          governingLawState: draft.governingState || null,
          isGrantorTrust: null, // Not applicable in draft
          isIrrevocable: null, // Not applicable in draft
          isCharitable: draft.entityType === "foundation" ? true : null,
          isReligiousOrg508c1a: null, // Would need more specific draft data
          hasBankingIntent: draft.companyDraft?.bankingReady || false,
          hasIncomeProducingAssets: false,
          hadFiduciaryChange: false,
          hadAddressChange: false,
          hadResponsiblePartyChange: false,
          hasAuthorizedRep: false,
          events: [], // No events in draft stage
        };

        // Import dynamically to avoid circular dependencies
        const { buildFilingAwareness } = await import("@/lib/filing-awareness/engine");
        const result = buildFilingAwareness(input);
        setAwareness(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    computeAwareness();
  }, [draft]);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            Regulatory Filing Awareness
          </CardTitle>
          <CardDescription>Loading awareness information...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error || !awareness) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Regulatory Filing Awareness
          </CardTitle>
          <CardDescription>
            {error || "Unable to load awareness information"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const renderCard = (card: FilingAwarenessResult['cards'][0], index: number) => {
    const Icon = CATEGORY_ICONS[card.category];
    const hasHighRelevance = card.relevance.score >= 70;

    return (
      <Collapsible key={card.id} className="border rounded-lg p-4">
        <CollapsibleTrigger asChild>
          <div className="flex items-start justify-between cursor-pointer w-full">
            <div className="flex items-start gap-3 flex-1">
              <Icon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm">{card.displayName}</h4>
                  {hasHighRelevance && (
                    <Badge variant="secondary" className="text-xs">
                      High Relevance
                    </Badge>
                  )}
                  <Badge className={`text-xs ${TIMELINE_COLORS[card.typicalTimeframe]}`}>
                    {card.typicalTimeframe.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-2">{card.summary}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Handled by: {card.whoTypicallyHandles.join(", ")}</span>
                  <span className={`px-2 py-0.5 rounded ${CONFIDENCE_COLORS[card.relevance.confidence]}`}>
                    {card.relevance.confidence} confidence
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">{card.relevance.score}%</div>
              <div className="text-xs text-gray-500">relevance</div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 pt-4 border-t">
          <div className="space-y-4">
            {/* Common Triggers */}
            <div>
              <h5 className="font-medium text-sm mb-2">Common Triggers</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                {card.commonTriggers.map((trigger, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    {trigger}
                  </li>
                ))}
              </ul>
            </div>

            {/* Relevance Reasons */}
            {card.relevance.reasons.length > 0 && (
              <div>
                <h5 className="font-medium text-sm mb-2">Why This May Apply</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {card.relevance.reasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Info className="h-3 w-3 text-blue-500 mt-1 flex-shrink-0" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Consultant Talking Points */}
            {card.audience !== "client" && card.consultantTalkingPoints.length > 0 && (
              <div>
                <h5 className="font-medium text-sm mb-2">Discussion Points</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {card.consultantTalkingPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Platform Boundary Note */}
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> {card.platformBoundaryNote}
              </p>
            </div>

            {/* References */}
            {card.references && card.references.length > 0 && (
              <div>
                <h5 className="font-medium text-sm mb-2">Additional Information</h5>
                <div className="space-y-1">
                  {card.references.map((ref, idx) => (
                    <div key={idx} className="text-sm text-gray-600">
                      <strong>{ref.label}:</strong> {ref.note}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-500" />
          Regulatory Filing Awareness
        </CardTitle>
        <CardDescription>
          General informational awareness of regulatory instruments that may be relevant based on your entity structure and intended activities.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-amber-800 mb-2">Important Disclaimer</h4>
              <p className="text-sm text-amber-700">{awareness.disclaimer}</p>
            </div>
          </div>
        </div>

        {/* Cards */}
        {awareness.cards.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Info className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No specific filing awareness items identified for your current configuration.</p>
            <p className="text-sm mt-1">This may change as you add more details about your entity and activities.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Relevant Instruments ({awareness.cards.length})</h3>
              <div className="text-sm text-gray-500">
                Sorted by relevance score
              </div>
            </div>

            {awareness.cards.map((card, index) => renderCard(card, index))}
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">Recommended Next Steps</h4>
          <div className="space-y-2 text-sm text-blue-700">
            <p>• Share this awareness information with your legal counsel or tax professional</p>
            <p>• Discuss which items may apply to your specific situation and timeline</p>
            <p>• Coordinate with your professional advisors on appropriate filing approaches</p>
            <p>• Keep this awareness information as part of your entity documentation</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
