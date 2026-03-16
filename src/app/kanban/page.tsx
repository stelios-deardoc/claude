'use client';

import { useMemo } from 'react';
import { useCallTracker } from '@/lib/store';
import { categorizeStatus, getStandingCategory, hasGuaranteeIssue, getInitials } from '@/lib/call-utils';
import { Call } from '@/lib/types';

interface KanbanColumn {
  title: string;
  color: string;
  calls: Call[];
}

export default function KanbanPage() {
  const { calls, openCallModal } = useCallTracker();

  const columns = useMemo<KanbanColumn[]>(() => {
    const saved: Call[] = [];
    const lost: Call[] = [];
    const pending: Call[] = [];
    const guarantee: Call[] = [];
    const badStanding: Call[] = [];

    calls.forEach((c) => {
      const status = categorizeStatus(c.saveStatus, c.saveType);
      if (status === 'saved') saved.push(c);
      if (status === 'lost') lost.push(c);
      if (status === 'pending') pending.push(c);
      if (hasGuaranteeIssue(c)) guarantee.push(c);
      if (getStandingCategory(c.paymentStanding) === 'bad') badStanding.push(c);
    });

    return [
      { title: 'Saved', color: '#22c55e', calls: saved },
      { title: 'Lost', color: '#ef4444', calls: lost },
      { title: 'Pending', color: '#f59e0b', calls: pending },
      { title: 'Guarantee Issues', color: '#a855f7', calls: guarantee },
      { title: 'Bad Standing', color: '#f97316', calls: badStanding },
    ];
  }, [calls]);

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: 24,
        overflowX: 'auto',
        height: '100%',
        minHeight: 0,
      }}
    >
      {columns.map((col) => (
        <div
          key={col.title}
          style={{
            flex: 1,
            minWidth: 240,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: `3px solid ${col.color}`,
            borderRadius: 8,
            background: '#0b1120',
          }}
        >
          {/* Column header */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              background: '#0b1120',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderBottom: '1px solid #1e293b',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>
              {col.title}
            </span>
            <span
              style={{
                background: col.color + '22',
                color: col.color,
                fontSize: 12,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 10,
              }}
            >
              {col.calls.length}
            </span>
          </div>

          {/* Card list */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 10px',
              maxHeight: 'calc(100vh - 160px)',
            }}
          >
            {col.calls.length === 0 ? (
              <div
                style={{
                  color: '#475569',
                  fontSize: 13,
                  textAlign: 'center',
                  padding: '24px 0',
                }}
              >
                No accounts
              </div>
            ) : (
              col.calls.map((call) => (
                <KanbanCard
                  key={call.id}
                  call={call}
                  onClick={() => openCallModal(call.id)}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function KanbanCard({ call, onClick }: { call: Call; onClick: () => void }) {
  const standing = getStandingCategory(call.paymentStanding);
  const standingLabel =
    standing === 'good' ? 'Good' : standing === 'bad' ? 'Bad' : 'Unknown';
  const standingColor = standing === 'good' ? '#22c55e' : standing === 'bad' ? '#ef4444' : '#64748b';

  const rate = `$${parseFloat(call.ratePerMonth || '0').toFixed(2)}/mo`;
  const notesPreview =
    call.notes && call.notes.length > 80
      ? call.notes.slice(0, 80) + '...'
      : call.notes || '';

  return (
    <div
      onClick={onClick}
      style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#334155';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#1e293b';
      }}
    >
      {/* Account name */}
      <div
        style={{
          fontWeight: 700,
          fontSize: 13,
          color: '#f1f5f9',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: 4,
        }}
      >
        {call.accountName || 'Unnamed Account'}
      </div>

      {/* Save type */}
      {call.saveType && (
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
          {call.saveType}
        </div>
      )}

      {/* Rate + standing row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: notesPreview ? 6 : 0,
        }}
      >
        <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>
          {rate}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: standingColor,
            background: standingColor + '18',
            padding: '1px 6px',
            borderRadius: 6,
          }}
        >
          {standingLabel}
        </span>
      </div>

      {/* Notes preview */}
      {notesPreview && (
        <div
          style={{
            fontSize: 11,
            color: '#64748b',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {notesPreview}
        </div>
      )}
    </div>
  );
}
