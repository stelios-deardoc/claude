'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { t as theme } from '@/lib/theme';
import { useCallTracker } from '@/lib/store';
import {
  generateId,
  categorizeStatus,
  generateSuggestion,
  getContractValue,
} from '@/lib/call-utils';
import type { TodoTask, Suggestion } from '@/lib/types';

type PriorityFilter = 'all' | 'high' | 'medium' | 'low';
type CategoryFilter = 'all' | 'follow-up' | 'email' | 'internal' | 'salesforce' | 'meeting' | 'other';
type StatusFilter = 'all' | 'active' | 'review' | 'completed';
type SortOption = 'dueDate' | 'priority' | 'created';

const CATEGORIES: TodoTask['category'][] = ['follow-up', 'email', 'internal', 'salesforce', 'meeting', 'other'];
const CATEGORY_LABELS: Record<TodoTask['category'], string> = {
  'follow-up': 'Follow-up',
  'email': 'Email',
  'internal': 'Internal',
  'salesforce': 'Salesforce',
  'meeting': 'Meeting',
  'other': 'Other',
};

const PRIORITY_MAP: Record<string, number> = { high: 0, medium: 1, low: 2 };

const inputStyle: React.CSSProperties = {
  background: theme.bg,
  border: `1px solid ${theme.cardBorder}`,
  borderRadius: 6,
  padding: '8px 12px',
  color: theme.fg,
  fontSize: 13,
  outline: 'none',
};

const selectStyle: React.CSSProperties = { ...inputStyle };

function getDueDateInfo(dueDate: string): { color: string; label: string } {
  if (!dueDate) return { color: theme.muted, label: '' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { color: theme.danger, label: 'Overdue' };
  if (diff === 0) return { color: theme.warning, label: 'Today' };
  if (diff <= 3) return { color: theme.accent, label: 'Soon' };
  return { color: theme.muted, label: dueDate };
}

function getPriorityDotColor(priority: string): string {
  if (priority === 'high') return theme.danger;
  if (priority === 'medium') return theme.warning;
  return theme.muted;
}

function getCategoryBadgeStyle(category: string): React.CSSProperties {
  const colorMap: Record<string, string> = {
    'follow-up': theme.accent,
    'email': '#8b5cf6',
    'internal': theme.muted,
    'salesforce': '#06b6d4',
    'meeting': '#10b981',
    'other': theme.textSecondary,
  };
  const c = colorMap[category] || theme.textSecondary;
  return {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 4,
    color: c,
    background: `${c}22`,
  };
}

export default function TodoPage() {
  const { calls, todos, addTodo, updateTodo, deleteTodo, toggleTodo, bulkCompleteTodos, openCallModal, approveTodo, reopenTodo } = useCallTracker();

  // Filter/sort state
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('dueDate');

  // AI suggestions
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  // Quick-add state
  const [qaTitle, setQaTitle] = useState('');
  const [qaDate, setQaDate] = useState('');
  const [qaPriority, setQaPriority] = useState<TodoTask['priority']>('medium');
  const [qaCategory, setQaCategory] = useState<TodoTask['category']>('follow-up');
  const [qaAccountId, setQaAccountId] = useState('');

  // Inline expand
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState<TodoTask['priority']>('medium');
  const [editCategory, setEditCategory] = useState<TodoTask['category']>('follow-up');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAccountId, setEditAccountId] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Completed section
  const [showCompleted, setShowCompleted] = useState(false);

  // Build call lookup
  const callMap = useMemo(() => {
    const map: Record<string, typeof calls[0]> = {};
    for (const c of calls) map[c.id] = c;
    return map;
  }, [calls]);

  // AI Suggestions from pending calls
  const suggestions = useMemo(() => {
    const today = new Date();
    const results: (Suggestion & { callId: string })[] = [];
    for (const call of calls) {
      const category = categorizeStatus(call.saveStatus, call.saveType);
      if (category !== 'pending') continue;
      if (dismissedSuggestions.has(call.id)) continue;
      const dateStr = call.saveDateTime || call.importDate;
      const callDate = dateStr ? new Date(dateStr) : today;
      const daysPending = Math.floor((today.getTime() - callDate.getTime()) / (1000 * 60 * 60 * 24));
      const s = generateSuggestion(call, daysPending);
      if (s) results.push({ ...s, callId: call.id });
    }
    results.sort((a, b) => b.priorityScore - a.priorityScore);
    return results;
  }, [calls, dismissedSuggestions]);

  // Filter and sort todos
  const { activeTodos, reviewTodos, completedTodos } = useMemo(() => {
    const searchLower = search.toLowerCase();
    let filtered = todos.filter((t) => {
      // text search
      if (searchLower) {
        const accountName = t.linkedAccountId ? (callMap[t.linkedAccountId]?.accountName || '') : '';
        const haystack = `${t.title} ${t.description} ${accountName}`.toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      // priority
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      // category
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      // status
      if (statusFilter === 'active' && (t.status || 'active') !== 'active') return false;
      if (statusFilter === 'review' && (t.status || 'active') !== 'review') return false;
      if (statusFilter === 'completed' && (t.status || (t.completed ? 'completed' : 'active')) !== 'completed') return false;
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (sortBy === 'priority') {
        return (PRIORITY_MAP[a.priority] ?? 2) - (PRIORITY_MAP[b.priority] ?? 2);
      }
      // created - newest first
      return b.createdAt.localeCompare(a.createdAt);
    });

    const active = filtered.filter((t) => (t.status || 'active') === 'active');
    const review = filtered.filter((t) => t.status === 'review');
    const completed = filtered.filter((t) => (t.status || (t.completed ? 'completed' : 'active')) === 'completed');
    return { activeTodos: active, reviewTodos: review, completedTodos: completed };
  }, [todos, search, priorityFilter, categoryFilter, statusFilter, sortBy, callMap]);

  const activeCount = useMemo(() => todos.filter((t) => t.status === 'active' || (!t.status && !t.completed)).length, [todos]);
  const reviewCount = useMemo(() => todos.filter((t) => t.status === 'review').length, [todos]);

  // Keyboard shortcuts for review mode
  React.useEffect(() => {
    if (statusFilter !== 'review') return;
    function handleKey(e: KeyboardEvent) {
      if (!reviewTodos.length) return;
      const focusedId = reviewTodos[0]?.id;
      if (!focusedId) return;
      if (e.key === 'Enter') { approveTodo(focusedId); }
      if (e.key === 'Backspace') { e.preventDefault(); reopenTodo(focusedId); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [statusFilter, reviewTodos, approveTodo, reopenTodo]);

  // Quick-add submit
  const handleQuickAdd = useCallback(() => {
    if (!qaTitle.trim()) return;
    const todo: TodoTask = {
      id: generateId(),
      title: qaTitle.trim(),
      description: '',
      dueDate: qaDate,
      priority: qaPriority,
      category: qaCategory,
      linkedAccountId: qaAccountId,
      status: 'active',
      completed: false,
      completedAt: '',
      createdAt: new Date().toISOString(),
      activityLog: [],
      lastSyncedAt: '',
    };
    addTodo(todo);
    setQaTitle('');
    setQaDate('');
    setQaPriority('medium');
    setQaCategory('follow-up');
    setQaAccountId('');
  }, [qaTitle, qaDate, qaPriority, qaCategory, qaAccountId, addTodo]);

  // Create task from suggestion
  const createFromSuggestion = useCallback((s: Suggestion) => {
    const todo: TodoTask = {
      id: generateId(),
      title: s.suggestion,
      description: '',
      dueDate: '',
      priority: s.priority,
      category: 'follow-up',
      linkedAccountId: s.accountId,
      status: 'active',
      completed: false,
      completedAt: '',
      createdAt: new Date().toISOString(),
      activityLog: [],
      lastSyncedAt: '',
    };
    addTodo(todo);
  }, [addTodo]);

  // Expand a task for inline editing
  const expandTask = useCallback((t: TodoTask) => {
    setExpandedId(t.id);
    setEditDesc(t.description);
    setEditPriority(t.priority);
    setEditCategory(t.category);
    setEditDueDate(t.dueDate);
    setEditAccountId(t.linkedAccountId);
  }, []);

  const saveExpanded = useCallback(() => {
    if (!expandedId) return;
    updateTodo(expandedId, {
      description: editDesc,
      priority: editPriority,
      category: editCategory,
      dueDate: editDueDate,
      linkedAccountId: editAccountId,
    });
    setExpandedId(null);
  }, [expandedId, editDesc, editPriority, editCategory, editDueDate, editAccountId, updateTodo]);

  // Selection
  const toggleSelect = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkComplete = useCallback(() => {
    bulkCompleteTodos(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, bulkCompleteTodos]);

  const handleBulkDelete = useCallback(() => {
    for (const id of selectedIds) deleteTodo(id);
    setSelectedIds(new Set());
  }, [selectedIds, deleteTodo]);

  // Render a single task card
  const renderTask = (t: TodoTask, dimmed: boolean) => {
    const isExpanded = expandedId === t.id;
    const isSelected = selectedIds.has(t.id);
    const dueDateInfo = getDueDateInfo(t.dueDate);
    const linkedCall = t.linkedAccountId ? callMap[t.linkedAccountId] : null;

    return (
      <div
        key={t.id}
        style={{
          background: 'var(--card-bg, #1e293b)',
          border: `1px solid ${isSelected ? theme.accent : 'var(--card-border, #334155)'}`,
          borderRadius: 10,
          opacity: dimmed ? 0.5 : 1,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 16px',
            gap: 12,
          }}
        >
          {/* Checkbox */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (e.shiftKey) {
                toggleSelect(t.id, true);
              } else {
                toggleTodo(t.id);
              }
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: `2px solid ${t.completed ? '#10b981' : theme.textTertiary}`,
              background: t.completed ? '#10b981' : 'transparent',
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: theme.statValue,
            }}
          >
            {t.completed ? '\u2713' : ''}
          </div>

          {/* Priority dot */}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: getPriorityDotColor(t.priority),
              flexShrink: 0,
            }}
          />

          {/* Center content - clickable to expand */}
          <div
            onClick={() => {
              if (isExpanded) {
                setExpandedId(null);
              } else {
                expandTask(t);
              }
            }}
            style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                textDecoration: dimmed ? 'line-through' : 'none',
                color: theme.fg,
                marginBottom: t.description || linkedCall ? 4 : 0,
              }}
            >
              {t.title}
            </div>
            {t.description && !isExpanded && (
              <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: linkedCall ? 4 : 0 }}>
                {t.description.length > 100 ? t.description.substring(0, 100) + '...' : t.description}
              </div>
            )}
            {linkedCall && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  openCallModal(linkedCall.id);
                }}
                style={{
                  fontSize: 12,
                  color: theme.accent,
                  cursor: 'pointer',
                }}
              >
                {linkedCall.accountName || 'Linked Account'}
              </span>
            )}
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Due date */}
            {(dueDateInfo.label || t.dueDate) && (
              <span style={{ fontSize: 12, fontWeight: 500, color: dueDateInfo.color }}>
                {dueDateInfo.label || t.dueDate}
              </span>
            )}
            {/* Category badge */}
            <span style={getCategoryBadgeStyle(t.category)}>
              {CATEGORY_LABELS[t.category] || t.category}
            </span>
            {/* Completed date for completed tasks */}
            {dimmed && t.completedAt && (
              <span style={{ fontSize: 11, color: theme.muted }}>
                {new Date(t.completedAt).toLocaleDateString()}
              </span>
            )}
            {/* Delete */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteTodo(t.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: theme.muted,
                fontSize: 16,
                cursor: 'pointer',
                padding: '2px 4px',
                lineHeight: 1,
              }}
            >
              x
            </button>
          </div>
        </div>

        {/* Expanded inline editor */}
        {isExpanded && (
          <div
            style={{
              borderTop: `1px solid ${theme.cardBorder}`,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description..."
              style={{
                ...inputStyle,
                width: '100%',
                minHeight: 70,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as TodoTask['priority'])}
                style={selectStyle}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as TodoTask['category'])}
                style={selectStyle}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                style={selectStyle}
              />
              <select
                value={editAccountId}
                onChange={(e) => setEditAccountId(e.target.value)}
                style={selectStyle}
              >
                <option value="">No linked account</option>
                {calls.map((c) => (
                  <option key={c.id} value={c.id}>{c.accountName || c.id}</option>
                ))}
              </select>
              <button
                onClick={saveExpanded}
                style={{
                  background: theme.accent,
                  color: 'white',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 20px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      {/* ---- Section 1: Header ---- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>To-Do</h1>
        <span
          style={{
            background: theme.accent,
            color: 'white',
            borderRadius: 20,
            padding: '3px 12px',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {activeCount}
        </span>
        {reviewCount > 0 && (
          <span
            style={{
              background: theme.warning,
              color: '#000',
              borderRadius: 20,
              padding: '3px 12px',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {reviewCount} to review
          </span>
        )}
      </div>

      {/* Filter/sort toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 20,
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 160 }}
        />
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
          style={selectStyle}
        >
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          style={selectStyle}
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={selectStyle}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="review">{`Review (${reviewCount})`}</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          style={selectStyle}
        >
          <option value="dueDate">Due Date</option>
          <option value="priority">Priority</option>
          <option value="created">Created</option>
        </select>
      </div>

      {/* ---- Section 2: AI Suggestions ---- */}
      {suggestions.length > 0 && (
        <div
          style={{
            background: 'var(--card-bg, #1e293b)',
            border: '1px solid var(--card-border, #334155)',
            borderRadius: 10,
            marginBottom: 20,
            overflow: 'hidden',
          }}
        >
          <div
            onClick={() => setSuggestionsOpen(!suggestionsOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: theme.fg }}>
                Suggested Actions
              </span>
              <span
                style={{
                  background: `${theme.warning}22`,
                  color: theme.warning,
                  borderRadius: 20,
                  padding: '2px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {suggestions.length}
              </span>
            </div>
            <span style={{ color: theme.textSecondary, fontSize: 13 }}>
              {suggestionsOpen ? 'Hide' : 'Show'}
            </span>
          </div>

          {suggestionsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {suggestions.map((s) => {
                const pColor = getPriorityDotColor(s.priority);
                const mrr = s.contractValue ? `$${Math.round(s.contractValue / 12).toLocaleString()}/mo` : '';
                return (
                  <div
                    key={s.callId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderTop: `1px solid ${theme.cardBorder}`,
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        onClick={() => openCallModal(s.callId)}
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: theme.accent,
                          cursor: 'pointer',
                        }}
                      >
                        {s.accountName || 'Unknown'}
                      </span>
                      <div style={{ fontSize: 13, color: theme.cardBorder, marginTop: 2 }}>
                        {s.suggestion}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 4,
                        color: pColor,
                        background: `${pColor}22`,
                        flexShrink: 0,
                      }}
                    >
                      {s.priority}
                    </span>
                    {mrr && (
                      <span style={{ fontSize: 12, color: theme.textSecondary, flexShrink: 0 }}>
                        {mrr}
                      </span>
                    )}
                    <button
                      onClick={() => createFromSuggestion(s)}
                      style={{
                        background: theme.accent,
                        color: 'white',
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontSize: 12,
                        cursor: 'pointer',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Create Task
                    </button>
                    <button
                      onClick={() =>
                        setDismissedSuggestions((prev) => {
                          const next = new Set(prev);
                          next.add(s.accountId);
                          return next;
                        })
                      }
                      style={{
                        background: 'none',
                        border: 'none',
                        color: theme.muted,
                        fontSize: 16,
                        cursor: 'pointer',
                        padding: '2px 4px',
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      x
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---- Section 3: Quick-Add Bar ---- */}
      <div
        style={{
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--card-border, #334155)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Add a task..."
          value={qaTitle}
          onChange={(e) => setQaTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleQuickAdd();
          }}
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
        <input
          type="date"
          value={qaDate}
          onChange={(e) => setQaDate(e.target.value)}
          style={{ ...inputStyle, width: 140 }}
        />
        <select
          value={qaPriority}
          onChange={(e) => setQaPriority(e.target.value as TodoTask['priority'])}
          style={selectStyle}
        >
          <option value="high">High</option>
          <option value="medium">Med</option>
          <option value="low">Low</option>
        </select>
        <select
          value={qaCategory}
          onChange={(e) => setQaCategory(e.target.value as TodoTask['category'])}
          style={selectStyle}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <select
          value={qaAccountId}
          onChange={(e) => setQaAccountId(e.target.value)}
          style={selectStyle}
        >
          <option value="">Link account...</option>
          {calls.map((c) => (
            <option key={c.id} value={c.id}>{c.accountName || c.id}</option>
          ))}
        </select>
        <button
          onClick={handleQuickAdd}
          style={{
            background: theme.accent,
            color: 'white',
            fontWeight: 600,
            border: 'none',
            borderRadius: 6,
            padding: '8px 20px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Add
        </button>
      </div>

      {/* ---- Section 4: Active Task List ---- */}
      {activeTodos.length === 0 && completedTodos.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: theme.textSecondary,
            fontSize: 16,
          }}
        >
          No tasks yet. Add one above or create from a suggestion.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {activeTodos.map((t) => renderTask(t, false))}
      </div>

      {/* ---- Review Section ---- */}
      {reviewTodos.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: theme.warning }}>Needs Review</span>
            <span style={{ fontSize: 12, color: theme.textSecondary }}>
              Enter = Complete | Backspace = Reopen
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reviewTodos.map((t) => {
              const linkedCall = t.linkedAccountId ? callMap[t.linkedAccountId] : null;
              return (
                <div
                  key={t.id}
                  style={{
                    background: 'var(--card-bg, #1e293b)',
                    border: '1px solid var(--card-border, #334155)',
                    borderLeft: `4px solid ${theme.warning}`,
                    borderRadius: 10,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: theme.fg }}>{t.title}</span>
                        {t.autoCreated && (
                          <span style={{ fontSize: 10, color: theme.textSecondary, background: theme.cardBorder, padding: '1px 6px', borderRadius: 4 }}>
                            auto-created
                          </span>
                        )}
                      </div>
                      {linkedCall && (
                        <span
                          onClick={() => openCallModal(linkedCall.id)}
                          style={{ fontSize: 12, color: theme.accent, cursor: 'pointer' }}
                        >
                          {linkedCall.accountName || 'Linked Account'}
                        </span>
                      )}
                      {/* Activity Timeline */}
                      {t.activityLog && t.activityLog.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {t.activityLog.map((activity) => (
                            <div key={activity.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                              <span style={{ color: activity.source === 'gmail' ? '#8b5cf6' : '#10b981', fontWeight: 600 }}>
                                {activity.source === 'gmail' ? 'EMAIL' : activity.source === 'calendar' ? 'MEETING' : 'NOTE'}
                              </span>
                              <span style={{ color: theme.cardBorder }}>{activity.summary}</span>
                              <span style={{ color: theme.muted, marginLeft: 'auto', flexShrink: 0 }}>
                                {new Date(activity.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => approveTodo(t.id)}
                        title="Complete"
                        style={{
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 14px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Complete
                      </button>
                      <button
                        onClick={() => reopenTodo(t.id)}
                        title="Reopen"
                        style={{
                          background: theme.accent,
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 14px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Reopen
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- Section 5: Completed (collapsible) ---- */}
      {completedTodos.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            style={{
              background: 'none',
              border: `1px solid ${theme.cardBorder}`,
              borderRadius: 6,
              color: theme.textSecondary,
              fontSize: 13,
              padding: '8px 16px',
              cursor: 'pointer',
              marginBottom: 12,
            }}
          >
            {showCompleted ? 'Hide' : 'Show'} {completedTodos.length} completed
          </button>
          {showCompleted && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {completedTodos.map((t) => renderTask(t, true))}
            </div>
          )}
        </div>
      )}

      {/* ---- Floating selection bar ---- */}
      {selectedIds.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: theme.cardBg,
            border: `1px solid ${theme.cardBorder}`,
            borderRadius: 10,
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 100,
          }}
        >
          <span style={{ fontSize: 14, color: theme.fg, fontWeight: 600 }}>
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkComplete}
            style={{
              background: '#10b981',
              color: 'white',
              fontWeight: 600,
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Complete Selected
          </button>
          <button
            onClick={handleBulkDelete}
            style={{
              background: theme.danger,
              color: 'white',
              fontWeight: 600,
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Delete Selected
          </button>
        </div>
      )}
    </div>
  );
}
