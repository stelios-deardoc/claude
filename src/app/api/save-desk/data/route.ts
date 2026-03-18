import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_PATH = path.resolve(process.cwd(), 'data', 'savedesk.json');

interface SaveDeskData {
  calls: unknown[];
  splits: unknown[];
  todos: unknown[];
  selectedCdpLevel: string;
  clawbackAmount: number;
}

async function ensureDataFile(): Promise<SaveDeskData> {
  try {
    const raw = await readFile(DATA_PATH, 'utf-8');
    return JSON.parse(raw) as SaveDeskData;
  } catch {
    const defaultData: SaveDeskData = {
      calls: [],
      splits: [],
      todos: [],
      selectedCdpLevel: 'am1',
      clawbackAmount: 0,
    };
    await mkdir(path.dirname(DATA_PATH), { recursive: true });
    await writeFile(DATA_PATH, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
}

// GET -- read all data
export async function GET() {
  const data = await ensureDataFile();
  return NextResponse.json(data);
}

// PUT -- full state sync (calls, splits, cdpLevel, clawback)
export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Partial<SaveDeskData>;
  const existing = await ensureDataFile();

  const updated: SaveDeskData = {
    calls: body.calls ?? existing.calls,
    splits: body.splits ?? existing.splits,
    todos: body.todos ?? existing.todos ?? [],
    selectedCdpLevel: body.selectedCdpLevel ?? existing.selectedCdpLevel,
    clawbackAmount: body.clawbackAmount ?? existing.clawbackAmount,
  };

  await writeFile(DATA_PATH, JSON.stringify(updated, null, 2));
  return NextResponse.json({ ok: true, count: updated.calls.length });
}

// POST -- append new calls (for imports without overwriting)
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { calls?: unknown[] };
  if (!body.calls || !Array.isArray(body.calls)) {
    return NextResponse.json({ error: 'calls array required' }, { status: 400 });
  }

  const existing = await ensureDataFile();
  existing.calls = [...existing.calls, ...body.calls];
  await writeFile(DATA_PATH, JSON.stringify(existing, null, 2));
  return NextResponse.json({ ok: true, added: body.calls.length, total: existing.calls.length });
}
