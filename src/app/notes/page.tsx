'use client';

import { useState, useMemo } from 'react';
import { useCallTracker } from '@/lib/store';
import { categorizeStatus, hasAccountingChanges, getInitials, parseDate } from '@/lib/call-utils';
import type { Call } from '@/lib/types';

function fmtDate(d: string): string {
  if (!d) return '';
  const parsed = parseDate(d);
  if (!parsed) return '';
  const dt = new Date(parsed + 'T00:00:00');
  if (isNaN(dt.getTime())) return parsed;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const statusColors: Record<string, string> = {
  saved: '#22c55e',
  lost: '#ef4444',
  pending: '#f59e0b',
};

export default function NotesPage() {
  const { calls, openCallModal } = useCallTracker();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRefund, setFilterRefund] = useState(false);
  const [filterContractSwap, setFilterContractSwap] = useState(false);
  const [filterRelaunch, setFilterRelaunch] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return calls.filter((c) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [
          c.accountName, c.contactName, c.notes, c.todoNotes,
          c.accountingNotes, c.saveSubReason, c.missedGuaranteeReasons,
          c.cancellationSubReason,
        ].join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (filterStatus !== 'all') {
        const category = categorizeStatus(c.saveStatus, c.saveType);
        if (category !== filterStatus) return false;
      }
      if (filterRefund && !c.refundAmount) return false;
      if (filterContractSwap && c.contractSwap !== 'Yes') return false;
      if (filterRelaunch && c.relaunch !== 'Yes') return false;
      return true;
    }).sort((a, b) => {
      const dateA = a.dateChanged || a.saveDateTime || a.importDate || '';
      const dateB = b.dateChanged || b.saveDateTime || b.importDate || '';
      return dateB.localeCompare(dateA);
    });
  }, [calls, searchQuery, filterStatus, filterRefund, filterContractSwap, filterRelaunch]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#3b82f620' : '#1e293b',
    color: active ? '#3b82f6' : '#64748b',
    border: `1px solid ${active ? '#3b82f6' : '#334155'}`,
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  });

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
          Notes & Accounting
        </h1>
        <span style={{ fontSize: 13, color: '#64748b' }}>
          {filtered.length} account{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          type="text"
          placeholder="Search notes, accounts, contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            color: 'white',
            padding: '10px 14px',
            width: '100%',
            fontSize: 14,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            color: 'white',
            padding: '10px 14px',
            fontSize: 14,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="all">All Statuses</option>
          <option value="saved">Saved</option>
          <option value="lost">Lost</option>
          <option value="pending">Pending</option>
        </select>

        <button style={toggleBtnStyle(filterRefund)} onClick={() => setFilterRefund((v) => !v)}>
          Has Refund
        </button>
        <button style={toggleBtnStyle(filterContractSwap)} onClick={() => setFilterContractSwap((v) => !v)}>
          Contract Swap
        </button>
        <button style={toggleBtnStyle(filterRelaunch)} onClick={() => setFilterRelaunch((v) => !v)}>
          Relaunch
        </button>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '60px 0', fontSize: 15 }}>
          No notes found
        </div>
      ) : (
        filtered.map((call) => {
          const category = categorizeStatus(call.saveStatus, call.saveType);
          const badgeColor = statusColors[category] || '#64748b';
          const initials = getInitials(call.accountName);
          const notesText = call.notes || '';
          const isLong = notesText.length > 200;
          const isExpanded = expandedIds.has(call.id);
          const showAccounting = hasAccountingChanges(call);

          return (
            <div
              key={call.id}
              style={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: 10,
                padding: 16,
                marginBottom: 12,
              }}
            >
              {/* Top row: avatar + header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Avatar */}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    minWidth: 48,
                    borderRadius: '50%',
                    background: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  {initials}
                </div>

                {/* Header content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span
                        onClick={() => openCallModal(call.id)}
                        style={{
                          fontWeight: 600,
                          color: '#f1f5f9',
                          fontSize: 15,
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {call.accountName || 'Unnamed Account'}
                      </span>
                      {call.contactName && (
                        <span style={{ color: '#64748b', fontSize: 13 }}>
                          {call.contactName}
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: badgeColor,
                        background: badgeColor + '18',
                        padding: '2px 8px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {category}
                    </span>
                  </div>

                  {/* Notes */}
                  {notesText && (
                    <div style={{ marginTop: 8, color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>
                      {isLong && !isExpanded ? notesText.slice(0, 200) + '...' : notesText}
                      {isLong && (
                        <span
                          onClick={() => toggleExpanded(call.id)}
                          style={{
                            color: '#3b82f6',
                            cursor: 'pointer',
                            marginLeft: 6,
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {isExpanded ? 'Show less' : 'Show more'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Todo notes */}
                  {call.todoNotes && (
                    <div style={{ marginTop: 8, color: '#fbbf24', fontSize: 12, lineHeight: 1.5, opacity: 0.85 }}>
                      <span style={{ fontWeight: 600 }}>To-Do: </span>
                      {call.todoNotes}
                    </div>
                  )}

                  {/* Accounting changes */}
                  {showAccounting && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                        Accounting Changes
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {call.refundAmount && (
                          <span style={pillStyle}>Refund: ${call.refundAmount}</span>
                        )}
                        {call.contractSwap === 'Yes' && (
                          <span style={pillStyle}>Contract Swap</span>
                        )}
                        {call.relaunch === 'Yes' && (
                          <span style={pillStyle}>Relaunch</span>
                        )}
                        {call.contractLength && (
                          <span style={pillStyle}>Contract: {call.contractLength}mo</span>
                        )}
                        {call.paymentMethod && (
                          <span style={pillStyle}>Payment: {call.paymentMethod}</span>
                        )}
                        {call.dateChanged && (
                          <span style={pillStyle}>Date Changed: {fmtDate(call.dateChanged)}</span>
                        )}
                      </div>

                      {call.accountingNotes && (
                        <div style={{ marginTop: 6, color: '#64748b', fontSize: 12, lineHeight: 1.4 }}>
                          {call.accountingNotes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  fontSize: 11,
  background: '#334155',
  color: '#cbd5e1',
  padding: '3px 8px',
  borderRadius: 10,
  fontWeight: 500,
  whiteSpace: 'nowrap',
};
