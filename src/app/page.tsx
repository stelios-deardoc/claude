'use client';

import { useMemo } from 'react';
import { useCallTracker } from '@/lib/store';
import {
  categorizeStatus,
  getContractValue,
  hasGuaranteeIssue,
  isLegalCase,
  getStandingCategory,
  getInitials,
} from '@/lib/call-utils';
import type { Call } from '@/lib/types';

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getBestDate(call: Call): string {
  return call.saveDateTime || call.meetingDate || call.importDate || '';
}

export default function Dashboard() {
  const { calls, openCallModal } = useCallTracker();

  const metrics = useMemo(() => {
    const savedCalls = calls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'saved');
    const lostCalls = calls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'lost');
    const pendingCalls = calls.filter(c => categorizeStatus(c.saveStatus, c.saveType) === 'pending');

    const fullyExcludedLost = lostCalls.filter(c => hasGuaranteeIssue(c) || isLegalCase(c)).length;
    const badStandingOnlyLost = lostCalls.filter(
      c => getStandingCategory(c.paymentStanding) === 'bad' && !hasGuaranteeIssue(c) && !isLegalCase(c)
    ).length;
    const regularLost = lostCalls.length - fullyExcludedLost - badStandingOnlyLost;
    const countableLost = regularLost + badStandingOnlyLost * 0.5;

    const rawDenom = savedCalls.length + lostCalls.length + pendingCalls.length;
    const rawSaveRate = rawDenom > 0 ? Math.round((savedCalls.length / rawDenom) * 100) : 0;

    const commDenom = savedCalls.length + countableLost;
    const commSaveRate = commDenom > 0 ? Math.round((savedCalls.length / commDenom) * 100) : 0;

    const totalSaved = savedCalls.reduce((s, c) => s + getContractValue(c), 0);
    const totalLost = lostCalls.reduce((s, c) => s + getContractValue(c), 0);

    const goodStanding = calls.filter(c => getStandingCategory(c.paymentStanding) === 'good').length;
    const badStanding = calls.filter(c => getStandingCategory(c.paymentStanding) === 'bad').length;

    // Top 5 saved deals by contract value
    const biggestDeals = [...savedCalls]
      .sort((a, b) => getContractValue(b) - getContractValue(a))
      .slice(0, 5);

    // Recent 5 calls sorted by newest date
    const recentSaves = [...calls]
      .sort((a, b) => {
        const da = getBestDate(a);
        const db = getBestDate(b);
        return db.localeCompare(da);
      })
      .slice(0, 5);

    return {
      savedCalls,
      lostCalls,
      pendingCalls,
      fullyExcludedLost,
      badStandingOnlyLost,
      countableLost,
      rawSaveRate,
      commSaveRate,
      totalSaved,
      totalLost,
      goodStanding,
      badStanding,
      biggestDeals,
      recentSaves,
    };
  }, [calls]);

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

  const maxDealValue = metrics.biggestDeals.length > 0 ? getContractValue(metrics.biggestDeals[0]) : 0;

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Save Desk Tracker</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '4px 0 0' }}>
          {calls.length} accounts loaded
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Total Accounts */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Accounts</div>
          <div className="stat-value" style={{ fontSize: '32px', fontWeight: 700, color: 'var(--foreground)' }}>{calls.length}</div>
        </div>

        {/* Saved */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Saved</div>
          <div className="stat-value" style={{ fontSize: '32px', fontWeight: 700, color: 'var(--success)' }}>{metrics.savedCalls.length}</div>
        </div>

        {/* Lost */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lost</div>
          <div className="stat-value" style={{ fontSize: '32px', fontWeight: 700, color: 'var(--danger)' }}>{metrics.lostCalls.length}</div>
        </div>

        {/* Pending */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending</div>
          <div className="stat-value" style={{ fontSize: '32px', fontWeight: 700, color: 'var(--warning)' }}>{metrics.pendingCalls.length}</div>
        </div>

        {/* Save Rate - green gradient */}
        <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #064e3b, #065f46)', border: '1px solid #10b981' }}>
          <div style={{ fontSize: '12px', color: '#6ee7b7', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Comm. Save Rate</div>
          <div style={{ fontSize: '36px', fontWeight: 700, color: '#ecfdf5' }}>{metrics.commSaveRate}%</div>
          <div style={{ fontSize: '12px', color: '#6ee7b7', marginTop: '4px' }}>Raw: {metrics.rawSaveRate}%</div>
        </div>

        {/* MRR Saved */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MRR Saved</div>
          <div className="stat-value" style={{ fontSize: '28px', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(metrics.totalSaved)}</div>
        </div>

        {/* MRR at Risk */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MRR at Risk</div>
          <div className="stat-value" style={{ fontSize: '28px', fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(metrics.totalLost)}</div>
        </div>
      </div>

      {/* Main content: 3 column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>

        {/* Save Metrics */}
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-header" style={{ marginBottom: '20px' }}>
            <h2 className="card-title" style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Save Metrics</h2>
          </div>

          {/* Rates side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={{ textAlign: 'center', padding: '16px', background: '#0f172a', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Commissionable</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--success)' }}>{metrics.commSaveRate}%</div>
            </div>
            <div style={{ textAlign: 'center', padding: '16px', background: '#0f172a', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Raw Rate</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--foreground)' }}>{metrics.rawSaveRate}%</div>
            </div>
          </div>

          {/* Saved / Lost / Pending counts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div style={{ textAlign: 'center', padding: '12px', background: '#0f172a', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--success)' }}>{metrics.savedCalls.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Saved</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#0f172a', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--danger)' }}>{metrics.lostCalls.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Lost</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#0f172a', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--warning)' }}>{metrics.pendingCalls.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Pending</div>
            </div>
          </div>

          {/* Excluded from Commission */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Excluded from Commission</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#0f172a', borderRadius: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px' }}>Guarantee Hits / Legal</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warning)' }}>{metrics.fullyExcludedLost}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#0f172a', borderRadius: '6px' }}>
              <span style={{ fontSize: '13px' }}>Bad Standing (0.5x)</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warning)' }}>{metrics.badStandingOnlyLost}</span>
            </div>
          </div>

          {/* Payment Standing */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Standing</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: '#0f172a', borderRadius: '6px' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)' }}>{metrics.goodStanding}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Good</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: '#0f172a', borderRadius: '6px' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--danger)' }}>{metrics.badStanding}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Bad</div>
              </div>
            </div>
          </div>

          {/* Contract Value Impact */}
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contract Value Impact</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#0f172a', borderRadius: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', color: 'var(--success)' }}>Total Saved</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(metrics.totalSaved)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#0f172a', borderRadius: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--danger)' }}>Total Lost</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(metrics.totalLost)}</span>
            </div>
          </div>
        </div>

        {/* Biggest Deals */}
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-header" style={{ marginBottom: '20px' }}>
            <h2 className="card-title" style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Biggest Deals</h2>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Top 5 saved by contract value</span>
          </div>

          {metrics.biggestDeals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
              <div style={{ fontSize: '14px' }}>No saved deals yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {metrics.biggestDeals.map((deal, idx) => {
                const value = getContractValue(deal);
                const barWidth = maxDealValue > 0 ? (value / maxDealValue) * 100 : 0;
                const truncatedName = deal.accountName.length > 22 ? deal.accountName.slice(0, 22) + '...' : deal.accountName;
                return (
                  <div
                    key={deal.id}
                    onClick={() => openCallModal(deal.id)}
                    style={{ cursor: 'pointer', padding: '12px', background: '#0f172a', borderRadius: '8px', transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#1e293b'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#0f172a'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--muted)', minWidth: '20px' }}>#{idx + 1}</span>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{truncatedName}</span>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(value)}</span>
                    </div>
                    {/* Bar */}
                    <div style={{ height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barWidth}%`, background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      {deal.saveType && (
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{deal.saveType}</span>
                      )}
                      {deal.ratePerMonth && (
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>${deal.ratePerMonth}/mo</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Saves */}
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-header" style={{ marginBottom: '20px' }}>
            <h2 className="card-title" style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Recent Activity</h2>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Last 5 entries</span>
          </div>

          {metrics.recentSaves.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
              <div style={{ fontSize: '14px' }}>No calls yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {metrics.recentSaves.map(call => {
                const category = categorizeStatus(call.saveStatus, call.saveType);
                const standing = getStandingCategory(call.paymentStanding);
                const guarantee = hasGuaranteeIssue(call);
                const badgeClass =
                  category === 'saved' ? 'badge-saved' :
                  category === 'lost' ? 'badge-lost' :
                  category === 'pending' ? 'badge-pending' :
                  'badge-excluded';

                return (
                  <div
                    key={call.id}
                    onClick={() => openCallModal(call.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#0f172a', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#1e293b'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#0f172a'; }}
                  >
                    {/* Avatar */}
                    <div className="avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
                      {getInitials(call.accountName)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {call.accountName}
                        </span>
                        {guarantee && (
                          <span title="Guarantee issue" style={{ fontSize: '12px', color: 'var(--warning)' }}>&#9888;</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--muted)' }}>
                        {call.saveType && <span>{call.saveType}</span>}
                        {call.ratePerMonth && <span>${call.ratePerMonth}/mo</span>}
                      </div>
                    </div>

                    {/* Right side badges */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      <span className={badgeClass}>{category}</span>
                      <span style={{ fontSize: '11px', color: standing === 'bad' ? 'var(--danger)' : standing === 'good' ? 'var(--success)' : 'var(--muted)' }}>
                        {standing === 'bad' ? 'Bad Standing' : standing === 'good' ? 'Good Standing' : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
