import { NextResponse } from 'next/server';
import { getRedis, KEYS } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ActionItem {
  id: string;
  priority: number;
  urgency: string;
  account: string;
  contact: string;
  email: string;
  task: string;
  details: string;
  decision: string;
  mrrAtRisk: string;
  deadline: string;
  category: string;
  docUrl: string;
  completed: boolean;
}

interface ActionsData {
  generated: string;
  actions: ActionItem[];
}

const DEFAULT_ACTIONS: ActionsData = {
  generated: '',
  actions: [],
};

export async function GET() {
  const redis = getRedis();
  const data = await redis.get<ActionsData>(KEYS.ACTIONS_DATA);
  return NextResponse.json(data ?? DEFAULT_ACTIONS);
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, completed } = body as { id: string; completed: boolean };

    if (!id || typeof completed !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing id or completed field' },
        { status: 400 },
      );
    }

    const redis = getRedis();
    const data = await redis.get<ActionsData>(KEYS.ACTIONS_DATA);
    if (!data) {
      return NextResponse.json({ error: 'No actions data found' }, { status: 404 });
    }

    const action = data.actions.find((a) => a.id === id);
    if (!action) {
      return NextResponse.json(
        { error: `Action ${id} not found` },
        { status: 404 },
      );
    }

    action.completed = completed;
    await redis.set(KEYS.ACTIONS_DATA, data);

    return NextResponse.json({ success: true, action });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update action' },
      { status: 500 },
    );
  }
}
