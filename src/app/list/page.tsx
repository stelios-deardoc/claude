'use client';

import React, { useState, useMemo } from 'react';
import { t } from '@/lib/theme';
import { useCallTracker } from '@/lib/store';
import { categorizeStatus, getStandingCategory, hasGuaranteeIssue, getInitials, getCallMonth, getMonthLabel, getLast6Months, getCurrentMonth } from '@/lib/call-utils';
import type { Call, SortOption } from '@/lib/types';

export default function ListPage() {
  const { calls, openCallModal } = useCallTracker();
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const months = useMemo(() => getLast6Months(), []);
  const currentMonth = useMemo(() => getCurrentMonth(), []);

  const filteredAndSorted = useMemo(() => {
    let filtered = [...calls];

    // Month filter
    if (selectedMonth !== 'all') {
      filtered = filtered.filter(c => getCallMonth(c) === selectedMonth);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => {
        const searchable = [c.accountName, c.contactName, c.notes, c.todoNotes, c.accountingNotes || ''].join(' ').toLowerCase();
        return searchable.includes(q);
      });
    }

    filtered = filtered.filter((c: Call) => {
      if (!filterStatus) return true;
      const category = categorizeStatus(c.saveStatus, c.saveType);
      const standing = getStandingCategory(c.paymentStanding);

      switch (filterStatus) {
        case 'saved':
          return category === 'saved';
        case 'lost':
          return category === 'lost';
        case 'pending':
          return category === 'pending';
        case 'guarantee':
          return hasGuaranteeIssue(c);
        case 'good-standing':
          return standing === 'good';
        case 'bad-standing':
          return standing === 'bad';
        default:
          return true;
      }
    });

    filtered.sort((a: Call, b: Call) => {
      switch (sortBy) {
        case 'date-desc': {
          const dateA = a.saveDateTime || a.importDate || '';
          const dateB = b.saveDateTime || b.importDate || '';
          return dateB.localeCompare(dateA);
        }
        case 'date-asc': {
          const dateA = a.saveDateTime || a.importDate || '';
          const dateB = b.saveDateTime || b.importDate || '';
          return dateA.localeCompare(dateB);
        }
        case 'name-asc':
          return (a.accountName || '').localeCompare(b.accountName || '');
        case 'name-desc':
          return (b.accountName || '').localeCompare(a.accountName || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [calls, filterStatus, sortBy, searchQuery, selectedMonth]);

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'saved':
        return 'badge-saved';
      case 'lost':
        return 'badge-lost';
      case 'pending':
        return 'badge-pending';
      case 'excluded':
        return 'badge-excluded';
      default:
        return 'badge-pending';
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Month filter pill bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setSelectedMonth('all')} style={{
          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          border: selectedMonth === 'all' ? `1px solid ${t.accent}` : `1px solid ${t.cardBorder}`,
          background: selectedMonth === 'all' ? 'rgba(59,130,246,0.15)' : 'transparent',
          color: selectedMonth === 'all' ? t.accent : t.muted, cursor: 'pointer',
        }}>All Time</button>
        {months.map(m => (
          <button key={m} onClick={() => setSelectedMonth(m)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: selectedMonth === m ? `1px solid ${t.accent}` : `1px solid ${t.cardBorder}`,
            background: selectedMonth === m ? 'rgba(59,130,246,0.15)' : 'transparent',
            color: selectedMonth === m ? t.accent : t.muted, cursor: 'pointer',
          }}>
            {getMonthLabel(m)}{m === currentMonth ? ' *' : ''}
          </button>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: t.fg, margin: 0 }}>All Saves</h1>
          <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 2 }}>
            {selectedMonth === 'all'
              ? `${filteredAndSorted.length} calls`
              : `${filteredAndSorted.length} of ${calls.length} calls - ${getMonthLabel(selectedMonth)}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Search names, notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: t.bg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 6,
              color: 'white',
              padding: '8px 12px',
              fontSize: 14,
              flex: 1,
              minWidth: 200,
            }}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              background: t.bg,
              border: `1px solid ${t.cardBg}`,
              color: 'white',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          >
            <option value="">All Statuses</option>
            <option value="saved">Saved</option>
            <option value="lost">Lost</option>
            <option value="pending">Pending</option>
            <option value="guarantee">Guarantee Issues</option>
            <option value="good-standing">Good Standing</option>
            <option value="bad-standing">Bad Standing</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            style={{
              background: t.bg,
              border: `1px solid ${t.cardBg}`,
              color: 'white',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          >
            <option value="date-desc">Date (Newest)</option>
            <option value="date-asc">Date (Oldest)</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.5fr',
            padding: '12px 16px',
            borderBottom: `1px solid ${t.cardBg}`,
            fontSize: '12px',
            fontWeight: 600,
            color: t.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <span>Account</span>
          <span>Save Type</span>
          <span>Status</span>
          <span>Billing</span>
          <span>Standing</span>
          <span>Actions</span>
        </div>

        {/* Table rows */}
        {filteredAndSorted.length === 0 ? (
          <div
            style={{
              padding: '48px 16px',
              textAlign: 'center',
              color: t.muted,
              fontSize: '14px',
            }}
          >
            No calls match the current filters.
          </div>
        ) : (
          filteredAndSorted.map((call: Call) => {
            const category = categorizeStatus(call.saveStatus, call.saveType);
            const standing = getStandingCategory(call.paymentStanding);
            const guarantee = hasGuaranteeIssue(call);

            return (
              <div
                key={call.id}
                onClick={() => openCallModal(call.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.5fr',
                  padding: '12px 16px',
                  borderBottom: '1px solid #1e293b20',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: t.fg,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = '#1e293b50';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                {/* Account */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: t.cardBorder,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: t.textSecondary,
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(call.accountName)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{call.accountName || 'Unknown Account'}</div>
                    <div style={{ fontSize: '11px', color: t.muted }}>{call.contactName || '-'}</div>
                  </div>
                </div>

                {/* Save Type */}
                <span style={{ color: t.textSecondary }}>{call.saveType || '-'}</span>

                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className={getCategoryBadgeClass(category)}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </span>
                  {guarantee && (
                    <span title="Guarantee Issue" style={{ color: t.warning, fontSize: '14px' }}>
                      &#9888;
                    </span>
                  )}
                </div>

                {/* Billing */}
                <span style={{ color: t.textSecondary }}>
                  ${parseFloat(call.ratePerMonth || '0').toFixed(2)}/{call.billingFrequency || 'mo'}
                </span>

                {/* Standing */}
                <span
                  style={{
                    color: standing === 'good' ? '#4ade80' : standing === 'bad' ? '#f87171' : t.muted,
                    fontWeight: 500,
                    fontSize: '12px',
                  }}
                >
                  {standing === 'good'
                    ? 'Good Standing'
                    : standing === 'bad'
                      ? 'Bad Standing'
                      : 'Unknown'}
                </span>

                {/* Actions */}
                <div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openCallModal(call.id);
                    }}
                    style={{
                      background: t.cardBg,
                      border: `1px solid ${t.cardBorder}`,
                      color: t.textSecondary,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = t.cardBorder;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = t.cardBg;
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
