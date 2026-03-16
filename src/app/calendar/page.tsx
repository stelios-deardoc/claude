'use client';

import { useEffect, useRef, useState } from 'react';
import { useCallTracker } from '@/lib/store';
import { categorizeStatus, parseDate } from '@/lib/call-utils';
import { Call } from '@/lib/types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_COLORS: Record<string, string> = {
  saved: '#22c55e',
  lost: '#ef4444',
  pending: '#f59e0b',
  other: '#64748b',
};

function getCallDate(call: Call): string | null {
  const raw = call.saveDateTime || call.meetingDate || '';
  const parsed = parseDate(raw);
  if (!parsed) return null;
  const d = new Date(parsed);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - startOffset + i);
    days.push(d);
  }
  return days;
}

function formatDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getStatusColor(call: Call): string {
  const status = categorizeStatus(call.saveStatus, call.saveType);
  if (status === 'saved') return STATUS_COLORS.saved;
  if (status === 'lost') return STATUS_COLORS.lost;
  if (status === 'pending') return STATUS_COLORS.pending;
  return STATUS_COLORS.other;
}

export default function CalendarPage() {
  const { calls, openCallModal } = useCallTracker();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const initialized = useRef(false);

  // Auto-navigate to the month of the most recent call on first render
  useEffect(() => {
    if (initialized.current || !calls || calls.length === 0) return;
    initialized.current = true;

    let mostRecent: Date | null = null;
    for (const c of calls) {
      const raw = c.saveDateTime || c.meetingDate || '';
      const parsed = parseDate(raw);
      if (!parsed) continue;
      const d = new Date(parsed);
      if (isNaN(d.getTime())) continue;
      if (!mostRecent || d > mostRecent) {
        mostRecent = d;
      }
    }
    if (mostRecent) {
      setCurrentMonth(new Date(mostRecent.getFullYear(), mostRecent.getMonth(), 1));
    }
  }, [calls]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const days = getCalendarDays(year, month);
  const today = formatDateKey(new Date());

  const monthLabel = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Build a map of date -> calls
  const callsByDate: Record<string, Call[]> = {};
  if (calls) {
    for (const call of calls) {
      const saveDateKey = call.saveDateTime ? parseDate(call.saveDateTime) : '';
      const meetDateKey = call.meetingDate ? parseDate(call.meetingDate) : '';
      const keys = new Set<string>();
      if (saveDateKey) keys.add(saveDateKey);
      if (meetDateKey) keys.add(meetDateKey);
      for (const key of keys) {
        if (!callsByDate[key]) callsByDate[key] = [];
        if (!callsByDate[key].find((c) => c.id === call.id)) {
          callsByDate[key].push(call);
        }
      }
    }
  }

  function navigateMonth(offset: number) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  }

  function goToToday() {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Calendar</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{monthLabel}</span>
          <button
            onClick={() => navigateMonth(-1)}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#e2e8f0',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Prev
          </button>
          <button
            onClick={goToToday}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#e2e8f0',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Today
          </button>
          <button
            onClick={() => navigateMonth(1)}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#e2e8f0',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Next
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 1,
          marginBottom: 4,
        }}
      >
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            style={{
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 600,
              color: '#94a3b8',
              padding: '8px 0',
            }}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 1,
        }}
      >
        {days.map((day, idx) => {
          const dateKey = formatDateKey(day);
          const isCurrentMonth = day.getMonth() === month;
          const isToday = dateKey === today;
          const dayCalls = callsByDate[dateKey] || [];
          const visibleCalls = dayCalls.slice(0, 3);
          const overflow = dayCalls.length - 3;

          return (
            <div
              key={idx}
              style={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                minHeight: 100,
                padding: 6,
                opacity: isCurrentMonth ? 1 : 0.3,
                position: 'relative',
              }}
            >
              {/* Day number */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  fontSize: 13,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? '#3b82f6' : '#cbd5e1',
                  border: isToday ? '2px solid #3b82f6' : 'none',
                  marginBottom: 4,
                }}
              >
                {day.getDate()}
              </div>

              {/* Call chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {visibleCalls.map((call) => (
                  <div
                    key={call.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      openCallModal(call.id);
                    }}
                    style={{
                      background: getStatusColor(call),
                      color: '#fff',
                      fontSize: 11,
                      lineHeight: '16px',
                      padding: '1px 6px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={call.accountName || call.id}
                  >
                    {call.accountName || call.id}
                  </div>
                ))}
                {overflow > 0 && (
                  <div
                    style={{
                      fontSize: 10,
                      color: '#94a3b8',
                      paddingLeft: 4,
                    }}
                  >
                    +{overflow} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
