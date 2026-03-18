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
