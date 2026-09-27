import { useSyncExternalStore } from "react";
import { type Action, type GameState, initialState, reduce } from "../game/state";

// A tiny external store so the three.js world and the React HUD share one game state.

export interface Store {
  get(): GameState;
  dispatch(action: Action): void;
  subscribe(fn: () => void): () => void;
}

export function createStore(radiusOf: (state: GameState, index: number) => number): Store {
  let state = initialState();
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    dispatch(action) {
      const next = reduce(state, action, (i) => radiusOf(state, i));
      if (next === state) return;
      state = next;
      for (const fn of listeners) fn();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export function useGame(store: Store): GameState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
