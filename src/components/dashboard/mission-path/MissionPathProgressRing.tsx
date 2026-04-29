"use client";

import React, { useId } from "react";

const SIZE = 120;
const STROKE = 8;
const r = (SIZE - STROKE) / 2;
const c = 2 * Math.PI * r;

type Props = {
  percent: number;
  className?: string;
  "aria-label"?: string;
};

export function MissionPathProgressRing({ percent, className, "aria-label": ariaLabel }: Props) {
  const gradId = `mission-ring-${useId().replace(/:/g, "")}`;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = c * (1 - clamped / 100);

  return (
    <div
      className={className}
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={ariaLabel ?? `Mission path ${clamped} percent complete`}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="drop-shadow-[0_0_12px_rgba(0,209,255,0.25)]">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00D1FF" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="fill-white text-lg font-bold font-mono"
          style={{ textShadow: "0 0 8px rgba(0,209,255,0.3)" }}
        >
          {clamped}%
        </text>
      </svg>
    </div>
  );
}
