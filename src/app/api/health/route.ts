import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
    hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    redisUrlPrefix: process.env.UPSTASH_REDIS_REST_URL?.substring(0, 25) || 'MISSING',
  });
}
