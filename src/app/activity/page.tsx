'use client';

import React, { useState, useEffect, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionItem {
  id: string;
  priority: number;
  urgency: string;
  account: string;
  contact: string;
  email: string;
  task: string;
  details: string;
  decision: string;
  mrrAtRisk: string;
  deadline: string;
  category: string;
  docUrl: string;
  completed: boolean;
  parentAction?: string;
  postSaveNotes?: Record<string, string>;
}

interface AccountGroup {
  account: string;
  decision: string;
  contact: string;
  email: string;
  mrrAtRisk: string;
  completedActions: ActionItem[];
  nextActions: ActionItem[];
  allActions: ActionItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ViewFilter = 'all' | 'needs-action' | 'saved' | 'lost' | 'pending';

function getDecisionStyle(decision: string): { color: string; bg: string; border: string } {
  switch (decision.toUpperCase()) {
    case 'SAVED': return { color: '#22c55e', bg: 'rgba(34,197,94,0.15)', border: '#22c55e' };
    case 'LOST': return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: '#ef4444' };
    case 'PENDING': return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: '#f59e0b' };
    default: return { color: '#64748b', bg: 'rgba(100,116,139,0.15)', border: '#64748b' };
  }
}

function getUrgencyDot(urgency: string): { color: string; pulse: boolean } {
  switch (urgency) {
    case 'NOW': return { color: '#ef4444', pulse: true };
    case 'TODAY': return { color: '#f59e0b', pulse: false };
    case 'THIS_WEEK': return { color: '#3b82f6', pulse: false };
    default: return { color: '#64748b', pulse: false };
  }
}

function getCategoryIcon(category: string): string {
  switch (category) {
    case 'email': return '\u2709';
    case 'internal': return '\u2699';
    case 'salesforce': return '\u2601';
    case 'follow-up': return '\u260E';
    case 'meeting': return '\uD83D\uDCC5';
    default: return '\u25CF';
  }
}

function getStepLabel(action: ActionItem): string {
  const task = action.task.toUpperCase();
  if (task.startsWith('FINALIZE')) return 'Finalize';
  if (task.startsWith('FOLLOW UP')) return 'Follow Up';
  if (task.startsWith('CLOSE OUT')) return 'Close Out';
  if (task.startsWith('ESCALATION')) return 'Escalation';
  if (action.category === 'email') return 'Email';
  if (action.category === 'meeting') return 'Meeting';
  if (action.category === 'internal') return 'Internal';
  if (action.category === 'salesforce') return 'Salesforce';
  return 'Action';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActivityFeed() {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [filter, setFilter] = useState<ViewFilter>('all');
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetch('/api/actions')
      .then(r => r.json())
      .then((data: { actions: ActionItem[] }) => setActions(data.actions || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Group actions by account
  const accountGroups = useMemo(() => {
    const groups: Record<string, ActionItem[]> = {};
    for (const action of actions) {
      const key = action.account;
      if (!groups[key]) groups[key] = [];
      groups[key].push(action);
    }

    const result: AccountGroup[] = [];
    for (const [account, items] of Object.entries(groups)) {
      // Use the most significant decision
      const decisions = items.map(i => i.decision.toUpperCase());
      let decision = 'UNKNOWN';
      if (decisions.includes('SAVED')) decision = 'SAVED';
      else if (decisions.includes('LOST')) decision = 'LOST';
      else if (decisions.includes('PENDING')) decision = 'PENDING';

      const completedActions = items.filter(i => i.completed);
      const nextActions = items.filter(i => !i.completed);

      // Get best contact/email from the group
      const withEmail = items.find(i => i.email) || items[0];

      result.push({
        account,
        decision,
        contact: withEmail.contact,
        email: withEmail.email,
        mrrAtRisk: withEmail.mrrAtRisk,
        completedActions,
        nextActions,
        allActions: items,
      });
    }

    // Sort: needs-action first (has incomplete items), then by urgency
    result.sort((a, b) => {
      // Accounts with next actions first
      if (a.nextActions.length > 0 && b.nextActions.length === 0) return -1;
      if (a.nextActions.length === 0 && b.nextActions.length > 0) return 1;
      // Then by highest urgency of next actions
      const urgencyOrder: Record<string, number> = { 'NOW': 0, 'TODAY': 1, 'THIS_WEEK': 2, 'NEXT_WEEK': 3 };
      const aUrg = Math.min(...a.nextActions.map(n => urgencyOrder[n.urgency] ?? 4));
      const bUrg = Math.min(...b.nextActions.map(n => urgencyOrder[n.urgency] ?? 4));
      return aUrg - bUrg;
    });

    return result;
  }, [actions]);

  // Filter
  const filtered = useMemo(() => {
    switch (filter) {
      case 'needs-action': return accountGroups.filter(g => g.nextActions.length > 0);
      case 'saved': return accountGroups.filter(g => g.decision === 'SAVED');
      case 'lost': return accountGroups.filter(g => g.decision === 'LOST');
      case 'pending': return accountGroups.filter(g => g.decision === 'PENDING' || g.decision === 'UNKNOWN');
      default: return accountGroups;
    }
  }, [accountGroups, filter]);

  // Stats
  const stats = useMemo(() => {
    const needsAction = accountGroups.filter(g => g.nextActions.length > 0).length;
    const saved = accountGroups.filter(g => g.decision === 'SAVED').length;
    const lost = accountGroups.filter(g => g.decision === 'LOST').length;
    const pending = accountGroups.filter(g => g.decision === 'PENDING' || g.decision === 'UNKNOWN').length;
    const totalNext = accountGroups.reduce((sum, g) => sum + g.nextActions.length, 0);
    return { needsAction, saved, lost, pending, totalNext, total: accountGroups.length };
  }, [accountGroups]);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>Activity Feed</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            {stats.total} accounts -- {stats.totalNext} actions pending -- {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {stats.needsAction > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8,
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#ef4444',
              animation: 'pulse-dot 2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
              {stats.needsAction} need action
            </span>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Need Action', value: stats.needsAction, color: '#ef4444' },
          { label: 'Saved', value: stats.saved, color: '#22c55e' },
          { label: 'Lost', value: stats.lost, color: '#ef4444' },
          { label: 'Pending', value: stats.pending, color: '#f59e0b' },
          { label: 'Total Accounts', value: stats.total, color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: 10, padding: '12px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {([
          { key: 'all' as ViewFilter, label: 'All Accounts' },
          { key: 'needs-action' as ViewFilter, label: `Needs Action (${stats.needsAction})` },
          { key: 'saved' as ViewFilter, label: 'Saved' },
          { key: 'lost' as ViewFilter, label: 'Lost' },
          { key: 'pending' as ViewFilter, label: 'Pending' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
              border: filter === tab.key ? '1px solid #3b82f6' : '1px solid #334155',
              background: filter === tab.key ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: filter === tab.key ? '#3b82f6' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Account cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(group => {
          const style = getDecisionStyle(group.decision);
          const isExpanded = expandedAccount === group.account;
          const hasNext = group.nextActions.length > 0;
          const topUrgency = hasNext
            ? group.nextActions.reduce((best, a) => {
                const order: Record<string, number> = { 'NOW': 0, 'TODAY': 1, 'THIS_WEEK': 2 };
                return (order[a.urgency] ?? 3) < (order[best.urgency] ?? 3) ? a : best;
              })
            : null;

          return (
            <div key={group.account} style={{
              background: '#1e293b', border: '1px solid #334155',
              borderLeft: `4px solid ${style.border}`,
              borderRadius: 10, overflow: 'hidden',
            }}>
              {/* Account header - always visible */}
              <div
                onClick={() => setExpandedAccount(isExpanded ? null : group.account)}
                style={{
                  padding: '16px 20px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}
              >
                {/* Progress circle */}
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: hasNext ? '#334155' : style.bg,
                  border: `2px solid ${hasNext ? '#64748b' : style.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {!hasNext ? (
                    <span style={{ fontSize: 18, color: style.color }}>
                      {group.decision === 'SAVED' ? '\u2714' : group.decision === 'LOST' ? '\u2718' : '\u2713'}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
                      {group.completedActions.length}/{group.allActions.length}
                    </span>
                  )}
                </div>

                {/* Account info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{group.account}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: style.bg, color: style.color, textTransform: 'uppercase',
                    }}>
                      {group.decision}
                    </span>
                    {hasNext && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                      }}>
                        {group.nextActions.length} step{group.nextActions.length > 1 ? 's' : ''} remaining
                      </span>
                    )}
                    {!hasNext && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                      }}>
                        All done
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                    {group.contact}{group.mrrAtRisk ? ` -- ${group.mrrAtRisk}` : ''}
                  </div>

                  {/* Next action preview (when collapsed) */}
                  {!isExpanded && topUrgency && (
                    <div style={{
                      marginTop: 8, padding: '8px 12px', borderRadius: 6,
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          ...getUrgencyDot(topUrgency.urgency),
                          width: 6, height: 6, borderRadius: '50%',
                          background: getUrgencyDot(topUrgency.urgency).color,
                        }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>NEXT:</span>
                        <span style={{ fontSize: 12, color: '#cbd5e1' }}>
                          {topUrgency.task.length > 80 ? topUrgency.task.slice(0, 77) + '...' : topUrgency.task}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expand arrow */}
                <span style={{
                  fontSize: 16, color: '#64748b', transition: 'transform 0.2s',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  flexShrink: 0,
                }}>
                  {'\u25BC'}
                </span>
              </div>

              {/* Expanded: workflow timeline */}
              {isExpanded && (
                <div style={{
                  borderTop: '1px solid #334155', padding: '16px 20px 20px',
                  background: 'rgba(15,23,42,0.5)',
                }}>
                  {/* Completed steps */}
                  {group.completedActions.length > 0 && (
                    <div style={{ marginBottom: group.nextActions.length > 0 ? 16 : 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#22c55e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Completed ({group.completedActions.length})
                      </div>
                      {group.completedActions.map(action => (
                        <div key={action.id} style={{
                          display: 'flex', gap: 10, padding: '8px 0',
                          borderBottom: '1px solid rgba(51,65,85,0.5)',
                          opacity: 0.7,
                        }}>
                          <span style={{ fontSize: 14, color: '#22c55e', flexShrink: 0, marginTop: 1 }}>{'\u2714'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
                                background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                              }}>
                                {getStepLabel(action)}
                              </span>
                              <span style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'line-through' }}>
                                {action.task.length > 90 ? action.task.slice(0, 87) + '...' : action.task}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Next steps */}
                  {group.nextActions.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Next Steps ({group.nextActions.length})
                      </div>
                      {group.nextActions.map((action, idx) => {
                        const urgDot = getUrgencyDot(action.urgency);
                        return (
                          <div key={action.id} style={{
                            display: 'flex', gap: 10, padding: '10px 12px',
                            background: idx === 0 ? 'rgba(239,68,68,0.08)' : 'transparent',
                            border: idx === 0 ? '1px solid rgba(239,68,68,0.2)' : '1px solid transparent',
                            borderRadius: 8, marginBottom: 6,
                          }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: '50%',
                              border: `2px solid ${urgDot.color}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, marginTop: 1,
                            }}>
                              <span style={{ fontSize: 12 }}>{getCategoryIcon(action.category)}</span>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                                  background: urgDot.color === '#ef4444' ? 'rgba(239,68,68,0.2)' : urgDot.color === '#f59e0b' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)',
                                  color: urgDot.color,
                                }}>
                                  {action.urgency}
                                </span>
                                <span style={{
                                  fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
                                  background: 'rgba(99,102,241,0.15)', color: '#6366f1',
                                }}>
                                  {getStepLabel(action)}
                                </span>
                                {action.deadline && (
                                  <span style={{ fontSize: 10, color: '#64748b' }}>
                                    Due: {action.deadline}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 4, lineHeight: '1.4' }}>
                                {action.task}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: '1.4' }}>
                                {action.details.length > 200 ? action.details.slice(0, 197) + '...' : action.details}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* All done message */}
                  {group.nextActions.length === 0 && (
                    <div style={{
                      textAlign: 'center', padding: '12px 0', color: '#22c55e',
                      fontSize: 13, fontWeight: 600,
                    }}>
                      All actions completed for this account
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b', fontSize: 14 }}>
          No accounts match the current filter.
        </div>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
