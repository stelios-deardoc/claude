'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { t } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProcessedEvent {
  id: string;
  event_title: string;
  event_end_time: string;
  status: string;
  first_detected: string;
  retry_count: number;
  last_retry: string | null;
  transcript_source: string;
  output_doc_url: string;
  decision: string;
  error_notes: string | null;
}

interface AccountNote {
  date: string;
  practiceName: string;
  contact: string;
  activity: string;
  decision: string;
  keyDetails: string;
  mrrAtRisk: string;
  status: string;
  nextSteps: string;
  offersMade: string;
}

interface SaveDeskData {
  events: ProcessedEvent[];
  lastCheckTime: string | null;
  accountNotes: AccountNote[];
  counts: {
    total: number;
    saved: number;
    lost: number;
    pending: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDecisionColor(decision: string): string {
  switch (decision.toUpperCase()) {
    case 'SAVED':
      return 'var(--success)';
    case 'LOST':
      return 'var(--danger)';
    case 'PENDING':
    case 'IN-PROGRESS':
      return 'var(--warning)';
    default:
      return 'var(--muted)';
  }
}

function getDecisionBg(decision: string): string {
  switch (decision.toUpperCase()) {
    case 'SAVED':
      return 'rgba(34,197,94,0.15)';
    case 'LOST':
      return 'rgba(239,68,68,0.15)';
    case 'PENDING':
    case 'IN-PROGRESS':
      return 'rgba(245,158,11,0.15)';
    default:
      return 'rgba(100,116,139,0.15)';
  }
}

function getSourceLabel(source: string): string {
  switch (source) {
    case 'fyxer':
      return 'Fyxer';
    case 'loom':
      return 'Loom';
    case 'fireflies':
      return 'Fireflies';
    case 'none':
      return 'No Transcript';
    default:
      return source || 'N/A';
  }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ' at ' + d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function extractClientName(title: string): string {
  // Titles are like "Nathan Tanner and Stelios Anastasiades"
  const parts = title.split(' and ');
  if (parts.length >= 2) {
    // Return the part that is NOT Stelios
    const nonStelios = parts.find(
      (p) => !p.toLowerCase().includes('stelios'),
    );
    return nonStelios?.trim() || parts[0].trim();
  }
  return title;
}

function parseAccountNotes(raw: string): AccountNote[] {
  const entries: AccountNote[] = [];
  // Split by "---" separator then look for ## headings
  const sections = raw.split(/^---$/m);

  for (const section of sections) {
    const headingMatch = section.match(
      /^##\s+\[(\d{4}-\d{2}-\d{2})\]\s+(.+)$/m,
    );
    if (!headingMatch) continue;

    const date = headingMatch[1];
    const practiceName = headingMatch[2].trim();

    const getField = (label: string): string => {
      const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+?)(?=\\n|$)`, 'i');
      const m = section.match(re);
      return m ? m[1].trim() : '';
    };

    entries.push({
      date,
      practiceName,
      contact: getField('Contact'),
      activity: getField('Activity'),
      decision: getField('Decision'),
      keyDetails: getField('Key Details'),
      mrrAtRisk: getField('MRR at Risk'),
      status: getField('Status'),
      nextSteps: getField('Next Steps?'),
      offersMade: getField('Offers Made'),
    });
  }

  return entries;
}

function parseApiResponse(data: {
  postCallState: {
    processed_events: Record<string, Record<string, unknown>>;
    last_check_time: string;
  } | null;
  accountNotes: string | null;
}): SaveDeskData {
  const events: ProcessedEvent[] = [];
  let lastCheckTime: string | null = null;

  if (data.postCallState) {
    lastCheckTime = data.postCallState.last_check_time;
    for (const [id, evt] of Object.entries(
      data.postCallState.processed_events,
    )) {
      events.push({
        id,
        event_title: (evt.event_title as string) || '',
        event_end_time: (evt.event_end_time as string) || '',
        status: (evt.status as string) || '',
        first_detected: (evt.first_detected as string) || '',
        retry_count: (evt.retry_count as number) || 0,
        last_retry: (evt.last_retry as string) || null,
        transcript_source: (evt.transcript_source as string) || 'none',
        output_doc_url: (evt.output_doc_url as string) || '',
        decision: (evt.decision as string) || 'UNKNOWN',
        error_notes: (evt.error_notes as string) || null,
      });
    }
  }

  // Sort by event end time descending (most recent first)
  events.sort(
    (a, b) =>
      new Date(b.event_end_time).getTime() -
      new Date(a.event_end_time).getTime(),
  );

  const accountNotes = data.accountNotes
    ? parseAccountNotes(data.accountNotes)
    : [];

  const saved = events.filter(
    (e) => e.decision.toUpperCase() === 'SAVED',
  ).length;
  const lost = events.filter(
    (e) => e.decision.toUpperCase() === 'LOST',
  ).length;
  const pending = events.filter((e) => {
    const d = e.decision.toUpperCase();
    return d !== 'SAVED' && d !== 'LOST';
  }).length;

  return {
    events,
    lastCheckTime,
    accountNotes,
    counts: { total: events.length, saved, lost, pending },
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrackerPage() {
  const [data, setData] = useState<SaveDeskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/save-desk', { cache: 'no-store' });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = await res.json();
      setData(parseApiResponse(json));
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + 30s polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
          fontSize: 16,
        }}
      >
        Loading save desk data...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: 'var(--muted)',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--danger)' }}>
          Error loading data
        </div>
        <div style={{ fontSize: 14 }}>{error}</div>
        <button
          onClick={fetchData}
          style={{
            marginTop: 8,
            padding: '8px 20px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const counts = data?.counts || { total: 0, saved: 0, lost: 0, pending: 0 };
  const events = data?.events || [];
  const accountNotes = data?.accountNotes || [];

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            Save Desk Tracker
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
            Real-time post-call activity dashboard
            {lastRefresh && (
              <span>
                {' -- '}last refreshed{' '}
                {lastRefresh.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchData}
          style={{
            padding: '8px 16px',
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 8,
            color: 'var(--foreground)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Calls Processed
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--foreground)' }}>
            {counts.total}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Saved
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--success)' }}>
            {counts.saved}
          </div>
          <div
            style={{
              marginTop: 4,
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(34,197,94,0.15)',
              color: 'var(--success)',
            }}
          >
            SAVED
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Lost
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--danger)' }}>
            {counts.lost}
          </div>
          <div
            style={{
              marginTop: 4,
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(239,68,68,0.15)',
              color: 'var(--danger)',
            }}
          >
            LOST
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Pending
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--warning)' }}>
            {counts.pending}
          </div>
          <div
            style={{
              marginTop: 4,
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(245,158,11,0.15)',
              color: 'var(--warning)',
            }}
          >
            PENDING
          </div>
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            Live Activity Feed
          </h2>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Post-call events from post-call-state.json
          </span>
        </div>

        {events.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--muted)',
              fontSize: 14,
            }}
          >
            No processed events yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {events.map((evt) => (
              <div
                key={evt.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  padding: '14px 16px',
                  background: t.bg,
                  borderRadius: 8,
                  border: '1px solid var(--card-border)',
                }}
              >
                {/* Decision dot */}
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: getDecisionColor(evt.decision),
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      {extractClientName(evt.event_title)}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: getDecisionBg(evt.decision),
                        color: getDecisionColor(evt.decision),
                      }}
                    >
                      {evt.decision}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'rgba(59,130,246,0.15)',
                        color: 'var(--accent)',
                      }}
                    >
                      {getSourceLabel(evt.transcript_source)}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--muted)',
                      marginBottom: evt.error_notes ? 6 : 0,
                    }}
                  >
                    {formatDateTime(evt.event_end_time)}
                    {evt.retry_count > 0 && (
                      <span>
                        {' -- '}{evt.retry_count} retries
                      </span>
                    )}
                  </div>

                  {evt.error_notes && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--foreground)',
                        opacity: 0.8,
                        lineHeight: 1.5,
                        maxWidth: 700,
                      }}
                    >
                      {evt.error_notes.length > 200
                        ? evt.error_notes.slice(0, 200) + '...'
                        : evt.error_notes}
                    </div>
                  )}
                </div>

                {/* Google Doc link */}
                {evt.output_doc_url && (
                  <a
                    href={evt.output_doc_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      flexShrink: 0,
                      padding: '6px 12px',
                      background: 'rgba(59,130,246,0.15)',
                      border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: 6,
                      color: 'var(--accent)',
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Open Doc
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account Notes Section */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            Account Notes
          </h2>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Parsed from account_notes.md -- {accountNotes.length} entries
          </span>
        </div>

        {accountNotes.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--muted)',
              fontSize: 14,
            }}
          >
            No account notes found
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: 14,
            }}
          >
            {accountNotes.map((note, idx) => {
              const decisionText =
                note.decision || note.status || 'Unknown';
              const decisionKey = decisionText.toUpperCase().includes('SAVED')
                ? 'SAVED'
                : decisionText.toUpperCase().includes('LOST')
                ? 'LOST'
                : decisionText.toUpperCase().includes('UNKNOWN')
                ? 'UNKNOWN'
                : 'PENDING';

              return (
                <div
                  key={`${note.date}-${note.practiceName}-${idx}`}
                  style={{
                    padding: 16,
                    background: t.bg,
                    borderRadius: 8,
                    border: '1px solid var(--card-border)',
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      {note.practiceName}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: getDecisionBg(decisionKey),
                        color: getDecisionColor(decisionKey),
                      }}
                    >
                      {decisionKey}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 12,
                      color: 'var(--muted)',
                      marginBottom: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{note.date}</span>
                    {note.contact && (
                      <>
                        <span style={{ opacity: 0.4 }}>|</span>
                        <span>{note.contact}</span>
                      </>
                    )}
                    {note.mrrAtRisk && (
                      <>
                        <span style={{ opacity: 0.4 }}>|</span>
                        <span
                          style={{
                            color: decisionKey === 'SAVED'
                              ? 'var(--success)'
                              : 'var(--warning)',
                            fontWeight: 600,
                          }}
                        >
                          {note.mrrAtRisk}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Key details */}
                  {note.keyDetails && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--foreground)',
                        opacity: 0.8,
                        lineHeight: 1.5,
                        marginBottom: 8,
                      }}
                    >
                      {note.keyDetails.length > 250
                        ? note.keyDetails.slice(0, 250) + '...'
                        : note.keyDetails}
                    </div>
                  )}

                  {/* Offers */}
                  {note.offersMade && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--accent)',
                        marginBottom: 4,
                      }}
                    >
                      Offers: {note.offersMade.length > 120
                        ? note.offersMade.slice(0, 120) + '...'
                        : note.offersMade}
                    </div>
                  )}

                  {/* Next steps */}
                  {note.nextSteps && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--muted)',
                        fontStyle: 'italic',
                      }}
                    >
                      Next: {note.nextSteps.length > 120
                        ? note.nextSteps.slice(0, 120) + '...'
                        : note.nextSteps}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Last check time footer */}
      {data?.lastCheckTime && (
        <div
          style={{
            textAlign: 'center',
            padding: '16px 0',
            fontSize: 12,
            color: 'var(--muted)',
          }}
        >
          Post-call monitor last ran: {formatDateTime(data.lastCheckTime)}
        </div>
      )}
    </div>
  );
}
