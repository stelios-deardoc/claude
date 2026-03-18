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
import type { Call, Split, CDPLevelKey, TodoTask, ActivityEntry } from './types';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export type TodoViewSize = 'compact' | 'normal' | 'expanded';

export interface StoreState {
  calls: Call[];
  splits: Split[];
  todos: TodoTask[];
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
  todos: [],
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
  | { type: 'CLOSE_CALL_MODAL' }
  | { type: 'ADD_TODO'; payload: TodoTask }
  | { type: 'UPDATE_TODO'; payload: { id: string; updates: Partial<TodoTask> } }
  | { type: 'DELETE_TODO'; payload: string }
  | { type: 'TOGGLE_TODO'; payload: string }
  | { type: 'BULK_COMPLETE_TODOS'; payload: string[] }
  | { type: 'MOVE_TODO_TO_REVIEW'; payload: { id: string; activity: ActivityEntry } }
  | { type: 'APPROVE_TODO'; payload: string }
  | { type: 'REOPEN_TODO'; payload: string }
  | { type: 'ADD_ACTIVITY'; payload: { id: string; activity: ActivityEntry } }
  | { type: 'SYNC_TODOS'; payload: TodoTask[] };

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

    case 'ADD_TODO':
      return { ...state, todos: [...state.todos, action.payload] };

    case 'UPDATE_TODO':
      return {
        ...state,
        todos: state.todos.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload.updates } : t,
        ),
      };

    case 'DELETE_TODO':
      return { ...state, todos: state.todos.filter((t) => t.id !== action.payload) };

    case 'TOGGLE_TODO':
      return {
        ...state,
        todos: state.todos.map((t) =>
          t.id === action.payload
            ? {
                ...t,
                status: t.status === 'completed' ? 'active' as const : 'completed' as const,
                completed: t.status !== 'completed',
                completedAt: t.status !== 'completed' ? new Date().toISOString() : '',
              }
            : t,
        ),
      };

    case 'BULK_COMPLETE_TODOS': {
      const ids = new Set(action.payload);
      const now = new Date().toISOString();
      return {
        ...state,
        todos: state.todos.map((t) =>
          ids.has(t.id) ? { ...t, status: 'completed' as const, completed: true, completedAt: now } : t,
        ),
      };
    }

    case 'MOVE_TODO_TO_REVIEW': {
      return {
        ...state,
        todos: state.todos.map((t) =>
          t.id === action.payload.id
            ? {
                ...t,
                status: 'review' as const,
                activityLog: [...(t.activityLog || []), action.payload.activity],
                lastSyncedAt: new Date().toISOString(),
              }
            : t,
        ),
      };
    }

    case 'APPROVE_TODO': {
      const now = new Date().toISOString();
      return {
        ...state,
        todos: state.todos.map((t) =>
          t.id === action.payload
            ? { ...t, status: 'completed' as const, completed: true, completedAt: now }
            : t,
        ),
      };
    }

    case 'REOPEN_TODO':
      return {
        ...state,
        todos: state.todos.map((t) =>
          t.id === action.payload
            ? { ...t, status: 'active' as const, completed: false, completedAt: '' }
            : t,
        ),
      };

    case 'ADD_ACTIVITY':
      return {
        ...state,
        todos: state.todos.map((t) =>
          t.id === action.payload.id
            ? {
                ...t,
                activityLog: [...(t.activityLog || []), action.payload.activity],
                lastSyncedAt: new Date().toISOString(),
              }
            : t,
        ),
      };

    case 'SYNC_TODOS':
      return { ...state, todos: action.payload };

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
  addTodo: (todo: TodoTask) => void;
  updateTodo: (id: string, updates: Partial<TodoTask>) => void;
  deleteTodo: (id: string) => void;
  toggleTodo: (id: string) => void;
  bulkCompleteTodos: (ids: string[]) => void;
  moveToReview: (id: string, activity: ActivityEntry) => void;
  approveTodo: (id: string) => void;
  reopenTodo: (id: string) => void;
  addActivity: (id: string, activity: ActivityEntry) => void;
  syncTodos: (todos: TodoTask[]) => void;
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
const LS_TODOS = 'savedesk_todos';

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
// Server sync helpers
// ---------------------------------------------------------------------------

const SYNC_API = '/api/save-desk/data';

interface ServerData {
  calls: Call[];
  splits: Split[];
  todos: TodoTask[];
  selectedCdpLevel: CDPLevelKey;
  clawbackAmount: number;
}

async function fetchServerData(): Promise<ServerData | null> {
  try {
    const res = await fetch(SYNC_API);
    if (!res.ok) return null;
    return (await res.json()) as ServerData;
  } catch {
    return null;
  }
}

let syncTimeout: ReturnType<typeof setTimeout> | null = null;

function syncToServer(data: Partial<ServerData>): void {
  // Debounce server writes to avoid hammering on rapid state changes
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      await fetch(SYNC_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {
      // silent fail -- localStorage is the fallback
    }
  }, 300);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CallTrackerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);

  // --- Hydrate from server first, fallback to localStorage ---------------
  useEffect(() => {
    // Migrate old todos that lack status/activityLog fields
    function migrateTodos(rawTodos: TodoTask[]): TodoTask[] {
      return rawTodos.map((t) => ({
        ...t,
        status: t.status || (t.completed ? 'completed' : 'active'),
        activityLog: t.activityLog || [],
        lastSyncedAt: t.lastSyncedAt || '',
      }));
    }

    async function hydrate() {
      const lsCalls = readLS<Call[]>(LS_CALLS, []);
      const lsSplits = readLS<Split[]>(LS_SPLITS, []);
      const lsTodos = readLS<TodoTask[]>(LS_TODOS, []);
      const lsCdp = readLS<CDPLevelKey>(LS_CDP, 'am1');
      const lsClawback = readLS<number>(LS_CLAWBACK, 0);
      const todoViewSize = readLS<TodoViewSize>(LS_TODO_VIEW, 'normal');

      // Try server first
      const serverData = await fetchServerData();

      if (serverData && serverData.calls && serverData.calls.length > 0) {
        // Server is ALWAYS the source of truth when it has data
        // This ensures all browsers show the same thing
        dispatch({
          type: 'INIT',
          payload: {
            calls: serverData.calls,
            splits: serverData.splits || lsSplits,
            todos: migrateTodos(serverData.todos || lsTodos),
            selectedCdpLevel: serverData.selectedCdpLevel || lsCdp,
            clawbackAmount: serverData.clawbackAmount ?? lsClawback,
            todoViewSize,
          },
        });

        // Update localStorage to match server
        writeLS(LS_CALLS, serverData.calls);
        writeLS(LS_SPLITS, serverData.splits || lsSplits);
        writeLS(LS_TODOS, migrateTodos(serverData.todos || lsTodos));
      } else {
        // No server data -- use localStorage and push to server
        dispatch({
          type: 'INIT',
          payload: { calls: lsCalls, splits: lsSplits, todos: migrateTodos(lsTodos), selectedCdpLevel: lsCdp, clawbackAmount: lsClawback, todoViewSize },
        });

        if (lsCalls.length > 0) {
          syncToServer({ calls: lsCalls, splits: lsSplits, todos: lsTodos, selectedCdpLevel: lsCdp, clawbackAmount: lsClawback });
        }
      }
    }

    hydrate();
  }, []);

  // --- Persist to localStorage + server on state changes -----------------
  useEffect(() => {
    if (!state._hydrated) return;
    writeLS(LS_CALLS, state.calls);
    syncToServer({ calls: state.calls });
  }, [state._hydrated, state.calls]);

  useEffect(() => {
    if (!state._hydrated) return;
    writeLS(LS_SPLITS, state.splits);
    syncToServer({ splits: state.splits });
  }, [state._hydrated, state.splits]);

  useEffect(() => {
    if (!state._hydrated) return;
    writeLS(LS_CDP, state.selectedCdpLevel);
    syncToServer({ selectedCdpLevel: state.selectedCdpLevel });
  }, [state._hydrated, state.selectedCdpLevel]);

  useEffect(() => {
    if (!state._hydrated) return;
    writeLS(LS_CLAWBACK, state.clawbackAmount);
    syncToServer({ clawbackAmount: state.clawbackAmount });
  }, [state._hydrated, state.clawbackAmount]);

  useEffect(() => {
    if (!state._hydrated) return;
    writeLS(LS_TODO_VIEW, state.todoViewSize);
  }, [state._hydrated, state.todoViewSize]);

  useEffect(() => {
    if (!state._hydrated) return;
    writeLS(LS_TODOS, state.todos);
    syncToServer({ todos: state.todos });
  }, [state._hydrated, state.todos]);

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
  const addTodo = useCallback(
    (todo: TodoTask) => dispatch({ type: 'ADD_TODO', payload: todo }),
    [],
  );
  const updateTodo = useCallback(
    (id: string, updates: Partial<TodoTask>) =>
      dispatch({ type: 'UPDATE_TODO', payload: { id, updates } }),
    [],
  );
  const deleteTodo = useCallback(
    (id: string) => dispatch({ type: 'DELETE_TODO', payload: id }),
    [],
  );
  const toggleTodo = useCallback(
    (id: string) => dispatch({ type: 'TOGGLE_TODO', payload: id }),
    [],
  );
  const bulkCompleteTodos = useCallback(
    (ids: string[]) => dispatch({ type: 'BULK_COMPLETE_TODOS', payload: ids }),
    [],
  );
  const moveToReview = useCallback(
    (id: string, activity: ActivityEntry) =>
      dispatch({ type: 'MOVE_TODO_TO_REVIEW', payload: { id, activity } }),
    [],
  );
  const approveTodo = useCallback(
    (id: string) => dispatch({ type: 'APPROVE_TODO', payload: id }),
    [],
  );
  const reopenTodo = useCallback(
    (id: string) => dispatch({ type: 'REOPEN_TODO', payload: id }),
    [],
  );
  const addActivity = useCallback(
    (id: string, activity: ActivityEntry) =>
      dispatch({ type: 'ADD_ACTIVITY', payload: { id, activity } }),
    [],
  );
  const syncTodos = useCallback(
    (todos: TodoTask[]) => dispatch({ type: 'SYNC_TODOS', payload: todos }),
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
      addTodo,
      updateTodo,
      deleteTodo,
      toggleTodo,
      bulkCompleteTodos,
      moveToReview,
      approveTodo,
      reopenTodo,
      addActivity,
      syncTodos,
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
      addTodo,
      updateTodo,
      deleteTodo,
      toggleTodo,
      bulkCompleteTodos,
      moveToReview,
      approveTodo,
      reopenTodo,
      addActivity,
      syncTodos,
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
