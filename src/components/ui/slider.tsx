"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Minimal slider implementation (no external deps).
 * API is compatible with the common shadcn `Slider` shape used in `InteriorExteriorEditor`.
 */
export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> {
  defaultValue?: number[];
  value?: number[];
  onValueChange?: (value: number[]) => void;
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, min = 0, max = 100, step = 1, defaultValue, value, onValueChange, ...props }, ref) => {
    const isControlled = Array.isArray(value);
    const [internal, setInternal] = React.useState<number>(() => {
      const v = defaultValue?.[0];
      return typeof v === "number" ? v : Number(min) || 0;
    });

    const current = isControlled ? (value?.[0] ?? internal) : internal;

    return (
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!isControlled) setInternal(next);
          onValueChange?.([next]);
        }}
        className={cn("w-full accent-cyan-500", className)}
        {...props}
      />
    );
  }
);
Slider.displayName = "Slider";




