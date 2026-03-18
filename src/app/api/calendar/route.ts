import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const CALENDAR_DATA_PATH = path.resolve(process.cwd(), 'calendar-data.json');
const POST_CALL_STATE_PATH = path.resolve(process.cwd(), '..', 'post-call-state.json');

export const dynamic = 'force-dynamic';

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  attendees: string[];
  hangoutLink: string;
}

interface PostCallEvent {
  event_title: string;
  decision: string;
  transcript_source: string;
  output_doc_url: string;
  status: string;
}

interface PostCallState {
  processed_events: Record<string, PostCallEvent>;
  last_check_time: string;
}

export async function GET() {
  let calendarEvents: CalendarEvent[] = [];
  let postCallState: PostCallState | null = null;

  try {
    const raw = await readFile(CALENDAR_DATA_PATH, 'utf-8');
    calendarEvents = JSON.parse(raw) as CalendarEvent[];
  } catch {
    // file not found
  }

  try {
    const raw = await readFile(POST_CALL_STATE_PATH, 'utf-8');
    postCallState = JSON.parse(raw) as PostCallState;
  } catch {
    // file not found
  }

  // Build a lookup from event ID to post-call decision
  const decisionMap: Record<string, { decision: string; docUrl: string; transcriptSource: string }> = {};
  if (postCallState) {
    for (const [eventId, evt] of Object.entries(postCallState.processed_events)) {
      decisionMap[eventId] = {
        decision: evt.decision,
        docUrl: evt.output_doc_url || '',
        transcriptSource: evt.transcript_source || 'none',
      };
    }
  }

  return NextResponse.json({ calendarEvents, decisionMap });
}
