/**
 * Lightweight world store (no external deps)
 *
 * Provides a minimal Zustand-like API using `useSyncExternalStore`.
 * Used by UI components (like WorldElements) to start placement mode.
 */

"use client";

import { useSyncExternalStore } from "react";

export type WorldCurrency = "TROO_POO" | "TROO_COIN";

export type WorldPlacementSpec = {
  name: string;
  type: string;
  modelUrl: string;
  category: string;
  price: number;
  currency: WorldCurrency;
  isStackable: boolean;
  isEnterable: boolean;
  isCustomizable: boolean;
  metadata?: Record<string, unknown>;
};

type WorldState = {
  isPlacing: boolean;
  placement: WorldPlacementSpec | null;
};

type Listener = () => void;

let state: WorldState = {
  isPlacing: false,
  placement: null,
};

const listeners = new Set<Listener>();

function setState(partial: Partial<WorldState>) {
  state = { ...state, ...partial };
  for (const l of listeners) l();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startPlacement(spec: WorldPlacementSpec) {
  setState({ isPlacing: true, placement: spec });
}

export function setPlacing(active: boolean) {
  setState({ isPlacing: active });
}

export function updatePlacement(patch: Partial<WorldPlacementSpec>) {
  if (!state.placement) return;
  setState({ placement: { ...state.placement, ...patch } });
}

export function updatePlacementMetadata(patch: Record<string, unknown>) {
  if (!state.placement) return;
  setState({
    placement: {
      ...state.placement,
      metadata: { ...(state.placement.metadata ?? {}), ...patch },
    },
  });
}

export function stopPlacement() {
  setState({ isPlacing: false });
}

export function clearPlacement() {
  setState({ isPlacing: false, placement: null });
}

export function useWorldStore<T>(selector: (s: WorldState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}


