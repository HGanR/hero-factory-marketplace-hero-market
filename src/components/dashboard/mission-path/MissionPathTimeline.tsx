"use client";

import React from "react";
import type { MissionPathStep } from "@/lib/user-mission-path/mission-path-types";
import { MissionPathStepNode } from "./MissionPathStepNode";

type Props = {
  steps: MissionPathStep[];
  className?: string;
};

export function MissionPathTimeline({ steps, className }: Props) {
  return (
    <ol className={`list-none m-0 p-0 space-y-0 ${className ?? ""}`} aria-label="Mission path steps">
      {steps.map((step, i) => (
        <MissionPathStepNode key={step.id} step={step} isLast={i === steps.length - 1} />
      ))}
    </ol>
  );
}
