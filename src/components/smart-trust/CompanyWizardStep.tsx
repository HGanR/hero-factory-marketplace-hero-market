"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building2, AlertTriangle, CheckCircle, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { DraftModel } from "@/app/smart-trust/SmartTrustApp";
import {
  buildParentCorpWizardSteps,
  defaultParentCorpDraft,
  getVisibleSteps,
  getNextStep,
  getPreviousStep,
} from "@/lib/company-wizard/wizard-config";
import { ParentCorpDraft, WizardStep, UIComponent, ValidationResult, ParentCorpModule } from "@/lib/company-wizard/types";
import { validateStep } from "@/lib/company-wizard/validation";
import { applyPreset, applyStructureChoice } from "@/lib/company-wizard/presets";

interface CompanyWizardStepProps {
  draft: DraftModel;
  setDraft: React.Dispatch<React.SetStateAction<DraftModel>>;
}

export function CompanyWizardStep({ draft, setDraft }: CompanyWizardStepProps) {
  const [companyDraft, setCompanyDraft] = useState<ParentCorpDraft | null>(
    draft.companyDraft || null
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  // Initialize or update companyDraft based on parent draft
  useEffect(() => {
    if (!companyDraft) {
      const newDraft = defaultParentCorpDraft();
      // Pre-populate from Smart Trust draft if available
      if (draft.governingState) newDraft.formationState = draft.governingState as any;
      setCompanyDraft(newDraft);
    }
  }, [draft, companyDraft]);

  // Handle preset changes
  const handlePresetChange = (newPreset: string) => {
    if (companyDraft) {
      const updatedDraft = applyPreset(companyDraft, newPreset as any);
      setCompanyDraft(updatedDraft);
    }
  };

  // Handle structure choice changes
  const handleStructureChoice = (structureChoice: string) => {
    if (companyDraft) {
      const updatedDraft = applyStructureChoice(companyDraft, structureChoice);
      setCompanyDraft(updatedDraft);
    }
  };

  // Handle module selection
  const handleModuleToggle = (module: ParentCorpModule, checked: boolean) => {
    if (companyDraft) {
      const currentModules = companyDraft.selectedModules || [];
      const newModules = checked
        ? [...currentModules, module]
        : currentModules.filter(m => m !== module);
      setCompanyDraft(prev => prev ? { ...prev, selectedModules: newModules } : null);
    }
  };

  // Sync local companyDraft with parent draft
  useEffect(() => {
    if (companyDraft) {
      setDraft((prev) => ({ ...prev, companyDraft }));
    }
  }, [companyDraft, setDraft]);

  // Validate on changes
  useEffect(() => {
    if (companyDraft) {
      const visibleSteps = getVisibleSteps(companyDraft);
      const currentStepId = visibleSteps[currentStepIndex];
      if (currentStepId) {
        const validationResult = validateStep(currentStepId, companyDraft);
        setValidation(validationResult);
      }
    }
  }, [companyDraft, currentStepIndex]);

  const allSteps = useMemo(() => {
    return companyDraft ? buildParentCorpWizardSteps(companyDraft) : [];
  }, [companyDraft]);

  const visibleSteps = useMemo(() => {
    return companyDraft ? getVisibleSteps(companyDraft) : [];
  }, [companyDraft]);

  const steps = useMemo(() => {
    return allSteps.filter(step => visibleSteps.includes(step.id));
  }, [allSteps, visibleSteps]);

  const currentWizardStep = steps[currentStepIndex];
  const currentStepId = visibleSteps[currentStepIndex];

  const updateField = (field: keyof ParentCorpDraft, value: any) => {
    setCompanyDraft((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const renderUIComponent = (component: UIComponent) => {
    const field = 'field' in component ? component.field as keyof ParentCorpDraft : '';
    const value = companyDraft && field ? companyDraft[field] : "";
    const helpBadge = 'badge' in component ? component.badge : undefined;

    const baseProps = {
      key: field || 'component-' + Math.random(),
      className: "space-y-2",
    };

    switch (component.type) {
      case "input":
        return (
          <div {...baseProps}>
            <Label htmlFor={field}>
              {component.label}
              {component.required && <span className="text-red-500 ml-1">*</span>}
              {helpBadge && (
                <Badge variant={helpBadge.level === "required" ? "destructive" : helpBadge.level === "recommended" ? "secondary" : "outline"} className="ml-2">
                  {helpBadge.label}
                </Badge>
              )}
            </Label>
            <Input
              id={field}
              type={component.inputType || "text"}
              placeholder={component.placeholder}
              value={value as string || ""}
              onChange={(e) => field && updateField(field, component.inputType === "number" ? Number(e.target.value) : e.target.value)}
              required={component.required}
            />
            {component.helpText && <p className="text-sm text-gray-600">{component.helpText}</p>}
          </div>
        );

      case "textarea":
        return (
          <div {...baseProps}>
            <Label htmlFor={field}>
              {component.label}
              {component.required && <span className="text-red-500 ml-1">*</span>}
              {helpBadge && (
                <Badge variant={helpBadge.level === "required" ? "destructive" : helpBadge.level === "recommended" ? "secondary" : "outline"} className="ml-2">
                  {helpBadge.label}
                </Badge>
              )}
            </Label>
            <Textarea
              id={field}
              placeholder={component.placeholder}
              value={value as string || ""}
              onChange={(e) => field && updateField(field, e.target.value)}
              required={component.required}
              rows={component.rows || 3}
            />
            {component.helpText && <p className="text-sm text-gray-600">{component.helpText}</p>}
          </div>
        );

      case "select":
        return (
          <div {...baseProps}>
            <Label htmlFor={field}>
              {component.label}
              {component.required && <span className="text-red-500 ml-1">*</span>}
              {helpBadge && (
                <Badge variant={helpBadge.level === "required" ? "destructive" : helpBadge.level === "recommended" ? "secondary" : "outline"} className="ml-2">
                  {helpBadge.label}
                </Badge>
              )}
            </Label>
            <Select
              value={value as string || ""}
              onValueChange={(val) => {
                if (field === "preset") {
                  handlePresetChange(val);
                } else if (field === "structureChoice") {
                  handleStructureChoice(val);
                } else {
                  field && updateField(field, val);
                }
              }}
              required={component.required}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${component.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {component.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {component.helpText && <p className="text-sm text-gray-600">{component.helpText}</p>}
          </div>
        );

      case "checkbox":
        return (
          <div {...baseProps}>
            <div className="flex items-center space-x-2">
              <Checkbox
                id={field}
                checked={value as boolean || false}
                onCheckedChange={(checked) => field && updateField(field, checked)}
                required={component.required}
              />
              <Label htmlFor={field} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {component.label}
                {helpBadge && (
                  <Badge variant={helpBadge.level === "required" ? "destructive" : helpBadge.level === "recommended" ? "secondary" : "outline"} className="ml-2">
                    {helpBadge.label}
                  </Badge>
                )}
              </Label>
            </div>
            {component.helpText && <p className="text-sm text-gray-600 ml-6">{component.helpText}</p>}
          </div>
        );

      case "multi-checkbox":
        return (
          <div {...baseProps}>
            <Label>
              {component.label}
              {component.required && <span className="text-red-500 ml-1">*</span>}
              {helpBadge && (
                <Badge variant={helpBadge.level === "required" ? "destructive" : helpBadge.level === "recommended" ? "secondary" : "outline"} className="ml-2">
                  {helpBadge.label}
                </Badge>
              )}
            </Label>
            <div className="space-y-3 mt-2">
              {component.options.map((opt, idx) => (
                <div key={idx} className="flex items-start space-x-2">
                  <Checkbox
                    id={`${field}-${idx}`}
                    checked={field === "selectedModules" ? (companyDraft?.selectedModules || []).includes(opt.value as ParentCorpModule) : false}
                    onCheckedChange={(checked) => {
                      if (field === "selectedModules") {
                        handleModuleToggle(opt.value as ParentCorpModule, checked as boolean);
                      }
                    }}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor={`${field}-${idx}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {opt.label}
                      {opt.badge && (
                        <Badge variant={opt.badge.level === "required" ? "destructive" : opt.badge.level === "recommended" ? "secondary" : "outline"} className="ml-2">
                          {opt.badge.label}
                        </Badge>
                      )}
                    </Label>
                    {opt.helpText && <p className="text-sm text-muted-foreground">{opt.helpText}</p>}
                  </div>
                </div>
              ))}
            </div>
            {component.helpText && <p className="text-sm text-gray-600">{component.helpText}</p>}
          </div>
        );

      case "divider":
        return (
          <Separator key={`divider-${component.label}`} className="my-6">
            {component.label && <span className="px-2 bg-white text-sm font-medium">{component.label}</span>}
          </Separator>
        );

      case "callout":
        const toneStyles = {
          info: "bg-blue-50 border-blue-200 text-blue-800",
          warning: "bg-amber-50 border-amber-200 text-amber-800",
          danger: "bg-red-50 border-red-200 text-red-800",
        };

        const iconMap = {
          info: <Info className="h-4 w-4" />,
          warning: <AlertTriangle className="h-4 w-4" />,
          danger: <AlertTriangle className="h-4 w-4" />,
        };

        return (
          <div key={`callout-${component.title}`} className={`p-4 rounded-lg border ${toneStyles[component.tone]}`}>
            <div className="flex items-start gap-3">
              {iconMap[component.tone]}
              <div>
                <h4 className="font-medium">{component.title}</h4>
                <p className="text-sm mt-1">{component.body}</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!companyDraft) {
    return <div>Loading company wizard...</div>;
  }

  const complianceBadge = validation
    ? validation.ok
      ? "secondary"
      : validation.issues.some(i => i.severity === "error")
      ? "destructive"
      : "outline"
    : "outline";

  const canGoNext = validation?.ok && currentStepIndex < steps.length - 1;
  const canGoPrev = currentStepIndex > 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-500" />
          Parent Company + C-Corp Wizard: {currentWizardStep?.title}
          <Badge variant={complianceBadge} className="ml-2">
            {complianceBadge === "secondary" ? "Ready" : complianceBadge === "outline" ? "Warnings" : "Errors"}
          </Badge>
        </CardTitle>
        <CardDescription>{currentWizardStep?.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {visibleSteps.map((stepId, idx) => {
            const stepConfig = allSteps.find(s => s.id === stepId);
            const isActive = idx === currentStepIndex;
            const isCompleted = idx < currentStepIndex;
            return (
              <div key={stepId} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isActive
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {isCompleted ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                </div>
                <span className={`text-sm ${isActive ? "font-medium text-blue-600" : "text-gray-500"}`}>
                  {stepConfig?.title}
                </span>
                {idx < visibleSteps.length - 1 && <div className="w-8 h-px bg-gray-200" />}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="space-y-6">
          {currentWizardStep?.uiComponents.map((component, idx) => renderUIComponent(component))}
        </div>

        {/* Validation Summary */}
        {validation && validation.issues.length > 0 && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900">Validation Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-center">
              <Badge variant={validation.issues.some(i => i.severity === "error") ? "destructive" : "secondary"}>
                Errors: {validation.issues.filter(i => i.severity === "error").length}
              </Badge>
              <Badge variant={validation.issues.some(i => i.severity === "warning") ? "secondary" : "outline"}>
                Warnings: {validation.issues.filter(i => i.severity === "warning").length}
              </Badge>
            </div>
            {validation.issues.map((issue, idx) => (
              <div key={idx} className={`p-3 rounded-md ${issue.severity === "error" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>
                <div className="flex items-start gap-2">
                  {issue.severity === "error" ? <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" /> : <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                  <div className="text-sm">
                    <strong>{issue.field}:</strong> {issue.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <Button
            onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
            disabled={!canGoPrev}
            variant="outline"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button
            onClick={() => setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1))}
            disabled={!canGoNext}
          >
            {currentStepIndex === steps.length - 1 ? "Complete" : "Next"}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
