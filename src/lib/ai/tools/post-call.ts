import { tool } from 'ai';
import { z } from 'zod';
import { getRedis, KEYS } from '@/lib/db';
import type { PostCallData } from '@/lib/types';

export const postCallTools = {
  processPostCall: tool({
    description: 'Trigger post-call processing for a recent call. Fetches the Fireflies transcript, gathers all context (Gmail, Calendar, NPI, Slack, Save Desk), and generates a summary, action items, and email drafts. Use when Stelios says "process my call", "post call notes", or "what happened on the call".',
    inputSchema: z.object({
      transcriptId: z.string().optional().describe('Fireflies transcript ID (if known)'),
      accountName: z.string().optional().describe('Account name to search for in recent transcripts'),
    }),
    execute: async ({ transcriptId, accountName }) => {
      const baseUrl = process.env.NEXT_PUBLIC_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

      const res = await fetch(`${baseUrl}/api/post-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firefliesTranscriptId: transcriptId,
          accountName,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        return { error: result.error || 'Failed to process call', status: res.status };
      }

      // Return a concise summary for the chat
      return {
        status: result.status,
        accountName: result.accountName,
        contactName: result.contactName,
        summary: result.summary?.overview,
        actionItemCount: result.actionItems?.length || 0,
        actionItems: result.actionItems?.map((a: { task: string; priority: string; owner: string }) =>
          `[${a.priority}] ${a.task} (${a.owner})`
        ),
        emailDraftCount: result.emailDrafts?.length || 0,
        emailDrafts: result.emailDrafts?.map((d: { type: string; to: string; subject: string }) =>
          `${d.type}: "${d.subject}" to ${d.to}`
        ),
        riskFlags: result.summary?.riskFlags,
        saveDeskSuggestions: result.saveDeskSuggestions,
        viewAt: '/post-call',
      };
    },
  }),

  getPostCallResults: tool({
    description: 'Get post-call processing results - summaries, action items, email drafts generated from call transcripts. Use when Stelios asks about past call results or wants to review post-call notes.',
    inputSchema: z.object({
      accountName: z.string().optional().describe('Filter by account name'),
      limit: z.number().optional().describe('Number of results to return (default 5)'),
    }),
    execute: async ({ accountName, limit }) => {
      const redis = getRedis();
      const data = await redis.get<PostCallData>(KEYS.POST_CALL_DATA);
      if (!data?.results?.length) return { results: [], total: 0 };

      let results = data.results;
      if (accountName) {
        const q = accountName.toLowerCase();
        results = results.filter(r =>
          r.accountName.toLowerCase().includes(q) ||
          r.contactName.toLowerCase().includes(q)
        );
      }

      const max = limit || 5;
      return {
        total: results.length,
        lastProcessedAt: data.lastProcessedAt,
        results: results.slice(0, max).map(r => ({
          id: r.id,
          accountName: r.accountName,
          contactName: r.contactName,
          status: r.status,
          processedAt: r.processedAt,
          summary: r.summary?.overview,
          sentiment: r.summary?.sentiment,
          actionItemCount: r.actionItems?.length || 0,
          pendingActions: r.actionItems?.filter(a => a.status === 'pending').length || 0,
          emailDraftCount: r.emailDrafts?.length || 0,
          riskFlags: r.summary?.riskFlags,
        })),
      };
    },
  }),

  listRecentTranscripts: tool({
    description: 'List recent Fireflies call transcripts that can be processed. Use when Stelios asks "what calls do I have" or "show my recent transcripts".',
    inputSchema: z.object({
      limit: z.number().optional().describe('Number of transcripts to return (default 5)'),
    }),
    execute: async ({ limit }) => {
      const baseUrl = process.env.NEXT_PUBLIC_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

      const res = await fetch(`${baseUrl}/api/post-call/check`);
      const data = await res.json();

      return {
        unprocessedCount: data.unprocessedCount,
        transcripts: (data.unprocessed || []).slice(0, limit || 5),
        lastProcessedAt: data.lastProcessedAt,
      };
    },
  }),
};
