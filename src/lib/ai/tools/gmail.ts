import { tool } from 'ai';
import { z } from 'zod';

// Helper to call Gmail API with the user's OAuth token
async function gmailFetch(endpoint: string, accessToken: string, options?: RequestInit) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Gmail API error (${res.status}): ${error}`);
  }
  return res.json();
}

// Decode base64url encoded email body
function decodeBody(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

export function createGmailTools(accessToken: string) {
  return {
    searchGmail: tool({
      description: 'Search Gmail for emails matching a query. Use Gmail search syntax (from:, to:, subject:, has:attachment, newer_than:7d, etc). Returns message IDs and snippets.',
      inputSchema: z.object({
        query: z.string().describe('Gmail search query (e.g. "from:client@example.com", "subject:cancel newer_than:30d", "is:unread")'),
        maxResults: z.number().optional().describe('Max results to return (default 10, max 20)'),
      }),
      execute: async ({ query, maxResults }) => {
        const max = Math.min(maxResults || 10, 20);
        const data = await gmailFetch(
          `messages?q=${encodeURIComponent(query)}&maxResults=${max}`,
          accessToken,
        );

        if (!data.messages || data.messages.length === 0) {
          return { results: [], total: 0, query };
        }

        // Fetch metadata for each message
        const messages = await Promise.all(
          data.messages.slice(0, max).map(async (msg: { id: string }) => {
            const detail = await gmailFetch(
              `messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
              accessToken,
            );
            return {
              id: detail.id,
              threadId: detail.threadId,
              snippet: detail.snippet,
              from: getHeader(detail.payload?.headers || [], 'From'),
              to: getHeader(detail.payload?.headers || [], 'To'),
              subject: getHeader(detail.payload?.headers || [], 'Subject'),
              date: getHeader(detail.payload?.headers || [], 'Date'),
              labelIds: detail.labelIds,
            };
          }),
        );

        return {
          results: messages,
          total: data.resultSizeEstimate || messages.length,
          query,
        };
      },
    }),

    readGmailThread: tool({
      description: 'Read a full Gmail thread by thread ID. Returns all messages in the thread with their bodies. Use this after searching to get full email content.',
      inputSchema: z.object({
        threadId: z.string().describe('The Gmail thread ID to read'),
      }),
      execute: async ({ threadId }) => {
        const data = await gmailFetch(`threads/${threadId}?format=full`, accessToken);

        const messages = (data.messages || []).map((msg: Record<string, unknown>) => {
          const headers = ((msg.payload as Record<string, unknown>)?.headers || []) as Array<{ name: string; value: string }>;
          const payload = msg.payload as Record<string, unknown>;

          // Extract body - check parts first, then direct body
          let body = '';
          const parts = (payload?.parts || []) as Array<Record<string, unknown>>;
          if (parts.length > 0) {
            const textPart = parts.find((p) => p.mimeType === 'text/plain');
            if (textPart) {
              body = decodeBody(((textPart.body as Record<string, unknown>)?.data as string) || '');
            }
          } else if (payload?.body) {
            body = decodeBody(((payload.body as Record<string, unknown>)?.data as string) || '');
          }

          return {
            id: msg.id,
            from: getHeader(headers, 'From'),
            to: getHeader(headers, 'To'),
            subject: getHeader(headers, 'Subject'),
            date: getHeader(headers, 'Date'),
            body: body.slice(0, 2000), // Truncate long bodies
            snippet: msg.snippet,
          };
        });

        return { threadId, messageCount: messages.length, messages };
      },
    }),

    createGmailDraft: tool({
      description: 'Create a Gmail draft email. The draft is NOT sent - it is saved for Stelios to review and send manually. Always use this instead of sending directly.',
      inputSchema: z.object({
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Email subject line'),
        body: z.string().describe('Email body (plain text)'),
        threadId: z.string().optional().describe('Optional thread ID to reply to'),
      }),
      execute: async ({ to, subject, body, threadId }) => {
        const rawMessage = [
          `To: ${to}`,
          `Subject: ${subject}`,
          'Content-Type: text/plain; charset=utf-8',
          '',
          body,
        ].join('\r\n');

        const encoded = Buffer.from(rawMessage).toString('base64url');

        const draftData: Record<string, unknown> = {
          message: { raw: encoded },
        };
        if (threadId) {
          (draftData.message as Record<string, unknown>).threadId = threadId;
        }

        const result = await gmailFetch('drafts', accessToken, {
          method: 'POST',
          body: JSON.stringify(draftData),
        });

        return {
          draftId: result.id,
          messageId: result.message?.id,
          status: 'Draft created - NOT sent. Stelios can review and send from Gmail.',
          to,
          subject,
        };
      },
    }),
  };
}
