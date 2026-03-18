import { NextRequest, NextResponse } from 'next/server';
import { getRedis, KEYS } from '@/lib/db';
import type { EmailWorkflowData } from '@/lib/types';

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

export async function GET(request: NextRequest) {
  const data = await readWorkflowData();
  const { searchParams } = request.nextUrl;

  let emails = data.emails;

  const statusFilter = searchParams.get('status');
  if (statusFilter) {
    emails = emails.filter(e => e.status === statusFilter);
  }

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
