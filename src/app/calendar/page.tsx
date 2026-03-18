'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { t } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  attendees: string[];
  hangoutLink: string;
}

interface DecisionInfo {
  decision: string;
  docUrl: string;
  transcriptSource: string;
}

interface DayEvent extends CalendarEvent {
  decisionInfo?: DecisionInfo;
  isClientMeeting: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DECISION_COLORS: Record<string, string> = {
  SAVED: t.success,
  LOST: t.danger,
  PENDING: t.warning,
  UNKNOWN: t.muted,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(year, month, 1 - startOffset + i));
  }
  return days;
}

function formatDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function extractClientName(summary: string): string {
  const parts = summary.split(' and ');
  if (parts.length >= 2) {
    const nonStelios = parts.find((p) => !p.toLowerCase().includes('stelios'));
    return nonStelios?.trim() || parts[0].trim();
  }
  return summary;
}

function getEventDateKey(start: string): string {
  // Handle both datetime and date-only formats
  if (start.includes('T')) {
    const d = new Date(start);
    return formatDateKey(d);
  }
  return start; // already YYYY-MM-DD
}

function getEventTime(start: string): string {
  if (!start.includes('T')) return '';
  const d = new Date(start);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getChipColor(evt: DayEvent): string {
  if (evt.decisionInfo) {
    return DECISION_COLORS[evt.decisionInfo.decision.toUpperCase()] || t.muted;
  }
  if (evt.isClientMeeting) return t.accent; // blue for client meetings
  return t.textTertiary; // gray for internal
}

function getChipBg(evt: DayEvent): string {
  const color = getChipColor(evt);
  return color + '30'; // 30 = ~19% opacity hex
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [decisionMap, setDecisionMap] = useState<Record<string, DecisionInfo>>({});
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setEvents(json.calendarEvents || []);
      setDecisionMap(json.decisionMap || {});
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Auto-navigate to current month or month with most recent client event
  useEffect(() => {
    if (initialized.current || events.length === 0) return;
    initialized.current = true;
    setCurrentMonth(new Date());
  }, [events]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const days = getCalendarDays(year, month);
  const today = formatDateKey(new Date());
  const monthLabel = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Build map of date -> events
  const eventsByDate: Record<string, DayEvent[]> = {};
  for (const evt of events) {
    const dateKey = getEventDateKey(evt.start);
    const dayEvt: DayEvent = {
      ...evt,
      decisionInfo: decisionMap[evt.id],
      isClientMeeting: evt.attendees.length > 0,
    };
    if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
    eventsByDate[dateKey].push(dayEvt);
  }

  // Sort events within each day by start time
  for (const key of Object.keys(eventsByDate)) {
    eventsByDate[key].sort((a, b) => a.start.localeCompare(b.start));
  }

  function navigateMonth(offset: number) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    setSelectedDay(null);
  }

  function goToToday() {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(formatDateKey(now));
  }

  // Selected day's events
  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] || []) : [];

  // Stats
  const clientMeetingsThisMonth = Object.entries(eventsByDate)
    .filter(([key]) => key.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
    .flatMap(([, evts]) => evts.filter((e) => e.isClientMeeting));
  const savedThisMonth = clientMeetingsThisMonth.filter((e) => e.decisionInfo?.decision === 'SAVED').length;
  const lostThisMonth = clientMeetingsThisMonth.filter((e) => e.decisionInfo?.decision === 'LOST').length;
  const pendingThisMonth = clientMeetingsThisMonth.filter((e) => {
    const d = e.decisionInfo?.decision?.toUpperCase();
    return d && d !== 'SAVED' && d !== 'LOST';
  }).length;
  const unprocessed = clientMeetingsThisMonth.filter((e) => !e.decisionInfo).length;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 16 }}>
        Loading calendar...
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Calendar</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
            {clientMeetingsThisMonth.length} client meetings this month
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{monthLabel}</span>
          <button onClick={() => navigateMonth(-1)} style={navBtnStyle}>Prev</button>
          <button onClick={goToToday} style={{ ...navBtnStyle, background: 'var(--accent)', border: '1px solid var(--accent)' }}>Today</button>
          <button onClick={() => navigateMonth(1)} style={navBtnStyle}>Next</button>
        </div>
      </div>

      {/* Month Stats Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <StatPill label="Saved" count={savedThisMonth} color="var(--success)" />
        <StatPill label="Lost" count={lostThisMonth} color="var(--danger)" />
        <StatPill label="Pending" count={pendingThisMonth} color="var(--warning)" />
        <StatPill label="Unprocessed" count={unprocessed} color="var(--muted)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedDay ? '1fr 360px' : '1fr', gap: 20 }}>
        {/* Calendar Grid */}
        <div>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 4 }}>
            {DAY_NAMES.map((name) => (
              <div key={name} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: t.textSecondary, padding: '8px 0' }}>
                {name}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
            {days.map((day, idx) => {
              const dateKey = formatDateKey(day);
              const isCurrentMonth = day.getMonth() === month;
              const isToday = dateKey === today;
              const isSelected = dateKey === selectedDay;
              const dayEvents = eventsByDate[dateKey] || [];
              const clientEvents = dayEvents.filter((e) => e.isClientMeeting);
              const visibleEvents = clientEvents.slice(0, 3);
              const overflow = clientEvents.length - 3;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDay(isSelected ? null : dateKey)}
                  style={{
                    background: isSelected ? t.cardBg : t.bg,
                    border: isSelected ? `2px solid ${t.accent}` : isToday ? `2px solid ${t.cardBorder}` : `1px solid ${t.cardBg}`,
                    minHeight: 100,
                    padding: 6,
                    opacity: isCurrentMonth ? 1 : 0.3,
                    cursor: 'pointer',
                    borderRadius: 4,
                    transition: 'background 0.1s',
                  }}
                >
                  {/* Day number */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: '50%',
                    fontSize: 13, fontWeight: isToday ? 700 : 400,
                    color: isToday ? t.statValue : t.cardBorder,
                    background: isToday ? 'var(--accent)' : 'transparent',
                    marginBottom: 4,
                  }}>
                    {day.getDate()}
                  </div>

                  {/* Event chips */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {visibleEvents.map((evt) => (
                      <div
                        key={evt.id}
                        style={{
                          background: getChipBg(evt),
                          color: getChipColor(evt),
                          fontSize: 10,
                          lineHeight: '15px',
                          padding: '1px 5px',
                          borderRadius: 4,
                          borderLeft: `3px solid ${getChipColor(evt)}`,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={evt.summary}
                      >
                        {extractClientName(evt.summary)}
                      </div>
                    ))}
                    {/* Internal event count */}
                    {dayEvents.length > clientEvents.length && (
                      <div style={{ fontSize: 9, color: t.muted, paddingLeft: 4 }}>
                        +{dayEvents.length - clientEvents.length} internal
                      </div>
                    )}
                    {overflow > 0 && (
                      <div style={{ fontSize: 9, color: t.textSecondary, paddingLeft: 4 }}>
                        +{overflow} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingLeft: 4 }}>
            <LegendItem color={t.accent} label="Client Meeting" />
            <LegendItem color={t.success} label="Saved" />
            <LegendItem color={t.danger} label="Lost" />
            <LegendItem color={t.warning} label="Pending" />
            <LegendItem color={t.textTertiary} label="Internal" />
          </div>
        </div>

        {/* Day Detail Panel */}
        {selectedDay && (
          <div className="card" style={{ padding: 20, height: 'fit-content', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18 }}>x</button>
            </div>

            {selectedEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)', fontSize: 13 }}>No events</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedEvents.map((evt) => (
                  <div
                    key={evt.id}
                    style={{
                      padding: 12,
                      background: t.bg,
                      borderRadius: 8,
                      borderLeft: `4px solid ${getChipColor(evt)}`,
                    }}
                  >
                    {/* Time + Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      {getEventTime(evt.start) && (
                        <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, minWidth: 65 }}>
                          {getEventTime(evt.start)}
                        </span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                        {evt.isClientMeeting ? extractClientName(evt.summary) : evt.summary}
                      </span>
                    </div>

                    {/* Decision badge */}
                    {evt.decisionInfo && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: (DECISION_COLORS[evt.decisionInfo.decision.toUpperCase()] || t.muted) + '25',
                          color: DECISION_COLORS[evt.decisionInfo.decision.toUpperCase()] || t.muted,
                        }}>
                          {evt.decisionInfo.decision}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: 'rgba(59,130,246,0.15)', color: 'var(--accent)',
                        }}>
                          {evt.decisionInfo.transcriptSource === 'none' ? 'No Transcript' : evt.decisionInfo.transcriptSource}
                        </span>
                      </div>
                    )}

                    {/* Attendees */}
                    {evt.attendees.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                        {evt.attendees.join(', ')}
                      </div>
                    )}

                    {/* Links */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      {evt.decisionInfo?.docUrl && (
                        <a
                          href={evt.decisionInfo.docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                            background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                            color: 'var(--accent)', textDecoration: 'none',
                          }}
                        >
                          Post-Call Doc
                        </a>
                      )}
                      {evt.hangoutLink && (
                        <a
                          href={evt.hangoutLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                            color: 'var(--success)', textDecoration: 'none',
                          }}
                        >
                          Join Call
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const navBtnStyle: React.CSSProperties = {
  background: t.cardBg,
  border: `1px solid ${t.cardBorder}`,
  color: t.fg,
  borderRadius: 6,
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: 14,
};

function StatPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 14px', background: color + '15', borderRadius: 20,
      border: `1px solid ${color}30`,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{count}</span>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
    </div>
  );
}
