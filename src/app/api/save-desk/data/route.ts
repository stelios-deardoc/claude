import { NextRequest, NextResponse } from 'next/server';
import { getRedis, KEYS } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface SaveDeskData {
  calls: unknown[];
  splits: unknown[];
  todos: unknown[];
  selectedCdpLevel: string;
  clawbackAmount: number;
}

const DEFAULT_DATA: SaveDeskData = {
  calls: [],
  splits: [],
  todos: [],
  selectedCdpLevel: 'am1',
  clawbackAmount: 0,
};

async function readData(): Promise<SaveDeskData> {
  const redis = getRedis();
  const data = await redis.get<SaveDeskData>(KEYS.SAVEDESK_DATA);
  return data ?? DEFAULT_DATA;
}

// GET -- read all data
export async function GET() {
  const data = await readData();
  return NextResponse.json(data);
}

// PUT -- full state sync (calls, splits, cdpLevel, clawback)
export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Partial<SaveDeskData>;
  const existing = await readData();

  const updated: SaveDeskData = {
    calls: body.calls ?? existing.calls,
    splits: body.splits ?? existing.splits,
    todos: body.todos ?? existing.todos ?? [],
    selectedCdpLevel: body.selectedCdpLevel ?? existing.selectedCdpLevel,
    clawbackAmount: body.clawbackAmount ?? existing.clawbackAmount,
  };

  const redis = getRedis();
  await redis.set(KEYS.SAVEDESK_DATA, updated);
  return NextResponse.json({ ok: true, count: updated.calls.length });
}

// POST -- append new calls (for imports without overwriting)
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { calls?: unknown[] };
  if (!body.calls || !Array.isArray(body.calls)) {
    return NextResponse.json({ error: 'calls array required' }, { status: 400 });
  }

  const existing = await readData();
  existing.calls = [...existing.calls, ...body.calls];
  const redis = getRedis();
  await redis.set(KEYS.SAVEDESK_DATA, existing);
  return NextResponse.json({ ok: true, added: body.calls.length, total: existing.calls.length });
}
