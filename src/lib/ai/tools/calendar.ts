import { tool } from 'ai';
import { z } from 'zod';

async function calendarFetch(endpoint: string, accessToken: string) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Calendar API error (${res.status}): ${error}`);
  }
  return res.json();
}

export function createCalendarTools(accessToken: string) {
  return {
    listCalendarEvents: tool({
      description: 'List upcoming calendar events. Use this to check what meetings are scheduled, prep for calls, or see today\'s agenda.',
      inputSchema: z.object({
        timeMin: z.string().optional().describe('Start time in ISO 8601 format (default: now)'),
        timeMax: z.string().optional().describe('End time in ISO 8601 format (default: end of today)'),
        maxResults: z.number().optional().describe('Max events to return (default 10, max 25)'),
        query: z.string().optional().describe('Search query to filter events by title'),
      }),
      execute: async ({ timeMin, timeMax, maxResults, query }) => {
        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const params = new URLSearchParams({
          timeMin: timeMin || now.toISOString(),
          timeMax: timeMax || endOfDay.toISOString(),
          maxResults: String(Math.min(maxResults || 10, 25)),
          singleEvents: 'true',
          orderBy: 'startTime',
        });

        if (query) params.set('q', query);

        const data = await calendarFetch(
          `calendars/primary/events?${params.toString()}`,
          accessToken,
        );

        const events = (data.items || []).map((event: Record<string, unknown>) => ({
          id: event.id,
          summary: event.summary || '(No title)',
          start: (event.start as Record<string, unknown>)?.dateTime || (event.start as Record<string, unknown>)?.date,
          end: (event.end as Record<string, unknown>)?.dateTime || (event.end as Record<string, unknown>)?.date,
          location: event.location || null,
          hangoutLink: event.hangoutLink || null,
          attendees: ((event.attendees || []) as Array<Record<string, unknown>>).map(
            (a) => `${a.email}${a.responseStatus === 'declined' ? ' (declined)' : ''}`,
          ),
          description: event.description ? String(event.description).slice(0, 500) : null,
          status: event.status,
        }));

        return {
          date: now.toISOString().split('T')[0],
          eventCount: events.length,
          events,
        };
      },
    }),
  };
}
