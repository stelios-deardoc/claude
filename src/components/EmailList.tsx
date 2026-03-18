'use client';

import { useMemo, useState } from 'react';
import type { ProcessedEmail, EmailPriority, EmailStatus } from '@/lib/types';
import {
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  groupByPriority,
  getSenderName,
  getSenderInitials,
  getRelativeTime,
  getStatusCounts,
} from '@/lib/email-utils';
import { t } from '@/lib/theme';

interface EmailListProps {
  emails: ProcessedEmail[];
  selectedId: string | null;
  lastRunAt: string;
  onSelectEmail: (id: string) => void;
  onRefresh: () => void;
}

export default function EmailList({ emails, selectedId, lastRunAt, onSelectEmail, onRefresh }: EmailListProps) {
  const [priorityFilter, setPriorityFilter] = useState<EmailPriority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<EmailStatus | 'active' | 'all'>('active');

  const filteredEmails = useMemo(() => {
    let filtered = emails;
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(e => e.priority === priorityFilter);
    }
    if (statusFilter === 'active') {
      filtered = filtered.filter(e => e.status !== 'archived' && e.status !== 'sent');
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter);
    }
    return filtered;
  }, [emails, priorityFilter, statusFilter]);

  const grouped = useMemo(() => groupByPriority(filteredEmails), [filteredEmails]);
  const statusCounts = useMemo(() => getStatusCounts(emails), [emails]);

  const lastRunLabel = lastRunAt
    ? `Last scanned: ${getRelativeTime(lastRunAt)}`
    : 'Not scanned yet';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bg }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${t.cardBorder}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: t.fg, margin: 0 }}>Inbox</h2>
            <span style={{ fontSize: '11px', color: t.muted }}>{lastRunLabel}</span>
          </div>
          <button
            onClick={onRefresh}
            style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '6px', padding: '6px 12px', color: t.textSecondary, fontSize: '12px', cursor: 'pointer' }}
          >
            Refresh
          </button>
        </div>

        {/* Status counts bar */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: t.danger, fontWeight: 600 }}>{statusCounts.needs_response} Need Response</span>
          <span style={{ fontSize: '11px', color: t.muted }}>|</span>
          <span style={{ fontSize: '11px', color: t.warning, fontWeight: 600 }}>{statusCounts.draft_ready} Drafts Ready</span>
          <span style={{ fontSize: '11px', color: t.muted }}>|</span>
          <span style={{ fontSize: '11px', color: t.success, fontWeight: 600 }}>{statusCounts.sent} Sent</span>
          <span style={{ fontSize: '11px', color: t.muted }}>|</span>
          <span style={{ fontSize: '11px', color: t.muted, fontWeight: 600 }}>{statusCounts.archived} Archived</span>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {(['all', 'P0', 'P1', 'P2', 'P3'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              style={{
                padding: '3px 10px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                background: priorityFilter === p ? (p === 'all' ? '#6366f1' : PRIORITY_CONFIG[p].bgColor) : t.cardBg,
                color: priorityFilter === p ? (p === 'all' ? '#fff' : PRIORITY_CONFIG[p].color) : t.muted,
              }}
            >
              {p === 'all' ? 'All' : PRIORITY_CONFIG[p].label}
            </button>
          ))}
          <span style={{ width: '1px', background: t.cardBorder, margin: '0 4px' }} />
          {(['active', 'needs_response', 'draft_ready', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '3px 10px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                background: statusFilter === s ? '#6366f1' : t.cardBg,
                color: statusFilter === s ? '#fff' : t.muted,
              }}
            >
              {s === 'active' ? 'Active' : s === 'all' ? 'All' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Email list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {(['P0', 'P1', 'P2', 'P3'] as const).map(priority => {
          const group = grouped[priority];
          if (group.length === 0) return null;
          const config = PRIORITY_CONFIG[priority];
          return (
            <div key={priority} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', marginBottom: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: config.color }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: config.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {config.label} ({group.length})
                </span>
              </div>
              {group.map(email => {
                const isSelected = email.id === selectedId;
                const statusConf = STATUS_CONFIG[email.status];
                return (
                  <div
                    key={email.id}
                    onClick={() => onSelectEmail(email.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      marginBottom: '2px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? t.cardBg : 'transparent',
                      borderLeft: `3px solid ${isSelected ? config.borderColor : 'transparent'}`,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = t.cardBg; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', background: t.cardBorder,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 600, color: t.fg, flexShrink: 0,
                    }}>
                      {getSenderInitials(email.from)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: t.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {getSenderName(email.from)}
                        </span>
                        <span style={{ fontSize: '10px', color: t.muted, flexShrink: 0, marginLeft: '8px' }}>
                          {getRelativeTime(email.receivedAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: t.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>
                        {email.subject}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '8px',
                          color: statusConf.color, background: statusConf.bgColor, textTransform: 'uppercase',
                        }}>
                          {statusConf.label}
                        </span>
                        {email.matchedAccount && (
                          <span style={{
                            fontSize: '9px', fontWeight: 600, padding: '1px 6px', borderRadius: '8px',
                            color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.15)',
                          }}>
                            {email.matchedAccount.accountName}
                          </span>
                        )}
                        {email.matchedAccount && email.matchedAccount.mrrAtRisk > 0 && (
                          <span style={{
                            fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '8px',
                            color: t.warning, background: 'rgba(245, 158, 11, 0.15)',
                          }}>
                            ${email.matchedAccount.mrrAtRisk}/mo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {filteredEmails.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: t.muted, fontSize: '13px' }}>
            {emails.length === 0 ? 'No emails processed yet. Run "clean my inbox" to start.' : 'No emails match the current filters.'}
          </div>
        )}
      </div>
    </div>
  );
}
