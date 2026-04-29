"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  financialReadinessReducer,
  initialFinancialReadinessState,
  type FinancialReadinessAction,
  type FinancialReadinessState,
} from "./state";
import { clearFinancialReadinessStorage, loadFinancialReadinessState, saveFinancialReadinessState } from "./persistence";

type Ctx = {
  state: FinancialReadinessState;
  dispatch: React.Dispatch<FinancialReadinessAction>;
};

const FinancialReadinessContext = createContext<Ctx | null>(null);

export function FinancialReadinessProvider({ children }: { children: React.ReactNode }) {
  const [state, baseDispatch] = useReducer(financialReadinessReducer, initialFinancialReadinessState);
  const [hydrated, setHydrated] = useState(false);

  const dispatch = useCallback((action: FinancialReadinessAction) => {
    baseDispatch(action);
    if (action.type === "reset") {
      clearFinancialReadinessStorage();
    }
  }, []);

  useEffect(() => {
    const loaded = loadFinancialReadinessState();
    if (loaded) {
      baseDispatch({ type: "hydrate", payload: loaded });
    }
    setHydrated(true);
  }, []);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveFinancialReadinessState(state);
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, hydrated]);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return (
    <FinancialReadinessContext.Provider value={value}>{children}</FinancialReadinessContext.Provider>
  );
}

export function useFinancialReadiness() {
  const ctx = useContext(FinancialReadinessContext);
  if (!ctx) {
    throw new Error("useFinancialReadiness must be used within FinancialReadinessProvider");
  }
  return ctx;
}

export function useFinancialReadinessOptional() {
  return useContext(FinancialReadinessContext);
}
