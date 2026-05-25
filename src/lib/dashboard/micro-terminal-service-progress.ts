/**
 * Placeholder until Trust / Site Builder / AI Agent / OS Revenue expose per-service completion.
 */
export function microTerminalServiceProgress(
  totalServices: number,
  completedServices = 0,
): { completedServices: number; totalServices: number; progressPercent: number } {
  return {
    completedServices,
    totalServices,
    progressPercent:
      totalServices > 0 ? Math.round((completedServices / totalServices) * 100) : 0,
  };
}
