'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import type { Call, Split, CDPLevelKey } from './types';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export type TodoViewSize = 'compact' | 'normal' | 'expanded';

export interface StoreState {
  calls: Call[];
  splits: Split[];
  selectedCdpLevel: CDPLevelKey;
  clawbackAmount: number;
  todoViewSize: TodoViewSize;
  importModalOpen: boolean;
  callModalOpen: boolean;
  callModalId: string | null; // null = new call, string = editing
  _hydrated: boolean; // internal flag -- true once localStorage has been read
}

const DEFAULT_STATE: StoreState = {
  calls: [],
  splits: [],
  selectedCdpLevel: 'am1',
  clawbackAmount: 0,
  todoViewSize: 'normal',
  importModalOpen: false,
  callModalOpen: false,
  callModalId: null,
  _hydrated: false,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: 'INIT'; payload: Partial<StoreState> }
  | { type: 'ADD_CALL'; payload: Call }
  | { type: 'UPDATE_CALL'; payload: { id: string; updates: Partial<Call> } }
  | { type: 'DELETE_CALL'; payload: string }
  | { type: 'IMPORT_CALLS'; payload: Call[] }
  | { type: 'SET_CDP_LEVEL'; payload: CDPLevelKey }
  | { type: 'SET_CLAWBACK'; payload: number }
  | { type: 'ADD_SPLIT'; payload: Split }
  | { type: 'UPDATE_SPLIT'; payload: { id: string; updates: Partial<Split> } }
  | { type: 'REMOVE_SPLIT'; payload: string }
  | { type: 'SET_TODO_VIEW_SIZE'; payload: TodoViewSize }
  | { type: 'OPEN_IMPORT_MODAL' }
  | { type: 'CLOSE_IMPORT_MODAL' }
  | { type: 'OPEN_CALL_MODAL'; payload?: string }
  | { type: 'CLOSE_CALL_MODAL' };

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'INIT':
      return { ...state, ...action.payload, _hydrated: true };

    case 'ADD_CALL':
      return { ...state, calls: [...state.calls, action.payload] };

    case 'UPDATE_CALL':
      return {
        ...state,
        calls: state.calls.map((c) =>
          c.id === action.payload.id ? { ...c, ...action.payload.updates } : c,
        ),
      };

    case 'DELETE_CALL':
      return {
        ...state,
        calls: state.calls.filter((c) => c.id !== action.payload),
      };

    case 'IMPORT_CALLS':
      return { ...state, calls: [...state.calls, ...action.payload] };

    case 'SET_CDP_LEVEL':
      return { ...state, selectedCdpLevel: action.payload };

    case 'SET_CLAWBACK':
      return { ...state, clawbackAmount: action.payload };

    case 'ADD_SPLIT':
      return { ...state, splits: [...state.splits, action.payload] };

    case 'UPDATE_SPLIT':
      return {
        ...state,
        splits: state.splits.map((s) =>
          s.id === action.payload.id ? { ...s, ...action.payload.updates } : s,
        ),
      };

    case 'REMOVE_SPLIT':
      return {
        ...state,
        splits: state.splits.filter((s) => s.id !== action.payload),
      };

    case 'SET_TODO_VIEW_SIZE':
      return { ...state, todoViewSize: action.payload };

    case 'OPEN_IMPORT_MODAL':
      return { ...state, importModalOpen: true };

    case 'CLOSE_IMPORT_MODAL':
      return { ...state, importModalOpen: false };

    case 'OPEN_CALL_MODAL':
      return {
        ...state,
        callModalOpen: true,
        callModalId: action.payload ?? null,
      };

    case 'CLOSE_CALL_MODAL':
      return { ...state, callModalOpen: false, callModalId: null };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context value shape
// ---------------------------------------------------------------------------

interface StoreActions {
  addCall: (call: Call) => void;
  updateCall: (id: string, updates: Partial<Call>) => void;
  deleteCall: (id: string) => void;
  importCalls: (calls: Call[]) => void;
  setCdpLevel: (level: CDPLevelKey) => void;
  setClawbackAmount: (amount: number) => void;
  addSplit: (split: Split) => void;
  updateSplit: (id: string, updates: Partial<Split>) => void;
  removeSplit: (id: string) => void;
  setTodoViewSize: (size: TodoViewSize) => void;
  openImportModal: () => void;
  closeImportModal: () => void;
  openCallModal: (id?: string) => void;
  closeCallModal: () => void;
}

type ContextValue = StoreState & StoreActions;

const CallTrackerContext = createContext<ContextValue | null>(null);

// ---------------------------------------------------------------------------
// localStorage helpers (safe for SSR)
// ---------------------------------------------------------------------------

const LS_CALLS = 'savedesk_data';
const LS_SPLITS = 'savedesk_splits';
const LS_CDP = 'savedesk_cdpLevel';
const LS_CLAWBACK = 'savedesk_clawbackAmount';
const LS_TODO_VIEW = 'todoViewSize';

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded or private browsing -- silently ignore
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CallTrackerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);

  // --- Hydrate from localStorage on mount --------------------------------
  useEffect(() => {
    const calls = readLS<Call[]>(LS_CALLS, []);
    const splits = readLS<Split[]>(LS_SPLITS, []);
    const selectedCdpLevel = readLS<CDPLevelKey>(LS_CDP, 'am1');
    const clawbackAmount = readLS<number>(LS_CLAWBACK, 0);
    const todoViewSize = readLS<TodoViewSize>(LS_TODO_VIEW, 'normal');

    dispatch({
      type: 'INIT',
      payload: { calls, splits, selectedCdpLevel, clawbackAmount, todoViewSize },
    });
  }, []);

  // --- Persist to localStorage on state changes --------------------------
  useEffect(() => {
    if (!state._hydrated) return;
    writeLS(LS_CALLS, state.calls);
  }, [state._hydrated, state.calls]);

  useEffect(() => {
    if (!state._hydrated) return;
    writeLS(LS_SPLITS, state.splits);
  }, [state._hydrated, state.splits]);

  useEffect(() => {
    if (!state._hydrated) return;
    writeLS(LS_CDP, state.selectedCdpLevel);
  }, [state._hydrated, state.selectedCdpLevel]);

  useEffect(() => {
    if (!state._hydrated) return;
    writeLS(LS_CLAWBACK, state.clawbackAmount);
  }, [state._hydrated, state.clawbackAmount]);

  useEffect(() => {
    if (!state._hydrated) return;
    writeLS(LS_TODO_VIEW, state.todoViewSize);
  }, [state._hydrated, state.todoViewSize]);

  // --- Stable action callbacks -------------------------------------------
  const addCall = useCallback(
    (call: Call) => dispatch({ type: 'ADD_CALL', payload: call }),
    [],
  );
  const updateCall = useCallback(
    (id: string, updates: Partial<Call>) =>
      dispatch({ type: 'UPDATE_CALL', payload: { id, updates } }),
    [],
  );
  const deleteCall = useCallback(
    (id: string) => dispatch({ type: 'DELETE_CALL', payload: id }),
    [],
  );
  const importCalls = useCallback(
    (calls: Call[]) => dispatch({ type: 'IMPORT_CALLS', payload: calls }),
    [],
  );
  const setCdpLevel = useCallback(
    (level: CDPLevelKey) => dispatch({ type: 'SET_CDP_LEVEL', payload: level }),
    [],
  );
  const setClawbackAmount = useCallback(
    (amount: number) => dispatch({ type: 'SET_CLAWBACK', payload: amount }),
    [],
  );
  const addSplit = useCallback(
    (split: Split) => dispatch({ type: 'ADD_SPLIT', payload: split }),
    [],
  );
  const updateSplit = useCallback(
    (id: string, updates: Partial<Split>) =>
      dispatch({ type: 'UPDATE_SPLIT', payload: { id, updates } }),
    [],
  );
  const removeSplit = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_SPLIT', payload: id }),
    [],
  );
  const setTodoViewSize = useCallback(
    (size: TodoViewSize) =>
      dispatch({ type: 'SET_TODO_VIEW_SIZE', payload: size }),
    [],
  );
  const openImportModal = useCallback(
    () => dispatch({ type: 'OPEN_IMPORT_MODAL' }),
    [],
  );
  const closeImportModal = useCallback(
    () => dispatch({ type: 'CLOSE_IMPORT_MODAL' }),
    [],
  );
  const openCallModal = useCallback(
    (id?: string) => dispatch({ type: 'OPEN_CALL_MODAL', payload: id }),
    [],
  );
  const closeCallModal = useCallback(
    () => dispatch({ type: 'CLOSE_CALL_MODAL' }),
    [],
  );

  // --- Memoised context value --------------------------------------------
  const value = useMemo<ContextValue>(
    () => ({
      ...state,
      addCall,
      updateCall,
      deleteCall,
      importCalls,
      setCdpLevel,
      setClawbackAmount,
      addSplit,
      updateSplit,
      removeSplit,
      setTodoViewSize,
      openImportModal,
      closeImportModal,
      openCallModal,
      closeCallModal,
    }),
    [
      state,
      addCall,
      updateCall,
      deleteCall,
      importCalls,
      setCdpLevel,
      setClawbackAmount,
      addSplit,
      updateSplit,
      removeSplit,
      setTodoViewSize,
      openImportModal,
      closeImportModal,
      openCallModal,
      closeCallModal,
    ],
  );

  return (
    <CallTrackerContext.Provider value={value}>
      {children}
    </CallTrackerContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCallTracker(): ContextValue {
  const ctx = useContext(CallTrackerContext);
  if (!ctx) {
    throw new Error('useCallTracker must be used within a CallTrackerProvider');
  }
  return ctx;
}
