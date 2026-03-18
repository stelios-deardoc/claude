import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const POST_CALL_STATE_PATH = path.resolve(
  process.cwd(),
  '..',
  'post-call-state.json',
);
const ACCOUNT_NOTES_PATH = path.resolve(
  process.cwd(),
  '..',
  'account_notes.md',
);

export const dynamic = 'force-dynamic';

interface ProcessedEvent {
  event_title: string;
  event_end_time: string;
  status: string;
  first_detected: string;
  retry_count: number;
  last_retry: string | null;
  transcript_source: string;
  output_doc_url: string;
  decision: string;
  error_notes: string | null;
}

interface PostCallState {
  processed_events: Record<string, ProcessedEvent>;
  last_check_time: string;
}

export async function GET() {
  let postCallState: PostCallState | null = null;
  let accountNotes: string | null = null;

  try {
    const raw = await readFile(POST_CALL_STATE_PATH, 'utf-8');
    postCallState = JSON.parse(raw) as PostCallState;
  } catch {
    // file not found or parse error -- return null
  }

  try {
    accountNotes = await readFile(ACCOUNT_NOTES_PATH, 'utf-8');
  } catch {
    // file not found -- return null
  }

  return NextResponse.json({ postCallState, accountNotes });
}
