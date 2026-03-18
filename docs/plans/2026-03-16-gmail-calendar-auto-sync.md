# Gmail + Calendar Auto-Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically sync Gmail sent emails and Google Calendar events with the Command Center's To-Do system 3x daily (9am, 12pm, 6pm), moving matched todos to a "Review" tab with activity logs.

**Architecture:** Extend TodoTask with `status` (active/review/completed) and `activityLog` fields. Build a `/api/sync` endpoint that receives matched Gmail/Calendar data and updates todos. Create 3 Claude scheduled tasks that use Gmail + Calendar MCPs to detect activity and POST to the sync endpoint.

**Tech Stack:** Next.js API Routes, Claude Scheduled Tasks MCP, Gmail MCP, Google Calendar MCP, existing React Context store

---

### Task 1: Extend TodoTask Type

**Files:**
- Modify: `src/lib/types.ts:60-71`

**Step 1: Add ActivityEntry interface and update TodoTask**

Replace the TodoTask interface (lines 60-71) with:

```typescript
export interface ActivityEntry {
  id: string;
  timestamp: string;        // ISO string
  source: 'gmail' | 'calendar' | 'manual';
  summary: string;          // "Email sent to Dr. Friedman" or "Meeting at 2pm"
  metadata: {
    emailId?: string;       // Gmail message ID for linking
    eventId?: string;       // Calendar event ID
    subject?: string;       // Email subject or event title
  };
}

export interface TodoTask {
  id: string;
  title: string;
  description: string;
  dueDate: string;          // 'YYYY-MM-DD' or ''
  priority: 'high' | 'medium' | 'low';
  category: 'follow-up' | 'email' | 'internal' | 'salesforce' | 'meeting' | 'other';
  linkedAccountId: string;  // '' if not linked
  status: 'active' | 'review' | 'completed';
  completed: boolean;       // kept for backward compat, derived from status
  completedAt: string;      // ISO string or ''
  createdAt: string;        // ISO string
  activityLog: ActivityEntry[];
  lastSyncedAt: string;     // ISO string or ''
  autoCreated?: boolean;    // true if created from calendar sync
}
```

**Step 2: Verify types compile**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npx tsc --noEmit 2>&1 | head -20`

Expected: May have errors in store.tsx and todo/page.tsx since they reference old fields -- that's fine, we fix those next.

---

### Task 2: Update Store for New Todo Status

**Files:**
- Modify: `src/lib/store.tsx:50-177` (Action types + reducer)
- Modify: `src/lib/store.tsx:183-203` (StoreActions interface)
- Modify: `src/lib/store.tsx:373-453` (callbacks)

**Step 1: Add new action types**

Add to the Action union type (after line 70):

```typescript
  | { type: 'MOVE_TODO_TO_REVIEW'; payload: { id: string; activity: ActivityEntry } }
  | { type: 'APPROVE_TODO'; payload: string }
  | { type: 'REOPEN_TODO'; payload: string }
  | { type: 'ADD_ACTIVITY'; payload: { id: string; activity: ActivityEntry } }
  | { type: 'SYNC_TODOS'; payload: TodoTask[] };
```

**Step 2: Add reducer cases**

Add before the `default` case (line 174):

```typescript
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
```

**Step 3: Update TOGGLE_TODO to use status field**

Replace the TOGGLE_TODO case (lines 153-161):

```typescript
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
```

**Step 4: Update BULK_COMPLETE_TODOS to set status**

Replace the BULK_COMPLETE_TODOS case (lines 163-172):

```typescript
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
```

**Step 5: Add new actions to StoreActions interface**

Add after `bulkCompleteTodos` (line 202):

```typescript
  moveToReview: (id: string, activity: ActivityEntry) => void;
  approveTodo: (id: string) => void;
  reopenTodo: (id: string) => void;
  addActivity: (id: string, activity: ActivityEntry) => void;
  syncTodos: (todos: TodoTask[]) => void;
```

**Step 6: Add useCallback wrappers**

Add after `bulkCompleteTodos` callback (line 453):

```typescript
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
```

**Step 7: Add to import, context value, and useMemo deps**

- Add `ActivityEntry` to the import from `./types` (line 12)
- Add the 5 new actions to the value object in useMemo (after line 477)
- Add the 5 new callbacks to the useMemo dependency array (after line 499)

**Step 8: Verify types compile**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npx tsc --noEmit 2>&1 | head -20`

---

### Task 3: Build Sync API Route

**Files:**
- Create: `src/app/api/sync/route.ts`

**Step 1: Create the sync endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_PATH = path.resolve(process.cwd(), 'data', 'savedesk.json');

interface ActivityEntry {
  id: string;
  timestamp: string;
  source: 'gmail' | 'calendar' | 'manual';
  summary: string;
  metadata: {
    emailId?: string;
    eventId?: string;
    subject?: string;
  };
}

interface TodoTask {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  category: 'follow-up' | 'email' | 'internal' | 'salesforce' | 'meeting' | 'other';
  linkedAccountId: string;
  status: 'active' | 'review' | 'completed';
  completed: boolean;
  completedAt: string;
  createdAt: string;
  activityLog: ActivityEntry[];
  lastSyncedAt: string;
  autoCreated?: boolean;
}

interface SyncPayload {
  emailMatches?: {
    accountId: string;
    accountName: string;
    contactName: string;
    emailId: string;
    subject: string;
    sentAt: string;
    recipientEmail: string;
  }[];
  calendarEvents?: {
    eventId: string;
    title: string;
    startTime: string;
    endTime: string;
    matchedAccountId?: string;
    matchedAccountName?: string;
    attendees?: string[];
  }[];
  lastSyncedAt: string;
}

interface SaveDeskData {
  calls: unknown[];
  splits: unknown[];
  todos: TodoTask[];
  selectedCdpLevel: string;
  clawbackAmount: number;
  lastSyncedAt?: string;
}

async function readData(): Promise<SaveDeskData> {
  try {
    const raw = await readFile(DATA_PATH, 'utf-8');
    return JSON.parse(raw) as SaveDeskData;
  } catch {
    return {
      calls: [],
      splits: [],
      todos: [],
      selectedCdpLevel: 'am1',
      clawbackAmount: 0,
    };
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// POST /api/sync -- receive Gmail/Calendar matches, update todos
export async function POST(req: NextRequest) {
  const payload = (await req.json()) as SyncPayload;
  const data = await readData();
  const todos = (data.todos || []).map((t) => ({
    ...t,
    activityLog: t.activityLog || [],
    status: t.status || (t.completed ? 'completed' : 'active'),
    lastSyncedAt: t.lastSyncedAt || '',
  })) as TodoTask[];

  const now = payload.lastSyncedAt || new Date().toISOString();
  const results: string[] = [];

  // --- Process email matches ---
  if (payload.emailMatches) {
    for (const match of payload.emailMatches) {
      // Find todos linked to this account that are active
      const linkedTodos = todos.filter(
        (t) => t.linkedAccountId === match.accountId && t.status === 'active',
      );

      if (linkedTodos.length > 0) {
        // Move each matching todo to review
        for (const todo of linkedTodos) {
          const activity: ActivityEntry = {
            id: generateId(),
            timestamp: match.sentAt || now,
            source: 'gmail',
            summary: `Email sent to ${match.contactName} - ${match.subject}`,
            metadata: {
              emailId: match.emailId,
              subject: match.subject,
            },
          };
          todo.activityLog.push(activity);
          todo.status = 'review';
          todo.lastSyncedAt = now;
          results.push(`Moved "${todo.title}" to review (email to ${match.contactName})`);
        }
      } else {
        // No linked todo -- just log for reference, don't auto-create
        results.push(`Email to ${match.contactName} at ${match.accountName} -- no linked todo`);
      }
    }
  }

  // --- Process calendar events ---
  if (payload.calendarEvents) {
    for (const event of payload.calendarEvents) {
      if (!event.matchedAccountId) continue;

      // Check if a todo already exists for this account
      const linkedTodos = todos.filter(
        (t) => t.linkedAccountId === event.matchedAccountId && t.status !== 'completed',
      );

      if (linkedTodos.length > 0) {
        // Add calendar activity to existing todos
        for (const todo of linkedTodos) {
          const alreadyLogged = todo.activityLog.some(
            (a) => a.metadata.eventId === event.eventId,
          );
          if (alreadyLogged) continue;

          const startTime = new Date(event.startTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          });
          const activity: ActivityEntry = {
            id: generateId(),
            timestamp: now,
            source: 'calendar',
            summary: `Meeting scheduled at ${startTime} - ${event.title}`,
            metadata: {
              eventId: event.eventId,
              subject: event.title,
            },
          };
          todo.activityLog.push(activity);
          todo.lastSyncedAt = now;
          results.push(`Added meeting context to "${todo.title}"`);
        }
      } else {
        // Auto-create a todo from the calendar event
        const startTime = new Date(event.startTime).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });
        const dateStr = new Date(event.startTime).toISOString().split('T')[0];
        const newTodo: TodoTask = {
          id: generateId(),
          title: `${event.title}`,
          description: `Auto-created from calendar event at ${startTime}`,
          dueDate: dateStr,
          priority: 'medium',
          category: 'meeting',
          linkedAccountId: event.matchedAccountId || '',
          status: 'active',
          completed: false,
          completedAt: '',
          createdAt: now,
          activityLog: [
            {
              id: generateId(),
              timestamp: now,
              source: 'calendar',
              summary: `Meeting at ${startTime} - ${event.title}`,
              metadata: { eventId: event.eventId, subject: event.title },
            },
          ],
          lastSyncedAt: now,
          autoCreated: true,
        };
        todos.push(newTodo);
        results.push(`Created todo from calendar: "${event.title}" for ${event.matchedAccountName}`);
      }
    }
  }

  // Save
  data.todos = todos;
  data.lastSyncedAt = now;
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2));

  return NextResponse.json({
    ok: true,
    synced: results.length,
    details: results,
    timestamp: now,
  });
}

// GET /api/sync -- return sync status + last sync time
export async function GET() {
  const data = await readData();
  const reviewCount = (data.todos || []).filter(
    (t: TodoTask) => (t.status || (t.completed ? 'completed' : 'active')) === 'review',
  ).length;

  return NextResponse.json({
    lastSyncedAt: data.lastSyncedAt || null,
    reviewCount,
    totalTodos: (data.todos || []).length,
  });
}
```

**Step 2: Verify the route compiles**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npx tsc --noEmit 2>&1 | head -20`

---

### Task 4: Update To-Do Page with Review Tab

**Files:**
- Modify: `src/app/todo/page.tsx`

**Key changes:**

1. Update `StatusFilter` type to include `'review'`:
```typescript
type StatusFilter = 'all' | 'active' | 'review' | 'completed';
```

2. Update the status filter dropdown (around line 548-556) to add Review option with badge:
```typescript
<select
  value={statusFilter}
  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
  style={selectStyle}
>
  <option value="all">All Status</option>
  <option value="active">Active</option>
  <option value="review">Review ({reviewCount})</option>
  <option value="completed">Completed</option>
</select>
```

3. Add `reviewCount` computation:
```typescript
const reviewCount = useMemo(() => todos.filter((t) => t.status === 'review').length, [todos]);
```

4. Add `approveTodo` and `reopenTodo` to the store destructuring (line 81):
```typescript
const { calls, todos, addTodo, updateTodo, deleteTodo, toggleTodo, bulkCompleteTodos, openCallModal, approveTodo, reopenTodo } = useCallTracker();
```

5. Update the filter logic (lines 143-157) to handle review status:
```typescript
      // status
      if (statusFilter === 'active' && t.status !== 'active') return false;
      if (statusFilter === 'review' && t.status !== 'review') return false;
      if (statusFilter === 'completed' && t.status !== 'completed') return false;
```

6. Split todos into 3 groups instead of 2:
```typescript
    const active = filtered.filter((t) => t.status === 'active');
    const review = filtered.filter((t) => t.status === 'review');
    const completed = filtered.filter((t) => t.status === 'completed');
    return { activeTodos: active, reviewTodos: review, completedTodos: completed };
```

7. Add Review section between active tasks and completed section. Each review card shows:
   - Yellow-amber left border (`borderLeft: '4px solid #f59e0b'`)
   - Activity timeline below title showing each ActivityEntry with icon (email/calendar), summary, timestamp
   - Two action buttons: Complete (green checkmark) and Reopen (blue arrow)
   - Click email activity to open Gmail thread (if emailId available)
   - Auto-created badge if `autoCreated` is true
   - Keyboard shortcut hint bar at bottom when on Review tab

8. Update the `activeCount` to show separate counts:
```typescript
const activeCount = useMemo(() => todos.filter((t) => t.status === 'active').length, [todos]);
```

9. Update header to show review badge when items need review:
```typescript
{reviewCount > 0 && (
  <span style={{ background: '#f59e0b', color: '#000', borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 600 }}>
    {reviewCount} to review
  </span>
)}
```

10. Add keyboard handler for quick review mode:
```typescript
useEffect(() => {
  if (statusFilter !== 'review') return;
  function handleKey(e: KeyboardEvent) {
    if (!reviewTodos.length) return;
    const focusedId = reviewTodos[0]?.id;
    if (!focusedId) return;
    if (e.key === 'Enter') { approveTodo(focusedId); }
    if (e.key === 'Backspace') { e.preventDefault(); reopenTodo(focusedId); }
  }
  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
}, [statusFilter, reviewTodos, approveTodo, reopenTodo]);
```

**Step 2: Verify the page renders**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npx tsc --noEmit`

Then preview at localhost:3000/todo and verify:
- Review option appears in status dropdown
- Review badge appears in header when items exist
- Review cards show activity timeline with amber left border

---

### Task 5: Update Quick-Add to Use New Status Field

**Files:**
- Modify: `src/app/todo/page.tsx` (handleQuickAdd and createFromSuggestion)

**Step 1: Update handleQuickAdd**

Update the todo object creation in `handleQuickAdd` (around line 185) to include new fields:

```typescript
    const todo: TodoTask = {
      id: generateId(),
      title: qaTitle.trim(),
      description: '',
      dueDate: qaDate,
      priority: qaPriority,
      category: qaCategory,
      linkedAccountId: qaAccountId,
      status: 'active',
      completed: false,
      completedAt: '',
      createdAt: new Date().toISOString(),
      activityLog: [],
      lastSyncedAt: '',
    };
```

**Step 2: Update createFromSuggestion**

Same pattern -- add `status: 'active'`, `activityLog: []`, `lastSyncedAt: ''` to the todo object.

**Step 3: Verify compile**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npx tsc --noEmit`

Expected: Zero type errors

---

### Task 6: Migrate Existing Data (Backward Compatibility)

**Files:**
- Modify: `src/lib/store.tsx` (hydration logic)

**Step 1: Add migration in the hydrate function**

In the hydrate function (around line 291-335), after loading todos from server or localStorage, add a migration step to ensure old todos without `status`/`activityLog` fields are normalized:

```typescript
// Migrate old todos that lack status/activityLog fields
function migrateTodos(todos: TodoTask[]): TodoTask[] {
  return todos.map((t) => ({
    ...t,
    status: t.status || (t.completed ? 'completed' : 'active'),
    activityLog: t.activityLog || [],
    lastSyncedAt: t.lastSyncedAt || '',
  }));
}
```

Call `migrateTodos()` on the todos array before dispatching INIT in both the server and localStorage branches.

**Step 2: Verify existing data loads correctly**

Preview at localhost:3000/todo -- existing todos should appear as "active" status with empty activity logs.

---

### Task 7: Create Scheduled Tasks

**Files:**
- No code files -- uses Claude Scheduled Tasks MCP

**Step 1: Create Morning Sync (9:00 AM)**

Use `scheduled-tasks` MCP `create_scheduled_task` with:
- name: "Command Center Morning Sync"
- schedule: daily at 9:00 AM
- prompt: (see sync prompt below)

**Step 2: Create Midday Sync (12:00 PM)**

Same prompt, different schedule.

**Step 3: Create Evening Sync (6:00 PM)**

Same prompt, different schedule.

**Sync Prompt Template:**

```
You are running an automated sync for Stelios's DearDoc Command Center. Follow these steps exactly:

1. FETCH ACCOUNTS: Make a GET request to http://localhost:3000/api/save-desk/data and extract the calls array. Build a lookup of account names, contact names, and IDs.

2. SEARCH GMAIL: Use gmail_search_messages to search for emails from stelios@getdeardoc.com sent in the last 4 hours. For each sent email:
   - Check if any recipient name or email matches a contact from the accounts list
   - If matched, record: accountId, accountName, contactName, emailId, subject, sentAt, recipientEmail

3. CHECK CALENDAR: Use gcal_list_events to get today's events. For each event:
   - Check if the event title contains any account/practice name from the accounts list
   - Check if any attendee matches a contact from the accounts list
   - If matched, record: eventId, title, startTime, endTime, matchedAccountId, matchedAccountName, attendees

4. POST SYNC: Send all matches to http://localhost:3000/api/sync with:
   {
     "emailMatches": [...matched emails...],
     "calendarEvents": [...matched events...],
     "lastSyncedAt": "<current ISO timestamp>"
   }

5. NOTIFY: Send a Slack message to #stelios-claude-notif with a summary:
   "Sync complete: X email matches, Y calendar matches, Z todos moved to review"

Account matching rules:
- Email recipient exact match to contact name -> high confidence, include
- Calendar event title contains practice/account name -> high confidence, include
- Fuzzy/partial matches -> skip, don't include
```

**Step 4: Verify scheduled tasks are registered**

Use `list_scheduled_tasks` to confirm all 3 are active.

---

### Task 8: Add Sync Status to Dashboard

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add last sync indicator**

Add a small status line below the "Command Center" heading showing:
- "Last synced: 9:00 AM" (or "Never synced" if no sync has run)
- A manual "Sync Now" button that triggers `/api/sync` with empty payload to check status

Fetch sync status from `GET /api/sync` on page load:

```typescript
const [syncStatus, setSyncStatus] = useState<{ lastSyncedAt: string | null; reviewCount: number } | null>(null);

useEffect(() => {
  fetch('/api/sync').then(r => r.json()).then(setSyncStatus).catch(() => {});
}, []);
```

Display next to the heading:
```typescript
{syncStatus && (
  <span style={{ fontSize: 12, color: '#64748b' }}>
    {syncStatus.lastSyncedAt
      ? `Last sync: ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString()}`
      : 'Not synced yet'}
    {syncStatus.reviewCount > 0 && (
      <span style={{ color: '#f59e0b', marginLeft: 8 }}>
        {syncStatus.reviewCount} items to review
      </span>
    )}
  </span>
)}
```

---

### Task 9: TypeScript Check + Full Verification

**Step 1: Run tsc**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npx tsc --noEmit`

Expected: Zero errors

**Step 2: Verify all pages load**

- Dashboard (`/`) -- sync status shows, no console errors
- To-Do (`/todo`) -- Review tab in dropdown, existing todos load correctly, quick-add creates todos with new fields
- Kanban (`/kanban`) -- still works, no regressions
- Actions (`/actions`) -- still works, no regressions

**Step 3: Test sync endpoint manually**

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -d '{"emailMatches":[],"calendarEvents":[],"lastSyncedAt":"2026-03-16T09:00:00Z"}'
```

Expected: `{"ok":true,"synced":0,"details":[],"timestamp":"..."}`

**Step 4: Verify scheduled tasks are running**

Use `list_scheduled_tasks` to confirm all 3 tasks show as active.
