import { NextRequest, NextResponse } from 'next/server';
import { getRedis, KEYS } from '@/lib/db';
import type { EmailWorkflowData, EmailStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DEFAULT_WORKFLOW: EmailWorkflowData = {
  lastRunAt: '',
  lastRunStats: { total: 0, p0: 0, p1: 0, p2: 0, p3: 0, drafted: 0, archived: 0, researchedAccounts: 0 },
  pendingActions: [],
  emails: [],
};

async function readWorkflowData(): Promise<EmailWorkflowData> {
  const redis = getRedis();
  const data = await redis.get<EmailWorkflowData>(KEYS.EMAIL_WORKFLOW);
  return data ?? DEFAULT_WORKFLOW;
}

async function writeWorkflowData(data: EmailWorkflowData): Promise<void> {
  const redis = getRedis();
  await redis.set(KEYS.EMAIL_WORKFLOW, data);
}

interface ActionBody {
  action: 'send' | 'archive' | 'snooze' | 'save_draft';
  emailId?: string;
  emailIds?: string[];
  snoozeUntil?: string;
  draftBody?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ActionBody;
  const { action, emailId, emailIds, snoozeUntil, draftBody } = body;

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
      case 'save_draft':
        if (!email.draft) {
          email.draft = { body: '', tone: 'value-first', strategy: '', createdAt: now };
        }
        email.draft.body = draftBody ?? email.draft.body;
        results.push({ id, newStatus: email.status });
        continue;
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
