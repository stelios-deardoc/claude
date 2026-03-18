'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { t } from '@/lib/theme';
import { useCallTracker } from '@/lib/store';
import {
  categorizeStatus,
  getStandingCategory,
  hasGuaranteeIssue,
  hasAccountingChanges,
  getContractValue,
  getInitials,
  getCallMonth,
  getMonthLabel,
  getLast6Months,
  getCurrentMonth,
} from '@/lib/call-utils';
import { Call } from '@/lib/types';

interface KanbanColumn {
  title: string;
  color: string;
  calls: Call[];
  droppable: boolean;
  statusValue: string;
  totalMRR: number;
}

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getDaysPending(call: Call): number {
  const dateStr = call.saveDateTime || call.importDate;
  if (!dateStr) return 0;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 0;
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function getDaysPendingColor(days: number): string {
  if (days >= 14) return t.danger;
  if (days >= 7) return t.warning;
  return t.accent;
}

export default function KanbanPage() {
  const { calls, openCallModal, updateCall } = useCallTracker();
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const months = useMemo(() => getLast6Months(), []);
  const currentMonth = useMemo(() => getCurrentMonth(), []);
  const filteredCalls = useMemo(() => {
    if (selectedMonth === 'all') return calls;
    return calls.filter(c => getCallMonth(c) === selectedMonth);
  }, [calls, selectedMonth]);

  // Click-outside handler for status menu
  useEffect(() => {
    if (!statusMenuId) return;
    const handler = () => setStatusMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [statusMenuId]);

  const toggleCollapse = useCallback((title: string) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }, []);

  const columns = useMemo<KanbanColumn[]>(() => {
    const saved: Call[] = [];
    const lost: Call[] = [];
    const pending: Call[] = [];
    const guarantee: Call[] = [];
    const badStanding: Call[] = [];

    filteredCalls.forEach((c) => {
      const status = categorizeStatus(c.saveStatus, c.saveType);
      if (status === 'saved') saved.push(c);
      if (status === 'lost') lost.push(c);
      if (status === 'pending') pending.push(c);
      if (hasGuaranteeIssue(c)) guarantee.push(c);
      if (getStandingCategory(c.paymentStanding) === 'bad') badStanding.push(c);
    });

    const sumMRR = (arr: Call[]) => arr.reduce((sum, c) => sum + getContractValue(c), 0);

    return [
      { title: 'Saved', color: t.success, calls: saved, droppable: true, statusValue: 'Closed Won', totalMRR: sumMRR(saved) },
      { title: 'Lost', color: t.danger, calls: lost, droppable: true, statusValue: 'Closed Lost', totalMRR: sumMRR(lost) },
      { title: 'Pending', color: t.warning, calls: pending, droppable: true, statusValue: 'Open', totalMRR: sumMRR(pending) },
      { title: 'Guarantee Issues', color: '#a855f7', calls: guarantee, droppable: false, statusValue: '', totalMRR: sumMRR(guarantee) },
      { title: 'Bad Standing', color: '#f97316', calls: badStanding, droppable: false, statusValue: '', totalMRR: sumMRR(badStanding) },
    ];
  }, [filteredCalls]);

  const handleDragOver = useCallback((e: React.DragEvent, col: KanbanColumn) => {
    if (!col.droppable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(col.title);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, col: KanbanColumn) => {
    // Only clear if we're actually leaving the column, not entering a child
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as Node).contains(related)) return;
    setDragOverCol((prev) => (prev === col.title ? null : prev));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, col: KanbanColumn) => {
    if (!col.droppable) return;
    e.preventDefault();
    const callId = e.dataTransfer.getData('text/plain');
    if (callId) {
      updateCall(callId, { saveStatus: col.statusValue });
    }
    setDragOverCol(null);
  }, [updateCall]);

  const handleQuickStatus = useCallback((callId: string, newStatus: string) => {
    updateCall(callId, { saveStatus: newStatus });
    setStatusMenuId(null);
  }, [updateCall]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Month filter pill bar */}
      <div style={{ padding: '16px 24px 0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: t.textSecondary }}>
            {selectedMonth === 'all'
              ? `${calls.length} total calls`
              : `${filteredCalls.length} of ${calls.length} calls - ${getMonthLabel(selectedMonth)}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 0, flexWrap: 'wrap' }}>
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
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-border {
          0%, 100% { border-color: #ef4444; }
          50% { border-color: #1e293b; }
        }
        .kanban-card-urgent {
          animation: pulse-border 2s ease-in-out infinite;
        }
      `}} />

      {/* Kanban columns */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          padding: 24,
          overflowX: 'auto',
          flex: 1,
          minHeight: 0,
        }}
      >

      {columns.map((col) => {
        const isCollapsed = collapsedCols.has(col.title);
        const isDragOver = dragOverCol === col.title;

        if (isCollapsed) {
          return (
            <div
              key={col.title}
              onClick={() => toggleCollapse(col.title)}
              onDragOver={(e) => handleDragOver(e, col)}
              onDragLeave={(e) => handleDragLeave(e, col)}
              onDrop={(e) => handleDrop(e, col)}
              style={{
                width: 48,
                minWidth: 48,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingTop: 16,
                gap: 8,
                borderLeft: `3px solid ${col.color}`,
                borderRadius: 8,
                background: t.bg,
                cursor: 'pointer',
                border: isDragOver && col.droppable
                  ? `2px dashed ${t.accent}`
                  : `1px solid transparent`,
                borderLeftWidth: isDragOver && col.droppable ? 2 : 3,
                borderLeftStyle: isDragOver && col.droppable ? 'dashed' : 'solid',
                borderLeftColor: isDragOver && col.droppable ? t.accent : col.color,
              }}
            >
              <span
                style={{
                  background: col.color + '22',
                  color: col.color,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 10,
                }}
              >
                {col.calls.length}
              </span>
              <span
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  fontWeight: 700,
                  fontSize: 13,
                  color: t.fg,
                  letterSpacing: 0.5,
                }}
              >
                {col.title}
              </span>
            </div>
          );
        }

        return (
          <div
            key={col.title}
            onDragOver={(e) => handleDragOver(e, col)}
            onDragLeave={(e) => handleDragLeave(e, col)}
            onDrop={(e) => handleDrop(e, col)}
            style={{
              flex: 1,
              minWidth: 240,
              display: 'flex',
              flexDirection: 'column',
              borderLeft: isDragOver && col.droppable
                ? `2px dashed ${t.accent}`
                : `3px solid ${col.color}`,
              borderRadius: 8,
              background: isDragOver && col.droppable ? '#0d1528' : t.bg,
              border: isDragOver && col.droppable
                ? `2px dashed ${t.accent}`
                : undefined,
              borderLeftWidth: isDragOver && col.droppable ? undefined : 3,
              borderLeftStyle: isDragOver && col.droppable ? undefined : 'solid',
              borderLeftColor: isDragOver && col.droppable ? undefined : col.color,
              transition: 'background 0.15s, border 0.15s',
            }}
          >
            {/* Column header */}
            <div
              onClick={() => toggleCollapse(col.title)}
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 1,
                background: isDragOver && col.droppable ? '#0d1528' : t.bg,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderBottom: `1px solid ${t.cardBg}`,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 14, color: t.fg }}>
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
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.textSecondary,
                }}
              >
                {formatCurrency(col.totalMRR)}
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
                    color: t.textTertiary,
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
                    statusMenuId={statusMenuId}
                    onStatusMenuToggle={(id) => setStatusMenuId(id)}
                    onQuickStatus={handleQuickStatus}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function KanbanCard({
  call,
  onClick,
  statusMenuId,
  onStatusMenuToggle,
  onQuickStatus,
}: {
  call: Call;
  onClick: () => void;
  statusMenuId: string | null;
  onStatusMenuToggle: (id: string | null) => void;
  onQuickStatus: (callId: string, status: string) => void;
}) {
  const standing = getStandingCategory(call.paymentStanding);
  const standingLabel =
    standing === 'good' ? 'Good' : standing === 'bad' ? 'Bad' : 'Unknown';
  const standingColor =
    standing === 'good' ? t.success : standing === 'bad' ? t.danger : t.muted;

  const mrr = getContractValue(call);
  const hasAcctChanges = hasAccountingChanges(call);
  const rawNotes = call.notes || call.accountingNotes || '';
  const notesPreview = rawNotes.length > 80 ? rawNotes.slice(0, 80) + '...' : rawNotes;

  const status = categorizeStatus(call.saveStatus, call.saveType);
  const daysPending = status === 'pending' ? getDaysPending(call) : 0;
  const isUrgent = status === 'pending' && daysPending >= 14;
  const showDaysBadge = status === 'pending';
  const isMenuOpen = statusMenuId === call.id;

  const [isHovered, setIsHovered] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', call.id);
    e.dataTransfer.effectAllowed = 'move';
    (e.currentTarget as HTMLDivElement).style.opacity = '0.4';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLDivElement).style.opacity = '1';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={isUrgent ? 'kanban-card-urgent' : undefined}
      style={{
        position: 'relative',
        background: t.bg,
        border: isUrgent ? `1px solid ${t.danger}` : `1px solid ${t.cardBg}`,
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        borderColor: isHovered && !isUrgent ? t.cardBorder : undefined,
      }}
    >
      {/* Top row: account name + "..." button */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 13,
            color: t.fg,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
          }}
        >
          {call.accountName || 'Unnamed Account'}
        </div>

        {/* Quick status "..." button - visible on hover */}
        <div
          style={{
            opacity: isHovered || isMenuOpen ? 1 : 0,
            transition: 'opacity 0.15s',
            position: 'relative',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStatusMenuToggle(isMenuOpen ? null : call.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: t.textSecondary,
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 700,
              padding: '0 4px',
              lineHeight: 1,
              letterSpacing: 1,
            }}
          >
            ...
          </button>

          {/* Status popover */}
          {isMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                zIndex: 20,
                background: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 8,
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minWidth: 130,
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickStatus(call.id, 'Closed Won');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: t.success,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '6px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#22c55e18'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              >
                Mark Saved
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickStatus(call.id, 'Closed Lost');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: t.danger,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '6px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#ef444418'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              >
                Mark Lost
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickStatus(call.id, 'Open');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: t.warning,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '6px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f59e0b18'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              >
                Mark Pending
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contact name */}
      {call.contactName && (
        <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>
          {call.contactName}
        </div>
      )}

      {/* Save type */}
      {call.saveType && (
        <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>
          {call.saveType}
        </div>
      )}

      {/* MRR + standing row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: showDaysBadge || hasAcctChanges || notesPreview ? 6 : 0,
        }}
      >
        <span style={{ fontSize: 13, color: t.cardBorder, fontWeight: 600 }}>
          {formatCurrency(mrr)}
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

      {/* Days pending badge */}
      {showDaysBadge && (
        <div style={{ marginBottom: 4 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: getDaysPendingColor(daysPending),
              background: getDaysPendingColor(daysPending) + '18',
              padding: '1px 6px',
              borderRadius: 6,
            }}
          >
            {daysPending}d pending
          </span>
        </div>
      )}

      {/* Accounting changes indicator */}
      {hasAcctChanges && (
        <div style={{ marginBottom: 4 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#38bdf8',
              background: '#38bdf818',
              padding: '1px 6px',
              borderRadius: 6,
            }}
          >
            Accounting Changes
          </span>
        </div>
      )}

      {/* Notes preview */}
      {notesPreview && (
        <div
          style={{
            fontSize: 11,
            color: t.muted,
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
