'use client';

import { useState } from 'react';
import { t } from '@/lib/theme';
import type { GatheredContext } from '@/lib/types';

interface Props {
  context: GatheredContext;
}

function Section({ title, count, children, defaultOpen = false }: { title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: '8px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '12px 16px', background: t.cardBg, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', color: t.fg, fontSize: '13px', fontWeight: 600,
        }}
      >
        <span>{title}{count !== undefined ? ` (${count})` : ''}</span>
        <span style={{ color: t.muted, fontSize: '12px' }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${t.cardBorder}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function ContextTab({ context }: Props) {
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
        Gathered Context
      </div>

      {/* Transcript */}
      <Section title="Call Transcript" defaultOpen>
        <div style={{ fontSize: '12px', color: t.textSecondary, marginBottom: '8px' }}>
          <strong>Title:</strong> {context.transcript.title} |
          <strong> Duration:</strong> {context.transcript.duration}min |
          <strong> Participants:</strong> {context.transcript.participants.join(', ')}
        </div>
        {context.transcript.summary && (
          <div style={{ fontSize: '12px', color: t.fg, marginBottom: '8px' }}>
            <strong>AI Summary:</strong> {context.transcript.summary}
          </div>
        )}
        <div style={{
          maxHeight: '300px', overflowY: 'auto', padding: '10px',
          background: t.inputBg, borderRadius: '6px',
          fontSize: '12px', color: t.textSecondary, lineHeight: '1.6', whiteSpace: 'pre-wrap',
        }}>
          {context.transcript.transcript || 'No transcript text available'}
        </div>
      </Section>

      {/* Save Desk Record */}
      {context.matchedCall && (
        <Section title="Save Desk Record">
          <div style={{ fontSize: '12px', color: t.fg, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong>Account:</strong> {context.matchedCall.accountName}</div>
            <div><strong>Contact:</strong> {context.matchedCall.contactName}</div>
            <div><strong>Status:</strong> {context.matchedCall.saveStatus}</div>
            <div><strong>Type:</strong> {context.matchedCall.saveType}</div>
            <div><strong>Monthly Price:</strong> {context.matchedCall.monthlySalesPrice}</div>
            <div><strong>Payment Standing:</strong> {context.matchedCall.paymentStanding}</div>
            <div><strong>Billing:</strong> {context.matchedCall.billingFrequency}</div>
            {context.matchedCall.notes && <div><strong>Notes:</strong> {context.matchedCall.notes}</div>}
          </div>
        </Section>
      )}

      {/* Gmail Threads */}
      <Section title="Gmail Threads" count={context.gmailThreads.length}>
        {context.gmailThreads.length === 0 ? (
          <div style={{ fontSize: '12px', color: t.muted }}>No matching email threads found</div>
        ) : (
          context.gmailThreads.map((thread, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: i < context.gmailThreads.length - 1 ? `1px solid ${t.cardBorder}` : 'none' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: t.fg }}>{thread.subject}</div>
              <div style={{ fontSize: '11px', color: t.muted }}>{thread.snippet}</div>
              <div style={{ fontSize: '11px', color: t.textTertiary, marginTop: '2px' }}>{thread.lastDate}</div>
            </div>
          ))
        )}
      </Section>

      {/* Calendar Events */}
      <Section title="Calendar Events" count={context.calendarEvents.length}>
        {context.calendarEvents.length === 0 ? (
          <div style={{ fontSize: '12px', color: t.muted }}>No matching calendar events found</div>
        ) : (
          context.calendarEvents.map((event, i) => (
            <div key={i} style={{ padding: '6px 0', fontSize: '12px', color: t.fg }}>
              <strong>{event.summary}</strong> - {event.start} ({event.attendees.join(', ')})
            </div>
          ))
        )}
      </Section>

      {/* NPI Data */}
      <Section title="NPI Provider Data">
        {context.npiData ? (
          <div style={{ fontSize: '12px', color: t.fg, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong>Name:</strong> {context.npiData.name}</div>
            <div><strong>NPI:</strong> {context.npiData.npi}</div>
            <div><strong>Specialty:</strong> {context.npiData.specialty}</div>
            <div><strong>Address:</strong> {context.npiData.address}</div>
            <div><strong>Phone:</strong> {context.npiData.phone}</div>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: t.muted }}>No NPI data found for this contact</div>
        )}
      </Section>

      {/* Slack Mentions */}
      <Section title="Slack Mentions" count={context.slackMentions.length}>
        {context.slackMentions.length === 0 ? (
          <div style={{ fontSize: '12px', color: t.muted }}>No Slack mentions found</div>
        ) : (
          context.slackMentions.map((m, i) => (
            <div key={i} style={{ padding: '6px 0', fontSize: '12px', borderBottom: i < context.slackMentions.length - 1 ? `1px solid ${t.cardBorder}` : 'none' }}>
              <span style={{ color: t.accent }}>#{m.channel}</span>{' '}
              <span style={{ color: t.fg }}>{m.text}</span>
            </div>
          ))
        )}
      </Section>

      {/* Account Notes */}
      <Section title="Account Notes">
        {context.accountNotes ? (
          <div style={{ fontSize: '12px', color: t.fg, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {context.accountNotes}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: t.muted }}>No existing account notes</div>
        )}
      </Section>

      {/* Existing Actions */}
      <Section title="Existing Actions" count={context.existingActions.length}>
        {context.existingActions.length === 0 ? (
          <div style={{ fontSize: '12px', color: t.muted }}>No existing action items for this account</div>
        ) : (
          context.existingActions.map((a, i) => (
            <div key={i} style={{ padding: '4px 0', fontSize: '12px', color: a.completed ? t.muted : t.fg }}>
              [{a.completed ? 'DONE' : a.urgency}] {a.task}
            </div>
          ))
        )}
      </Section>
    </div>
  );
}
