import { NextResponse } from 'next/server';
import { getRedis, KEYS } from '@/lib/db';

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
  const redis = getRedis();
  const [postCallState, accountNotes] = await Promise.all([
    redis.get<PostCallState>(KEYS.POST_CALL_STATE),
    redis.get<string>(KEYS.ACCOUNT_NOTES),
  ]);

  return NextResponse.json({
    postCallState: postCallState ?? null,
    accountNotes: accountNotes ?? null,
  });
}
