import { NextResponse } from 'next/server';
import { getRedis, KEYS } from '@/lib/db';

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
  const redis = getRedis();
  const [calendarEvents, postCallState] = await Promise.all([
    redis.get<CalendarEvent[]>(KEYS.CALENDAR_EVENTS),
    redis.get<PostCallState>(KEYS.POST_CALL_STATE),
  ]);

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

  return NextResponse.json({ calendarEvents: calendarEvents ?? [], decisionMap });
}
