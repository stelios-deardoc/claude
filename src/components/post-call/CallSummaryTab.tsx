'use client';

import { t } from '@/lib/theme';
import type { PostCallSummary } from '@/lib/types';

interface Props {
  summary: PostCallSummary;
  accountName: string;
  contactName: string;
  processedAt: string;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'var(--success)',
  neutral: 'var(--warning)',
  negative: 'var(--danger)',
};

export default function CallSummaryTab({ summary, accountName, contactName, processedAt }: Props) {
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: t.fg }}>{accountName}</h3>
          <span style={{
            fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '10px',
            background: `${SENTIMENT_COLORS[summary.sentiment]}22`,
            color: SENTIMENT_COLORS[summary.sentiment],
          }}>
            {summary.sentiment}
          </span>
        </div>
        <div style={{ fontSize: '13px', color: t.muted }}>
          {contactName} - {processedAt ? new Date(processedAt).toLocaleString() : ''}
        </div>
      </div>

      {/* Overview */}
      <div style={{ padding: '16px', background: t.cardBg, borderRadius: '8px', border: `1px solid ${t.cardBorder}` }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: t.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Summary</div>
        <div style={{ fontSize: '14px', color: t.fg, lineHeight: '1.6' }}>{summary.overview}</div>
      </div>

      {/* Discussion Points */}
      {summary.discussionPoints.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: t.muted, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Discussion Points</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {summary.discussionPoints.map((dp, i) => (
              <div key={i} style={{ padding: '12px 16px', background: t.cardBg, borderRadius: '8px', border: `1px solid ${t.cardBorder}` }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: t.fg, marginBottom: '4px' }}>{dp.topic}</div>
                <div style={{ fontSize: '12px', color: t.textSecondary, lineHeight: '1.5' }}>{dp.details}</div>
                {dp.outcome && (
                  <div style={{ fontSize: '12px', color: t.accent, marginTop: '6px' }}>Outcome: {dp.outcome}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decisions */}
      {summary.decisions.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: t.muted, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Decisions Made</div>
          <ul style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {summary.decisions.map((d, i) => (
              <li key={i} style={{ fontSize: '13px', color: t.fg, lineHeight: '1.5' }}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Steps */}
      {summary.nextSteps.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: t.muted, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next Steps</div>
          <ul style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {summary.nextSteps.map((s, i) => (
              <li key={i} style={{ fontSize: '13px', color: t.fg, lineHeight: '1.5' }}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk Flags */}
      {summary.riskFlags.length > 0 && (
        <div style={{ padding: '14px 16px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: t.danger, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Risk Flags</div>
          <ul style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {summary.riskFlags.map((r, i) => (
              <li key={i} style={{ fontSize: '13px', color: t.danger, lineHeight: '1.5' }}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
