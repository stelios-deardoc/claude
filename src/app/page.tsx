'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/theme';
import { useCallTracker } from '@/lib/store';
import {
  categorizeStatus,
  getContractValue,
  hasGuaranteeIssue,
  isLegalCase,
  getStandingCategory,
  getInitials,
  isBadStandingOnly,
  calculateCountableSaved,
  calculateCountableLost,
  calculateCountablePending,
  generateSuggestion,
  getCallMonth,
  getMonthLabel,
  getLast6Months,
  getCurrentMonth,
  getMRR,
} from '@/lib/call-utils';
import { CDP_LEVELS } from '@/lib/commission-data';
import type { Call, CDPLevelKey, Suggestion } from '@/lib/types';

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getBestDate(call: Call): string {
  return call.saveDateTime || call.meetingDate || call.importDate || '';
}

function getDaysPending(call: Call): number {
  const dateStr = call.saveDateTime || call.importDate || call.meetingDate || '';
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

function getDaysPendingColor(days: number): string {
  if (days <= 3) return t.accent;
  if (days <= 7) return t.warning;
  if (days <= 14) return '#f97316';
  return t.danger;
}

// Sparkline component for inline trend visualization
function Sparkline({ data, color, width = 80, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padding = 2;
  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', margin: '4px auto 0' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Dashboard() {
  const { calls, selectedCdpLevel, openCallModal, openImportModal } = useCallTracker();
  const router = useRouter();

  const [syncStatus, setSyncStatus] = useState<{ lastSyncedAt: string | null; reviewCount: number } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  useEffect(() => {
    fetch('/api/sync').then(r => r.json()).then(setSyncStatus).catch(() => {});
  }, []);

  const months6 = useMemo(() => getLast6Months(), []);
  const currentMonth = useMemo(() => getCurrentMonth(), []);

  const filteredCalls = useMemo(() => {
    if (selectedMonth === 'all') return calls;
    return calls.filter(c => getCallMonth(c) === selectedMonth);
  }, [calls, selectedMonth]);

  // Monthly data for trend chart - always uses full calls, not filtered
  const monthlyData = useMemo(() => {
    return months6.map(mk => {
      const monthCalls = calls.filter(c => getCallMonth(c) === mk);
      const saved = monthCalls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'saved');
      const lost = monthCalls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'lost');
      const pending = monthCalls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'pending');
      const total = saved.length + lost.length + pending.length;
      const saveRate = total > 0 ? Math.round((saved.length / total) * 100) : 0;
      const savedMRR = saved.reduce((s, c) => s + getMRR(c), 0);
      const lostMRR = lost.reduce((s, c) => s + getMRR(c), 0);
      const pendingMRR = pending.reduce((s, c) => s + getMRR(c), 0);
      const mrrSaveRate = (savedMRR + lostMRR) > 0 ? Math.round((savedMRR / (savedMRR + lostMRR)) * 100) : 0;
      return { key: mk, saved: saved.length, lost: lost.length, pending: pending.length, total, saveRate, savedMRR, lostMRR, pendingMRR, mrrSaveRate };
    });
  }, [calls, months6]);

  const metrics = useMemo(() => {
    const savedCalls = filteredCalls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'saved');
    const lostCalls = filteredCalls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'lost');
    const pendingCalls = filteredCalls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'pending');

    const fullyExcludedLost = lostCalls.filter(c => hasGuaranteeIssue(c) || isLegalCase(c)).length;

    const badStandingSaved = savedCalls.filter(c => isBadStandingOnly(c)).length;
    const badStandingLost = lostCalls.filter(c => isBadStandingOnly(c)).length;
    const badStandingPending = pendingCalls.filter(c => isBadStandingOnly(c)).length;
    const totalBadStandingAffected = badStandingSaved + badStandingLost + badStandingPending;

    const countableSaved = calculateCountableSaved(savedCalls);
    const countableLost = calculateCountableLost(lostCalls);
    const countablePending = calculateCountablePending(pendingCalls);

    const rawDenom = savedCalls.length + lostCalls.length + pendingCalls.length;
    const rawSaveRate = rawDenom > 0 ? Math.round((savedCalls.length / rawDenom) * 100) : 0;

    const commDenom = countableSaved + countableLost;
    const commSaveRate = commDenom > 0 ? Math.round((countableSaved / commDenom) * 100) : 0;

    const totalSaved = savedCalls.reduce((s, c) => s + getContractValue(c), 0);
    const totalLost = lostCalls.reduce((s, c) => s + getContractValue(c), 0);
    const totalPendingMRR = pendingCalls.reduce((s, c) => s + getContractValue(c), 0);
    const netImpact = totalSaved - totalLost;

    const goodStanding = filteredCalls.filter(c => getStandingCategory(c.paymentStanding) === 'good').length;
    const badStanding = filteredCalls.filter(c => getStandingCategory(c.paymentStanding) === 'bad').length;

    // Top 3 saved deals by contract value
    const biggestDeals = [...savedCalls]
      .sort((a, b) => getContractValue(b) - getContractValue(a))
      .slice(0, 3);

    // Recent 3 calls sorted by newest date
    const recentActivity = [...filteredCalls]
      .sort((a, b) => {
        const da = getBestDate(a);
        const db = getBestDate(b);
        return db.localeCompare(da);
      })
      .slice(0, 3);

    // Pending urgency buckets
    const urgencyBuckets = { early: 0, mid: 0, late: 0, overdue: 0 };
    pendingCalls.forEach(c => {
      const days = getDaysPending(c);
      if (days <= 3) urgencyBuckets.early++;
      else if (days <= 7) urgencyBuckets.mid++;
      else if (days <= 14) urgencyBuckets.late++;
      else urgencyBuckets.overdue++;
    });

    // AI Suggestions for pending calls - top 5 by priority
    const suggestions: (Suggestion & { call: Call })[] = [];
    pendingCalls.forEach(c => {
      const days = getDaysPending(c);
      const suggestion = generateSuggestion(c, days);
      if (suggestion) {
        suggestions.push({ ...suggestion, call: c });
      }
    });
    suggestions.sort((a, b) => b.priorityScore - a.priorityScore);
    const topSuggestions = suggestions.slice(0, 5);

    // Commission tier lookup
    const tiers = CDP_LEVELS[selectedCdpLevel].tiers;
    const matchedTier = tiers.find(t => commSaveRate >= t.saveRate) || tiers[tiers.length - 1];
    const matchedIdx = tiers.indexOf(matchedTier);
    const nextTier = matchedIdx > 0 ? tiers[matchedIdx - 1] : null;

    return {
      savedCalls,
      lostCalls,
      pendingCalls,
      fullyExcludedLost,
      totalBadStandingAffected,
      countableSaved,
      countableLost,
      countablePending,
      rawSaveRate,
      commSaveRate,
      totalSaved,
      totalLost,
      totalPendingMRR,
      netImpact,
      goodStanding,
      badStanding,
      biggestDeals,
      recentActivity,
      urgencyBuckets,
      topSuggestions,
      matchedTier,
      nextTier,
    };
  }, [filteredCalls, selectedCdpLevel]);

  if (calls.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: 'var(--muted)' }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--foreground)' }}>No Data Yet</div>
        <div style={{ fontSize: '14px', textAlign: 'center', maxWidth: '320px' }}>
          Import your Salesforce data to get started
        </div>
      </div>
    );
  }

  // Donut chart values
  const donutSize = 140;
  const strokeWidth = 14;
  const radius = (donutSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const donutOffset = circumference - (metrics.commSaveRate / 100) * circumference;

  // Urgency bar
  const totalPending = metrics.pendingCalls.length;
  const urgencyTotal = totalPending || 1;
  const earlyPct = (metrics.urgencyBuckets.early / urgencyTotal) * 100;
  const midPct = (metrics.urgencyBuckets.mid / urgencyTotal) * 100;
  const latePct = (metrics.urgencyBuckets.late / urgencyTotal) * 100;
  const overduePct = (metrics.urgencyBuckets.overdue / urgencyTotal) * 100;

  // Commission progress
  const currentRate = metrics.commSaveRate;
  const currentTierRate = metrics.matchedTier.saveRate;
  const nextTierRate = metrics.nextTier ? metrics.nextTier.saveRate : currentTierRate;
  const progressToNext = metrics.nextTier
    ? Math.min(100, Math.max(0, ((currentRate - currentTierRate) / (nextTierRate - currentTierRate)) * 100))
    : 100;

  // Biggest deals
  const maxDealValue = metrics.biggestDeals.length > 0 ? getContractValue(metrics.biggestDeals[0]) : 0;

  const cardStyle: React.CSSProperties = {
    background: t.cardBg,
    border: `1px solid ${t.cardBorder}`,
    borderRadius: '12px',
    padding: '20px',
  };

  const miniStatStyle = (color: string): React.CSSProperties => ({
    background: t.bg,
    borderRadius: '8px',
    padding: '12px',
    textAlign: 'center' as const,
  });

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: t.bg }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: t.fg }}>Command Center</h1>
        <p style={{ fontSize: '13px', color: t.muted, margin: '4px 0 0' }}>
          {selectedMonth === 'all'
            ? `${calls.length} accounts loaded`
            : `${filteredCalls.length} accounts in ${getMonthLabel(selectedMonth)}`}
        </p>
        {syncStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <span style={{ fontSize: 12, color: t.muted }}>
              {syncStatus.lastSyncedAt
                ? `Last sync: ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                : 'Not synced yet'}
            </span>
            {syncStatus.reviewCount > 0 && (
              <span style={{ fontSize: 12, color: t.warning, fontWeight: 600 }}>
                {syncStatus.reviewCount} items to review
              </span>
            )}
          </div>
        )}
        {/* Month Selector Pill Bar */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
          {[{ key: 'all', label: 'All Time' }, ...months6.map(mk => ({ key: mk, label: getMonthLabel(mk) + (mk === currentMonth ? ' *' : '') }))].map(item => (
            <button
              key={item.key}
              onClick={() => setSelectedMonth(item.key)}
              style={{
                padding: '5px 14px',
                borderRadius: '20px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: selectedMonth === item.key ? '#6366f1' : t.cardBg,
                color: selectedMonth === item.key ? '#fff' : t.textSecondary,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Save Rate Donut | Revenue Impact | Commission Snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>

        {/* Save Rate Donut */}
        <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #064e3b, #065f46)', border: `1px solid ${t.success}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '12px', color: '#6ee7b7', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Commission Save Rate</div>
          <div style={{ position: 'relative', width: donutSize, height: donutSize }}>
            <svg width={donutSize} height={donutSize} style={{ transform: 'rotate(-90deg)' }}>
              {/* Background ring */}
              <circle
                cx={donutSize / 2}
                cy={donutSize / 2}
                r={radius}
                fill="none"
                stroke={t.cardBorder}
                strokeWidth={strokeWidth}
              />
              {/* Value arc */}
              <circle
                cx={donutSize / 2}
                cy={donutSize / 2}
                r={radius}
                fill="none"
                stroke={t.success}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={donutOffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            {/* Center text */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <span style={{ fontSize: '28px', fontWeight: 700, color: '#ecfdf5' }}>{metrics.commSaveRate}%</span>
              {(() => {
                const curIdx = months6.indexOf(currentMonth);
                if (curIdx > 0) {
                  const curMrr = monthlyData[curIdx].mrrSaveRate;
                  const prevMrr = monthlyData[curIdx - 1].mrrSaveRate;
                  const delta = curMrr - prevMrr;
                  const deltaColor = delta >= 0 ? t.success : t.danger;
                  const sign = delta >= 0 ? '+' : '';
                  return (
                    <span style={{ fontSize: '9px', color: deltaColor, fontWeight: 600, marginTop: '2px' }}>
                      {sign}{delta}% vs last mo
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          </div>
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6ee7b7' }}>Raw: {metrics.rawSaveRate}%</div>
            <div style={{ fontSize: '11px', color: '#a7f3d0', marginTop: '4px' }}>
              S: {metrics.savedCalls.length} | L: {metrics.lostCalls.length} | P: {metrics.pendingCalls.length}
            </div>
          </div>
        </div>

        {/* Revenue Impact */}
        <div style={cardStyle}>
          <div style={{ fontSize: '12px', color: t.muted, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Revenue Impact</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={miniStatStyle(t.success)}>
              <div style={{ fontSize: '11px', color: t.muted, marginBottom: '4px', textTransform: 'uppercase' }}>Saved MRR</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: t.success }}>{formatCurrency(metrics.totalSaved)}</div>
              <Sparkline data={monthlyData.map(m => m.savedMRR)} color={t.success} />
            </div>
            <div style={miniStatStyle(t.danger)}>
              <div style={{ fontSize: '11px', color: t.muted, marginBottom: '4px', textTransform: 'uppercase' }}>Lost MRR</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: t.danger }}>{formatCurrency(metrics.totalLost)}</div>
              <Sparkline data={monthlyData.map(m => m.lostMRR)} color={t.danger} />
            </div>
            <div style={miniStatStyle(t.warning)}>
              <div style={{ fontSize: '11px', color: t.muted, marginBottom: '4px', textTransform: 'uppercase' }}>Pending MRR</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: t.warning }}>{formatCurrency(metrics.totalPendingMRR)}</div>
              <Sparkline data={monthlyData.map(m => m.pendingMRR)} color={t.warning} />
            </div>
            <div style={miniStatStyle(metrics.netImpact >= 0 ? t.accent : t.danger)}>
              <div style={{ fontSize: '11px', color: t.muted, marginBottom: '4px', textTransform: 'uppercase' }}>Net Impact</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: metrics.netImpact >= 0 ? t.accent : t.danger }}>{formatCurrency(metrics.netImpact)}</div>
              <Sparkline data={monthlyData.map(m => m.savedMRR - m.lostMRR)} color={t.accent} />
            </div>
          </div>
        </div>

        {/* Commission Snapshot */}
        <div style={cardStyle}>
          <div style={{ fontSize: '12px', color: t.muted, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Commission Snapshot</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: t.fg }}>{CDP_LEVELS[selectedCdpLevel].name}</span>
            <span style={{ fontSize: '12px', color: t.muted }}>Save Rate: {metrics.commSaveRate}%</span>
          </div>
          <div style={{ background: t.bg, borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: t.muted, textTransform: 'uppercase' }}>Current Tier</span>
              <span style={{ fontSize: '11px', color: t.muted }}>{metrics.matchedTier.saveRate}% save rate</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: t.success, marginBottom: '2px' }}>{metrics.matchedTier.revenuePercent}%</div>
            <div style={{ fontSize: '11px', color: t.muted }}>Revenue Commission</div>
          </div>
          {/* Progress to next tier */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: t.muted }}>
                {metrics.nextTier ? `Next: ${metrics.nextTier.saveRate}% - ${metrics.nextTier.revenuePercent}%` : 'Max tier reached'}
              </span>
              <span style={{ fontSize: '11px', color: t.muted }}>{Math.round(progressToNext)}%</span>
            </div>
            <div style={{ height: '6px', background: t.bg, borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressToNext}%`, background: 'linear-gradient(90deg, #3b82f6, #6366f1)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        </div>
      </div>

      {/* 6-Month Trend Chart */}
      <div style={{ ...cardStyle, marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>6-Month Trend</div>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 8, height: 8, borderRadius: 2, background: t.success }} /><span style={{ fontSize: 11, color: t.textSecondary }}>Saved</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 8, height: 8, borderRadius: 2, background: t.danger }} /><span style={{ fontSize: 11, color: t.textSecondary }}>Lost</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 8, height: 8, borderRadius: 2, background: t.warning }} /><span style={{ fontSize: 11, color: t.textSecondary }}>Pending</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 8, height: 3, borderRadius: 1, background: '#6366f1' }} /><span style={{ fontSize: 11, color: t.textSecondary }}>MRR Save Rate</span></div>
          </div>
        </div>
        {(() => {
          const chartW = 600;
          const chartH = 200;
          const padL = 40;
          const padR = 20;
          const padT = 30;
          const padB = 40;
          const plotW = chartW - padL - padR;
          const plotH = chartH - padT - padB;
          const barGroupW = plotW / months6.length;
          const barW = Math.min(barGroupW * 0.6, 40);
          const maxTotal = Math.max(...monthlyData.map(m => m.total), 1);

          return (
            <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ display: 'block' }}>
              {/* Y-axis gridlines and labels */}
              {[0, 25, 50, 75, 100].map(pct => {
                const y = padT + plotH - (pct / 100) * plotH;
                return (
                  <g key={pct}>
                    <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke={t.cardBorder} strokeWidth="0.5" strokeDasharray={pct === 0 ? '' : '4,4'} />
                    <text x={padL - 6} y={y + 3} fill={t.muted} fontSize="9" textAnchor="end">{pct}%</text>
                  </g>
                );
              })}

              {/* Bars per month */}
              {monthlyData.map((m, i) => {
                const cx = padL + barGroupW * i + barGroupW / 2;
                const bx = cx - barW / 2;
                const totalH = m.total > 0 ? (m.total / maxTotal) * plotH : 0;
                const savedH = m.total > 0 ? (m.saved / m.total) * totalH : 0;
                const lostH = m.total > 0 ? (m.lost / m.total) * totalH : 0;
                const pendingH = m.total > 0 ? (m.pending / m.total) * totalH : 0;
                const baseY = padT + plotH;
                const shortLabel = getMonthLabel(m.key).split(' ')[0];
                return (
                  <g key={m.key}>
                    {/* Stacked bars: saved (bottom), lost (middle), pending (top) */}
                    {savedH > 0 && <rect x={bx} y={baseY - savedH} width={barW} height={savedH} fill={t.success} rx="2" />}
                    {lostH > 0 && <rect x={bx} y={baseY - savedH - lostH} width={barW} height={lostH} fill={t.danger} rx="2" />}
                    {pendingH > 0 && <rect x={bx} y={baseY - savedH - lostH - pendingH} width={barW} height={pendingH} fill={t.warning} rx="2" />}
                    {/* Rate label above bars */}
                    {m.total > 0 && (
                      <text x={cx} y={baseY - totalH - 6} fill={t.fg} fontSize="9" textAnchor="middle" fontWeight="600">{m.saveRate}%</text>
                    )}
                    {/* X-axis month label */}
                    <text x={cx} y={baseY + 14} fill={t.textSecondary} fontSize="10" textAnchor="middle">{shortLabel}</text>
                    {/* Total count below */}
                    <text x={cx} y={baseY + 26} fill={t.muted} fontSize="8" textAnchor="middle">{m.total}</text>
                  </g>
                );
              })}

              {/* MRR Save Rate trend line (indigo) */}
              {(() => {
                const pts = monthlyData.map((m, i) => {
                  const cx = padL + (plotW / months6.length) * i + (plotW / months6.length) / 2;
                  const y = padT + plotH - (m.mrrSaveRate / 100) * plotH;
                  return { x: cx, y };
                });
                const linePoints = pts.map(p => `${p.x},${p.y}`).join(' ');
                return (
                  <>
                    <polyline points={linePoints} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {pts.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="3" fill="#6366f1" stroke={t.bg} strokeWidth="1.5" />
                    ))}
                  </>
                );
              })()}
            </svg>
          );
        })()}
      </div>

      {/* Row 2: Pending Urgency | Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginBottom: '20px' }}>

        {/* Pending Urgency Breakdown */}
        <div style={cardStyle}>
          <div style={{ fontSize: '12px', color: t.muted, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Pending Urgency Breakdown</div>
          {totalPending === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px', color: t.muted, fontSize: '13px' }}>No pending accounts</div>
          ) : (
            <>
              <svg width="100%" height="32" style={{ borderRadius: '6px', overflow: 'hidden', display: 'block' }}>
                {earlyPct > 0 && (
                  <rect x="0%" y="0" width={`${earlyPct}%`} height="32" fill={t.accent} />
                )}
                {midPct > 0 && (
                  <rect x={`${earlyPct}%`} y="0" width={`${midPct}%`} height="32" fill={t.warning} />
                )}
                {latePct > 0 && (
                  <rect x={`${earlyPct + midPct}%`} y="0" width={`${latePct}%`} height="32" fill="#f97316" />
                )}
                {overduePct > 0 && (
                  <rect x={`${earlyPct + midPct + latePct}%`} y="0" width={`${overduePct}%`} height="32" fill={t.danger} />
                )}
              </svg>
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: t.accent }} />
                  <span style={{ fontSize: '12px', color: t.fg }}>0-3 days ({metrics.urgencyBuckets.early})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: t.warning }} />
                  <span style={{ fontSize: '12px', color: t.fg }}>4-7 days ({metrics.urgencyBuckets.mid})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f97316' }} />
                  <span style={{ fontSize: '12px', color: t.fg }}>8-14 days ({metrics.urgencyBuckets.late})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: t.danger }} />
                  <span style={{ fontSize: '12px', color: t.fg }}>14+ days ({metrics.urgencyBuckets.overdue})</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick Stats */}
        <div style={cardStyle}>
          <div style={{ fontSize: '12px', color: t.muted, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Quick Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: t.bg, borderRadius: '6px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: t.muted }}>Saved pts</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: t.success }}>{metrics.countableSaved}</span>
            </div>
            <div style={{ background: t.bg, borderRadius: '6px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: t.muted }}>Lost pts</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: t.danger }}>{metrics.countableLost}</span>
            </div>
            <div style={{ background: t.bg, borderRadius: '6px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: t.muted }}>Pending pts</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: t.warning }}>{metrics.countablePending}</span>
            </div>
            <div style={{ background: t.bg, borderRadius: '6px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: t.muted }}>Bad Standing</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: t.danger }}>{metrics.totalBadStandingAffected}</span>
            </div>
            <div style={{ background: t.bg, borderRadius: '6px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: t.muted }}>Guarantee Excl.</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: t.warning }}>{metrics.fullyExcludedLost}</span>
            </div>
            <div style={{ background: t.bg, borderRadius: '6px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: t.muted }}>Good Standing</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: t.success }}>{metrics.goodStanding}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <button
          onClick={() => openImportModal()}
          style={{ ...cardStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', border: `1px solid ${t.cardBorder}`, fontSize: '14px', fontWeight: 600, color: t.fg, transition: 'background 0.15s, border-color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = t.cardBorder; e.currentTarget.style.borderColor = t.textTertiary; }}
          onMouseLeave={e => { e.currentTarget.style.background = t.cardBg; e.currentTarget.style.borderColor = t.cardBorder; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Import Data
        </button>
        <button
          onClick={() => openCallModal()}
          style={{ ...cardStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', border: `1px solid ${t.cardBorder}`, fontSize: '14px', fontWeight: 600, color: t.fg, transition: 'background 0.15s, border-color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = t.cardBorder; e.currentTarget.style.borderColor = t.textTertiary; }}
          onMouseLeave={e => { e.currentTarget.style.background = t.cardBg; e.currentTarget.style.borderColor = t.cardBorder; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Account
        </button>
        <button
          onClick={() => router.push('/list')}
          style={{ ...cardStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', border: `1px solid ${t.cardBorder}`, fontSize: '14px', fontWeight: 600, color: t.fg, transition: 'background 0.15s, border-color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = t.cardBorder; e.currentTarget.style.borderColor = t.textTertiary; }}
          onMouseLeave={e => { e.currentTarget.style.background = t.cardBg; e.currentTarget.style.borderColor = t.cardBorder; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          View All Saves
        </button>
      </div>

      {/* Row 4: Accounts Needing Attention | Biggest Deals + Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '20px' }}>

        {/* Accounts Needing Attention */}
        <div style={cardStyle}>
          <div style={{ fontSize: '12px', color: t.muted, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Accounts Needing Attention</div>
          {metrics.topSuggestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: t.muted, fontSize: '13px' }}>No pending accounts with actionable suggestions</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {metrics.topSuggestions.map(item => {
                const days = item.daysPending;
                const dayColor = getDaysPendingColor(days);
                const priorityColor = item.priority === 'high' ? t.danger : item.priority === 'medium' ? t.warning : t.accent;
                return (
                  <div
                    key={item.accountId}
                    onClick={() => openCallModal(item.accountId)}
                    style={{ background: t.bg, borderRadius: '8px', padding: '12px 14px', cursor: 'pointer', transition: 'background 0.15s', border: '1px solid transparent' }}
                    onMouseEnter={e => { e.currentTarget.style.background = t.cardBg; e.currentTarget.style.borderColor = t.textTertiary; }}
                    onMouseLeave={e => { e.currentTarget.style.background = t.bg; e.currentTarget.style.borderColor = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: t.fg }}>{item.accountName}</span>
                        {item.contactName && (
                          <span style={{ fontSize: '12px', color: t.muted }}>{item.contactName}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {item.contractValue > 0 && (
                          <span style={{ fontSize: '11px', fontWeight: 600, color: t.success, background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '10px' }}>
                            {formatCurrency(item.contractValue)}
                          </span>
                        )}
                        <span style={{ fontSize: '11px', fontWeight: 600, color: dayColor, background: `${dayColor}15`, padding: '2px 8px', borderRadius: '10px' }}>
                          {days}d
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: priorityColor, background: `${priorityColor}15`, padding: '2px 6px', borderRadius: '10px', textTransform: 'uppercase' }}>
                          {item.priority}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: t.textSecondary }}>
                      {item.suggestion}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Biggest Deals + Recent Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Biggest Deals */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Biggest Deals</div>
              <span style={{ fontSize: '11px', color: t.muted }}>Top 3 saved</span>
            </div>
            {metrics.biggestDeals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: t.muted, fontSize: '13px' }}>No saved deals yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {metrics.biggestDeals.map((deal, idx) => {
                  const value = getContractValue(deal);
                  const barWidth = maxDealValue > 0 ? (value / maxDealValue) * 100 : 0;
                  const truncatedName = deal.accountName.length > 20 ? deal.accountName.slice(0, 20) + '...' : deal.accountName;
                  return (
                    <div
                      key={deal.id}
                      onClick={() => openCallModal(deal.id)}
                      style={{ cursor: 'pointer', padding: '8px 10px', background: t.bg, borderRadius: '6px', transition: 'background 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = t.cardBg; }}
                      onMouseLeave={e => { e.currentTarget.style.background = t.bg; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: t.muted }}>#{idx + 1}</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: t.fg }}>{truncatedName}</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: t.success }}>{formatCurrency(value)}</span>
                      </div>
                      <div style={{ height: '4px', background: t.cardBg, borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${barWidth}%`, background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '2px', transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Recent Activity</div>
              <span style={{ fontSize: '11px', color: t.muted }}>Last 3</span>
            </div>
            {metrics.recentActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: t.muted, fontSize: '13px' }}>No activity yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {metrics.recentActivity.map(call => {
                  const category = categorizeStatus(call.saveStatus, call.saveType);
                  const badgeColor = category === 'saved' ? t.success : category === 'lost' ? t.danger : category === 'pending' ? t.warning : t.muted;
                  const notesPreview = (call.notes || call.accountingNotes || '').slice(0, 50);
                  return (
                    <div
                      key={call.id}
                      onClick={() => openCallModal(call.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: t.bg, borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = t.cardBg; }}
                      onMouseLeave={e => { e.currentTarget.style.background = t.bg; }}
                    >
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: t.cardBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: t.fg, flexShrink: 0 }}>
                        {getInitials(call.accountName)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: t.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {call.accountName}
                        </div>
                        {notesPreview && (
                          <div style={{ fontSize: '11px', color: t.textTertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                            {notesPreview}{notesPreview.length >= 50 ? '...' : ''}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: badgeColor, background: `${badgeColor}15`, padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase', flexShrink: 0 }}>
                        {category}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
