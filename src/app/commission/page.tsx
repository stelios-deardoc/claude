'use client';

import React, { useMemo } from 'react';
import { useCallTracker } from '@/lib/store';
import {
  categorizeStatus,
  getContractValue,
  calculateCountableLost,
  hasGuaranteeIssue,
  isLegalCase,
  isBadStandingOnly,
  isFullyExcludedFromCommission,
} from '@/lib/call-utils';
import { CDP_LEVELS } from '@/lib/commission-data';
import type { Call, Split, CDPLevelKey, CDPTier } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function generateSplitId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// ---------------------------------------------------------------------------
// Styles (dark theme, inline)
// ---------------------------------------------------------------------------

const card: React.CSSProperties = {
  background: 'var(--card-bg, #1e1e2e)',
  border: '1px solid var(--card-border, #2e2e3e)',
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
};

const cardTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#a1a1aa',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: 12,
};

const green = '#22c55e';
const red = '#ef4444';
const dimText = '#71717a';
const lightText = '#e4e4e7';

const selectStyle: React.CSSProperties = {
  background: '#27272a',
  color: lightText,
  border: '1px solid #3f3f46',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
  cursor: 'pointer',
};

const btnStyle: React.CSSProperties = {
  background: '#22c55e22',
  color: green,
  border: `1px solid ${green}44`,
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const removeBtnStyle: React.CSSProperties = {
  background: '#ef444422',
  color: red,
  border: `1px solid ${red}44`,
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 12,
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  background: '#27272a',
  color: lightText,
  border: '1px solid #3f3f46',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
  width: 120,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CommissionPage() {
  const {
    calls,
    splits,
    selectedCdpLevel,
    clawbackAmount,
    setCdpLevel,
    setClawbackAmount,
    addSplit,
    updateSplit,
    removeSplit,
  } = useCallTracker();

  // ---- Core commission calculation (SACRED - do not modify) ----

  const savedCalls = useMemo(
    () => calls.filter((c) => categorizeStatus(c.saveStatus, c.saveType) === 'saved'),
    [calls],
  );
  const lostCalls = useMemo(
    () => calls.filter((c) => categorizeStatus(c.saveStatus, c.saveType) === 'lost'),
    [calls],
  );
  const pendingCalls = useMemo(
    () => calls.filter((c) => categorizeStatus(c.saveStatus, c.saveType) === 'pending'),
    [calls],
  );

  const countableLost = useMemo(() => calculateCountableLost(lostCalls), [lostCalls]);
  const totalCountable = savedCalls.length + countableLost;
  const saveRate = totalCountable > 0 ? (savedCalls.length / totalCountable) * 100 : 0;
  const totalRevenue = useMemo(
    () => savedCalls.reduce((sum, c) => sum + getContractValue(c), 0),
    [savedCalls],
  );

  // Split deductions
  const splitReduction = useMemo(() => {
    let reduction = 0;
    splits.forEach((split) => {
      const call = savedCalls.find((c) => c.id === split.accountId);
      if (call) {
        const callValue = getContractValue(call);
        reduction += split.type === 'percent' ? callValue * (split.value / 100) : split.value;
      }
    });
    return reduction;
  }, [splits, savedCalls]);

  const totalAdjustments = splitReduction + clawbackAmount;
  const adjustedRevenue = totalRevenue - totalAdjustments;

  // Round save rate DOWN to nearest 5% tier
  const roundedSaveRate = Math.floor(saveRate / 5) * 5;
  const cdpConfig = CDP_LEVELS[selectedCdpLevel];
  const tiers = cdpConfig.tiers;

  const matchedTier = useMemo(() => {
    let matched = tiers[tiers.length - 1];
    for (const tier of tiers) {
      if (roundedSaveRate >= tier.saveRate) {
        matched = tier;
        break;
      }
    }
    return matched;
  }, [tiers, roundedSaveRate]);

  const revenuePercent = matchedTier.revenuePercent;
  const commission = adjustedRevenue * (revenuePercent / 100);
  const toGoal = Math.round((saveRate / 40) * 100);

  // ---- What-If (worst case) ----
  const countablePendingLost = useMemo(() => calculateCountableLost(pendingCalls), [pendingCalls]);
  const worstCaseLost = countableLost + countablePendingLost;
  const worstCaseCountable = savedCalls.length + worstCaseLost;
  const worstCaseRate = worstCaseCountable > 0 ? (savedCalls.length / worstCaseCountable) * 100 : 0;
  const worstRoundedRate = Math.floor(worstCaseRate / 5) * 5;

  const worstTier = useMemo(() => {
    let matched = tiers[tiers.length - 1];
    for (const tier of tiers) {
      if (worstRoundedRate >= tier.saveRate) {
        matched = tier;
        break;
      }
    }
    return matched;
  }, [tiers, worstRoundedRate]);

  const worstCaseCommission = adjustedRevenue * (worstTier.revenuePercent / 100);
  const potentialLoss = commission - worstCaseCommission;

  // ---- CDP Level options ----
  const cdpOptions: { key: CDPLevelKey; label: string }[] = [
    { key: 'jram', label: 'Jr. AM' },
    { key: 'am1', label: 'AM1' },
    { key: 'am2', label: 'AM2' },
    { key: 'am3', label: 'AM3' },
    { key: 'sram', label: 'Sr. AM' },
  ];

  // ---- Handlers ----

  function handleAddSplit() {
    addSplit({
      id: generateSplitId(),
      accountId: savedCalls.length > 0 ? savedCalls[0].id : '',
      type: 'percent',
      value: 50,
    });
  }

  // ---- Render ----

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: lightText, margin: 0 }}>
          Commission Calculator
        </h1>
        <select
          value={selectedCdpLevel}
          onChange={(e) => setCdpLevel(e.target.value as CDPLevelKey)}
          style={selectStyle}
        >
          {cdpOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Commission Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={card}>
          <div style={cardTitle}>Save Rate</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: saveRate >= 40 ? green : red }}>
            {saveRate.toFixed(1)}%
          </div>
        </div>
        <div style={card}>
          <div style={cardTitle}>% to Goal</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: toGoal >= 100 ? green : '#facc15' }}>
            {toGoal}%
          </div>
        </div>
        <div style={card}>
          <div style={cardTitle}>% of Revenue</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: lightText }}>
            {revenuePercent}%
          </div>
        </div>
        <div style={card}>
          <div style={cardTitle}>Commission</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: green }}>
            ${fmt(commission)}
          </div>
        </div>
      </div>

      {/* Revenue Breakdown + Formula Display */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Revenue Breakdown */}
        <div style={card}>
          <div style={cardTitle}>Revenue Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: dimText }}>Total Revenue</span>
              <span style={{ color: lightText, fontWeight: 600 }}>${fmt(totalRevenue)}</span>
            </div>
            {splitReduction > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: dimText }}>Split Deductions</span>
                <span style={{ color: red, fontWeight: 600 }}>-${fmt(splitReduction)}</span>
              </div>
            )}
            {clawbackAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: dimText }}>Clawback</span>
                <span style={{ color: red, fontWeight: 600 }}>-${fmt(clawbackAmount)}</span>
              </div>
            )}
            {totalAdjustments > 0 && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid #3f3f46', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: dimText }}>Adjusted Revenue</span>
                  <span style={{ color: lightText, fontWeight: 700 }}>${fmt(adjustedRevenue)}</span>
                </div>
              </>
            )}
            <hr style={{ border: 'none', borderTop: '1px solid #3f3f46', margin: '4px 0' }} />
            <div style={{ display: 'flex', gap: 20 }}>
              <span style={{ color: dimText }}>
                Saved: <span style={{ color: green, fontWeight: 600 }}>{savedCalls.length}</span>
              </span>
              <span style={{ color: dimText }}>
                Countable Lost: <span style={{ color: red, fontWeight: 600 }}>{countableLost}</span>
              </span>
              <span style={{ color: dimText }}>
                Pending: <span style={{ color: '#facc15', fontWeight: 600 }}>{pendingCalls.length}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Formula Display */}
        <div style={card}>
          <div style={cardTitle}>Formula</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div>
              <span style={{ color: dimText }}>Step 1: </span>
              <span style={{ color: lightText }}>
                Save Rate = {savedCalls.length} / ({savedCalls.length} + {countableLost}) ={' '}
                <span style={{ color: green, fontWeight: 600 }}>{saveRate.toFixed(1)}%</span>
              </span>
            </div>
            <div>
              <span style={{ color: dimText }}>Step 2: </span>
              <span style={{ color: lightText }}>
                Rounds down to <span style={{ fontWeight: 600 }}>{roundedSaveRate}%</span> tier
              </span>
            </div>
            <div>
              <span style={{ color: dimText }}>Step 3: </span>
              <span style={{ color: lightText }}>
                {cdpConfig.name} at {roundedSaveRate}% = <span style={{ fontWeight: 600 }}>{revenuePercent}%</span> of revenue
              </span>
            </div>
            {totalAdjustments > 0 && (
              <div>
                <span style={{ color: dimText }}>Step 4: </span>
                <span style={{ color: lightText }}>
                  ${fmt(totalRevenue)} - ${fmt(totalAdjustments)} ={' '}
                  <span style={{ fontWeight: 600 }}>${fmt(adjustedRevenue)}</span>
                </span>
              </div>
            )}
            <div style={{ marginTop: 4, padding: '8px 12px', background: '#22c55e11', borderRadius: 8, border: `1px solid ${green}33` }}>
              <span style={{ color: dimText }}>Result: </span>
              <span style={{ color: green, fontWeight: 700 }}>
                ${fmt(adjustedRevenue)} x {revenuePercent}% = ${fmt(commission)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Splits Section */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={cardTitle}>Splits</div>
          <button style={btnStyle} onClick={handleAddSplit}>
            + Add Split
          </button>
        </div>

        {splits.length === 0 && (
          <div style={{ color: dimText, fontSize: 13, padding: '8px 0' }}>
            No splits added. Use splits when commission revenue is shared with another rep.
          </div>
        )}

        {splits.map((split) => {
          const matchedCall = savedCalls.find((c) => c.id === split.accountId);
          const callValue = matchedCall ? getContractValue(matchedCall) : 0;
          const deduction =
            split.type === 'percent' ? callValue * (split.value / 100) : split.value;

          return (
            <div
              key={split.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 0',
                borderBottom: '1px solid #2e2e3e',
                flexWrap: 'wrap',
              }}
            >
              {/* Account dropdown */}
              <select
                value={split.accountId}
                onChange={(e) => updateSplit(split.id, { accountId: e.target.value })}
                style={{ ...selectStyle, flex: 1, minWidth: 180 }}
              >
                <option value="">Select account...</option>
                {savedCalls.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.accountName} (${fmt(getContractValue(c))})
                  </option>
                ))}
              </select>

              {/* Type toggle */}
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #3f3f46' }}>
                <button
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    background: split.type === 'percent' ? '#22c55e33' : '#27272a',
                    color: split.type === 'percent' ? green : dimText,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => updateSplit(split.id, { type: 'percent', value: 50 })}
                >
                  %
                </button>
                <button
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    background: split.type === 'dollar' ? '#22c55e33' : '#27272a',
                    color: split.type === 'dollar' ? green : dimText,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => updateSplit(split.id, { type: 'dollar', value: 0 })}
                >
                  $
                </button>
              </div>

              {/* Value input */}
              {split.type === 'percent' ? (
                <select
                  value={split.value}
                  onChange={(e) => updateSplit(split.id, { value: Number(e.target.value) })}
                  style={{ ...selectStyle, width: 80 }}
                >
                  <option value={25}>25%</option>
                  <option value={50}>50%</option>
                  <option value={75}>75%</option>
                </select>
              ) : (
                <input
                  type="number"
                  value={split.value || ''}
                  onChange={(e) => updateSplit(split.id, { value: Number(e.target.value) || 0 })}
                  placeholder="Amount"
                  style={inputStyle}
                />
              )}

              {/* Deduction display */}
              <span style={{ color: red, fontWeight: 600, fontSize: 13, minWidth: 90 }}>
                -${fmt(deduction)}
              </span>

              {/* Remove */}
              <button style={removeBtnStyle} onClick={() => removeSplit(split.id)}>
                Remove
              </button>
            </div>
          );
        })}

        {splits.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
            <span style={{ color: dimText, fontSize: 13 }}>Total Split Deductions:</span>
            <span style={{ color: red, fontWeight: 700, fontSize: 14 }}>-${fmt(splitReduction)}</span>
          </div>
        )}
      </div>

      {/* Clawback Section */}
      <div style={card}>
        <div style={cardTitle}>Clawback</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: dimText, fontSize: 13 }}>Clawback Amount: $</span>
          <input
            type="number"
            value={clawbackAmount || ''}
            onChange={(e) => setClawbackAmount(Number(e.target.value) || 0)}
            placeholder="0.00"
            style={inputStyle}
          />
          {clawbackAmount > 0 && (
            <span style={{ color: red, fontSize: 13 }}>
              Reduces revenue by <span style={{ fontWeight: 600 }}>${fmt(clawbackAmount)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Tiers Table */}
      <div style={card}>
        <div style={cardTitle}>
          {cdpConfig.name} Tiers
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Save Rate', '% to Goal', 'Accelerator', '% of Rev', 'Commission'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'right',
                      padding: '8px 12px',
                      color: dimText,
                      fontWeight: 600,
                      borderBottom: '1px solid #3f3f46',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tiers
                .filter((t) => t.saveRate > 0)
                .map((tier, i) => {
                  const isActive = tier.saveRate === matchedTier.saveRate;
                  const belowGoal = tier.saveRate < 40;
                  const tierCommission = adjustedRevenue * (tier.revenuePercent / 100);

                  return (
                    <tr
                      key={tier.saveRate}
                      style={{
                        background: isActive
                          ? '#22c55e18'
                          : i % 2 === 0
                          ? 'transparent'
                          : '#ffffff06',
                        opacity: belowGoal && !isActive ? 0.55 : 1,
                      }}
                    >
                      <td
                        style={{
                          textAlign: 'right',
                          padding: '8px 12px',
                          color: isActive ? green : lightText,
                          fontWeight: isActive ? 700 : 400,
                          borderLeft: isActive ? `3px solid ${green}` : '3px solid transparent',
                        }}
                      >
                        {tier.saveRate}%
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 12px', color: isActive ? green : lightText }}>
                        {tier.toGoal}%
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 12px', color: isActive ? green : dimText }}>
                        {tier.accelerator.toFixed(2)}x
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 12px', color: isActive ? green : lightText, fontWeight: isActive ? 700 : 400 }}>
                        {tier.revenuePercent}%
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 12px', color: isActive ? green : dimText, fontWeight: isActive ? 700 : 400 }}>
                        ${fmt(tierCommission)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* What-If Calculator */}
      {pendingCalls.length > 0 && (
        <div style={{ ...card, border: `1px solid ${red}44` }}>
          <div style={{ ...cardTitle, color: '#fca5a5' }}>
            What-If: Worst Case
          </div>
          <div style={{ color: dimText, fontSize: 13, marginBottom: 12 }}>
            If all {pendingCalls.length} pending account{pendingCalls.length !== 1 ? 's are' : ' is'} lost:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <div>
              <div style={{ color: dimText, fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Save Rate</div>
              <div style={{ color: red, fontSize: 20, fontWeight: 700 }}>{worstCaseRate.toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ color: dimText, fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Tier</div>
              <div style={{ color: red, fontSize: 20, fontWeight: 700 }}>{worstRoundedRate}%</div>
            </div>
            <div>
              <div style={{ color: dimText, fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>% of Revenue</div>
              <div style={{ color: red, fontSize: 20, fontWeight: 700 }}>{worstTier.revenuePercent}%</div>
            </div>
            <div>
              <div style={{ color: dimText, fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Commission</div>
              <div style={{ color: red, fontSize: 20, fontWeight: 700 }}>${fmt(worstCaseCommission)}</div>
            </div>
            <div>
              <div style={{ color: dimText, fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Potential Loss</div>
              <div style={{ color: red, fontSize: 20, fontWeight: 700 }}>-${fmt(potentialLoss)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
