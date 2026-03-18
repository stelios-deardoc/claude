import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const ACTIONS_PATH = path.resolve(process.cwd(), 'actions-data.json');

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

async function readActions(): Promise<ActionsData> {
  const raw = await readFile(ACTIONS_PATH, 'utf-8');
  return JSON.parse(raw) as ActionsData;
}

export async function GET() {
  try {
    const data = await readActions();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Failed to read actions data' },
      { status: 500 },
    );
  }
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

    const data = await readActions();
    const action = data.actions.find((a) => a.id === id);
    if (!action) {
      return NextResponse.json(
        { error: `Action ${id} not found` },
        { status: 404 },
      );
    }

    action.completed = completed;
    await writeFile(ACTIONS_PATH, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({ success: true, action });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update action' },
      { status: 500 },
    );
  }
}
