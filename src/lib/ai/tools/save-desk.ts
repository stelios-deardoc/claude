import { tool } from 'ai';
import { z } from 'zod';
import { getRedis, KEYS } from '@/lib/db';

export const saveDeskTools = {
  getSaveDeskData: tool({
    description: 'Get save desk call data - all calls, splits, todos, and commission config. Use this to look up accounts, check save statuses, calculate commissions, or answer questions about the save desk pipeline.',
    inputSchema: z.object({
      query: z.string().optional().describe('Optional: search for a specific account name or contact name'),
    }),
    execute: async ({ query }) => {
      const redis = getRedis();
      const data = await redis.get<Record<string, unknown>>(KEYS.SAVEDESK_DATA);
      if (!data) return { calls: [], splits: [], todos: [], totalCalls: 0 };

      const calls = (data.calls || []) as Record<string, unknown>[];

      if (query) {
        const q = query.toLowerCase();
        const filtered = calls.filter((c) => {
          const name = String(c.accountName || '').toLowerCase();
          const contact = String(c.contactName || '').toLowerCase();
          return name.includes(q) || contact.includes(q);
        });
        return {
          matchedCalls: filtered.slice(0, 20),
          totalMatches: filtered.length,
          selectedCdpLevel: data.selectedCdpLevel,
        };
      }

      const saved = calls.filter((c) => String(c.saveStatus).toLowerCase().includes('won') || String(c.saveStatus).toLowerCase().includes('ride'));
      const lost = calls.filter((c) => String(c.saveStatus).toLowerCase().includes('lost'));
      const pending = calls.filter((c) => String(c.saveStatus).toLowerCase().includes('pending'));

      return {
        totalCalls: calls.length,
        saved: saved.length,
        lost: lost.length,
        pending: pending.length,
        selectedCdpLevel: data.selectedCdpLevel,
        clawbackAmount: data.clawbackAmount,
        recentCalls: calls.slice(-10),
        todos: data.todos,
      };
    },
  }),

  getEmailWorkflow: tool({
    description: 'Get the email workflow state - processed emails, their priorities, statuses, drafts, and research. Use this to check email status, see what needs response, or review drafted emails.',
    inputSchema: z.object({
      status: z.enum(['needs_response', 'draft_ready', 'sent', 'archived', 'snoozed']).optional(),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
    }),
    execute: async ({ status, priority }) => {
      const redis = getRedis();
      const data = await redis.get<Record<string, unknown>>(KEYS.EMAIL_WORKFLOW);
      if (!data) return { emails: [], lastRunAt: 'never' };

      let emails = (data.emails || []) as Record<string, unknown>[];
      if (status) emails = emails.filter((e) => e.status === status);
      if (priority) emails = emails.filter((e) => e.priority === priority);

      return {
        lastRunAt: data.lastRunAt,
        lastRunStats: data.lastRunStats,
        emailCount: emails.length,
        emails: emails.slice(0, 20),
      };
    },
  }),

  getAccountNotes: tool({
    description: 'Get the running account notes log - a markdown document with notes from all account interactions. Search for a specific account or get the full log.',
    inputSchema: z.object({
      search: z.string().optional().describe('Search term to filter notes for a specific account'),
    }),
    execute: async ({ search }) => {
      const redis = getRedis();
      const notes = await redis.get<string>(KEYS.ACCOUNT_NOTES);
      if (!notes) return { notes: 'No account notes found.' };

      if (search) {
        const lines = notes.split('\n');
        const q = search.toLowerCase();
        const matched: string[] = [];
        let inSection = false;

        for (const line of lines) {
          if (line.startsWith('##') || line.startsWith('---')) {
            inSection = line.toLowerCase().includes(q);
          }
          if (inSection) matched.push(line);
        }

        return { matchedNotes: matched.join('\n').slice(0, 3000), totalLength: notes.length };
      }

      return { notes: notes.slice(-3000), totalLength: notes.length };
    },
  }),

  getActions: tool({
    description: 'Get the action items list - prioritized tasks with accounts, deadlines, and categories.',
    inputSchema: z.object({
      showCompleted: z.boolean().optional().describe('Include completed actions (default: false)'),
    }),
    execute: async ({ showCompleted }) => {
      const redis = getRedis();
      const data = await redis.get<Record<string, unknown>>(KEYS.ACTIONS_DATA);
      if (!data) return { actions: [], total: 0 };

      let actions = (data.actions || []) as Record<string, unknown>[];
      if (!showCompleted) actions = actions.filter((a) => !a.completed);

      return {
        generated: data.generated,
        total: actions.length,
        actions: actions.slice(0, 30),
      };
    },
  }),
};
