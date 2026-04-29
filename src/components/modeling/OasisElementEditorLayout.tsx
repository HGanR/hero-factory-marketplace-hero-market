"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Library,
  Download,
  HelpCircle,
  Plus,
  Lightbulb,
  Move,
  RotateCcw,
  Square,
  Maximize2,
  Trash2,
  Save,
  Loader2,
  Palette,
  Upload,
  FileOutput,
  Users,
  Bell,
  Sun,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function OasisElementEditorLayout({
  sceneSearch,
  onSceneSearchChange,
  sceneObjectCount,
  onLibraryClick,
  onImportClick,
  onHelpClick,
  sceneTitle,
  onAddObject,
  onMove,
  onRotate,
  onScale,
  onDelete,
  onPaint,
  onSave,
  onLoad,
  onImport,
  onExport,
  onCollaborate,
  saving,
  loading,
  cameraView,
  onCameraViewChange,
  bgColor,
  onBgColorChange,
  snapping,
  onSnappingChange,
  snapSize,
  onSnapSizeChange,
  showGrid,
  onShowGridChange,
  wireframe,
  onWireframeChange,
  helpers,
  onHelpersChange,
  ambientLight,
  onAmbientLightChange,
  ambientIntensity,
  onAmbientIntensityChange,
  directionalLight,
  onDirectionalLightChange,
  directionalIntensity,
  onDirectionalIntensityChange,
  zoomLabel,
  children,
  toolbarExtra,
  sidebarExtra,
}: {
  sceneSearch: string;
  onSceneSearchChange: (v: string) => void;
  sceneObjectCount: number;
  onLibraryClick?: () => void;
  onImportClick?: () => void;
  onHelpClick?: () => void;
  sceneTitle: string;
  onAddObject?: () => void;
  onMove?: () => void;
  onRotate?: () => void;
  onScale?: () => void;
  onDelete?: () => void;
  onPaint?: () => void;
  onSave?: () => void;
  onLoad?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onCollaborate?: () => void;
  saving?: boolean;
  loading?: boolean;
  cameraView: string;
  onCameraViewChange: (v: string) => void;
  bgColor: string;
  onBgColorChange: (v: string) => void;
  snapping: boolean;
  onSnappingChange: (v: boolean) => void;
  snapSize: number;
  onSnapSizeChange: (v: number) => void;
  showGrid: boolean;
  onShowGridChange: (v: boolean) => void;
  wireframe: boolean;
  onWireframeChange: (v: boolean) => void;
  helpers: boolean;
  onHelpersChange: (v: boolean) => void;
  ambientLight: boolean;
  onAmbientLightChange: (v: boolean) => void;
  ambientIntensity: number;
  onAmbientIntensityChange: (v: number) => void;
  directionalLight: boolean;
  onDirectionalLightChange: (v: boolean) => void;
  directionalIntensity: number;
  onDirectionalIntensityChange: (v: number) => void;
  zoomLabel?: string;
  children: React.ReactNode;
  toolbarExtra?: React.ReactNode;
  /** Optional content at top of right sidebar (e.g. Parametric Builder) */
  sidebarExtra?: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden">
      {/* Left Sidebar - Scene Explorer */}
      <aside className="w-[280px] min-w-[280px] border-r border-white/10 bg-slate-950/60 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center gap-2">
          <Link
            href="/oasis-elements"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Back to Oasis Elements"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h2 className="text-base font-semibold">Oasis Element Editor</h2>
        </div>

        <div className="p-4">
          <Input
            type="search"
            placeholder="Search"
            value={sceneSearch}
            onChange={(e) => onSceneSearchChange(e.target.value)}
            className="w-full bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-500"
          />
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-6 text-center">
            <p className="text-sm text-slate-400">
              {sceneObjectCount === 0
                ? "No objects in scene. Use the toolbar to add shapes."
                : `${sceneObjectCount} object(s) in scene`}
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 space-y-1">
          <button
            onClick={onLibraryClick}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-sm"
          >
            <Library className="h-4 w-4 shrink-0" />
            Library
          </button>
          <button
            onClick={onImportClick}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-sm"
          >
            <Download className="h-4 w-4 shrink-0" />
            Import
          </button>
          <button
            onClick={onHelpClick}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-sm"
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            Help & Feedback
          </button>
        </div>
      </aside>

      {/* Center - Canvas Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm text-slate-400">{sceneTitle}</span>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2 flex-wrap">
          <button
            onClick={onAddObject}
            className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            title="Add object"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" title="Lights">
            <Lightbulb className="h-4 w-4" />
          </button>
          <button onClick={onMove} className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" title="Move">
            <Move className="h-4 w-4" />
          </button>
          <button onClick={onRotate} className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" title="Rotate">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button onClick={onScale} className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" title="Scale">
            <Square className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-lg text-rose-400 hover:bg-white/5 hover:text-rose-300 transition-colors" title="Delete selected">
            <Trash2 className="h-4 w-4" />
          </button>
          <button className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" title="Fullscreen">
            <Maximize2 className="h-4 w-4" />
          </button>

          <div className="w-px h-6 bg-slate-600 mx-1" />

          <button
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
          <button
            onClick={onLoad}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            <Loader2 className={cn("h-4 w-4", loading && "animate-spin")} />
            Load
          </button>
          <button onClick={onPaint} className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-sm font-medium flex items-center gap-1.5">
            <Palette className="h-4 w-4" />
            Paint
          </button>
          <button onClick={onImport} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-medium flex items-center gap-1.5">
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button onClick={onExport} className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-sm font-medium flex items-center gap-1.5">
            <FileOutput className="h-4 w-4" />
            Export
          </button>

          {toolbarExtra}

          <div className="flex-1" />
          {zoomLabel && <span className="text-xs text-slate-500">{zoomLabel}</span>}
          <button className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" title="Notifications">
            <Bell className="h-4 w-4" />
          </button>
          <button
            onClick={onCollaborate}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700 text-sm font-medium flex items-center gap-1.5"
          >
            <Users className="h-4 w-4" />
            Collaborate
          </button>
        </div>

        {/* 3D Canvas */}
        <div className="flex-1 min-h-0 relative">{children}</div>

        {/* Keyboard Shortcuts Footer */}
        <div className="px-4 py-2 bg-slate-950/80 border-t border-white/10 text-[10px] text-slate-500 font-mono flex items-center gap-4 flex-wrap">
          <span><kbd className="px-1 bg-slate-800 rounded">W</kbd> Move</span>
          <span><kbd className="px-1 bg-slate-800 rounded">E</kbd> Rotate</span>
          <span><kbd className="px-1 bg-slate-800 rounded">R</kbd> Scale</span>
          <span><kbd className="px-1 bg-slate-800 rounded">G</kbd> Grid</span>
          <span><kbd className="px-1 bg-slate-800 rounded">H</kbd> Helpers</span>
          <span><kbd className="px-1 bg-slate-800 rounded">Del</kbd> Delete</span>
          <span><kbd className="px-1 bg-slate-800 rounded">Ctrl+D</kbd> Dup</span>
          <span><kbd className="px-1 bg-slate-800 rounded">Ctrl+Z</kbd> Undo</span>
          <span><kbd className="px-1 bg-slate-800 rounded">Ctrl+S</kbd> Save</span>
          <span><kbd className="px-1 bg-slate-800 rounded">1-6</kbd> Add</span>
          <span><kbd className="px-1 bg-slate-800 rounded">?</kbd></span>
        </div>
      </main>

      {/* Right Sidebar - Properties */}
      <aside className="w-[300px] min-w-[300px] border-l border-white/10 bg-slate-950/60 overflow-y-auto">
        <div className="p-4 space-y-6">
          {sidebarExtra}
          {/* Camera */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Camera</h3>
            <Select value={cameraView} onValueChange={onCameraViewChange}>
              <SelectTrigger className="w-full bg-slate-800/80 border-slate-700">
                <SelectValue placeholder="Current" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="perspective">Perspective</SelectItem>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="front">Front</SelectItem>
                <SelectItem value="side">Side</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Frame */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Frame</h3>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 shrink-0">BG Color</label>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => onBgColorChange(e.target.value)}
                className="h-8 w-10 rounded cursor-pointer shrink-0"
              />
              <input
                type="text"
                value={bgColor}
                onChange={(e) => onBgColorChange(e.target.value)}
                className="flex-1 rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs font-mono text-slate-200"
              />
            </div>
          </div>

          {/* Global Settings */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Global Settings</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">Snapping</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => onSnappingChange(true)}
                    className={cn("px-2 py-1 rounded text-xs", snapping ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400")}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => onSnappingChange(false)}
                    className={cn("px-2 py-1 rounded text-xs", !snapping ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400")}
                  >
                    No
                  </button>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Snap Size</span>
                  <span>{snapSize.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={2}
                  step={0.05}
                  value={snapSize}
                  onChange={(e) => onSnapSizeChange(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">Grid</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => onShowGridChange(true)}
                    className={cn("px-2 py-1 rounded text-xs", showGrid ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400")}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => onShowGridChange(false)}
                    className={cn("px-2 py-1 rounded text-xs", !showGrid ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400")}
                  >
                    No
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">Wireframe</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => onWireframeChange(true)}
                    className={cn("px-2 py-1 rounded text-xs", wireframe ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400")}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => onWireframeChange(false)}
                    className={cn("px-2 py-1 rounded text-xs", !wireframe ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400")}
                  >
                    No
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">Helpers</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => onHelpersChange(true)}
                    className={cn("px-2 py-1 rounded text-xs", helpers ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400")}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => onHelpersChange(false)}
                    className={cn("px-2 py-1 rounded text-xs", !helpers ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400")}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Environment */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Environment
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">Ambient Light</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAmbientLightChange(true)}
                    className={cn("px-2 py-1 rounded text-xs", ambientLight ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400")}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => onAmbientLightChange(false)}
                    className={cn("px-2 py-1 rounded text-xs", !ambientLight ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400")}
                  >
                    No
                  </button>
                </div>
              </div>
              {ambientLight && (
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Intensity</span>
                    <span>{ambientIntensity.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={ambientIntensity}
                    onChange={(e) => onAmbientIntensityChange(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">Directional Light</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => onDirectionalLightChange(true)}
                    className={cn("px-2 py-1 rounded text-xs", directionalLight ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400")}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => onDirectionalLightChange(false)}
                    className={cn("px-2 py-1 rounded text-xs", !directionalLight ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400")}
                  >
                    No
                  </button>
                </div>
              </div>
              {directionalLight && (
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Intensity</span>
                    <span>{directionalIntensity.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.05}
                    value={directionalIntensity}
                    onChange={(e) => onDirectionalIntensityChange(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
