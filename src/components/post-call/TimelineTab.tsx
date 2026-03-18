'use client';

import { t } from '@/lib/theme';
import type { GatheredContext } from '@/lib/types';

interface Props {
  context: GatheredContext;
  accountName: string;
}

interface TimelineEvent {
  date: string;
  source: 'call' | 'email' | 'calendar' | 'slack' | 'action';
  title: string;
  detail: string;
}

function buildTimeline(context: GatheredContext): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Call transcript
  if (context.transcript.date) {
    events.push({
      date: context.transcript.date,
      source: 'call',
      title: context.transcript.title,
      detail: `${context.transcript.duration}min call with ${context.transcript.participants.join(', ')}`,
    });
  }

  // Gmail threads
  context.gmailThreads.forEach(thread => {
    events.push({
      date: thread.lastDate,
      source: 'email',
      title: thread.subject,
      detail: thread.snippet,
    });
  });

  // Calendar events
  context.calendarEvents.forEach(event => {
    events.push({
      date: event.start,
      source: 'calendar',
      title: event.summary,
      detail: event.attendees.join(', '),
    });
  });

  // Slack mentions
  context.slackMentions.forEach(m => {
    events.push({
      date: new Date(parseFloat(m.timestamp) * 1000).toISOString(),
      source: 'slack',
      title: `#${m.channel}`,
      detail: m.text,
    });
  });

  // Sort by date descending
  events.sort((a, b) => {
    const da = new Date(a.date).getTime() || 0;
    const db = new Date(b.date).getTime() || 0;
    return db - da;
  });

  return events;
}

const SOURCE_COLORS: Record<string, string> = {
  call: 'var(--accent)',
  email: 'var(--warning)',
  calendar: 'var(--success)',
  slack: '#E01E5A',
  action: 'var(--muted)',
};

const SOURCE_LABELS: Record<string, string> = {
  call: 'Call',
  email: 'Email',
  calendar: 'Calendar',
  slack: 'Slack',
  action: 'Action',
};

export default function TimelineTab({ context, accountName }: Props) {
  const events = buildTimeline(context);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
        Timeline - {accountName}
      </div>

      {events.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: t.muted, fontSize: '13px' }}>
          No timeline events to display.
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '24px' }}>
          {/* Vertical line */}
          <div style={{
            position: 'absolute', left: '7px', top: '8px', bottom: '8px',
            width: '2px', background: t.cardBorder,
          }} />

          {events.map((event, i) => (
            <div key={i} style={{ position: 'relative', marginBottom: '20px' }}>
              {/* Dot */}
              <div style={{
                position: 'absolute', left: '-20px', top: '6px',
                width: '12px', height: '12px', borderRadius: '50%',
                background: SOURCE_COLORS[event.source] || t.muted,
                border: `2px solid ${t.bg}`,
              }} />

              {/* Content */}
              <div style={{ padding: '10px 14px', background: t.cardBg, borderRadius: '8px', border: `1px solid ${t.cardBorder}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                    background: `${SOURCE_COLORS[event.source] || t.muted}22`,
                    color: SOURCE_COLORS[event.source] || t.muted,
                    textTransform: 'uppercase',
                  }}>
                    {SOURCE_LABELS[event.source] || event.source}
                  </span>
                  <span style={{ fontSize: '11px', color: t.muted }}>
                    {formatDate(event.date)}
                  </span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: t.fg }}>{event.title}</div>
                {event.detail && (
                  <div style={{ fontSize: '12px', color: t.textSecondary, marginTop: '2px', lineHeight: '1.4' }}>
                    {event.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}
