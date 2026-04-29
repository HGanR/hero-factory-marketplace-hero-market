"use client";

import { useState } from "react";

export function MetricTooltip({
  tooltip,
  children,
}: {
  tooltip: string;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-flex items-center gap-1.5 group">
      {children}
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold cursor-help border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/20"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        aria-label={tooltip}
      >
        ?
      </span>
      {show && (
        <div
          className="absolute left-0 top-full mt-1 z-50 px-3 py-2 rounded-lg text-xs text-white bg-gray-900 border border-[#D4AF37]/40 shadow-xl max-w-[260px]"
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
