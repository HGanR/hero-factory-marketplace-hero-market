"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export type PipCorner = "br" | "bl" | "tr" | "tl";

type Ctx = {
  pipEnabled: boolean;
  setPipEnabled: (v: boolean) => void;
  pipCorner: PipCorner;
  setPipCorner: (c: PipCorner) => void;
};

const MeetScreenShareUiContext = createContext<Ctx | null>(null);

export function MeetScreenShareUiProvider({ children }: { children: React.ReactNode }) {
  const [pipEnabled, setPipEnabled] = useState(true);
  const [pipCorner, setPipCorner] = useState<PipCorner>("br");
  const value = useMemo(
    () => ({ pipEnabled, setPipEnabled, pipCorner, setPipCorner }),
    [pipEnabled, pipCorner]
  );
  return <MeetScreenShareUiContext.Provider value={value}>{children}</MeetScreenShareUiContext.Provider>;
}

export function useMeetScreenShareUi() {
  const c = useContext(MeetScreenShareUiContext);
  if (!c) throw new Error("useMeetScreenShareUi must be used under MeetScreenShareUiProvider");
  return c;
}
