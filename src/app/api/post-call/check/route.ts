import { NextResponse } from 'next/server';
import { getRedis, KEYS } from '@/lib/db';
import { getRecentTranscripts } from '@/lib/api/fireflies';
import type { PostCallData } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET - check for new unprocessed Fireflies transcripts
export async function GET() {
  try {
    const redis = getRedis();
    const postCallData = await redis.get<PostCallData>(KEYS.POST_CALL_DATA);
    const processedIds = postCallData?.processedTranscriptIds || [];

    const recent = await getRecentTranscripts(10);
    const unprocessed = recent.filter(t => !processedIds.includes(t.id));

    return NextResponse.json({
      totalRecent: recent.length,
      unprocessedCount: unprocessed.length,
      unprocessed: unprocessed.map(t => ({
        id: t.id,
        title: t.title,
        date: t.date,
        duration: t.duration,
        participants: t.participants,
      })),
      lastProcessedAt: postCallData?.lastProcessedAt || null,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to check transcripts',
      unprocessedCount: 0,
      unprocessed: [],
    }, { status: 500 });
  }
}
