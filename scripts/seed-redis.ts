/**
 * Seed Redis with local JSON data.
 *
 * Usage:
 *   npx tsx scripts/seed-redis.ts
 *
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * in .env.local or environment.
 */

import { Redis } from '@upstash/redis';
import { readFile } from 'fs/promises';
import path from 'path';

const KEYS = {
  SAVEDESK_DATA: 'savedesk:data',
  EMAIL_WORKFLOW: 'email-workflow:data',
  CALENDAR_EVENTS: 'calendar:events',
  POST_CALL_STATE: 'post-call:state',
  ACCOUNT_NOTES: 'account:notes',
  ACTIONS_DATA: 'actions:data',
};

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    console.log(`  [skip] ${filePath} not found or invalid`);
    return null;
  }
}

async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    console.log(`  [skip] ${filePath} not found`);
    return null;
  }
}

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
    console.error('Run: npx vercel env pull .env.local');
    process.exit(1);
  }

  const redis = new Redis({ url, token });
  const root = path.resolve(__dirname, '..');
  const parentDir = path.resolve(root, '..');

  console.log('Seeding Redis from local JSON files...\n');

  // 1. Save desk data
  const savedesk = await readJsonFile(path.join(root, 'data', 'savedesk.json'));
  if (savedesk) {
    await redis.set(KEYS.SAVEDESK_DATA, savedesk);
    console.log(`  [done] ${KEYS.SAVEDESK_DATA} -- save desk data loaded`);
  }

  // 2. Email workflow data
  const emailWorkflow = await readJsonFile(path.join(root, 'data', 'email-workflow.json'));
  if (emailWorkflow) {
    await redis.set(KEYS.EMAIL_WORKFLOW, emailWorkflow);
    console.log(`  [done] ${KEYS.EMAIL_WORKFLOW} -- email workflow data loaded`);
  }

  // 3. Calendar events
  const calendar = await readJsonFile(path.join(root, 'calendar-data.json'));
  if (calendar) {
    await redis.set(KEYS.CALENDAR_EVENTS, calendar);
    console.log(`  [done] ${KEYS.CALENDAR_EVENTS} -- calendar events loaded`);
  }

  // 4. Post-call state
  const postCall = await readJsonFile(path.join(parentDir, 'post-call-state.json'));
  if (postCall) {
    await redis.set(KEYS.POST_CALL_STATE, postCall);
    console.log(`  [done] ${KEYS.POST_CALL_STATE} -- post-call state loaded`);
  }

  // 5. Account notes (text, not JSON)
  const notes = await readTextFile(path.join(parentDir, 'account_notes.md'));
  if (notes) {
    await redis.set(KEYS.ACCOUNT_NOTES, notes);
    console.log(`  [done] ${KEYS.ACCOUNT_NOTES} -- account notes loaded (${(notes.length / 1024).toFixed(1)}KB)`);
  }

  // 6. Actions data
  const actions = await readJsonFile(path.join(root, 'actions-data.json'));
  if (actions) {
    await redis.set(KEYS.ACTIONS_DATA, actions);
    console.log(`  [done] ${KEYS.ACTIONS_DATA} -- actions data loaded`);
  }

  console.log('\nSeed complete!');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
