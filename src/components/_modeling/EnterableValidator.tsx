"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, Building } from "lucide-react";
import { BuildingAssetTemplate } from "./parametric-objects";

interface EnterableValidatorProps {
  buildingTemplate?: BuildingAssetTemplate;
  isBuildingSelected: boolean;
}

export function EnterableValidator({ buildingTemplate, isBuildingSelected }: EnterableValidatorProps) {
  if (!isBuildingSelected || !buildingTemplate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Building className="h-4 w-4" />
            Enterable Readiness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Select a building to view enterable readiness status.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const validation = buildingTemplate.manifest.validation;

  const checks = [
    {
      label: "Exterior Group",
      status: validation.hasExterior,
      description: "Contains building geometry and doors"
    },
    {
      label: "Interior Group",
      status: validation.hasInterior,
      description: "Space for placing interior objects"
    },
    {
      label: "Colliders Group",
      status: validation.hasColliders,
      description: "Physics and trigger volumes"
    },
    // Interactables are optional and checked separately
    // {
    //   label: "Interactables Group",
    //   status: validation.hasInteractables !== false, // Optional but present
    //   description: "Interactive objects (doors, lights, etc.)",
    //   optional: true
    // },
    {
      label: "Spawns Group",
      status: validation.hasSpawns,
      description: "Entry and exit points"
    },
    {
      label: "Entry Triggers",
      status: validation.hasEntryTriggers,
      description: "At least one trigger to enter building"
    }
  ];

  const allRequiredPass = checks.every(check => check.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Building className="h-4 w-4" />
          Enterable Readiness
          <Badge variant={allRequiredPass ? "default" : "destructive"} className="ml-auto">
            {allRequiredPass ? "Ready" : "Not Ready"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {checks.map((check, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="mt-0.5">
              {check.status ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{check.label}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{check.description}</p>
            </div>
          </div>
        ))}

        {!allRequiredPass && (
          <Alert className="border-red-700/50 bg-red-900/20 mt-4">
            <XCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300 text-xs">
              <strong>Publishing blocked:</strong> Building must pass all required checks to be published as enterable.
            </AlertDescription>
          </Alert>
        )}

        {allRequiredPass && (
          <Alert className="border-green-700/50 bg-green-900/20 mt-4">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-300 text-xs">
              <strong>Ready to publish:</strong> This building meets all enterable requirements and can be published.
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700">
          <p><strong>Manifest Version:</strong> {buildingTemplate.manifest.version}</p>
          <p><strong>Building Type:</strong> {buildingTemplate.manifest.buildingType}</p>
          <p><strong>Entry Points:</strong> {buildingTemplate.manifest.entryPoints.length}</p>
          <p><strong>Spawn Points:</strong> {buildingTemplate.manifest.spawnPoints.length}</p>
        </div>
      </CardContent>
    </Card>
  );
}