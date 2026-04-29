"use client";

type Mode = "select" | "move" | "rotate" | "scale" | "placePrefab" | "addTrigger";

export function EditorToolbar(props: {
  toolMode: Mode;
  onToolModeChange: (m: Mode) => void;
  editMode: boolean;
  onEditModeChange: (v: boolean) => void;
  onResetTemplate: () => void;
  onAddWall?: () => void;
  onAddWindow?: () => void;
  onAddDoor?: () => void;
}) {
  const { toolMode, onToolModeChange, editMode, onEditModeChange, onResetTemplate, onAddWall, onAddWindow, onAddDoor } = props;

  const btn = (id: Mode, label: string) => (
    <button
      onClick={() => onToolModeChange(id)}
      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
        toolMode === id
          ? "bg-cyan-500 text-white border-cyan-400"
          : "bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-3 flex-wrap p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
      <div className="flex items-center gap-2">
        {btn("select", "Select")}
        {btn("move", "Move")}
        {btn("rotate", "Rotate")}
        {btn("scale", "Scale")}
        {btn("placePrefab", "Place Prefab")}
        {btn("addTrigger", "Add Trigger")}
      </div>

      <div className="h-6 w-px bg-slate-600" />

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={editMode}
            onChange={(e) => onEditModeChange(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
          />
          Interior Edit Mode
        </label>

        <div className="flex gap-2">
          <button onClick={onAddWall} className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-800/80 text-slate-300 hover:bg-slate-700 text-sm">
            Wall
          </button>
          <button onClick={onAddWindow} className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-800/80 text-slate-300 hover:bg-slate-700 text-sm">
            Window
          </button>
          <button onClick={onAddDoor} className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-800/80 text-slate-300 hover:bg-slate-700 text-sm">
            Door
          </button>
        </div>
      </div>

      <button
        onClick={onResetTemplate}
        className="ml-auto px-4 py-2 rounded-lg border border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700 font-medium text-sm"
      >
        New Enterable Building
      </button>
    </div>
  );
}

export type EditorMode = "select" | "move" | "rotate" | "scale" | "placePrefab" | "addTrigger";