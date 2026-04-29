import type { ProjectExportFile } from "./types";

export function projectExportPaths(files: ProjectExportFile[]): string[] {
  return [...new Set(files.map((f) => f.path))].sort();
}

export function textFilesMap(files: ProjectExportFile[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of files) {
    if (typeof f.content === "string") {
      m.set(f.path, f.content);
    }
  }
  return m;
}

export function getTextFile(files: ProjectExportFile[], path: string): string | undefined {
  const f = files.find((x) => x.path === path);
  return f && typeof f.content === "string" ? f.content : undefined;
}

/** WordPress export nests under `wordpress-theme/<slug>/`. */
export function wordpressThemePrefixFromFiles(files: ProjectExportFile[]): string {
  const style = files.find((f) => f.path.endsWith("/style.css"));
  if (!style) {
    throw new Error("wordpress export: missing style.css");
  }
  return style.path.replace(/\/style\.css$/, "");
}
