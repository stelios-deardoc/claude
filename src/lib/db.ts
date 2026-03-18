import { Redis } from '@upstash/redis';

// Singleton Redis client for all API routes
// Env vars auto-provisioned by Vercel Marketplace integration:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

// Redis key constants -- single source of truth for all key names
export const KEYS = {
  SAVEDESK_DATA: 'savedesk:data',
  EMAIL_WORKFLOW: 'email-workflow:data',
  CALENDAR_EVENTS: 'calendar:events',
  POST_CALL_STATE: 'post-call:state',
  ACCOUNT_NOTES: 'account:notes',
  ACTIONS_DATA: 'actions:data',
} as const;
