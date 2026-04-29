"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DoorOpen, MapPin, Eye, CheckCircle } from "lucide-react";
import { BuildingAssetTemplate } from "./parametric-objects";

interface PortalEnterDemoProps {
  buildingTemplate?: BuildingAssetTemplate;
  isBuildingSelected: boolean;
}

export function PortalEnterDemo({ buildingTemplate, isBuildingSelected }: PortalEnterDemoProps) {
  const [playerPosition, setPlayerPosition] = useState<'exterior' | 'interior'>('exterior');
  const [hasEntered, setHasEntered] = useState(false);

  if (!isBuildingSelected || !buildingTemplate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <DoorOpen className="h-4 w-4" />
            Portal Enter Demo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Eye className="h-4 w-4" />
            <AlertDescription>
              Select a building to see the portal enter system demo.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const manifest = buildingTemplate.manifest;
  const entryPoint = manifest.entryPoints[0];
  const exteriorSpawn = manifest.spawnPoints.find(s => s.type === 'exterior');
  const interiorSpawn = manifest.spawnPoints.find(s => s.type === 'interior');

  const handleEnterBuilding = () => {
    if (entryPoint && interiorSpawn) {
      setPlayerPosition('interior');
      setHasEntered(true);
      console.log('Player entered building via portal:', {
        entryPoint: entryPoint.position,
        interiorSpawn: interiorSpawn.position
      });
    }
  };

  const handleExitBuilding = () => {
    if (exteriorSpawn) {
      setPlayerPosition('exterior');
      console.log('Player exited building to exterior spawn:', exteriorSpawn.position);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <DoorOpen className="h-4 w-4" />
          Portal Enter Demo
          {hasEntered && <Badge className="ml-auto bg-green-600">Inside Building</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Building Status */}
        <div className="space-y-2">
          <div className="text-xs font-medium">Building Configuration:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <Badge variant="outline" className="w-full justify-center">
                {manifest.entryPoints.length} Entry Point{manifest.entryPoints.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div>
              <Badge variant="outline" className="w-full justify-center">
                {manifest.spawnPoints.length} Spawn Point{manifest.spawnPoints.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </div>

        {/* Player Position */}
        <div className="space-y-2">
          <div className="text-xs font-medium flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            Player Position:
            <Badge variant={playerPosition === 'exterior' ? 'default' : 'secondary'}>
              {playerPosition === 'exterior' ? 'Outside Building' : 'Inside Building'}
            </Badge>
          </div>

          {playerPosition === 'exterior' && exteriorSpawn && (
            <div className="text-xs text-slate-400">
              Exterior spawn at: [{exteriorSpawn.position.join(', ')}]
            </div>
          )}

          {playerPosition === 'interior' && interiorSpawn && (
            <div className="text-xs text-slate-400">
              Interior spawn at: [{interiorSpawn.position.join(', ')}]
            </div>
          )}
        </div>

        {/* Entry/Exit Controls */}
        <div className="space-y-2">
          {playerPosition === 'exterior' ? (
            <Button
              onClick={handleEnterBuilding}
              className="w-full text-xs gap-2"
              disabled={!entryPoint}
            >
              <DoorOpen className="h-4 w-4" />
              Enter Building (Portal)
            </Button>
          ) : (
            <Button
              onClick={handleExitBuilding}
              variant="outline"
              className="w-full text-xs gap-2"
            >
              <DoorOpen className="h-4 w-4" />
              Exit Building
            </Button>
          )}

          {!entryPoint && (
            <Alert className="border-yellow-700/50 bg-yellow-900/20">
              <AlertDescription className="text-yellow-300 text-xs">
                No entry points configured. Building cannot be entered.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Demo Explanation */}
        <Alert className="border-blue-700/50 bg-blue-900/20">
          <CheckCircle className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-300 text-xs">
            <strong>How it works:</strong> Entry triggers teleport players from exterior spawn to interior spawn.
            This provides guaranteed enterable buildings without complex door physics.
          </AlertDescription>
        </Alert>

        {/* Technical Details */}
        <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-700">
          <div><strong>Entry Point:</strong> {entryPoint ? `[${entryPoint.position.join(', ')}]` : 'None'}</div>
          <div><strong>Exterior Spawn:</strong> {exteriorSpawn ? `[${exteriorSpawn.position.join(', ')}]` : 'None'}</div>
          <div><strong>Interior Spawn:</strong> {interiorSpawn ? `[${interiorSpawn.position.join(', ')}]` : 'None'}</div>
        </div>
      </CardContent>
    </Card>
  );
}