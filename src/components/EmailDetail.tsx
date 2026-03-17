'use client';

import { useState } from 'react';
import type { ProcessedEmail } from '@/lib/types';
import { PRIORITY_CONFIG, STATUS_CONFIG, getSenderName, getRelativeTime, getSnoozeOptions } from '@/lib/email-utils';

interface EmailDetailProps {
  email: ProcessedEmail;
  onSend: (id: string) => void;
  onArchive: (id: string) => void;
  onSnooze: (id: string, until: string) => void;
}

function AccordionSection({ title, icon, children, defaultOpen = false }: { title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #334155' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', color: '#e2e8f0',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600 }}>{icon} {title}</span>
        <span style={{ fontSize: '12px', color: '#64748b' }}>{open ? '-' : '+'}</span>
      </button>
      {open && <div style={{ paddingBottom: '12px', fontSize: '13px', color: '#94a3b8', lineHeight: '1.6' }}>{children}</div>}
    </div>
  );
}

export default function EmailDetail({ email, onSend, onArchive, onSnooze }: EmailDetailProps) {
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [draftText, setDraftText] = useState(email.draft?.body || '');

  const priorityConf = PRIORITY_CONFIG[email.priority];
  const statusConf = STATUS_CONFIG[email.status];
  const snoozeOptions = getSnoozeOptions();

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0f172a', borderLeft: '1px solid #334155' }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px' }}>{email.subject}</h3>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              From: <strong style={{ color: '#e2e8f0' }}>{getSenderName(email.from)}</strong>
              <span style={{ color: '#64748b', marginLeft: '8px' }}>{getRelativeTime(email.receivedAt)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', color: priorityConf.color, background: priorityConf.bgColor, textTransform: 'uppercase' }}>
              {email.priority}
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', color: statusConf.color, background: statusConf.bgColor, textTransform: 'uppercase' }}>
              {statusConf.label}
            </span>
          </div>
        </div>
        {email.priorityReason && (
          <div style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '6px', marginTop: '6px' }}>
            {email.priorityReason}
          </div>
        )}
        {email.matchedAccount && (
          <div style={{ marginTop: '8px', padding: '8px 12px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#8b5cf6' }}>{email.matchedAccount.accountName}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '8px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)' }}>
                  ${email.matchedAccount.mrrAtRisk}/mo
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '8px', color: '#22c55e', background: 'rgba(34, 197, 94, 0.15)' }}>
                  {email.matchedAccount.saveStatus}
                </span>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Standing: {email.matchedAccount.paymentStanding} | Contract ends: {email.matchedAccount.contractEnd || 'N/A'}
            </div>
          </div>
        )}
      </div>

      {/* Email Body */}
      <div style={{ padding: '16px', borderBottom: '1px solid #334155' }}>
        <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
          {email.snippet}
        </div>
      </div>

      {/* Research Context */}
      {email.research && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, padding: '12px 0 4px' }}>Research Context</div>

          {email.research.accountIntel && (
            <AccordionSection title="Account Intel" icon="*" defaultOpen={true}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{email.research.accountIntel}</div>
            </AccordionSection>
          )}

          {email.research.gmailThreadSummary && (
            <AccordionSection title="Email History" icon="@">
              <div style={{ whiteSpace: 'pre-wrap' }}>{email.research.gmailThreadSummary}</div>
            </AccordionSection>
          )}

          {email.research.slackMentions.length > 0 && (
            <AccordionSection title={`Slack Context (${email.research.slackMentions.length})`} icon="#">
              {email.research.slackMentions.map((mention, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: i < email.research!.slackMentions.length - 1 ? '1px solid #1e293b' : 'none' }}>
                  {mention}
                </div>
              ))}
            </AccordionSection>
          )}

          {email.research.recentTranscripts.length > 0 && (
            <AccordionSection title={`Call Transcripts (${email.research.recentTranscripts.length})`} icon="~">
              {email.research.recentTranscripts.map((t, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: i < email.research!.recentTranscripts.length - 1 ? '1px solid #1e293b' : 'none' }}>
                  {t}
                </div>
              ))}
            </AccordionSection>
          )}

          {email.research.calendarContext && (
            <AccordionSection title="Calendar" icon="+">
              <div style={{ whiteSpace: 'pre-wrap' }}>{email.research.calendarContext}</div>
            </AccordionSection>
          )}

          {email.research.accountTimeline && (
            <AccordionSection title="Full Timeline" icon="=">
              <div style={{ whiteSpace: 'pre-wrap' }}>{email.research.accountTimeline}</div>
            </AccordionSection>
          )}

          {email.research.saveDeskNotes && (
            <AccordionSection title="Save Desk Notes" icon="-">
              <div style={{ whiteSpace: 'pre-wrap' }}>{email.research.saveDeskNotes}</div>
            </AccordionSection>
          )}
        </div>
      )}

      {/* Draft Section */}
      {email.draft && (
        <div style={{ padding: '16px', borderTop: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Draft Response</div>
            <span style={{ fontSize: '10px', color: '#64748b', background: '#1e293b', padding: '2px 8px', borderRadius: '8px' }}>
              Tone: {email.draft.tone}
            </span>
          </div>
          {email.draft.strategy && (
            <div style={{ fontSize: '11px', color: '#6366f1', background: 'rgba(99, 102, 241, 0.1)', padding: '6px 10px', borderRadius: '6px', marginBottom: '8px' }}>
              Strategy: {email.draft.strategy}
            </div>
          )}
          <textarea
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            style={{
              width: '100%', minHeight: '200px', padding: '12px', background: '#1e293b',
              border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0',
              fontSize: '13px', lineHeight: '1.6', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ padding: '16px', borderTop: '1px solid #334155', display: 'flex', gap: '8px', flexWrap: 'wrap', position: 'sticky', bottom: 0, background: '#0f172a' }}>
        {email.status !== 'sent' && email.status !== 'archived' && (
          <>
            {email.gmailDraftId && (
              <button
                onClick={() => onSend(email.id)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#22c55e', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Approve & Send
              </button>
            )}
            <button
              onClick={() => window.open('https://mail.google.com/mail/u/0/#drafts', '_blank')}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
            >
              Edit in Gmail
            </button>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#8b5cf6', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
              >
                Snooze
              </button>
              {showSnoozeMenu && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: 0, marginBottom: '4px',
                  background: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
                  padding: '4px', minWidth: '140px', zIndex: 10,
                }}>
                  {snoozeOptions.map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => { onSnooze(email.id, opt.getTime()); setShowSnoozeMenu(false); }}
                      style={{
                        display: 'block', width: '100%', padding: '6px 10px', background: 'none',
                        border: 'none', color: '#e2e8f0', fontSize: '12px', cursor: 'pointer',
                        textAlign: 'left', borderRadius: '4px',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#334155'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => onArchive(email.id)}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#64748b', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
            >
              Archive
            </button>
          </>
        )}
        {email.status === 'sent' && (
          <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 600 }}>Sent</span>
        )}
        {email.status === 'archived' && (
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Archived</span>
        )}
      </div>
    </div>
  );
}
