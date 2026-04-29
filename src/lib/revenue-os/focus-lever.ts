/**
 * Shared logic for computing the primary focus lever from revenue variables.
 * Used by PrimaryFocusLeverCard and Scenario save payload.
 */
export type Lever = "conversion" | "aov" | "traffic";

export interface LeverDelta {
  lever: Lever;
  delta: number;
  label: string;
  why: string;
}

export function computeLeverDeltas(
  traffic: number,
  conversion: number,
  aov: number
): LeverDelta[] {
  const revenue = traffic * (conversion / 100) * aov;

  const deltaConv = traffic * ((conversion + 0.25) / 100) * aov - revenue;
  const deltaAov = traffic * (conversion / 100) * (aov * 1.05) - revenue;
  const deltaTraffic = traffic * 1.1 * (conversion / 100) * aov - revenue;

  return [
    {
      lever: "conversion",
      delta: deltaConv,
      label: "Conversion",
      why: `+0.25% conversion adds $${deltaConv.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`,
    },
    {
      lever: "aov",
      delta: deltaAov,
      label: "AOV",
      why: `+5% AOV adds $${deltaAov.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`,
    },
    {
      lever: "traffic",
      delta: deltaTraffic,
      label: "Traffic",
      why: `+10% traffic adds $${deltaTraffic.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`,
    },
  ];
}

export function getFocusLever(
  traffic: number,
  conversion: number,
  aov: number
): Lever {
  const levers = computeLeverDeltas(traffic, conversion, aov);
  const focus = levers.reduce((a, b) => (a.delta >= b.delta ? a : b));
  return focus.lever;
}
