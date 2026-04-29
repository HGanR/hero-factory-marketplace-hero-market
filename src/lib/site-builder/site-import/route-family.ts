/** Map URL path to coarse route family for planner-style hints (import stubs, manifests). */

export type ImportRouteFamily = "home" | "about" | "services" | "contact" | "faq" | "blog" | "other";

export function inferRouteFamilyFromPath(path: string): ImportRouteFamily {
  const p = path.trim().toLowerCase().replace(/\/+$/, "") || "/";
  const tail = p === "/" ? "" : p.split("/").filter(Boolean).pop() || "";
  if (p === "/" || tail === "index") return "home";
  if (/about|team|company|who/.test(tail)) return "about";
  if (/service|solution|pricing|plan|product|offer/.test(tail)) return "services";
  if (/contact|book|schedule|call|reach/.test(tail)) return "contact";
  if (/faq|help|support/.test(tail)) return "faq";
  if (/blog|news|article|insights/.test(tail)) return "blog";
  return "other";
}
