import { NextRequest, NextResponse } from 'next/server';
import { getRedis, KEYS } from '@/lib/db';
import type { PostCallData } from '@/lib/types';

export const dynamic = 'force-dynamic';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// POST - accept or dismiss a post-call action item
export async function POST(req: NextRequest) {
  const { resultId, actionId, action } = await req.json() as {
    resultId: string;
    actionId: string;
    action: 'accept' | 'dismiss';
  };

  const redis = getRedis();
  const postCallData = await redis.get<PostCallData>(KEYS.POST_CALL_DATA);
  if (!postCallData) {
    return NextResponse.json({ error: 'No post-call data' }, { status: 404 });
  }

  const result = postCallData.results.find(r => r.id === resultId);
  if (!result) {
    return NextResponse.json({ error: 'Result not found' }, { status: 404 });
  }

  const actionItem = result.actionItems.find(a => a.id === actionId);
  if (!actionItem) {
    return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
  }

  if (action === 'dismiss') {
    actionItem.status = 'dismissed';
    await redis.set(KEYS.POST_CALL_DATA, postCallData);
    return NextResponse.json({ ok: true, status: 'dismissed' });
  }

  // Accept - push to main actions store
  actionItem.status = 'accepted';

  const actionsData = (await redis.get<{ actions: Record<string, unknown>[]; generated: string }>(KEYS.ACTIONS_DATA)) || {
    actions: [],
    generated: new Date().toISOString(),
  };

  actionsData.actions.push({
    id: generateId(),
    priority: actionItem.priority === 'high' ? 1 : actionItem.priority === 'medium' ? 2 : 3,
    urgency: actionItem.priority,
    account: result.accountName,
    contact: result.contactName,
    email: '',
    task: actionItem.task,
    details: actionItem.details,
    decision: '',
    mrrAtRisk: result.context.matchedCall?.monthlySalesPrice || '',
    deadline: actionItem.deadline,
    category: actionItem.category,
    docUrl: '',
    completed: false,
    postSaveNotes: '',
    source: 'post-call',
    sourceResultId: resultId,
  });

  await redis.set(KEYS.ACTIONS_DATA, actionsData);
  await redis.set(KEYS.POST_CALL_DATA, postCallData);

  return NextResponse.json({ ok: true, status: 'accepted' });
}
