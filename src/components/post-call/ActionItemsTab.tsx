'use client';

import { t } from '@/lib/theme';
import type { PostCallActionItem } from '@/lib/types';

interface Props {
  actions: PostCallActionItem[];
  resultId: string;
  onAccept: (resultId: string, actionId: string) => void;
  onDismiss: (resultId: string, actionId: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'var(--danger)',
  medium: 'var(--warning)',
  low: 'var(--muted)',
};

const OWNER_LABELS: Record<string, string> = {
  stelios: 'You',
  client: 'Client',
  internal: 'Team',
};

export default function ActionItemsTab({ actions, resultId, onAccept, onDismiss }: Props) {
  const pending = actions.filter(a => a.status === 'pending');
  const accepted = actions.filter(a => a.status === 'accepted');
  const dismissed = actions.filter(a => a.status === 'dismissed');

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Action Items ({actions.length})
        </div>
        <div style={{ fontSize: '12px', color: t.muted }}>
          {pending.length} pending - {accepted.length} accepted - {dismissed.length} dismissed
        </div>
      </div>

      {pending.length === 0 && accepted.length === 0 && dismissed.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: t.muted, fontSize: '13px' }}>
          No action items generated for this call.
        </div>
      )}

      {/* Pending actions */}
      {pending.map(action => (
        <div key={action.id} style={{ padding: '14px 16px', background: t.cardBg, borderRadius: '8px', border: `1px solid ${t.cardBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{
                  fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                  background: `${PRIORITY_COLORS[action.priority]}22`,
                  color: PRIORITY_COLORS[action.priority],
                  textTransform: 'uppercase',
                }}>
                  {action.priority}
                </span>
                <span style={{ fontSize: '11px', color: t.muted, padding: '2px 6px', background: t.hoverBg, borderRadius: '4px' }}>
                  {OWNER_LABELS[action.owner] || action.owner}
                </span>
                <span style={{ fontSize: '11px', color: t.muted, padding: '2px 6px', background: t.hoverBg, borderRadius: '4px' }}>
                  {action.category}
                </span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: t.fg, marginBottom: '4px' }}>{action.task}</div>
              <div style={{ fontSize: '12px', color: t.textSecondary, lineHeight: '1.5' }}>{action.details}</div>
              {action.deadline && (
                <div style={{ fontSize: '11px', color: t.warning, marginTop: '6px' }}>Due: {action.deadline}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button
                onClick={() => onAccept(resultId, action.id)}
                style={{
                  padding: '6px 12px', fontSize: '12px', fontWeight: 600,
                  background: 'var(--success)', color: '#fff',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                }}
              >
                Accept
              </button>
              <button
                onClick={() => onDismiss(resultId, action.id)}
                style={{
                  padding: '6px 12px', fontSize: '12px',
                  background: 'transparent', color: t.muted,
                  border: `1px solid ${t.cardBorder}`, borderRadius: '6px', cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Accepted actions */}
      {accepted.length > 0 && (
        <>
          <div style={{ fontSize: '11px', fontWeight: 600, color: t.success, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px' }}>Accepted</div>
          {accepted.map(action => (
            <div key={action.id} style={{ padding: '10px 16px', background: t.cardBg, borderRadius: '8px', border: `1px solid ${t.cardBorder}`, opacity: 0.7 }}>
              <div style={{ fontSize: '13px', color: t.fg }}>{action.task}</div>
              <div style={{ fontSize: '11px', color: t.success, marginTop: '2px' }}>Added to Actions</div>
            </div>
          ))}
        </>
      )}

      {/* Dismissed actions */}
      {dismissed.length > 0 && (
        <>
          <div style={{ fontSize: '11px', fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px' }}>Dismissed</div>
          {dismissed.map(action => (
            <div key={action.id} style={{ padding: '10px 16px', background: t.cardBg, borderRadius: '8px', border: `1px solid ${t.cardBorder}`, opacity: 0.4 }}>
              <div style={{ fontSize: '13px', color: t.muted, textDecoration: 'line-through' }}>{action.task}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
