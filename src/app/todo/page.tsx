'use client';

import React, { useState, useMemo } from 'react';
import { useCallTracker } from '@/lib/store';
import {
  categorizeStatus,
  getContractValue,
  getStandingCategory,
  hasGuaranteeIssue,
  isLegalCase,
  isBadStandingOnly,
  generateSuggestion,
} from '@/lib/call-utils';
import type { Call, Suggestion } from '@/lib/types';

interface TodoItem {
  call: Call;
  daysPending: number;
  suggestion: Suggestion | null;
}

export default function TodoPage() {
  const { calls, openCallModal, updateCall } = useCallTracker();
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [noteValues, setNoteValues] = useState<Record<string, string>>({});

  const todoItems = useMemo(() => {
    const today = new Date();
    const pending: TodoItem[] = [];

    for (const call of calls) {
      const category = categorizeStatus(call.saveStatus, call.saveType);
      if (category !== 'pending') continue;

      const dateStr = call.saveDateTime || call.importDate;
      const callDate = dateStr ? new Date(dateStr) : today;
      const daysPending = Math.floor(
        (today.getTime() - callDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const suggestion = generateSuggestion(call, daysPending);

      pending.push({ call, daysPending, suggestion });
    }

    // Sort: items with suggestions first (by priorityScore desc), then by daysPending desc
    pending.sort((a, b) => {
      const aHas = a.suggestion ? 1 : 0;
      const bHas = b.suggestion ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      if (a.suggestion && b.suggestion) {
        return b.suggestion.priorityScore - a.suggestion.priorityScore;
      }
      return b.daysPending - a.daysPending;
    });

    return pending;
  }, [calls]);

  const toggleNotes = (callId: string, currentNotes: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) {
        next.delete(callId);
      } else {
        next.add(callId);
        if (!(callId in noteValues)) {
          setNoteValues((nv) => ({ ...nv, [callId]: currentNotes }));
        }
      }
      return next;
    });
  };

  const saveNotes = (callId: string) => {
    const value = noteValues[callId] ?? '';
    updateCall(callId, { todoNotes: value });
  };

  const getDaysColor = (days: number): string => {
    if (days >= 14) return '#ef4444';
    if (days >= 7) return '#f59e0b';
    return 'var(--text-secondary, #94a3b8)';
  };

  const getPriorityColor = (priority: 'low' | 'medium' | 'high'): string => {
    if (priority === 'high') return '#ef4444';
    if (priority === 'medium') return '#f59e0b';
    return '#64748b';
  };

  const getSuggestionBg = (priority: 'low' | 'medium' | 'high'): string => {
    if (priority === 'high') return 'rgba(239,68,68,0.1)';
    if (priority === 'medium') return 'rgba(245,158,11,0.1)';
    return 'rgba(100,116,139,0.1)';
  };

  const isExcluded = (call: Call): boolean => {
    return hasGuaranteeIssue(call) || isLegalCase(call);
  };

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>To-Do</h1>
        <span
          style={{
            background: 'var(--card-bg, #1e293b)',
            border: '1px solid var(--card-border, #334155)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 14,
            color: 'var(--text-secondary, #94a3b8)',
          }}
        >
          {todoItems.length} pending
        </span>
      </div>

      {/* Empty state */}
      {todoItems.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--text-secondary, #94a3b8)',
            fontSize: 16,
          }}
        >
          All caught up! No pending accounts to follow up on.
        </div>
      )}

      {/* Todo items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {todoItems.map(({ call, daysPending, suggestion }) => {
          const standing = getStandingCategory(call.paymentStanding);
          const guarantee = hasGuaranteeIssue(call);
          const legal = isLegalCase(call);
          const badStanding = isBadStandingOnly(call);
          const excluded = isExcluded(call);
          const rate = call.monthlySalesPrice || call.ratePerMonth || '';
          const notesOpen = expandedNotes.has(call.id);
          const currentNotes = noteValues[call.id] ?? call.todoNotes ?? call.notes ?? '';

          return (
            <div
              key={call.id}
              style={{
                background: 'var(--card-bg, #1e293b)',
                border: '1px solid var(--card-border, #334155)',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {/* Main row */}
              <div
                onClick={() => openCallModal(call.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  cursor: 'pointer',
                  gap: 16,
                }}
              >
                {/* Left side */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 15 }}>
                      {call.accountName || 'Unnamed Account'}
                    </span>
                    {badStanding && (
                      <span
                        style={{
                          background: 'rgba(239,68,68,0.15)',
                          color: '#ef4444',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        Bad Standing
                      </span>
                    )}
                    {guarantee && (
                      <span
                        style={{
                          background: 'rgba(168,85,247,0.15)',
                          color: '#a855f7',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        Guarantee
                      </span>
                    )}
                    {legal && (
                      <span
                        style={{
                          background: 'rgba(249,115,22,0.15)',
                          color: '#f97316',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        Legal
                      </span>
                    )}
                  </div>
                  {call.contactName && (
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--text-secondary, #94a3b8)',
                        marginBottom: 4,
                      }}
                    >
                      {call.contactName}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontSize: 12,
                      color: 'var(--text-secondary, #94a3b8)',
                      flexWrap: 'wrap',
                    }}
                  >
                    {rate && <span>${rate}/mo</span>}
                    {call.saveType && <span>{call.saveType}</span>}
                    {excluded && (
                      <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                        Won&apos;t count against you if lost
                      </span>
                    )}
                    {call.saveStatus && (
                      <span
                        style={{
                          background: 'rgba(59,130,246,0.15)',
                          color: '#3b82f6',
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        {call.saveStatus}
                      </span>
                    )}
                  </div>
                </div>

                {/* Days pending counter */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${getDaysColor(daysPending)}33`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        lineHeight: 1,
                        color: getDaysColor(daysPending),
                      }}
                    >
                      {daysPending}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: getDaysColor(daysPending),
                        marginTop: 2,
                      }}
                    >
                      days
                    </span>
                  </div>
                </div>
              </div>

              {/* Suggestion banner */}
              {suggestion && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 20px',
                    background: getSuggestionBg(suggestion.priority),
                    borderTop: '1px solid var(--card-border, #334155)',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <span style={{ flexShrink: 0 }}>-&gt;</span>
                    <span>{suggestion.suggestion}</span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 4,
                      flexShrink: 0,
                      color: getPriorityColor(suggestion.priority),
                      background:
                        suggestion.priority === 'high'
                          ? 'rgba(239,68,68,0.15)'
                          : suggestion.priority === 'medium'
                          ? 'rgba(245,158,11,0.15)'
                          : 'rgba(100,116,139,0.15)',
                    }}
                  >
                    {suggestion.priority}
                  </span>
                </div>
              )}

              {/* Notes section */}
              <div
                style={{
                  borderTop: '1px solid var(--card-border, #334155)',
                  padding: '8px 20px',
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNotes(
                      call.id,
                      call.todoNotes || call.notes || ''
                    );
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary, #94a3b8)',
                    fontSize: 12,
                    cursor: 'pointer',
                    padding: '4px 0',
                  }}
                >
                  {notesOpen
                    ? 'Hide Notes'
                    : call.todoNotes || call.notes
                    ? 'View Notes'
                    : 'Add Notes'}
                </button>
                {notesOpen && (
                  <div style={{ marginTop: 8, marginBottom: 8 }}>
                    <textarea
                      value={
                        noteValues[call.id] !== undefined
                          ? noteValues[call.id]
                          : call.todoNotes || call.notes || ''
                      }
                      onChange={(e) =>
                        setNoteValues((prev) => ({
                          ...prev,
                          [call.id]: e.target.value,
                        }))
                      }
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        minHeight: 80,
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--card-border, #334155)',
                        borderRadius: 6,
                        padding: '8px 12px',
                        color: 'inherit',
                        fontSize: 13,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        saveNotes(call.id);
                      }}
                      style={{
                        marginTop: 6,
                        padding: '6px 16px',
                        fontSize: 12,
                        fontWeight: 600,
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
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
