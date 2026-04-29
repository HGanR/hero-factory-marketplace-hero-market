"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, AlertTriangle, CheckCircle, Info, HelpCircle, ChevronDown, ChevronRight } from "lucide-react";

// SmartTrustDraft is defined in the SmartTrustApp, so we'll use any for now
import { BYLAWS_WIZARD_STEPS, BylawsDraft, generateDefaultBylawsDraft, GovernancePackage } from "@/lib/bylaws/wizard-config";
import { validateBylawsDraft, getComplianceBadge } from "@/lib/bylaws/validator";
import { getRulesetForState, getAvailableStates, getAvailableEntityForms } from "@/lib/bylaws/rulesets";
import { getStateHelp, getHelpForStep } from "@/lib/bylaws/state-help";

interface BylawsStepProps {
  draft: any; // SmartTrustDraft from SmartTrustApp
  setDraft: (updater: (prev: any) => any) => void;
}

export function BylawsStep({ draft, setDraft }: BylawsStepProps) {
  const [bylawsDraft, setBylawsDraft] = useState<BylawsDraft | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [validation, setValidation] = useState<any>(null);

  const getGovernancePackageLabel = (value: GovernancePackage) => {
    if (value === "bylaws_standard") return "Bylaws (Standard)";
    if (value === "bylaws_foundation") return "Bylaws (Foundation)";
    if (value === "bylaws_religious") return "Bylaws (Religious)";
    if (value === "bylaws_family_office") return "Bylaws (Family Office)";
    return "No governance package";
  };

  const inferGovernancePackage = (entityType?: string | null): GovernancePackage => {
    if (entityType === "foundation") return "bylaws_foundation";
    if (entityType === "religious_organization") return "bylaws_religious";
    if (entityType === "family_office") return "bylaws_family_office";
    return "bylaws_standard";
  };

  // Initialize bylaws draft when component mounts
  useEffect(() => {
    if (!bylawsDraft) {
      const entityForm = getEntityFormFromDraft(draft);
      const governancePackage: GovernancePackage = draft.governancePackage && draft.governancePackage !== "none"
        ? draft.governancePackage
        : inferGovernancePackage(draft.entityType);
      const newBylawsDraft = generateDefaultBylawsDraft(
        draft.entityType || "foundation",
        entityForm,
        draft.jurisdictionState || "TX",
        governancePackage
      );
      setBylawsDraft(newBylawsDraft);
    }
  }, [draft, bylawsDraft]);

  // Validate on changes
  useEffect(() => {
    if (bylawsDraft) {
      const validationResult = validateBylawsDraft(bylawsDraft);
      setValidation(validationResult);
    }
  }, [bylawsDraft]);

  useEffect(() => {
    if (!bylawsDraft) return;
    setDraft((prev: any) => {
      const next: any = { ...prev };
      if (bylawsDraft.entityType && prev.entityType !== bylawsDraft.entityType) {
        next.entityType = bylawsDraft.entityType;
      }
      if (bylawsDraft.governancePackage && prev.governancePackage !== bylawsDraft.governancePackage) {
        next.governancePackage = bylawsDraft.governancePackage;
      }
      return next;
    });
  }, [bylawsDraft?.entityType, bylawsDraft?.governancePackage, setDraft]);

  const getEntityFormFromDraft = (draft: any): any => {
    if (draft.governancePackage === "bylaws_religious") return "religious_corp";
    if (draft.governancePackage === "bylaws_family_office") return "llc";
    if (draft.governancePackage === "bylaws_foundation") return "nonprofit_corp";
    if (draft.governancePackage === "bylaws_standard") return "nonprofit_corp";

    // Map Smart Trust entity types to bylaws entity forms
    if (draft.entityType === "foundation") {
      return draft.foundationType === "Charitable Trust" ? "trust" : "nonprofit_corp";
    }
    if (draft.entityType === "religious_organization") {
      return draft.foundationAffiliation === "unincorporated" ? "unincorporated" : "religious_corp";
    }
    return "nonprofit_corp"; // Default
  };

  const updateBylawsDraft = (updater: (prev: BylawsDraft) => BylawsDraft) => {
    setBylawsDraft(prev => prev ? updater(prev) : null);
  };

  const complianceBadge = validation ? getComplianceBadge(validation) : null;

  if (!bylawsDraft) {
    return <div>Loading bylaws wizard...</div>;
  }

  const currentWizardStep = BYLAWS_WIZARD_STEPS[currentStep];

  // Get state-specific help content
  const stateHelp = getStateHelp(bylawsDraft.state, bylawsDraft.entityForm);
  const stepHelp = getHelpForStep(bylawsDraft.state, bylawsDraft.entityForm, currentWizardStep.id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bylaws Wizard
            {complianceBadge && (
              <Badge variant={complianceBadge.color === "green" ? "default" : complianceBadge.color === "yellow" ? "secondary" : "destructive"}>
                {complianceBadge.label}
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {getGovernancePackageLabel(bylawsDraft.governancePackage)} for {bylawsDraft.entityType} in {bylawsDraft.state}.
            Step {currentStep + 1} of {BYLAWS_WIZARD_STEPS.length}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress indicator */}
          <div className="flex gap-2 mb-6">
            {BYLAWS_WIZARD_STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 h-2 rounded ${
                  index < currentStep
                    ? "bg-green-500"
                    : index === currentStep
                    ? "bg-blue-500"
                    : "bg-gray-200"
                }`}
              />
            ))}
          </div>

          {/* Current step content */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{currentWizardStep.title}</h3>
            <p className="text-sm text-muted-foreground">{currentWizardStep.description}</p>

            {/* State-specific help section */}
            {stepHelp && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
                  <HelpCircle className="h-4 w-4" />
                  State-specific guidance for {bylawsDraft.state}
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 p-3 bg-blue-50 rounded-md border">
                  <StateHelpContent stepHelp={stepHelp} stateHelp={stateHelp} />
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Step-specific content */}
            {renderStepContent(currentWizardStep, bylawsDraft, updateBylawsDraft, validation, stepHelp, stateHelp)}
          </div>

          {/* Validation feedback */}
          {validation && validation.results.length > 0 && (
            <Alert className={validation.isValid ? "border-yellow-200 bg-yellow-50" : "border-red-200 bg-red-50"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  {validation.results.slice(0, 3).map((result: any, index: number) => (
                    <div key={index} className="text-sm">
                      <span className="font-medium">{result.field}:</span> {result.message}
                    </div>
                  ))}
                  {validation.results.length > 3 && (
                    <div className="text-sm text-muted-foreground">
                      ...and {validation.results.length - 3} more issues
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              Previous
            </Button>

            <div className="flex gap-2">
              {currentStep === BYLAWS_WIZARD_STEPS.length - 1 && validation?.isValid && (
                <Button
                  onClick={async () => {
                    try {
                      // Save bylaws as trust document
                      const response = await fetch(`/api/trusts/${draft.trustId || 'temp'}/bylaws`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(bylawsDraft)
                      });

                      if (response.ok) {
                        const result = await response.json();
                        // Save reference to main draft
                        setDraft(prev => ({
                          ...prev,
                          bylawsDraft,
                          bylawsDocumentId: result.documentId
                        }));
                        alert('Bylaws saved successfully!');
                      } else {
                        const error = await response.json();
                        alert(`Failed to save bylaws: ${error.error}`);
                      }
                    } catch (err) {
                      alert('Error saving bylaws. Please try again.');
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Save Bylaws
                </Button>
              )}

              <Button
                onClick={() => setCurrentStep(Math.min(BYLAWS_WIZARD_STEPS.length - 1, currentStep + 1))}
                disabled={currentStep === BYLAWS_WIZARD_STEPS.length - 1}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// State Help Content Component
function StateHelpContent({ stepHelp, stateHelp }: { stepHelp: any, stateHelp: any }) {
  return (
    <div className="space-y-3 text-sm">
      {stepHelp.whyRulesMatter && (
        <div>
          <strong>Why this matters:</strong> {stepHelp.whyRulesMatter}
        </div>
      )}

      {stepHelp.keyRequirements && stepHelp.keyRequirements.length > 0 && (
        <div>
          <strong>Key requirements:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            {stepHelp.keyRequirements.map((req: string, idx: number) => (
              <li key={idx}>{req}</li>
            ))}
          </ul>
        </div>
      )}

      {stepHelp.statutoryReference && (
        <div>
          <strong>Statutory reference:</strong> {stepHelp.statutoryReference}
        </div>
      )}

      {stepHelp.stateSpecific && (
        <div>
          <strong>State-specific notes:</strong> {stepHelp.stateSpecific}
        </div>
      )}

      {stepHelp.commonPitfalls && stepHelp.commonPitfalls.length > 0 && (
        <div>
          <strong>Common pitfalls to avoid:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            {stepHelp.commonPitfalls.map((pitfall: string, idx: number) => (
              <li key={idx}>{pitfall}</li>
            ))}
          </ul>
        </div>
      )}

      {stateHelp?.irsGuidance && (
        <div className="mt-3 pt-3 border-t border-blue-200">
          <strong className="text-blue-800">IRS Considerations:</strong>
          <div className="mt-1 text-xs text-blue-700">
            {stepHelp.irsGuidance || "Consult IRS Publication 557 for tax-exempt organization guidance."}
          </div>
        </div>
      )}
    </div>
  );
}

function renderStepContent(
  step: any,
  bylawsDraft: BylawsDraft,
  updateBylawsDraft: (updater: (prev: BylawsDraft) => BylawsDraft) => void,
  validation?: any,
  stepHelp?: any,
  stateHelp?: any
) {
  const updateField = (field: string, value: any) => {
    updateBylawsDraft(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateNestedField = (path: string, value: any) => {
    const [parent, child] = path.split('.');
    updateBylawsDraft(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent as keyof BylawsDraft] as any,
        [child]: value
      }
    }));
  };

  switch (step.id) {
    case "entity-gatekeeper":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Governance Package</Label>
              <Select
                value={bylawsDraft.governancePackage}
                onValueChange={(value) => updateField("governancePackage", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bylaws_standard">Bylaws (Standard)</SelectItem>
                  <SelectItem value="bylaws_foundation">Bylaws (Foundation)</SelectItem>
                  <SelectItem value="bylaws_religious">Bylaws (Religious)</SelectItem>
                  <SelectItem value="bylaws_family_office">Bylaws (Family Office)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Entity Type</Label>
              <Select
                value={bylawsDraft.entityType}
                onValueChange={(value) => updateField("entityType", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="foundation">Charitable Foundation</SelectItem>
                  <SelectItem value="religious_organization">Religious Organization</SelectItem>
                  <SelectItem value="family_office">Family Office</SelectItem>
                  <SelectItem value="revocable_living_trust">Revocable Living Trust</SelectItem>
                  <SelectItem value="private_trust">Private Trust</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Legal Form</Label>
              <Select
                value={bylawsDraft.entityForm}
                onValueChange={(value) => updateField("entityForm", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nonprofit_corp">Nonprofit Corporation</SelectItem>
                  <SelectItem value="religious_corp">Religious Corporation</SelectItem>
                  <SelectItem value="llc">LLC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>State of Formation</Label>
            <Select
              value={bylawsDraft.state}
              onValueChange={(value) => updateField("state", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAvailableStates().map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case "state-selection":
      const ruleset = getRulesetForState(bylawsDraft.state, bylawsDraft.entityForm);
      return (
        <div className="space-y-4">
          {ruleset ? (
            <div className="p-4 border rounded-lg bg-blue-50">
              <h4 className="font-semibold">{ruleset.stateName} {ruleset.entityForm.replace('_', ' ').toUpperCase()} Requirements</h4>
              <div className="mt-2 space-y-1 text-sm">
                <div>Minimum Directors: {ruleset.statutoryMinimums.minimumDirectors}</div>
                <div>Quorum Floor: {ruleset.statutoryMinimums.quorumFloor}%</div>
                <div>Notice Requirement: {ruleset.statutoryMinimums.noticeRequirement} days</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {ruleset.legalDisclaimer}
                </div>
              </div>
            </div>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No ruleset available for {bylawsDraft.state} {bylawsDraft.entityForm}.
                Using general nonprofit corporation guidelines.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="acceptDisclaimer"
              checked={bylawsDraft.acceptDisclaimer || false}
              onCheckedChange={(checked) => updateField("acceptDisclaimer", checked)}
            />
            <Label htmlFor="acceptDisclaimer" className="text-sm">
              I acknowledge this is general guidance, not legal advice
            </Label>
          </div>
        </div>
      );

    case "board-governance":
      return (
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <strong>Director Requirements:</strong> {stepHelp?.directorMinimums || "Check your state's minimum director requirements."}
                <br />
                <strong>Quorum Rules:</strong> {stepHelp?.quorumRules || "Majority quorum unless bylaws specify otherwise."}
              </div>
            </div>
          </div>

          <div>
            <Label>Number of Directors</Label>
            <Input
              type="number"
              value={bylawsDraft.directorCount}
              onChange={(e) => updateField("directorCount", parseInt(e.target.value) || 1)}
              min="1"
            />
          </div>

          <div>
            <Label>Board Composition Clause</Label>
            <Textarea
              value={bylawsDraft.clauses["board-composition"]?.content || ""}
              onChange={(e) => updateNestedField("clauses.board-composition.content", e.target.value)}
              placeholder="The corporation shall have a board of directors..."
              rows={4}
            />
          </div>
        </div>
      );

    case "meetings-voting":
      return (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <strong>Meeting Requirements:</strong> {stepHelp?.statutoryMinimums || "Annual meetings required by law."}
                <br />
                <strong>Notice Rules:</strong> {stepHelp?.noticeRequirements || "Reasonable notice required for meetings."}
                <br />
                <strong>Quorum Defaults:</strong> {stepHelp?.quorumDefaults || "Majority constitutes quorum unless specified."}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Voting Quorum (%)</Label>
              <Input
                type="number"
                value={bylawsDraft.quorumPercentage}
                onChange={(e) => updateField("quorumPercentage", parseInt(e.target.value) || 50)}
                min="1"
                max="100"
              />
            </div>

            <div>
              <Label>Meeting Notice (days)</Label>
              <Input
                type="number"
                value={bylawsDraft.noticeDays}
                onChange={(e) => updateField("noticeDays", parseInt(e.target.value) || 10)}
                min="1"
              />
            </div>
          </div>

          <div>
            <Label>Meetings & Quorum Clause</Label>
            <Textarea
              value={bylawsDraft.clauses["meetings-quorum"]?.content || ""}
              onChange={(e) => updateNestedField("clauses.meetings-quorum.content", e.target.value)}
              placeholder="Regular meetings shall be held..."
              rows={6}
            />
          </div>
        </div>
      );

    case "review-validation":
      return (
        <div className="space-y-4">
          {validation && (
            <div className="space-y-2">
              <h4 className="font-semibold">Validation Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 border rounded">
                  <div className="text-2xl font-bold text-red-600">{validation.summary.errors}</div>
                  <div className="text-sm">Errors</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-2xl font-bold text-yellow-600">{validation.summary.warnings}</div>
                  <div className="text-sm">Warnings</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-2xl font-bold text-blue-600">{validation.summary.info}</div>
                  <div className="text-sm">Suggestions</div>
                </div>
              </div>
            </div>
          )}

          {stateHelp?.irsGuidance && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <strong>IRS Compliance:</strong>
                  <div className="mt-1">
                    <strong>Dissolution requirement:</strong> {stateHelp.irsGuidance.dissolutionLanguage.required}
                  </div>
                  <div className="mt-1 text-xs text-green-700">
                    Suggested language: {stateHelp.irsGuidance.dissolutionLanguage.suggestions[0]}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>Dissolution Clause</Label>
            <Textarea
              value={bylawsDraft.clauses["dissolution"]?.content || ""}
              onChange={(e) => updateNestedField("clauses.dissolution.content", e.target.value)}
              placeholder="Upon dissolution, assets shall be distributed..."
              rows={4}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeIrsDissolution"
              checked={bylawsDraft.includeIrsDissolution}
              onCheckedChange={(checked) => updateField("includeIrsDissolution", checked)}
            />
            <Label htmlFor="includeIrsDissolution" className="text-sm">
              Include IRS-recommended dissolution language
            </Label>
          </div>
        </div>
      );

    default:
      return <div>Step content not implemented yet.</div>;
  }
}
