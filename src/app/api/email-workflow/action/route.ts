import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { EmailWorkflowData, EmailStatus } from '@/lib/types';

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
