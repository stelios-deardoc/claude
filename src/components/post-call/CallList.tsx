'use client';

import { t } from '@/lib/theme';
import type { PostCallResult } from '@/lib/types';

interface CallListProps {
  results: PostCallResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onProcessLatest: () => void;
  onRefresh: () => void;
  processing: boolean;
  unprocessedCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  complete: 'var(--success)',
  processing: 'var(--warning)',
  gathering: 'var(--warning)',
  pending: 'var(--muted)',
  error: 'var(--danger)',
};

const SENTIMENT_ICONS: Record<string, string> = {
  positive: '+',
  neutral: '~',
  negative: '-',
};

export default function CallList({ results, selectedId, onSelect, onProcessLatest, onRefresh, processing, unprocessedCount }: CallListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: t.fg }}>Post-Call Center</h2>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: t.muted }}>
            {results.length} processed{unprocessedCount > 0 ? ` - ${unprocessedCount} new` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onRefresh}
            style={{ padding: '6px 10px', fontSize: '12px', background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '6px', color: t.fg, cursor: 'pointer' }}
          >
            Refresh
          </button>
          <button
            onClick={onProcessLatest}
            disabled={processing}
            style={{
              padding: '6px 12px', fontSize: '12px', fontWeight: 600,
              background: processing ? t.muted : t.accent, color: '#fff',
              border: 'none', borderRadius: '6px', cursor: processing ? 'not-allowed' : 'pointer',
            }}
          >
            {processing ? 'Processing...' : 'Process Latest Call'}
          </button>
        </div>
      </div>

      {/* Unprocessed banner */}
      {unprocessedCount > 0 && !processing && (
        <div style={{
          padding: '10px 20px', background: 'rgba(59, 130, 246, 0.1)',
          borderBottom: `1px solid ${t.cardBorder}`, fontSize: '13px', color: t.accent,
        }}>
          {unprocessedCount} new transcript{unprocessedCount > 1 ? 's' : ''} detected
        </div>
      )}

      {/* Results list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {results.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: t.muted, fontSize: '13px' }}>
            No processed calls yet. Click &quot;Process Latest Call&quot; to get started.
          </div>
        ) : (
          results.map(result => (
            <div
              key={result.id}
              onClick={() => onSelect(result.id)}
              style={{
                padding: '14px 20px', cursor: 'pointer',
                borderBottom: `1px solid ${t.cardBorder}`,
                background: selectedId === result.id ? t.activeBg : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (selectedId !== result.id) e.currentTarget.style.background = t.hoverBg; }}
              onMouseLeave={e => { if (selectedId !== result.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: t.fg }}>{result.accountName || 'Unknown Account'}</span>
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                  background: `${STATUS_COLORS[result.status]}22`,
                  color: STATUS_COLORS[result.status],
                }}>
                  {result.status}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: t.textSecondary, marginBottom: '4px' }}>
                {result.contactName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: t.muted }}>
                <span>{result.processedAt ? new Date(result.processedAt).toLocaleDateString() : '--'}</span>
                {result.status === 'complete' && (
                  <>
                    <span>{result.actionItems.length} actions</span>
                    <span>{result.emailDrafts.length} drafts</span>
                    <span title={`Sentiment: ${result.summary.sentiment}`}>
                      {SENTIMENT_ICONS[result.summary.sentiment] || ''}
                    </span>
                  </>
                )}
              </div>
              {result.summary?.overview && (
                <div style={{ fontSize: '12px', color: t.muted, marginTop: '6px', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {result.summary.overview}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
