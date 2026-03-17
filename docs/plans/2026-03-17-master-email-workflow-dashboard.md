# Master Email Workflow + Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full autopilot email processing system with a command center dashboard -- Claude autonomously scans, classifies, researches, and drafts every email; Stelios reviews and approves from a split-view dashboard.

**Architecture:** Two-part system -- (1) Enhanced Claude skill that writes structured JSON output, (2) New `/email` page in the Next.js command center that reads the JSON and provides an interactive review UI with action queuing back to Claude.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, inline SVG icons (no deps), JSON file storage (same pattern as savedesk.json)

---

## Task 1: Email Workflow Types

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add the email workflow type definitions to types.ts**

Add these types at the bottom of the existing `src/lib/types.ts`:

```typescript
// ============================================================
// Master Email Workflow Types
// ============================================================

export type EmailPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type EmailStatus = 'needs_response' | 'draft_ready' | 'sent' | 'archived' | 'snoozed';

export interface MatchedAccount {
  accountName: string;
  accountId: string;
  saveStatus: string;
  mrrAtRisk: number;
  contractEnd: string;
  paymentStanding: string;
}

export interface EmailResearch {
  gmailThreadSummary: string;
  slackMentions: string[];
  recentTranscripts: string[];
  calendarContext: string;
  accountTimeline: string;
  accountIntel: string;
  saveDeskNotes: string;
  researchedAt: string;
}

export interface EmailDraft {
  body: string;
  tone: 'value-first' | 'enforcement' | 'hybrid' | 'internal' | 'brief';
  strategy: string;
  createdAt: string;
}

export interface PendingAction {
  action: 'send' | 'archive' | 'snooze';
  emailId: string;
  gmailDraftId?: string;
  snoozeUntil?: string;
  queuedAt: string;
}

export interface ProcessedEmail {
  id: string;
  threadId: string;
  gmailDraftId: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  priority: EmailPriority;
  priorityReason: string;
  status: EmailStatus;
  statusUpdatedAt: string;
  snoozeUntil?: string;
  matchedAccount?: MatchedAccount;
  research?: EmailResearch;
  draft?: EmailDraft;
}

export interface EmailWorkflowRunStats {
  total: number;
  p0: number;
  p1: number;
  p2: number;
  p3: number;
  drafted: number;
  archived: number;
  researchedAccounts: number;
}

export interface EmailWorkflowData {
  lastRunAt: string;
  lastRunStats: EmailWorkflowRunStats;
  pendingActions: PendingAction[];
  emails: ProcessedEmail[];
}
```

**Step 2: Verify the types compile**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npx tsc --noEmit`
Expected: No errors related to the new types.

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add email workflow types for master email dashboard"
```

---

## Task 2: Seed Data File

**Files:**
- Create: `data/email-workflow.json`

**Step 1: Create the empty seed data file**

Create `data/email-workflow.json` with an empty initial structure:

```json
{
  "lastRunAt": "",
  "lastRunStats": {
    "total": 0,
    "p0": 0,
    "p1": 0,
    "p2": 0,
    "p3": 0,
    "drafted": 0,
    "archived": 0,
    "researchedAccounts": 0
  },
  "pendingActions": [],
  "emails": []
}
```

**Step 2: Commit**

```bash
git add data/email-workflow.json
git commit -m "feat: add empty email workflow data seed file"
```

---

## Task 3: API Route -- GET Email Workflow Data

**Files:**
- Create: `src/app/api/email-workflow/route.ts`

**Step 1: Create the GET API route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { EmailWorkflowData } from '@/lib/types';

const DATA_PATH = path.resolve(process.cwd(), 'data', 'email-workflow.json');

export const dynamic = 'force-dynamic';

async function readWorkflowData(): Promise<EmailWorkflowData> {
  try {
    const raw = await readFile(DATA_PATH, 'utf-8');
    return JSON.parse(raw) as EmailWorkflowData;
  } catch {
    return {
      lastRunAt: '',
      lastRunStats: { total: 0, p0: 0, p1: 0, p2: 0, p3: 0, drafted: 0, archived: 0, researchedAccounts: 0 },
      pendingActions: [],
      emails: [],
    };
  }
}

async function writeWorkflowData(data: EmailWorkflowData): Promise<void> {
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET(request: NextRequest) {
  const data = await readWorkflowData();
  const { searchParams } = request.nextUrl;

  let emails = data.emails;

  // Filter by status
  const statusFilter = searchParams.get('status');
  if (statusFilter) {
    emails = emails.filter(e => e.status === statusFilter);
  }

  // Filter by priority
  const priorityFilter = searchParams.get('priority');
  if (priorityFilter) {
    emails = emails.filter(e => e.priority === priorityFilter);
  }

  // Unsnooze any snoozed emails whose time has passed
  const now = new Date().toISOString();
  let changed = false;
  data.emails.forEach(e => {
    if (e.status === 'snoozed' && e.snoozeUntil && e.snoozeUntil <= now) {
      e.status = e.gmailDraftId ? 'draft_ready' : 'needs_response';
      e.statusUpdatedAt = now;
      delete e.snoozeUntil;
      changed = true;
    }
  });
  if (changed) {
    await writeWorkflowData(data);
  }

  return NextResponse.json({
    lastRunAt: data.lastRunAt,
    lastRunStats: data.lastRunStats,
    pendingActions: data.pendingActions,
    emails,
  });
}
```

**Step 2: Verify it compiles and returns the seed data**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/api/email-workflow/route.ts
git commit -m "feat: add GET API route for email workflow data"
```

---

## Task 4: API Route -- POST Actions (Send, Archive, Snooze)

**Files:**
- Create: `src/app/api/email-workflow/action/route.ts`

**Step 1: Create the POST action route**

This route handles Approve & Send, Archive, and Snooze actions from the dashboard. It immediately updates the JSON status (UI feels instant) and queues the action for Claude to execute.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { EmailWorkflowData, PendingAction, EmailStatus } from '@/lib/types';

const DATA_PATH = path.resolve(process.cwd(), 'data', 'email-workflow.json');

export const dynamic = 'force-dynamic';

async function readWorkflowData(): Promise<EmailWorkflowData> {
  try {
    const raw = await readFile(DATA_PATH, 'utf-8');
    return JSON.parse(raw) as EmailWorkflowData;
  } catch {
    return {
      lastRunAt: '',
      lastRunStats: { total: 0, p0: 0, p1: 0, p2: 0, p3: 0, drafted: 0, archived: 0, researchedAccounts: 0 },
      pendingActions: [],
      emails: [],
    };
  }
}

async function writeWorkflowData(data: EmailWorkflowData): Promise<void> {
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

interface ActionBody {
  action: 'send' | 'archive' | 'snooze';
  emailId?: string;
  emailIds?: string[];
  snoozeUntil?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ActionBody;
  const { action, emailId, emailIds, snoozeUntil } = body;

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  const ids = emailIds || (emailId ? [emailId] : []);
  if (ids.length === 0) {
    return NextResponse.json({ error: 'emailId or emailIds is required' }, { status: 400 });
  }

  const data = await readWorkflowData();
  const now = new Date().toISOString();
  const results: { id: string; newStatus: EmailStatus }[] = [];

  for (const id of ids) {
    const email = data.emails.find(e => e.id === id);
    if (!email) continue;

    let newStatus: EmailStatus;

    switch (action) {
      case 'send':
        newStatus = 'sent';
        data.pendingActions.push({
          action: 'send',
          emailId: id,
          gmailDraftId: email.gmailDraftId,
          queuedAt: now,
        });
        break;
      case 'archive':
        newStatus = 'archived';
        data.pendingActions.push({
          action: 'archive',
          emailId: id,
          queuedAt: now,
        });
        break;
      case 'snooze':
        if (!snoozeUntil) {
          return NextResponse.json({ error: 'snoozeUntil is required for snooze action' }, { status: 400 });
        }
        newStatus = 'snoozed';
        email.snoozeUntil = snoozeUntil;
        data.pendingActions.push({
          action: 'snooze',
          emailId: id,
          snoozeUntil,
          queuedAt: now,
        });
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    email.status = newStatus;
    email.statusUpdatedAt = now;
    results.push({ id, newStatus });
  }

  await writeWorkflowData(data);

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
    pendingActionsCount: data.pendingActions.length,
  });
}
```

**Step 2: Verify compilation**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/api/email-workflow/action/route.ts
git commit -m "feat: add POST action route for send/archive/snooze email actions"
```

---

## Task 5: Email Workflow Utility Functions

**Files:**
- Create: `src/lib/email-utils.ts`

**Step 1: Create email utility helpers**

```typescript
import type { ProcessedEmail, EmailPriority, EmailStatus } from './types';

// Priority display config
export const PRIORITY_CONFIG: Record<EmailPriority, { label: string; color: string; bgColor: string; borderColor: string; sortOrder: number }> = {
  P0: { label: 'Critical', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444', sortOrder: 0 },
  P1: { label: 'Action Needed', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b', sortOrder: 1 },
  P2: { label: 'FYI', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', borderColor: '#3b82f6', sortOrder: 2 },
  P3: { label: 'Noise', color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', borderColor: '#64748b', sortOrder: 3 },
};

// Status display config
export const STATUS_CONFIG: Record<EmailStatus, { label: string; color: string; bgColor: string; icon: string }> = {
  needs_response: { label: 'Needs Response', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', icon: '!' },
  draft_ready: { label: 'Draft Ready', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', icon: '~' },
  sent: { label: 'Sent', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', icon: '+' },
  archived: { label: 'Archived', color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', icon: '-' },
  snoozed: { label: 'Snoozed', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)', icon: 'z' },
};

// Group emails by priority tier
export function groupByPriority(emails: ProcessedEmail[]): Record<EmailPriority, ProcessedEmail[]> {
  const groups: Record<EmailPriority, ProcessedEmail[]> = { P0: [], P1: [], P2: [], P3: [] };
  emails.forEach(e => {
    if (groups[e.priority]) {
      groups[e.priority].push(e);
    }
  });
  return groups;
}

// Get the sender display name from a full email "from" string
export function getSenderName(from: string): string {
  // "Dr. Sarah Koontz <sarah@example.com>" -> "Dr. Sarah Koontz"
  const match = from.match(/^(.+?)\s*<.+>$/);
  if (match) return match[1].trim();
  // "sarah@example.com" -> "sarah"
  const emailMatch = from.match(/^([^@]+)@/);
  if (emailMatch) return emailMatch[1];
  return from;
}

// Get initials from sender name
export function getSenderInitials(from: string): string {
  const name = getSenderName(from);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Format relative time
export function getRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Get count stats from emails
export function getStatusCounts(emails: ProcessedEmail[]): Record<EmailStatus, number> {
  const counts: Record<EmailStatus, number> = {
    needs_response: 0,
    draft_ready: 0,
    sent: 0,
    archived: 0,
    snoozed: 0,
  };
  emails.forEach(e => {
    if (counts[e.status] !== undefined) counts[e.status]++;
  });
  return counts;
}

// Snooze duration options
export function getSnoozeOptions(): { label: string; getTime: () => string }[] {
  return [
    { label: '1 hour', getTime: () => new Date(Date.now() + 3600000).toISOString() },
    { label: '4 hours', getTime: () => new Date(Date.now() + 14400000).toISOString() },
    { label: 'Tomorrow 9am', getTime: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    }},
    { label: 'Next week', getTime: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    }},
  ];
}
```

**Step 2: Verify compilation**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/email-utils.ts
git commit -m "feat: add email workflow utility functions"
```

---

## Task 6: Sidebar Navigation Update

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Step 1: Add the Email nav item to the NAV_ITEMS array**

Add this entry as the FIRST item in the NAV_ITEMS array (top of the sidebar for quick access):

```typescript
{ href: '/email', label: 'Email', icon: 'mail' },
```

**Step 2: Add the mail icon SVG to the NavIcon icons record**

Add to the `icons` object inside `NavIcon`:

```typescript
'mail': <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
```

**Step 3: Verify the app compiles**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add Email nav item to sidebar"
```

---

## Task 7: Email List Component (Left Panel)

**Files:**
- Create: `src/components/EmailList.tsx`

**Step 1: Create the EmailList component**

This is the left panel -- priority-ranked inbox list with color-coded status labels, grouped by priority tier with colored section headers. Clicking a row calls `onSelectEmail(id)`.

```typescript
'use client';

import { useMemo, useState } from 'react';
import type { ProcessedEmail, EmailPriority, EmailStatus } from '@/lib/types';
import {
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  groupByPriority,
  getSenderName,
  getSenderInitials,
  getRelativeTime,
  getStatusCounts,
} from '@/lib/email-utils';

interface EmailListProps {
  emails: ProcessedEmail[];
  selectedId: string | null;
  lastRunAt: string;
  onSelectEmail: (id: string) => void;
  onRefresh: () => void;
}

export default function EmailList({ emails, selectedId, lastRunAt, onSelectEmail, onRefresh }: EmailListProps) {
  const [priorityFilter, setPriorityFilter] = useState<EmailPriority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<EmailStatus | 'active' | 'all'>('active');

  const filteredEmails = useMemo(() => {
    let filtered = emails;
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(e => e.priority === priorityFilter);
    }
    if (statusFilter === 'active') {
      filtered = filtered.filter(e => e.status !== 'archived' && e.status !== 'sent');
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter);
    }
    return filtered;
  }, [emails, priorityFilter, statusFilter]);

  const grouped = useMemo(() => groupByPriority(filteredEmails), [filteredEmails]);
  const statusCounts = useMemo(() => getStatusCounts(emails), [emails]);

  const lastRunLabel = lastRunAt
    ? `Last scanned: ${getRelativeTime(lastRunAt)}`
    : 'Not scanned yet';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f172a' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Inbox</h2>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{lastRunLabel}</span>
          </div>
          <button
            onClick={onRefresh}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '6px 12px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}
          >
            Refresh
          </button>
        </div>

        {/* Status counts bar */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>{statusCounts.needs_response} Need Response</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>|</span>
          <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>{statusCounts.draft_ready} Drafts Ready</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>|</span>
          <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 600 }}>{statusCounts.sent} Sent</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>|</span>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{statusCounts.archived} Archived</span>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {(['all', 'P0', 'P1', 'P2', 'P3'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              style={{
                padding: '3px 10px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                background: priorityFilter === p ? (p === 'all' ? '#6366f1' : PRIORITY_CONFIG[p].bgColor) : '#1e293b',
                color: priorityFilter === p ? (p === 'all' ? '#fff' : PRIORITY_CONFIG[p].color) : '#64748b',
              }}
            >
              {p === 'all' ? 'All' : PRIORITY_CONFIG[p].label}
            </button>
          ))}
          <span style={{ width: '1px', background: '#334155', margin: '0 4px' }} />
          {(['active', 'needs_response', 'draft_ready', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '3px 10px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                background: statusFilter === s ? '#6366f1' : '#1e293b',
                color: statusFilter === s ? '#fff' : '#64748b',
              }}
            >
              {s === 'active' ? 'Active' : s === 'all' ? 'All' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Email list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {(['P0', 'P1', 'P2', 'P3'] as const).map(priority => {
          const group = grouped[priority];
          if (group.length === 0) return null;
          const config = PRIORITY_CONFIG[priority];
          return (
            <div key={priority} style={{ marginBottom: '12px' }}>
              {/* Priority section header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', marginBottom: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: config.color }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: config.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {config.label} ({group.length})
                </span>
              </div>
              {/* Email rows */}
              {group.map(email => {
                const isSelected = email.id === selectedId;
                const statusConf = STATUS_CONFIG[email.status];
                return (
                  <div
                    key={email.id}
                    onClick={() => onSelectEmail(email.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      marginBottom: '2px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? '#1e293b' : 'transparent',
                      borderLeft: `3px solid ${isSelected ? config.borderColor : 'transparent'}`,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#1e293b'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', background: '#334155',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 600, color: '#e2e8f0', flexShrink: 0,
                    }}>
                      {getSenderInitials(email.from)}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {getSenderName(email.from)}
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b', flexShrink: 0, marginLeft: '8px' }}>
                          {getRelativeTime(email.receivedAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>
                        {email.subject}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {/* Status pill */}
                        <span style={{
                          fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '8px',
                          color: statusConf.color, background: statusConf.bgColor, textTransform: 'uppercase',
                        }}>
                          {statusConf.label}
                        </span>
                        {/* Account match tag */}
                        {email.matchedAccount && (
                          <span style={{
                            fontSize: '9px', fontWeight: 600, padding: '1px 6px', borderRadius: '8px',
                            color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.15)',
                          }}>
                            {email.matchedAccount.accountName}
                          </span>
                        )}
                        {/* MRR badge */}
                        {email.matchedAccount && email.matchedAccount.mrrAtRisk > 0 && (
                          <span style={{
                            fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '8px',
                            color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)',
                          }}>
                            ${email.matchedAccount.mrrAtRisk}/mo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {filteredEmails.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: '13px' }}>
            {emails.length === 0 ? 'No emails processed yet. Run "clean my inbox" to start.' : 'No emails match the current filters.'}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify compilation**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/EmailList.tsx
git commit -m "feat: add EmailList component (left panel inbox view)"
```

---

## Task 8: Email Detail Component (Right Panel)

**Files:**
- Create: `src/components/EmailDetail.tsx`

**Step 1: Create the EmailDetail split-view component**

This is the right panel -- shows full email, research context (collapsible accordions), editable draft, and action buttons.

```typescript
'use client';

import { useState } from 'react';
import type { ProcessedEmail } from '@/lib/types';
import { PRIORITY_CONFIG, STATUS_CONFIG, getSenderName, getRelativeTime, getSnoozeOptions } from '@/lib/email-utils';

interface EmailDetailProps {
  email: ProcessedEmail;
  onSend: (id: string) => void;
  onArchive: (id: string) => void;
  onSnooze: (id: string, until: string) => void;
}

function AccordionSection({ title, icon, children, defaultOpen = false }: { title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #334155' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', color: '#e2e8f0',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600 }}>{icon} {title}</span>
        <span style={{ fontSize: '12px', color: '#64748b' }}>{open ? '-' : '+'}</span>
      </button>
      {open && <div style={{ paddingBottom: '12px', fontSize: '13px', color: '#94a3b8', lineHeight: '1.6' }}>{children}</div>}
    </div>
  );
}

export default function EmailDetail({ email, onSend, onArchive, onSnooze }: EmailDetailProps) {
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [draftText, setDraftText] = useState(email.draft?.body || '');

  const priorityConf = PRIORITY_CONFIG[email.priority];
  const statusConf = STATUS_CONFIG[email.status];
  const snoozeOptions = getSnoozeOptions();

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0f172a', borderLeft: '1px solid #334155' }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px' }}>{email.subject}</h3>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              From: <strong style={{ color: '#e2e8f0' }}>{getSenderName(email.from)}</strong>
              <span style={{ color: '#64748b', marginLeft: '8px' }}>{getRelativeTime(email.receivedAt)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', color: priorityConf.color, background: priorityConf.bgColor, textTransform: 'uppercase' }}>
              {email.priority}
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', color: statusConf.color, background: statusConf.bgColor, textTransform: 'uppercase' }}>
              {statusConf.label}
            </span>
          </div>
        </div>
        {email.priorityReason && (
          <div style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '6px', marginTop: '6px' }}>
            {email.priorityReason}
          </div>
        )}
        {/* Account match card */}
        {email.matchedAccount && (
          <div style={{ marginTop: '8px', padding: '8px 12px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#8b5cf6' }}>{email.matchedAccount.accountName}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '8px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)' }}>
                  ${email.matchedAccount.mrrAtRisk}/mo
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '8px', color: '#22c55e', background: 'rgba(34, 197, 94, 0.15)' }}>
                  {email.matchedAccount.saveStatus}
                </span>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Standing: {email.matchedAccount.paymentStanding} | Contract ends: {email.matchedAccount.contractEnd || 'N/A'}
            </div>
          </div>
        )}
      </div>

      {/* Email Body */}
      <div style={{ padding: '16px', borderBottom: '1px solid #334155' }}>
        <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
          {email.snippet}
        </div>
      </div>

      {/* Research Context */}
      {email.research && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, padding: '12px 0 4px' }}>Research Context</div>

          {email.research.accountIntel && (
            <AccordionSection title="Account Intel" icon="*" defaultOpen={true}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{email.research.accountIntel}</div>
            </AccordionSection>
          )}

          {email.research.gmailThreadSummary && (
            <AccordionSection title="Email History" icon="@">
              <div style={{ whiteSpace: 'pre-wrap' }}>{email.research.gmailThreadSummary}</div>
            </AccordionSection>
          )}

          {email.research.slackMentions.length > 0 && (
            <AccordionSection title={`Slack Context (${email.research.slackMentions.length})`} icon="#">
              {email.research.slackMentions.map((mention, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: i < email.research!.slackMentions.length - 1 ? '1px solid #1e293b' : 'none' }}>
                  {mention}
                </div>
              ))}
            </AccordionSection>
          )}

          {email.research.recentTranscripts.length > 0 && (
            <AccordionSection title={`Call Transcripts (${email.research.recentTranscripts.length})`} icon="~">
              {email.research.recentTranscripts.map((t, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: i < email.research!.recentTranscripts.length - 1 ? '1px solid #1e293b' : 'none' }}>
                  {t}
                </div>
              ))}
            </AccordionSection>
          )}

          {email.research.calendarContext && (
            <AccordionSection title="Calendar" icon="+">
              <div style={{ whiteSpace: 'pre-wrap' }}>{email.research.calendarContext}</div>
            </AccordionSection>
          )}

          {email.research.accountTimeline && (
            <AccordionSection title="Full Timeline" icon="=">
              <div style={{ whiteSpace: 'pre-wrap' }}>{email.research.accountTimeline}</div>
            </AccordionSection>
          )}

          {email.research.saveDeskNotes && (
            <AccordionSection title="Save Desk Notes" icon="-">
              <div style={{ whiteSpace: 'pre-wrap' }}>{email.research.saveDeskNotes}</div>
            </AccordionSection>
          )}
        </div>
      )}

      {/* Draft Section */}
      {email.draft && (
        <div style={{ padding: '16px', borderTop: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Draft Response</div>
            <span style={{ fontSize: '10px', color: '#64748b', background: '#1e293b', padding: '2px 8px', borderRadius: '8px' }}>
              Tone: {email.draft.tone}
            </span>
          </div>
          {email.draft.strategy && (
            <div style={{ fontSize: '11px', color: '#6366f1', background: 'rgba(99, 102, 241, 0.1)', padding: '6px 10px', borderRadius: '6px', marginBottom: '8px' }}>
              Strategy: {email.draft.strategy}
            </div>
          )}
          <textarea
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            style={{
              width: '100%', minHeight: '200px', padding: '12px', background: '#1e293b',
              border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0',
              fontSize: '13px', lineHeight: '1.6', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ padding: '16px', borderTop: '1px solid #334155', display: 'flex', gap: '8px', flexWrap: 'wrap', position: 'sticky', bottom: 0, background: '#0f172a' }}>
        {email.status !== 'sent' && email.status !== 'archived' && (
          <>
            {email.gmailDraftId && (
              <button
                onClick={() => onSend(email.id)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#22c55e', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Approve & Send
              </button>
            )}
            <button
              onClick={() => window.open(`https://mail.google.com/mail/u/0/#drafts`, '_blank')}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
            >
              Edit in Gmail
            </button>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#8b5cf6', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
              >
                Snooze
              </button>
              {showSnoozeMenu && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: 0, marginBottom: '4px',
                  background: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
                  padding: '4px', minWidth: '140px', zIndex: 10,
                }}>
                  {snoozeOptions.map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => { onSnooze(email.id, opt.getTime()); setShowSnoozeMenu(false); }}
                      style={{
                        display: 'block', width: '100%', padding: '6px 10px', background: 'none',
                        border: 'none', color: '#e2e8f0', fontSize: '12px', cursor: 'pointer',
                        textAlign: 'left', borderRadius: '4px',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#334155'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => onArchive(email.id)}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#64748b', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
            >
              Archive
            </button>
          </>
        )}
        {email.status === 'sent' && (
          <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 600 }}>Sent</span>
        )}
        {email.status === 'archived' && (
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Archived</span>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify compilation**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/EmailDetail.tsx
git commit -m "feat: add EmailDetail component (right panel split view)"
```

---

## Task 9: Email Page (Main Route)

**Files:**
- Create: `src/app/email/page.tsx`

**Step 1: Create the /email page that combines both panels**

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { ProcessedEmail, EmailWorkflowData } from '@/lib/types';
import EmailList from '@/components/EmailList';
import EmailDetail from '@/components/EmailDetail';

export default function EmailPage() {
  const [data, setData] = useState<EmailWorkflowData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/email-workflow');
      const json = await res.json();
      setData(json);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!data) return;
    const activeEmails = data.emails.filter(e => e.status !== 'archived' && e.status !== 'sent');

    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in textarea/input
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      const currentIndex = activeEmails.findIndex(em => em.id === selectedId);

      switch (e.key.toLowerCase()) {
        case 'j': // next
          if (currentIndex < activeEmails.length - 1) {
            setSelectedId(activeEmails[currentIndex + 1].id);
          } else if (currentIndex === -1 && activeEmails.length > 0) {
            setSelectedId(activeEmails[0].id);
          }
          e.preventDefault();
          break;
        case 'k': // prev
          if (currentIndex > 0) {
            setSelectedId(activeEmails[currentIndex - 1].id);
          }
          e.preventDefault();
          break;
        case 'e': // archive
          if (selectedId) handleArchive(selectedId);
          e.preventDefault();
          break;
        case 'escape':
          setSelectedId(null);
          e.preventDefault();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data, selectedId]);

  const handleAction = async (action: string, emailId: string, extra?: Record<string, string>) => {
    try {
      await fetch('/api/email-workflow/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, emailId, ...extra }),
      });
      await fetchData();
    } catch {
      // silent fail
    }
  };

  const handleSend = (id: string) => handleAction('send', id);
  const handleArchive = (id: string) => handleAction('archive', id);
  const handleSnooze = (id: string, until: string) => handleAction('snooze', id, { snoozeUntil: until });

  const selectedEmail = data?.emails.find(e => e.id === selectedId) || null;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#64748b' }}>
        Loading...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#64748b', gap: '12px' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#e2e8f0' }}>Email Workflow</div>
        <div style={{ fontSize: '13px', textAlign: 'center', maxWidth: '300px' }}>
          Run &quot;clean my inbox&quot; in Claude Code to process your emails and populate this dashboard.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', margin: '-24px', overflow: 'hidden' }}>
      {/* Left Panel - Email List */}
      <div style={{ width: selectedEmail ? '40%' : '100%', minWidth: '320px', transition: 'width 0.2s ease', borderRight: selectedEmail ? '1px solid #334155' : 'none' }}>
        <EmailList
          emails={data.emails}
          selectedId={selectedId}
          lastRunAt={data.lastRunAt}
          onSelectEmail={setSelectedId}
          onRefresh={fetchData}
        />
      </div>

      {/* Right Panel - Email Detail */}
      {selectedEmail && (
        <div style={{ flex: 1, minWidth: '400px' }}>
          <EmailDetail
            email={selectedEmail}
            onSend={handleSend}
            onArchive={handleArchive}
            onSnooze={handleSnooze}
          />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify compilation and dev server**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/email/page.tsx
git commit -m "feat: add /email page with split-view inbox dashboard"
```

---

## Task 10: Enhanced Master Email Workflow Skill

**Files:**
- Modify: `/Users/stelios/Documents/Claude Code/skills/master-email-workflow/SKILL.md`

**Step 1: Add the JSON output phase and enhanced research to the existing skill**

Add a new Phase 3.5 (Deep Research) and Phase 4.5 (Write JSON) to the existing skill. The key additions:

1. **Enhanced Research (Phase 3 upgrade)** -- For P0/P1 emails, add these research steps after the existing ones:
   - Search local transcripts: `find /Users/stelios/Documents/Claude\ Code/transcripts/ -name "*[sender_last_name]*"` and read matching files
   - Read `savedesk.json` and fuzzy-match by account name to populate `matchedAccount`
   - Run account-timeline logic: combine all found data into a chronological timeline string
   - Run account-intel logic: synthesize strategic context from all gathered data
   - Search Google Calendar for recent/upcoming meetings: `gcal_list_events` with timeMin/timeMax

2. **JSON Output (new Phase after Phase 5)** -- After all processing, write the full `email-workflow.json`:
   - Path: `/Users/stelios/Documents/Claude Code/deardoc-command-center/data/email-workflow.json`
   - Map each processed email to the `ProcessedEmail` structure
   - Set `status` based on: has draft -> `draft_ready`, no draft needed -> `archived`, needs manual handling -> `needs_response`
   - Include `gmailDraftId` from the draft creation step
   - Process any `pendingActions` in the queue (send queued drafts, archive queued emails)
   - Clear processed actions from the queue

3. **Action Queue Processing (new Phase after JSON output)** -- Check for pending actions:
   - For `send` actions: `gmail_sendDraft(draftId)` then update status to `sent`
   - For `archive` actions: `gmail_modify(messageId, removeLabelIds=["INBOX", "UNREAD"])` then update status to `archived`
   - Clear processed actions from `pendingActions` array

This is a skill file update, NOT code -- it's the instruction document that Claude follows when the skill is triggered.

**Step 2: Commit**

```bash
git add /Users/stelios/Documents/Claude\ Code/skills/master-email-workflow/SKILL.md
git commit -m "feat: enhance master email workflow skill with deep research and JSON output"
```

---

## Task 11: Register the Skill as Invocable

**Files:**
- Check: Claude Code skill registration (the skill wasn't found when we tried to invoke it)

**Step 1: Verify the skill file is at the correct path**

The skill should be at:
```
/Users/stelios/Documents/Claude Code/skills/master-email-workflow/SKILL.md
```

Check if there's a skills registry or if skills auto-discover from the `skills/` directory. If a registry exists, add the master-email-workflow entry.

**Step 2: Test invocation**

Run "clean my inbox" in Claude Code to verify the skill triggers.

**Step 3: Commit if changes were needed**

---

## Task 12: Sample Data for Testing

**Files:**
- Create: `data/email-workflow-sample.json`

**Step 1: Create sample data to test the UI**

Create a file with 6 sample emails (one per priority + status combo) so the dashboard can be tested visually before the skill populates real data. Include:
- 1 P0 email (needs_response, with matchedAccount and research)
- 1 P0 email (draft_ready, with full draft)
- 1 P1 email (draft_ready, with research and draft)
- 1 P1 email (needs_response)
- 1 P2 email (archived)
- 1 P3 email (archived)

Use realistic DearDoc account names and subjects.

**Step 2: Copy to live data path for testing**

```bash
cp data/email-workflow-sample.json data/email-workflow.json
```

**Step 3: Start dev server and visually verify**

Run: `cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npm run dev`
Navigate to: `http://localhost:3000/email`
Verify: Left panel shows all 6 emails grouped by priority. Clicking one opens the split view.

**Step 4: Commit**

```bash
git add data/email-workflow-sample.json
git commit -m "feat: add sample email data for dashboard testing"
```

---

## Task 13: Final Integration Test

**Step 1: Run the full dev server**

```bash
cd /Users/stelios/Documents/Claude\ Code/deardoc-command-center && npm run dev
```

**Step 2: Verify all routes work**

- `/email` -- loads, shows email list, split view works on click
- `/email` -- filter chips work (P0/P1/P2/P3, Active/All)
- `/email` -- action buttons work (Archive updates status, Snooze shows menu)
- Sidebar -- Email nav item appears at top, links to /email
- API -- `curl http://localhost:3000/api/email-workflow` returns JSON
- API -- `curl -X POST http://localhost:3000/api/email-workflow/action -d '{"action":"archive","emailId":"sample-1"}' -H 'Content-Type: application/json'` updates the data
- Keyboard shortcuts -- J/K navigate, E archives, Escape deselects

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Zero errors.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete master email workflow dashboard - full autopilot inbox system"
```

---

## Summary of All Files

### New Files (8):
1. `data/email-workflow.json` -- seed data
2. `data/email-workflow-sample.json` -- test data
3. `src/lib/email-utils.ts` -- utility functions
4. `src/app/api/email-workflow/route.ts` -- GET API
5. `src/app/api/email-workflow/action/route.ts` -- POST actions API
6. `src/components/EmailList.tsx` -- left panel component
7. `src/components/EmailDetail.tsx` -- right panel component
8. `src/app/email/page.tsx` -- main page

### Modified Files (3):
1. `src/lib/types.ts` -- email workflow type definitions
2. `src/components/Sidebar.tsx` -- add Email nav item
3. `skills/master-email-workflow/SKILL.md` -- enhanced with deep research + JSON output

### Total: 11 files, 13 tasks
