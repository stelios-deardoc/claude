# Command Center 6-Month Data Enhancement

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every page month-aware and data-rich now that 238 calls across 6 months (Oct 2025 - Mar 2026) are loaded.

**Architecture:** Add a shared `getCallMonth()` utility and month-filtering helpers to `call-utils.ts`. Enhance the Dashboard with a month selector, trend sparklines, MoM deltas, and a 6-month bar chart. Rewrite the Activity page to use real call data grouped by month. Add month filters to Kanban and List pages.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind (inline styles), SVG charts (no external libs)

**Design:** Dark theme - bg #0f172a, cards #1e293b, borders #334155, text #e2e8f0, green #22c55e, red #ef4444, amber #f59e0b, blue #3b82f6, indigo #6366f1

---

## Task 1: Shared Month Utilities

**Files:**
- Modify: `src/lib/call-utils.ts`

**What:** Add month extraction, filtering, and labeling helpers that all pages can reuse.

**Step 1: Add utilities to call-utils.ts**

Add these exports at the end of the file:

```typescript
// Month helpers for 6-month data views
export function getCallMonth(c: Call): string {
  const raw = c.saveDateTime || c.importDate || c.meetingDate || '';
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

export function getLast6Months(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getMRR(c: Call): number {
  return parseFloat(c.monthlySalesPrice) || 0;
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/lib/call-utils.ts
git commit -m "feat: add shared month utilities to call-utils"
```

---

## Task 2: Dashboard - Month Selector + Filtered Stats

**Files:**
- Modify: `src/app/page.tsx`

**What:** Add a month selector pill bar (All Time | Oct | Nov | Dec | Jan | Feb | Mar*) to the dashboard header. All stat cards, donut, urgency bar, biggest deals, and recent activity filter to selected month. Default to current month.

**Step 1: Add imports and state**

Add to imports from call-utils:
```typescript
import {
  // ... existing imports ...
  getCallMonth,
  getMonthLabel,
  getLast6Months,
  getCurrentMonth,
  getMRR,
} from '@/lib/call-utils';
```

Add state after existing state:
```typescript
const [selectedMonth, setSelectedMonth] = useState<string>('all');
const months = useMemo(() => getLast6Months(), []);
const currentMonth = useMemo(() => getCurrentMonth(), []);
```

**Step 2: Filter calls by selected month**

Add before the metrics useMemo:
```typescript
const filteredCalls = useMemo(() => {
  if (selectedMonth === 'all') return calls;
  return calls.filter(c => getCallMonth(c) === selectedMonth);
}, [calls, selectedMonth]);
```

Change `metrics` useMemo to use `filteredCalls` instead of `calls` everywhere inside it. Update deps array to include `filteredCalls` instead of `calls`.

**Step 3: Add month selector UI**

After the header `<div>` (after sync status), add:
```tsx
{/* Month Selector */}
<div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
  <button
    onClick={() => setSelectedMonth('all')}
    style={{
      padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      border: selectedMonth === 'all' ? '1px solid #3b82f6' : '1px solid #334155',
      background: selectedMonth === 'all' ? 'rgba(59,130,246,0.15)' : 'transparent',
      color: selectedMonth === 'all' ? '#3b82f6' : '#64748b',
      cursor: 'pointer',
    }}
  >
    All Time
  </button>
  {months.map(m => (
    <button
      key={m}
      onClick={() => setSelectedMonth(m)}
      style={{
        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
        border: selectedMonth === m ? '1px solid #3b82f6' : '1px solid #334155',
        background: selectedMonth === m ? 'rgba(59,130,246,0.15)' : 'transparent',
        color: selectedMonth === m ? '#3b82f6' : '#64748b',
        cursor: 'pointer',
      }}
    >
      {getMonthLabel(m)}{m === currentMonth ? ' *' : ''}
    </button>
  ))}
</div>
```

**Step 4: Update header subtitle**

Change the subtitle to show count for filtered view:
```tsx
<p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
  {filteredCalls.length} accounts{selectedMonth !== 'all' ? ` in ${getMonthLabel(selectedMonth)}` : ' loaded'}
</p>
```

**Step 5: Verify in browser**

Open `/` -- month pills should render, clicking filters stats.

**Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add month selector to dashboard with filtered stats"
```

---

## Task 3: Dashboard - 6-Month Trend Chart

**Files:**
- Modify: `src/app/page.tsx`

**What:** Add a new card between Row 1 and Row 2 showing a 6-month bar chart with save rate trend line. Each month shows stacked saved/lost bars. Trend line overlays save rate %.

**Step 1: Compute monthly data**

Add after `filteredCalls` useMemo:
```typescript
const monthlyData = useMemo(() => {
  return months.map(mKey => {
    const mCalls = calls.filter(c => getCallMonth(c) === mKey);
    const saved = mCalls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'saved');
    const lost = mCalls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'lost');
    const pending = mCalls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'pending');
    const savedMRR = saved.reduce((s, c) => s + getMRR(c), 0);
    const lostMRR = lost.reduce((s, c) => s + getMRR(c), 0);
    const totalMRR = savedMRR + lostMRR;
    const rate = totalMRR > 0 ? (savedMRR / totalMRR) * 100 : 0;
    return {
      key: mKey,
      label: getMonthLabel(mKey),
      shortLabel: new Date(parseInt(mKey.split('-')[0]), parseInt(mKey.split('-')[1]) - 1).toLocaleString('en-US', { month: 'short' }),
      savedCount: saved.length,
      lostCount: lost.length,
      pendingCount: pending.length,
      savedMRR,
      lostMRR,
      rate,
      isCurrent: mKey === currentMonth,
    };
  });
}, [calls, months, currentMonth]);
```

**Step 2: Add SVG bar chart card**

Insert a new row after Row 1 (after the grid with donut/revenue/commission):

```tsx
{/* Row 1.5: 6-Month Trend */}
<div style={{ ...cardStyle, marginBottom: 20 }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
    <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
      6-Month Performance Trend
    </div>
    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#64748b' }}>
      <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#22c55e', marginRight: 4 }} />Saved</span>
      <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#ef4444', marginRight: 4 }} />Lost</span>
      <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#f59e0b', marginRight: 4 }} />Pending</span>
      <span><span style={{ display: 'inline-block', width: 2, height: 10, background: '#6366f1', marginRight: 4 }} />MRR Save Rate</span>
    </div>
  </div>

  {(() => {
    const chartW = 800;
    const chartH = 200;
    const barAreaW = chartW - 60;
    const barW = barAreaW / 6;
    const padding = 12;
    const maxCount = Math.max(...monthlyData.map(m => m.savedCount + m.lostCount + m.pendingCount), 1);

    // Trend line points
    const trendPoints = monthlyData.map((m, i) => {
      const x = 60 + i * barW + barW / 2;
      const y = chartH - 30 - (m.rate / 100) * (chartH - 50);
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${chartW} ${chartH + 40}`} style={{ width: '100%', height: 'auto' }}>
        {/* Y-axis labels */}
        {[0, 25, 50, 75, 100].map(pct => {
          const y = chartH - 30 - (pct / 100) * (chartH - 50);
          return (
            <g key={pct}>
              <line x1="55" x2={chartW} y1={y} y2={y} stroke="#1e293b" strokeWidth="1" />
              <text x="50" y={y + 4} textAnchor="end" fill="#475569" fontSize="10">{pct}%</text>
            </g>
          );
        })}

        {/* Bars */}
        {monthlyData.map((m, i) => {
          const x = 60 + i * barW + padding / 2;
          const w = barW - padding;
          const total = m.savedCount + m.lostCount + m.pendingCount;
          const scale = (chartH - 50) / maxCount;

          const savedH = m.savedCount * scale;
          const lostH = m.lostCount * scale;
          const pendingH = m.pendingCount * scale;
          const baseY = chartH - 30;

          return (
            <g key={m.key}>
              {/* Saved bar */}
              <rect x={x} y={baseY - savedH} width={w} height={savedH} rx="3" fill="#22c55e" opacity={m.isCurrent ? 1 : 0.7} />
              {/* Lost bar stacked above */}
              <rect x={x} y={baseY - savedH - lostH} width={w} height={lostH} rx="3" fill="#ef4444" opacity={m.isCurrent ? 1 : 0.7} />
              {/* Pending bar stacked above */}
              <rect x={x} y={baseY - savedH - lostH - pendingH} width={w} height={pendingH} rx="3" fill="#f59e0b" opacity={m.isCurrent ? 1 : 0.7} />

              {/* Month label */}
              <text x={x + w / 2} y={chartH - 10} textAnchor="middle" fill={m.isCurrent ? '#e2e8f0' : '#64748b'} fontSize="11" fontWeight={m.isCurrent ? '700' : '400'}>
                {m.shortLabel}
              </text>

              {/* Count label */}
              <text x={x + w / 2} y={chartH + 6} textAnchor="middle" fill="#475569" fontSize="9">
                {total} accts
              </text>

              {/* Rate label above bar */}
              {m.rate > 0 && (
                <text x={x + w / 2} y={baseY - savedH - lostH - pendingH - 6} textAnchor="middle" fill="#a5b4fc" fontSize="10" fontWeight="600">
                  {m.rate.toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}

        {/* Trend line */}
        <polyline points={trendPoints} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Trend dots */}
        {monthlyData.map((m, i) => {
          const x = 60 + i * barW + barW / 2;
          const y = chartH - 30 - (m.rate / 100) * (chartH - 50);
          return <circle key={m.key} cx={x} cy={y} r="4" fill="#6366f1" stroke="#0f172a" strokeWidth="2" />;
        })}

        {/* Current month highlight */}
        <text x={chartW / 2} y={chartH + 30} textAnchor="middle" fill="#475569" fontSize="10">
          MRR Save Rate trend (indigo line) -- Account counts (bars)
        </text>
      </svg>
    );
  })()}
</div>
```

**Step 3: Add MoM delta badges to stat cards**

In the Revenue Impact card, after the Net Impact stat, compute and show month-over-month delta:

Inside the `metrics` useMemo, add:
```typescript
// Month-over-month comparison
const prevMonth = months.length >= 2 ? months[months.length - 2] : '';
const prevMonthCalls = calls.filter(c => getCallMonth(c) === prevMonth);
const prevSaved = prevMonthCalls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'saved');
const prevLost = prevMonthCalls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'lost');
const prevSavedMRR = prevSaved.reduce((s, c) => s + getMRR(c), 0);
const prevLostMRR = prevLost.reduce((s, c) => s + getMRR(c), 0);
const prevTotalMRR = prevSavedMRR + prevLostMRR;
const prevRate = prevTotalMRR > 0 ? (prevSavedMRR / prevTotalMRR) * 100 : 0;

const curMonthCalls = calls.filter(c => getCallMonth(c) === currentMonth);
const curSaved = curMonthCalls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'saved');
const curLost = curMonthCalls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'lost');
const curSavedMRR = curSaved.reduce((s, c) => s + getMRR(c), 0);
const curLostMRR = curLost.reduce((s, c) => s + getMRR(c), 0);
const curTotalMRR = curSavedMRR + curLostMRR;
const curRate = curTotalMRR > 0 ? (curSavedMRR / curTotalMRR) * 100 : 0;
const momDelta = curRate - prevRate;
```

Return `momDelta, prevRate, curRate` from the metrics useMemo.

Add a MoM indicator badge below the save rate donut center text:
```tsx
<div style={{ fontSize: 11, color: metrics.momDelta >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600, marginTop: 2 }}>
  {metrics.momDelta >= 0 ? '+' : ''}{metrics.momDelta.toFixed(1)}% vs last month
</div>
```

**Step 4: Verify in browser**

Check that chart renders, bars are proportional, trend line connects dots.

**Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add 6-month trend chart and MoM deltas to dashboard"
```

---

## Task 4: Activity Page - Real Call Data

**Files:**
- Modify: `src/app/activity/page.tsx`

**What:** Replace the actions-API-based activity feed with a feed driven by the actual 238 calls from the store. Group by month with expandable sections. Show save/loss events with MRR values, timeline with date markers.

**Step 1: Rewrite the component**

Replace the entire file with a new implementation that:
- Imports `useCallTracker` from store and call-utils helpers
- Uses `calls` from store instead of fetching `/api/actions`
- Converts each Call to an ActivityEvent using its saveStatus, saveType, saveDateTime
- Groups by month (using `getCallMonth`)
- Shows monthly summary cards at top (like the MRR table on commission page)
- Timeline view with month headers, each showing saved/lost/pending counts
- Each event card shows: account name, status badge, MRR value, save type, date
- Click to expand shows full details (notes, payment standing, cancellation stage)
- Filter tabs: All | Saved | Lost | Pending
- Month filter: same pill bar as dashboard

Key structure:
```
Header + stats bar
Month filter pills
Filter tabs (All/Saved/Lost/Pending)
For each month:
  Month header with summary (e.g. "Nov 2025 -- 38 saved, 25 lost | MRR: $23,866 saved")
  Timeline of events sorted by date
    Event cards with status color left-border
```

**Step 2: Verify in browser**

Check activity page loads, shows real data grouped by month.

**Step 3: Commit**

```bash
git add src/app/activity/page.tsx
git commit -m "feat: rewrite activity page with real call data and monthly grouping"
```

---

## Task 5: Kanban - Month Filter

**Files:**
- Modify: `src/app/kanban/page.tsx`

**What:** Add the same month selector pill bar to the Kanban page header. Filter calls by selected month. Show MRR totals per column for the selected month.

**Step 1: Add month filter**

Import month utilities. Add `selectedMonth` state and `filteredCalls` memo. Add month pills to header. Use `filteredCalls` instead of `calls` in the columns useMemo.

**Step 2: Verify in browser**

Kanban columns should filter when selecting a month.

**Step 3: Commit**

```bash
git add src/app/kanban/page.tsx
git commit -m "feat: add month filter to kanban board"
```

---

## Task 6: List Page - Month Filter

**Files:**
- Modify: `src/app/list/page.tsx`

**What:** Same month selector pill bar. Filter the list view by month.

**Step 1: Add month filter**

Import month utilities. Add `selectedMonth` state and `filteredCalls` memo. Add month pills to header. Update the calls mapping to use `filteredCalls`.

**Step 2: Verify in browser**

List should filter by month selection.

**Step 3: Commit**

```bash
git add src/app/list/page.tsx
git commit -m "feat: add month filter to list page"
```

---

## Task 7: Dashboard - Sparklines in Stat Cards

**Files:**
- Modify: `src/app/page.tsx`

**What:** Add tiny inline SVG sparklines (30px tall) to the Revenue Impact stat cards showing 6-month trend for saved MRR, lost MRR, and net impact.

**Step 1: Create sparkline helper**

Add inside the Dashboard component:
```typescript
function Sparkline({ data, color, width = 80, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2 || data.every(d => d === 0)) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block', marginTop: 6 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
```

**Step 2: Add sparklines to stat cards**

In the Revenue Impact card, add sparklines under each value:
```tsx
<Sparkline data={monthlyData.map(m => m.savedMRR)} color="#22c55e" />
<Sparkline data={monthlyData.map(m => m.lostMRR)} color="#ef4444" />
```

**Step 3: Verify in browser**

Small trend lines should appear under each MRR number.

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add sparklines to dashboard revenue cards"
```

---

## Task 8: Final Polish + Type Check

**Files:**
- All modified files

**What:** Run full type check, fix any issues, verify all 9 pages load without console errors.

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 2: Verify all pages in browser**

Navigate to each route:
- `/` (dashboard)
- `/activity`
- `/kanban`
- `/list`
- `/commission`
- `/calendar`
- `/todo`
- `/notes`
- `/actions`

Check console for zero errors on each page.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final polish and type fixes for command center enhancement"
```
