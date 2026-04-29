"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Move3d, RotateCw, Maximize2 } from "lucide-react";
import type { TransformGizmo } from "./transform-gizmo";

export type GizmoMode = "translate" | "rotate" | "scale";
type GizmoRefLike = { current: TransformGizmo | null } | undefined;

export function GizmoModeButtons({
  mode,
  onModeChange,
  gizmoRef,
  compact = false,
  showShortcuts = true,
}: {
  mode: GizmoMode;
  onModeChange: (mode: GizmoMode) => void;
  gizmoRef?: GizmoRefLike;
  compact?: boolean;
  showShortcuts?: boolean;
}) {
  const handleModeChange = (newMode: GizmoMode) => {
    onModeChange(newMode);
    gizmoRef?.current?.setMode(newMode);
  };

  const buttons = [
    { mode: "translate" as const, label: "Translate", shortcut: "T", icon: Move3d, description: "Move object along axes" },
    { mode: "rotate" as const, label: "Rotate", shortcut: "R", icon: RotateCw, description: "Rotate around axes" },
    { mode: "scale" as const, label: "Scale", shortcut: "S", icon: Maximize2, description: "Scale along axes" },
  ];

  const buttonContent = (
    <div className={compact ? "flex gap-2" : "space-y-2"}>
      {buttons.map(({ mode: btnMode, label, shortcut, icon: Icon, description }) => (
        <Button
          key={btnMode}
          onClick={() => handleModeChange(btnMode)}
          variant={mode === btnMode ? "default" : "outline"}
          size="sm"
          className={`${compact ? "flex-1" : "w-full"} text-xs gap-2`}
          title={description}
        >
          <Icon className="h-4 w-4" />
          {label}
          {showShortcuts ? <span className="ml-1 opacity-60">({shortcut})</span> : null}
        </Button>
      ))}
    </div>
  );

  if (compact) return buttonContent;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Gizmo Controls</CardTitle>
      </CardHeader>
      <CardContent>{buttonContent}</CardContent>
    </Card>
  );
}

export function GizmoModeIndicator({ mode }: { mode: GizmoMode }) {
  const modeInfo: Record<GizmoMode, { label: string; description: string; icon: string }> = {
    translate: { label: "Translate Mode", description: "Move objects along X, Y, Z axes", icon: "↔" },
    rotate: { label: "Rotate Mode", description: "Rotate around X, Y, Z axes", icon: "⟳" },
    scale: { label: "Scale Mode", description: "Scale along X, Y, Z axes", icon: "⬚" },
  };

  const info = modeInfo[mode];

  return (
    <div className="fixed bottom-4 left-4 bg-slate-900/80 border border-slate-700 rounded p-3 text-xs text-slate-300 max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{info.icon}</span>
        <div className="font-semibold">{info.label}</div>
      </div>
      <div className="text-slate-400 mb-3">{info.description}</div>
      <div className="space-y-1 text-slate-400 border-t border-slate-700 pt-2">
        <div>
          Press <kbd className="bg-slate-800 px-1 rounded">T</kbd> for Translate
        </div>
        <div>
          Press <kbd className="bg-slate-800 px-1 rounded">R</kbd> for Rotate
        </div>
        <div>
          Press <kbd className="bg-slate-800 px-1 rounded">S</kbd> for Scale
        </div>
      </div>
      <div className="border-t border-slate-700 pt-2 mt-2 text-slate-500">
        <div>Right-click + drag to rotate camera</div>
        <div>Scroll to zoom</div>
      </div>
    </div>
  );
}

export function GizmoControlsPanel({
  mode,
  onModeChange,
  gizmoRef,
}: {
  mode: GizmoMode;
  onModeChange: (mode: GizmoMode) => void;
  gizmoRef?: GizmoRefLike;
}) {
  return (
    <>
      <GizmoModeButtons mode={mode} onModeChange={onModeChange} gizmoRef={gizmoRef} showShortcuts />
      <GizmoModeIndicator mode={mode} />
    </>
  );
}

export function CompactGizmoButtons({
  mode,
  onModeChange,
  gizmoRef,
}: {
  mode: GizmoMode;
  onModeChange: (mode: GizmoMode) => void;
  gizmoRef?: GizmoRefLike;
}) {
  return <GizmoModeButtons mode={mode} onModeChange={onModeChange} gizmoRef={gizmoRef} compact showShortcuts={false} />;
}


