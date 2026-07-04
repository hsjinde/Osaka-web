import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { entities, todos } from '../data';

const LS_KEY = 'osaka-trip-state';
type StateMap = Record<string, boolean>;

function defaults(): StateMap {
  const d: StateMap = {};
  for (const e of entities) if (e.favorite) d[`fav:${e.id}`] = true;
  for (const t of todos) if (t.checkedInVault) d[t.key] = true;
  return d;
}

function loadLocal(): StateMap {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); } catch { return {}; }
}

interface TripState {
  favs: StateMap;
  todosState: StateMap;
  toggleFav(entityId: string): void;
  toggleTodo(key: string): void;
  isFav(entityId: string): boolean;
  favCount: number;
  offline: boolean;
}

const Ctx = createContext<TripState | null>(null);

export function TripStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StateMap>(() => ({ ...defaults(), ...loadLocal() }));

  const toggle = useCallback((key: string) => {
    setState((s) => {
      const next = { ...s, [key]: !s[key] };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* 忽略 */ }
      return next;
    });
  }, []);

  const value = useMemo<TripState>(() => {
    const favs: StateMap = {}; const todosState: StateMap = {};
    for (const [k, v] of Object.entries(state)) {
      if (k.startsWith('fav:')) favs[k] = v;
      else if (k.startsWith('todo:')) todosState[k] = v;
    }
    return {
      favs, todosState,
      toggleFav: (id) => toggle(`fav:${id}`),
      toggleTodo: (key) => toggle(key),
      isFav: (id) => !!state[`fav:${id}`],
      favCount: Object.entries(favs).filter(([, v]) => v).length,
      offline: false,
    };
  }, [state, toggle]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTripState(): TripState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTripState 必須在 TripStateProvider 內使用');
  return ctx;
}