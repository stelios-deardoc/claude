'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { t } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostSaveNotes {
  saveStatus: string;
  callParticipants: string;
  reasonForCancelRequest: string;
  solutionsOffered: string;
  solutionsAccepted: string;
  resultStrategyDiscussed: string;
  resultsMetric: string;
  overallCallRecap: string;
  saveType: string;
  saveSubReason: string;
  saveTactic: string;
  saveDateTime: string;
  revenueRetained: string;
  newContractDuration: string;
  newBillingFrequency: string;
  monthlySalesPrice: string;
  saveCancelNotes: string;
}

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
  postSaveNotes?: PostSaveNotes;
}

interface ActionsData {
  generated: string;
  actions: ActionItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUrgencyStyle(urgency: string): { bg: string; color: string; label: string; pulse: boolean } {
  switch (urgency) {
    case 'NOW':
      return { bg: 'rgba(239,68,68,0.2)', color: t.danger, label: 'NOW', pulse: true };
    case 'TODAY':
      return { bg: 'rgba(245,158,11,0.2)', color: t.warning, label: 'TODAY', pulse: false };
    case 'THIS_WEEK':
      return { bg: 'rgba(59,130,246,0.2)', color: t.accent, label: 'THIS WEEK', pulse: false };
    default:
      return { bg: 'rgba(100,116,139,0.2)', color: t.muted, label: urgency, pulse: false };
  }
}

function getDecisionStyle(decision: string): { bg: string; color: string } {
  switch (decision.toUpperCase()) {
    case 'SAVED':
      return { bg: 'rgba(34,197,94,0.15)', color: t.success };
    case 'LOST':
      return { bg: 'rgba(239,68,68,0.15)', color: t.danger };
    case 'PENDING':
      return { bg: 'rgba(245,158,11,0.15)', color: t.warning };
    default:
      return { bg: 'rgba(100,116,139,0.15)', color: t.muted };
  }
}

function getCategoryIcon(category: string): React.ReactNode {
  const svgProps = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (category) {
    case 'email':
      return (
        <svg {...svgProps}>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      );
    case 'internal':
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      );
    case 'salesforce':
      return (
        <svg {...svgProps}>
          <path d="M20 16V7a2 2 0 00-2-2H6a2 2 0 00-2 2v9m16 0H4m16 0l1.28 2.55a1 1 0 01-.9 1.45H3.62a1 1 0 01-.9-1.45L4 16" />
        </svg>
      );
    case 'follow-up':
      return (
        <svg {...svgProps}>
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
        </svg>
      );
    case 'meeting':
      return (
        <svg {...svgProps}>
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      );
    default:
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case 'email': return 'Email';
    case 'internal': return 'Internal';
    case 'salesforce': return 'Salesforce';
    case 'follow-up': return 'Follow-up';
    case 'meeting': return 'Meeting';
    default: return category;
  }
}

const URGENCY_ORDER: Record<string, number> = { NOW: 0, TODAY: 1, THIS_WEEK: 2 };

function parseMrr(mrr: string): number {
  if (!mrr) return 0;
  const cleaned = mrr.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActionsPage() {
  const [data, setData] = useState<ActionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // New filter/search/sort/group/batch state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [filterDecision, setFilterDecision] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortOption, setSortOption] = useState<string>('priority');
  const [groupBy, setGroupBy] = useState<string>('none');
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/actions', { cache: 'no-store' });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = await res.json();
      setData(json as ActionsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCompleted = async (id: string, completed: boolean) => {
    // Optimistic update
    setUpdatingIds((prev) => new Set(prev).add(id));
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        actions: prev.actions.map((a) =>
          a.id === id ? { ...a, completed } : a,
        ),
      };
    });

    try {
      const res = await fetch('/api/actions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, completed }),
      });
      if (!res.ok) throw new Error('Failed to update');
    } catch {
      // Revert on error
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          actions: prev.actions.map((a) =>
            a.id === id ? { ...a, completed: !completed } : a,
          ),
        };
      });
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleSelectAction = (id: string) => {
    setSelectedActionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const batchMarkComplete = async () => {
    const ids = Array.from(selectedActionIds);
    for (const id of ids) {
      await toggleCompleted(id, true);
    }
    setSelectedActionIds(new Set());
  };

  // Filtered + sorted actions
  const { activeActions, completedActions } = useMemo(() => {
    const actions = data?.actions || [];
    const query = searchQuery.toLowerCase().trim();

    let filtered = actions;

    // Text search
    if (query) {
      filtered = filtered.filter((a) =>
        a.account.toLowerCase().includes(query) ||
        a.contact.toLowerCase().includes(query) ||
        a.task.toLowerCase().includes(query) ||
        a.details.toLowerCase().includes(query)
      );
    }

    // Urgency filter
    if (filterUrgency !== 'all') {
      filtered = filtered.filter((a) => a.urgency === filterUrgency);
    }

    // Decision filter
    if (filterDecision !== 'all') {
      filtered = filtered.filter((a) => a.decision.toUpperCase() === filterDecision);
    }

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter((a) => a.category === filterCategory);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'urgency':
          return (URGENCY_ORDER[a.urgency] ?? 3) - (URGENCY_ORDER[b.urgency] ?? 3);
        case 'account':
          return a.account.localeCompare(b.account);
        case 'mrr':
          return parseMrr(b.mrrAtRisk) - parseMrr(a.mrrAtRisk);
        case 'priority':
        default:
          return a.priority - b.priority;
      }
    });

    return {
      activeActions: sorted.filter((a) => !a.completed),
      completedActions: sorted.filter((a) => a.completed),
    };
  }, [data, searchQuery, filterUrgency, filterDecision, filterCategory, sortOption]);

  // Grouped actions (null when groupBy === 'none')
  const groupedActions = useMemo<Record<string, ActionItem[]> | null>(() => {
    if (groupBy === 'none') return null;

    const groups: Record<string, ActionItem[]> = {};
    for (const action of activeActions) {
      let key: string;
      switch (groupBy) {
        case 'urgency':
          key = action.urgency || 'OTHER';
          break;
        case 'category':
          key = getCategoryLabel(action.category) || 'Other';
          break;
        case 'decision':
          key = action.decision || 'UNKNOWN';
          break;
        default:
          key = 'Other';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(action);
    }
    return groups;
  }, [activeActions, groupBy]);

  // Stats derived from filtered active actions
  const totalCount = (data?.actions || []).length;
  const completedCount = completedActions.length;
  const remainingCount = activeActions.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const nowCount = activeActions.filter((a) => a.urgency === 'NOW').length;
  const todayCount = activeActions.filter((a) => a.urgency === 'TODAY').length;
  const weekCount = activeActions.filter((a) => a.urgency === 'THIS_WEEK').length;

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
        Loading actions...
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
          Error loading actions
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

  const groupColorMap: Record<string, string> = {
    NOW: t.danger,
    TODAY: t.warning,
    THIS_WEEK: t.accent,
    SAVED: t.success,
    LOST: t.danger,
    PENDING: t.warning,
    Email: t.accent,
    Internal: '#8b5cf6',
    Salesforce: '#06b6d4',
    'Follow-up': t.warning,
    Meeting: t.success,
  };

  const renderActionList = (items: ActionItem[]) =>
    items.map((action) => (
      <ActionCard
        key={action.id}
        action={action}
        expanded={expandedIds.has(action.id)}
        updating={updatingIds.has(action.id)}
        selected={selectedActionIds.has(action.id)}
        onToggleExpand={() => toggleExpanded(action.id)}
        onToggleComplete={(completed) => toggleCompleted(action.id, completed)}
        onToggleSelect={() => toggleSelectAction(action.id)}
      />
    ));

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      {/* Pulse animation */}
      <style>{`
        @keyframes pulse-urgency {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .urgency-pulse {
          animation: pulse-urgency 2s ease-in-out infinite;
        }
        .action-card {
          transition: all 0.3s ease;
        }
        .action-card:hover {
          border-color: rgba(59,130,246,0.4) !important;
        }
        .action-card-completed {
          opacity: 0.5;
        }
        .action-card-completed:hover {
          opacity: 0.7;
        }
        .checkbox-btn {
          transition: all 0.2s ease;
        }
        .checkbox-btn:hover {
          transform: scale(1.1);
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
              Action Dashboard
            </h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
              {completedCount}/{totalCount} completed -- {remainingCount} remaining
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

        {/* Progress Bar */}
        <div
          style={{
            width: '100%',
            height: 8,
            background: 'rgba(100,116,139,0.2)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: completedCount === totalCount ? t.success : t.accent,
              borderRadius: 4,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </div>

      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search actions by account, contact, task, or details..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          width: '100%',
          background: t.bg,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 8,
          padding: '10px 14px',
          color: t.fg,
          fontSize: 14,
          marginBottom: 16,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 20,
          alignItems: 'center',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textSecondary }}>
          Urgency
          <select
            value={filterUrgency}
            onChange={(e) => setFilterUrgency(e.target.value)}
            style={{
              background: t.bg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 6,
              padding: '6px 10px',
              color: t.fg,
              fontSize: 12,
              outline: 'none',
            }}
          >
            <option value="all">All</option>
            <option value="NOW">NOW</option>
            <option value="TODAY">TODAY</option>
            <option value="THIS_WEEK">THIS WEEK</option>
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textSecondary }}>
          Decision
          <select
            value={filterDecision}
            onChange={(e) => setFilterDecision(e.target.value)}
            style={{
              background: t.bg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 6,
              padding: '6px 10px',
              color: t.fg,
              fontSize: 12,
              outline: 'none',
            }}
          >
            <option value="all">All</option>
            <option value="SAVED">SAVED</option>
            <option value="LOST">LOST</option>
            <option value="PENDING">PENDING</option>
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textSecondary }}>
          Category
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{
              background: t.bg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 6,
              padding: '6px 10px',
              color: t.fg,
              fontSize: 12,
              outline: 'none',
            }}
          >
            <option value="all">All</option>
            <option value="email">Email</option>
            <option value="internal">Internal</option>
            <option value="salesforce">Salesforce</option>
            <option value="follow-up">Follow-up</option>
            <option value="meeting">Meeting</option>
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textSecondary }}>
          Sort
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            style={{
              background: t.bg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 6,
              padding: '6px 10px',
              color: t.fg,
              fontSize: 12,
              outline: 'none',
            }}
          >
            <option value="priority">Priority</option>
            <option value="urgency">Urgency</option>
            <option value="account">Account</option>
            <option value="mrr">MRR</option>
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textSecondary }}>
          Group By
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            style={{
              background: t.bg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 6,
              padding: '6px 10px',
              color: t.fg,
              fontSize: 12,
              outline: 'none',
            }}
          >
            <option value="none">None</option>
            <option value="urgency">Urgency</option>
            <option value="category">Category</option>
            <option value="decision">Decision</option>
          </select>
        </label>
      </div>

      {/* Stats Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Total Actions
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)' }}>{totalCount}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Completed
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: t.success }}>{completedCount}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Remaining
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)' }}>{remainingCount}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: t.danger, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            NOW
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: t.danger }}>{nowCount}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: t.warning, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Today
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: t.warning }}>{todayCount}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            This Week
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: t.accent }}>{weekCount}</div>
        </div>
      </div>

      {/* Batch Operations Bar */}
      {selectedActionIds.size > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            marginBottom: 12,
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: '#93c5fd' }}>
            {selectedActionIds.size} selected
          </span>
          <button
            onClick={batchMarkComplete}
            style={{
              padding: '6px 16px',
              background: t.accent,
              border: 'none',
              borderRadius: 6,
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Mark All Complete
          </button>
        </div>
      )}

      {/* Active Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {groupedActions ? (
          // Grouped rendering
          Object.entries(groupedActions).map(([groupLabel, items]) => (
            <div key={groupLabel}>
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  marginBottom: 8,
                  background: t.bg,
                  borderLeft: `4px solid ${groupColorMap[groupLabel] || t.muted}`,
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 700,
                  color: groupColorMap[groupLabel] || t.textSecondary,
                }}
              >
                {groupLabel}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: t.muted,
                  }}
                >
                  ({items.length})
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {renderActionList(items)}
              </div>
            </div>
          ))
        ) : (
          // Flat rendering
          renderActionList(activeActions)
        )}
        {activeActions.length === 0 && (
          <div
            className="card"
            style={{
              padding: 40,
              textAlign: 'center',
              color: t.success,
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            All actions completed! Nice work.
          </div>
        )}
      </div>

      {/* Completed Section */}
      {completedActions.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              background: 'transparent',
              border: '1px solid var(--card-border)',
              borderRadius: 8,
              color: 'var(--muted)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: showCompleted ? 12 : 0,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: showCompleted ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Show {completedActions.length} completed
          </button>

          {showCompleted && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {completedActions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  expanded={expandedIds.has(action.id)}
                  updating={updatingIds.has(action.id)}
                  selected={selectedActionIds.has(action.id)}
                  onToggleExpand={() => toggleExpanded(action.id)}
                  onToggleComplete={(completed) => toggleCompleted(action.id, completed)}
                  onToggleSelect={() => toggleSelectAction(action.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionCard Sub-component
// ---------------------------------------------------------------------------

function ActionCard({
  action,
  expanded,
  updating,
  selected,
  onToggleExpand,
  onToggleComplete,
  onToggleSelect,
}: {
  action: ActionItem;
  expanded: boolean;
  updating: boolean;
  selected: boolean;
  onToggleExpand: () => void;
  onToggleComplete: (completed: boolean) => void;
  onToggleSelect: () => void;
}) {
  const urgency = getUrgencyStyle(action.urgency);
  const decision = getDecisionStyle(action.decision);
  const isCompleted = action.completed;

  const [showNotes, setShowNotes] = useState(false);

  return (
    <div
      className={`card action-card ${isCompleted ? 'action-card-completed' : ''}`}
      style={{
        padding: 0,
        overflow: 'hidden',
        borderLeft: `4px solid ${isCompleted ? t.cardBorder : urgency.color}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
          padding: '16px 20px',
        }}
      >
        {/* Select Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          style={{
            width: 24,
            height: 24,
            minWidth: 24,
            borderRadius: 6,
            border: `2px solid ${selected ? t.accent : t.cardBorder}`,
            background: selected ? 'rgba(59,130,246,0.2)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 8,
            padding: 0,
          }}
          title="Select for batch operations"
        >
          {selected && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={t.accent}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        {/* Priority Number */}
        <div
          style={{
            minWidth: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isCompleted ? 'rgba(100,116,139,0.1)' : 'rgba(59,130,246,0.1)',
            borderRadius: 8,
            fontSize: 18,
            fontWeight: 700,
            color: isCompleted ? t.textTertiary : t.accent,
            flexShrink: 0,
          }}
        >
          {action.priority}
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top Row: Badges */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              flexWrap: 'wrap',
            }}
          >
            {/* Urgency Badge */}
            <span
              className={urgency.pulse && !isCompleted ? 'urgency-pulse' : ''}
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.5px',
                background: isCompleted ? 'rgba(100,116,139,0.15)' : urgency.bg,
                color: isCompleted ? t.textTertiary : urgency.color,
              }}
            >
              {urgency.label}
            </span>

            {/* Decision Badge */}
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                background: isCompleted ? 'rgba(100,116,139,0.15)' : decision.bg,
                color: isCompleted ? t.textTertiary : decision.color,
              }}
            >
              {action.decision}
            </span>

            {/* Category */}
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                background: 'rgba(100,116,139,0.1)',
                color: t.textSecondary,
              }}
            >
              {getCategoryIcon(action.category)}
              {getCategoryLabel(action.category)}
            </span>

            {/* Deadline */}
            <span
              style={{
                fontSize: 11,
                color: isCompleted ? t.textTertiary : t.textSecondary,
                marginLeft: 'auto',
              }}
            >
              {action.deadline}
            </span>
          </div>

          {/* Account + Contact */}
          <div style={{ marginBottom: 4 }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: isCompleted ? t.textTertiary : 'var(--foreground)',
                textDecoration: isCompleted ? 'line-through' : 'none',
              }}
            >
              {action.account}
            </span>
            <span
              style={{
                fontSize: 13,
                color: isCompleted ? t.cardBorder : 'var(--muted)',
                marginLeft: 8,
              }}
            >
              {action.contact}
            </span>
          </div>

          {/* Task */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: isCompleted ? t.textTertiary : t.fg,
              textDecoration: isCompleted ? 'line-through' : 'none',
              marginBottom: 4,
              lineHeight: 1.4,
            }}
          >
            {action.task}
          </div>

          {/* MRR at Risk */}
          {action.mrrAtRisk && (
            <div
              style={{
                fontSize: 12,
                color: isCompleted
                  ? t.textTertiary
                  : action.decision === 'SAVED'
                  ? t.success
                  : t.warning,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              MRR: {action.mrrAtRisk}
            </div>
          )}

          {/* Details (expandable) */}
          <button
            onClick={onToggleExpand}
            style={{
              background: 'none',
              border: 'none',
              color: t.accent,
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 0',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {expanded ? 'Hide details' : 'Show details'}
          </button>

          {expanded && (
            <div
              style={{
                marginTop: 8,
                padding: 12,
                background: t.bg,
                borderRadius: 6,
                fontSize: 13,
                color: t.textSecondary,
                lineHeight: 1.6,
              }}
            >
              {action.details}
              {action.email && (
                <div style={{ marginTop: 8, fontSize: 12, color: t.muted }}>
                  Email: <a href={`mailto:${action.email}`} style={{ color: t.accent, textDecoration: 'none' }}>{action.email}</a>
                </div>
              )}
            </div>
          )}

          {/* Post-Save Notes */}
          {action.postSaveNotes && (
            <PostSaveNotesPanel notes={action.postSaveNotes} account={action.account} />
          )}
        </div>

        {/* Right Side: Doc Link + Checkbox */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {/* Checkbox */}
          <button
            className="checkbox-btn"
            onClick={() => onToggleComplete(!isCompleted)}
            disabled={updating}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `2px solid ${isCompleted ? t.success : t.cardBorder}`,
              background: isCompleted ? 'rgba(34,197,94,0.2)' : 'transparent',
              cursor: updating ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.success,
              flexShrink: 0,
            }}
            title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            {isCompleted && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>

          {/* Doc Link */}
          {action.docUrl && (
            <a
              href={action.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '6px 10px',
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: 6,
                color: t.accent,
                fontSize: 11,
                fontWeight: 600,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Open Doc
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PostSaveNotesPanel Sub-component
// ---------------------------------------------------------------------------

const PSN_FIELD_LABELS: Record<string, string> = {
  saveStatus: 'Save Status',
  callParticipants: 'Call Participants',
  reasonForCancelRequest: 'Reason for Cancel Request',
  solutionsOffered: 'Solutions Offered',
  solutionsAccepted: 'Solutions Accepted',
  resultStrategyDiscussed: 'Result Strategy Discussed',
  resultsMetric: 'Results Metric',
  overallCallRecap: 'Overall Call Recap',
  saveType: 'Save Type',
  saveSubReason: 'Save Sub-Reason',
  saveTactic: 'Save Tactic',
  saveDateTime: 'Save Date/Time',
  revenueRetained: 'Revenue Retained',
  newContractDuration: 'New Contract Duration',
  newBillingFrequency: 'New Billing Frequency',
  monthlySalesPrice: 'Monthly Sales Price',
  saveCancelNotes: 'Save/Cancel Notes',
};

function PostSaveNotesPanel({ notes, account }: { notes: PostSaveNotes; account: string }) {
  const [open, setOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    }
  };

  const copyAll = async () => {
    const allText = Object.entries(notes)
      .filter(([, v]) => v)
      .map(([k, v]) => `${PSN_FIELD_LABELS[k] || k}: ${v}`)
      .join('\n\n');
    await copyToClipboard('__all__', allText);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          color: '#a78bfa',
          fontSize: 12,
          cursor: 'pointer',
          padding: '4px 0',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        Post-Save Notes for Salesforce
      </button>

      {open && (
        <div
          style={{
            marginTop: 8,
            padding: 16,
            background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(59,130,246,0.08))',
            border: '1px solid rgba(124,58,237,0.25)',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {/* Header with Copy All */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              paddingBottom: 8,
              borderBottom: '1px solid rgba(124,58,237,0.2)',
            }}
          >
            <span style={{ fontWeight: 700, color: '#a78bfa', fontSize: 13 }}>
              {account} -- Save Opp Fields
            </span>
            <button
              onClick={copyAll}
              style={{
                padding: '4px 12px',
                background: copiedField === '__all__' ? 'rgba(34,197,94,0.2)' : 'rgba(124,58,237,0.2)',
                border: `1px solid ${copiedField === '__all__' ? 'rgba(34,197,94,0.4)' : 'rgba(124,58,237,0.3)'}`,
                borderRadius: 6,
                color: copiedField === '__all__' ? t.success : '#a78bfa',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copiedField === '__all__' ? 'Copied!' : 'Copy All'}
            </button>
          </div>

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(notes).map(([key, value]) => {
              if (!value) return null;
              const label = PSN_FIELD_LABELS[key] || key;
              const isCopied = copiedField === key;
              return (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    padding: '6px 8px',
                    borderRadius: 4,
                    background: 'rgba(15,23,42,0.5)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 12, color: t.cardBorder, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {value}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(key, value)}
                    style={{
                      flexShrink: 0,
                      padding: '2px 8px',
                      background: isCopied ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.15)',
                      border: `1px solid ${isCopied ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.2)'}`,
                      borderRadius: 4,
                      color: isCopied ? t.success : t.muted,
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginTop: 2,
                    }}
                  >
                    {isCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
