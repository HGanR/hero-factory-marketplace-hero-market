/**
 * Scroll to an AI Revenue OS in-page anchor and expand collapsible steps via hash (openOnHashIds).
 */

export function scrollToAiRevenueOsAnchor(targetId: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const id = targetId.replace(/^#/, "");
  if (!id) return;
  const nextHash = `#${id}`;
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
  window.setTimeout(() => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);
}
