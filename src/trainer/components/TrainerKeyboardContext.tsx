import React, { createContext, useContext } from 'react';
import type { KeyboardView, TrainerKeyView, ComponentId } from '../types';

const Ctx = createContext<KeyboardView | null>(null);

export const TrainerKeyboardProvider: React.FC<{ value: KeyboardView | null; children: React.ReactNode }> =
  ({ value, children }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;

export function useTrainerKeyView(id?: ComponentId): TrainerKeyView | null {
  const view = useContext(Ctx);
  if (!view || !id) return null;
  return view[id] ?? null;
}
