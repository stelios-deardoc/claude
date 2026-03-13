# Call Tracker (CommCalc) Full Port to Next.js Command Center

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the entire CommCalc call tracker (vanilla HTML/JS/CSS) into the Next.js DearDoc Command Center as React components with TypeScript, creating one unified application with sidebar navigation.

**Architecture:** Client-side React app using Context + localStorage for state management. All 6 CommCalc views become pages under the Next.js App Router. Shared business logic lives in TypeScript utility modules. SheetJS (xlsx) handles Salesforce imports.

**Tech Stack:** Next.js 16.1.6, React 19, TypeScript, Tailwind CSS 4, SheetJS (xlsx)

---

### Task 1: Install SheetJS dependency

**Files:**
- Modify: `package.json`

**Step 1: Install xlsx**

```bash
cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center
npm install xlsx
```

**Step 2: Verify installation**

Run: `cat package.json | grep xlsx`
Expected: `"xlsx": "^0.18..."`

**Step 3: Commit**

```bash
git init && git add -A && git commit -m "chore: init repo and add xlsx dependency"
```

---

### Task 2: Create TypeScript types for Call data

**Files:**
- Create: `src/lib/types.ts`

Define all types extracted from CommCalc's state and data structures:

```typescript
export interface Call {
  id: string;
  accountName: string;
  contactName: string;
  saveStatus: string;
  saveType: string;
  monthlySalesPrice: string;
  ratePerMonth: string;
  newContractDuration: string;
  paymentStanding: string;
  billingFrequency: string;
  newBillingFrequency: string;
  meetingDate: string;
  saveDateTime: string;
  importDate: string;
  missedGuaranteeReasons: string;
  notes: string;
  todoNotes: string;
  opportunityName: string;
  ownerName: string;
  cancellationStage: string;
  cancellationSubReason: string;
  saveSubReason: string;
}

export type CallCategory = 'saved' | 'lost' | 'pending' | 'excluded' | 'other';
export type StandingCategory = 'good' | 'bad' | 'unknown';
export type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';
export type ViewName = 'dashboard' | 'calendar' | 'kanban' | 'list' | 'todo' | 'commission';

export interface Split {
  id: string;
  accountId: string;
  type: 'percent' | 'dollar';
  value: number;
}

export interface Suggestion {
  accountId: string;
  accountName: string;
  contactName: string;
  suggestion: string;
  priority: 'low' | 'medium' | 'high';
  priorityScore: number;
  originalNotes: string;
  daysPending: number;
  contractValue: number;
}

export interface CDPTier {
  saveRate: number;
  toGoal: number;
  accelerator: number;
  revenuePercent: number;
}

export type CDPLevelKey = 'jram' | 'am1' | 'am2' | 'am3' | 'sram';

export interface CDPLevel {
  name: string;
  tiers: CDPTier[];
}

export interface ImportData {
  headers: string[];
  rows: string[][];
  mapping: Record<string, number>;
  repName: string;
}

export interface AppState {
  calls: Call[];
  currentView: ViewName;
  filterStatus: string;
  sortBy: SortOption;
  currentMonth: Date;
  calendarInitialized: boolean;
  selectedCdpLevel: CDPLevelKey;
  clawbackAmount: number;
}
```

**Step 4: Commit**

```bash
git add src/lib/types.ts && git commit -m "feat: add TypeScript types for call tracker data"
```

---

### Task 3: Port business logic utilities

**Files:**
- Create: `src/lib/call-utils.ts`
- Create: `src/lib/commission-data.ts`
- Create: `src/lib/import-utils.ts`

Port these pure functions from app.js (lines 1-180 and 1296-1423):

**`src/lib/call-utils.ts`** -- Core business logic:
- `generateId()` -- random ID generator
- `cleanCurrency(val)` -- strip $, commas from currency strings
- `cleanDate(val)` -- normalize date strings
- `parseDate(dateStr)` -- parse various date formats including Excel serial dates, return YYYY-MM-DD
- `categorizeStatus(saveStatus, saveType)` -- returns CallCategory
- `getContractValue(call)` -- monthly rate x duration multiplier (12 or 24)
- `hasGuaranteeIssue(call)` -- checks missedGuaranteeReasons
- `isLegalCase(call)` -- checks notes/reasons for legal keywords
- `isFullyExcludedFromCommission(call)` -- guarantee or legal
- `isBadStandingOnly(call)` -- bad standing but not excluded
- `getStandingCategory(standing)` -- returns StandingCategory
- `calculateCountableLost(lostCalls)` -- weighted loss calc (0, 0.5, 1 points)
- `getInitials(name)` -- extract initials for avatar
- `generateSuggestion(call, daysPending)` -- AI-like next step suggestion

**`src/lib/commission-data.ts`** -- CDP tier tables:
- Export `CDP_LEVELS` constant with all 5 levels (jram, am1, am2, am3, sram)
- Each level has 20 tiers from 0% to 110% save rate

**`src/lib/import-utils.ts`** -- Salesforce CSV/XLSX import:
- `SF_COLUMN_MAP` constant -- Salesforce column name to internal field mapping
- `normalizeHeader(header)` -- normalize for matching
- `autoMapColumns(headers)` -- auto-detect column mapping
- `extractRepName(filename)` -- parse rep name from filename
- `parseCSVLine(line)` -- CSV line parser handling quoted fields
- `processImportRow(row, headers, mapping)` -- convert a raw row to a Call object

**Step 5: Commit**

```bash
git add src/lib/ && git commit -m "feat: port business logic to TypeScript utilities"
```

---

### Task 4: Create React Context for app state

**Files:**
- Create: `src/lib/store.tsx`

React Context provider wrapping the app state with localStorage persistence:

```typescript
// Key exports:
// - CallTrackerProvider: wraps children with context
// - useCallTracker(): hook returning state + actions
//
// Actions:
// - addCall(call)
// - updateCall(id, updates)
// - deleteCall(id)
// - importCalls(calls) -- merge imported data
// - setView(view)
// - setFilter(status)
// - setSort(sortBy)
// - setCdpLevel(level)
// - setClawbackAmount(amount)
//
// Persistence: save to localStorage key 'savedesk_data' on every state change
// Load from localStorage on mount
```

**Step 6: Commit**

```bash
git add src/lib/store.tsx && git commit -m "feat: add React Context store with localStorage persistence"
```

---

### Task 5: Create shared layout with sidebar navigation

**Files:**
- Modify: `src/app/layout.tsx` -- add the CallTrackerProvider
- Create: `src/components/Sidebar.tsx` -- navigation sidebar
- Create: `src/components/AppShell.tsx` -- layout wrapper (sidebar + content area)
- Modify: `src/app/globals.css` -- add sidebar styles, CSS variables for dark theme

The sidebar matches CommCalc's design:
- Fixed 240px left sidebar, dark background
- Logo/title at top: "DearDoc Command Center"
- Nav items with icons: Dashboard, Calendar, Kanban, List, To-Do, Commission
- Import button at bottom
- Active state highlight on current page

Navigation uses Next.js App Router links:
- `/` -- Dashboard (existing page becomes the call tracker dashboard, replacing mock data)
- `/calendar` -- Calendar view
- `/kanban` -- Kanban view
- `/list` -- List view
- `/todo` -- To-Do view
- `/commission` -- Commission view

**Step 7: Commit**

```bash
git add src/ && git commit -m "feat: add sidebar navigation and app shell layout"
```

---

### Task 6: Port Dashboard view

**Files:**
- Rewrite: `src/app/page.tsx` -- replace mock dashboard with real call tracker dashboard

Port from CommCalc's `renderDashboard()` (app.js lines 480-706):
- Stats grid: Total Accounts, Saved, Lost, Pending, Save Rate (raw + commissionable), MRR Saved, MRR at Risk
- Save metrics chart section (bar/visual showing saved vs lost vs pending)
- Biggest deals section (top 5 by contract value)
- Recent saves section (last 5 by date)
- All metrics calculated from real call data via useCallTracker() hook

**Step 8: Commit**

```bash
git add src/app/page.tsx && git commit -m "feat: port dashboard view with real metrics"
```

---

### Task 7: Port Calendar view

**Files:**
- Create: `src/app/calendar/page.tsx`

Port from `renderCalendar()` (app.js lines 757-839):
- Month/year header with prev/next navigation and "Today" button
- 7-column weekday grid
- 6-week calendar showing calls on their dates (by save date or meeting date)
- Color-coded by status category (saved=green, lost=red, pending=yellow)
- Click day to add new record, click call chip to open detail modal
- Auto-jump to month with most recent data on first render

**Step 9: Commit**

```bash
git add src/app/calendar/ && git commit -m "feat: port calendar view"
```

---

### Task 8: Port Kanban view

**Files:**
- Create: `src/app/kanban/page.tsx`

Port from `renderKanban()` (app.js lines 841-926):
- 5 columns: Saved, Lost, Pending, Guarantee Issues, Bad Standing
- Each column shows count badge
- Kanban cards with account name, save type, monthly rate, standing badge, notes preview
- Click card to open detail modal
- Empty state per column

**Step 10: Commit**

```bash
git add src/app/kanban/ && git commit -m "feat: port kanban view"
```

---

### Task 9: Port List view

**Files:**
- Create: `src/app/list/page.tsx`

Port from `renderListView()` (app.js lines 928-1025):
- Filter dropdown: All Statuses, Saved, Lost, Pending, Guarantee Issues, Good Standing, Bad Standing
- Sort dropdown: Date (newest), Date (oldest), Name (A-Z), Name (Z-A)
- Table with columns: Account (avatar + name + contact), Save Type, Status, Billing, Standing, Actions
- Status badges color-coded
- Guarantee warning icon
- Click row to open detail modal

**Step 11: Commit**

```bash
git add src/app/list/ && git commit -m "feat: port list view"
```

---

### Task 10: Port To-Do view

**Files:**
- Create: `src/app/todo/page.tsx`

Port from `renderTodoView()` and `generateSuggestion()` (app.js lines 1027-1293):
- Shows only pending accounts, sorted by priority score
- Each item shows: account name, contact, monthly rate, save type, days pending, status badge
- Urgency coloring: normal (<7 days), warning (7-13 days), urgent (14+ days)
- AI suggestion banners with priority badges (high/medium/low)
- Inline notes section (toggle open/close, save notes)
- View size selector (compact/normal/expanded)
- Badges for Bad Standing, Guarantee, Legal cases
- "Won't count against you if lost" note for excluded accounts

**Step 12: Commit**

```bash
git add src/app/todo/ && git commit -m "feat: port todo view with AI suggestions"
```

---

### Task 11: Port Commission view

**Files:**
- Create: `src/app/commission/page.tsx`

Port from `renderCommissionView()` (app.js lines 1295-2048):
- CDP Level selector dropdown (Jr. AM, AM1, AM2, AM3, Sr. AM)
- Commission summary card: commission amount (before/after adjustments), save rate, % to goal, accelerator, % of revenue
- Revenue breakdown: total revenue, adjustments, adjusted revenue, counts (saved/lost/pending)
- Commission formula display (step-by-step calculation)
- Splits & Clawbacks section:
  - Add split button -- select account, type (% or $), value (25%/50%/75% or dollar amount)
  - Clawback amount input
  - Total deductions summary
- Tiers table: all 20 tiers showing save rate, % to goal, accelerator, % of revenue, commission amount
  - Highlight current tier, mark below-goal tiers, star the 40% quota line
- Worst case scenario: what happens if all pendings are lost
- What-If calculator: input any save rate + revenue, see estimated commission

**Step 13: Commit**

```bash
git add src/app/commission/ && git commit -m "feat: port commission view with splits, tiers, and what-if calc"
```

---

### Task 12: Create Call Detail Modal component

**Files:**
- Create: `src/components/CallModal.tsx`

Port from `openCallModal()`, `renderViewMode()`, `populateEditForm()`, `saveCall()`, `deleteCall()` (app.js lines 2126-2359):
- View mode: account header (avatar, name, contact, status badge), tags (save type, standing, guarantee), metrics (monthly rate, contract value, billing), meeting date, details grid, notes section
- Edit mode: form with all fields (account name, contact, save status dropdown, save type, monthly price, contract duration, payment standing, billing frequency, meeting date, guarantee reasons, notes)
- Toggle between view/edit modes
- Save and delete actions
- Rendered as a modal overlay, managed via context or local state

**Step 14: Commit**

```bash
git add src/components/CallModal.tsx && git commit -m "feat: add call detail modal with view and edit modes"
```

---

### Task 13: Create Import Modal component

**Files:**
- Create: `src/components/ImportModal.tsx`

Port from import functions (app.js lines 2361-2598+):
- Drag-and-drop file zone for CSV/XLSX
- File type detection (Excel vs CSV)
- Excel parsing via SheetJS: smart header row detection, data cleaning
- CSV parsing with quoted field support
- Column mapping UI: auto-mapped fields from SF_COLUMN_MAP, manual override dropdowns
- Preview of first few rows
- Import button that processes rows into Call objects and merges into state
- Rep name extraction from filename

**Step 15: Commit**

```bash
git add src/components/ImportModal.tsx && git commit -m "feat: add import modal with CSV/XLSX support and column mapping"
```

---

### Task 14: Wire everything together and test

**Files:**
- Verify all pages render correctly
- Verify navigation works between all 6 views
- Verify import flow works end-to-end
- Verify localStorage persistence (reload keeps data)
- Verify commission calculations match CommCalc exactly

**Step 16: Run dev server and verify**

```bash
cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center
npm run dev
```

Open localhost:3000 and verify:
- Sidebar navigation works
- All 6 pages render without errors
- Import modal opens and processes a test file
- Commission calculations are correct
- Data persists across page reloads

**Step 17: Final commit**

```bash
git add -A && git commit -m "feat: complete call tracker port - all views functional"
```

---

## Execution Notes

**State Management:** Single React Context wrapping the entire app. All views read from the same call data. localStorage key `savedesk_data` for calls, `savedesk_splits` for commission splits, `todoViewSize` for todo preference.

**Styling:** Use Tailwind CSS utility classes for layout. Port CommCalc's CSS variables for the dark theme into globals.css. Keep the same visual design -- dark cards, colored status badges, accent colors.

**Commission Formula (sacred):**
- Commissionable Save Rate = Saved / (Saved + Countable Lost)
- Countable Lost: Regular = 1.0, Bad Standing = 0.5, Guarantee/Legal = 0 (excluded)
- Tier = round save rate DOWN to nearest 5%
- Commission = Adjusted Revenue x Revenue% from tier table
- Adjusted Revenue = Total Revenue - Splits - Clawbacks
