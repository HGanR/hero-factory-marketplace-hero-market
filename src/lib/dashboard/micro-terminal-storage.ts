export const DASHBOARD_MICRO_TERMINAL_STORAGE_KEY = "hf_dashboard_micro_terminal_v1";
export const DASHBOARD_MICRO_TERMINAL_UPDATED_EVENT = "hf-dashboard-micro-terminal-updated";

const MAX_LOGO_CHARS = 120_000;

export type DashboardMicroTerminalSnapshot = {
  version: 1;
  savedAt: string;
  clientId: string;
  personDisplayName: string;
  entityName: string | null;
  requestedServices: string[];
  /** Truncated or omitted if upload was very large */
  clientLogoDataUrl: string | null;
  logoTruncated: boolean;
};

function safeParse(raw: string | null): DashboardMicroTerminalSnapshot | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as DashboardMicroTerminalSnapshot;
    if (v?.version !== 1 || typeof v.clientId !== "string") return null;
    return v;
  } catch {
    return null;
  }
}

export function readMicroTerminalSnapshot(): DashboardMicroTerminalSnapshot | null {
  if (typeof window === "undefined") return null;
  return safeParse(window.localStorage.getItem(DASHBOARD_MICRO_TERMINAL_STORAGE_KEY));
}

export function writeMicroTerminalClientSnapshot(input: {
  clientId: string;
  personDisplayName: string;
  entityName: string | null;
  requestedServices: string[];
  logoDataUrl: string | null;
}): void {
  if (typeof window === "undefined") return;
  const logo = input.logoDataUrl?.trim() || "";
  const logoTruncated = logo.length > MAX_LOGO_CHARS;
  const clientLogoDataUrl = logoTruncated ? null : logo || null;
  const snap: DashboardMicroTerminalSnapshot = {
    version: 1,
    savedAt: new Date().toISOString(),
    clientId: input.clientId,
    personDisplayName: input.personDisplayName.trim() || "Client",
    entityName: input.entityName?.trim() || null,
    requestedServices: Array.isArray(input.requestedServices) ? [...input.requestedServices] : [],
    clientLogoDataUrl,
    logoTruncated,
  };
  try {
    window.localStorage.setItem(DASHBOARD_MICRO_TERMINAL_STORAGE_KEY, JSON.stringify(snap));
    window.dispatchEvent(new CustomEvent(DASHBOARD_MICRO_TERMINAL_UPDATED_EVENT));
  } catch {
    // Quota exceeded or private mode — skip persistence
  }
}
