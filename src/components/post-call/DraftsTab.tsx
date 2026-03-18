'use client';

import { useState } from 'react';
import { t } from '@/lib/theme';
import type { PostCallDraft } from '@/lib/types';

interface Props {
  drafts: PostCallDraft[];
  resultId: string;
  onCreateGmailDraft: (resultId: string, draftId: string, body?: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  'client-followup': 'Client Follow-up',
  'internal-update': 'Internal Update',
  'escalation': 'Escalation',
};

const TYPE_COLORS: Record<string, string> = {
  'client-followup': 'var(--accent)',
  'internal-update': 'var(--success)',
  'escalation': 'var(--danger)',
};

export default function DraftsTab({ drafts, resultId, onCreateGmailDraft }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  const startEdit = (draft: PostCallDraft) => {
    setEditingId(draft.id);
    setEditBody(draft.body);
  };

  const saveAndCreate = (draftId: string) => {
    onCreateGmailDraft(resultId, draftId, editBody);
    setEditingId(null);
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Email Drafts ({drafts.length})
      </div>

      {drafts.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: t.muted, fontSize: '13px' }}>
          No email drafts generated for this call.
        </div>
      )}

      {drafts.map(draft => (
        <div key={draft.id} style={{ padding: '16px', background: t.cardBg, borderRadius: '8px', border: `1px solid ${t.cardBorder}` }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
              background: `${TYPE_COLORS[draft.type] || t.accent}22`,
              color: TYPE_COLORS[draft.type] || t.accent,
              textTransform: 'uppercase',
            }}>
              {TYPE_LABELS[draft.type] || draft.type}
            </span>
            <span style={{ fontSize: '11px', color: t.muted }}>
              {draft.tone}
            </span>
            {draft.gmailDraftId && (
              <span style={{ fontSize: '11px', color: t.success, fontWeight: 600 }}>
                Created in Gmail
              </span>
            )}
          </div>

          {/* Email fields */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', color: t.muted, marginBottom: '2px' }}>To: <span style={{ color: t.fg }}>{draft.to}</span></div>
            <div style={{ fontSize: '12px', color: t.muted }}>Subject: <span style={{ color: t.fg, fontWeight: 600 }}>{draft.subject}</span></div>
          </div>

          {/* Strategy note */}
          {draft.strategy && (
            <div style={{ fontSize: '11px', color: t.accent, marginBottom: '10px', fontStyle: 'italic' }}>
              Strategy: {draft.strategy}
            </div>
          )}

          {/* Body */}
          {editingId === draft.id ? (
            <div>
              <textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                style={{
                  width: '100%', minHeight: '200px', padding: '12px',
                  background: t.inputBg, border: `1px solid ${t.cardBorder}`,
                  borderRadius: '6px', color: t.fg, fontSize: '13px',
                  fontFamily: 'inherit', lineHeight: '1.6', resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  onClick={() => saveAndCreate(draft.id)}
                  style={{
                    padding: '8px 16px', fontSize: '12px', fontWeight: 600,
                    background: t.accent, color: '#fff',
                    border: 'none', borderRadius: '6px', cursor: 'pointer',
                  }}
                >
                  Save & Create in Gmail
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{
                    padding: '8px 16px', fontSize: '12px',
                    background: 'transparent', color: t.muted,
                    border: `1px solid ${t.cardBorder}`, borderRadius: '6px', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{
                padding: '12px', background: t.inputBg, borderRadius: '6px',
                fontSize: '13px', color: t.fg, lineHeight: '1.6',
                whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto',
              }}>
                {draft.body}
              </div>
              {!draft.gmailDraftId && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    onClick={() => onCreateGmailDraft(resultId, draft.id)}
                    style={{
                      padding: '8px 16px', fontSize: '12px', fontWeight: 600,
                      background: t.accent, color: '#fff',
                      border: 'none', borderRadius: '6px', cursor: 'pointer',
                    }}
                  >
                    Create in Gmail
                  </button>
                  <button
                    onClick={() => startEdit(draft)}
                    style={{
                      padding: '8px 16px', fontSize: '12px',
                      background: 'transparent', color: t.fg,
                      border: `1px solid ${t.cardBorder}`, borderRadius: '6px', cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
