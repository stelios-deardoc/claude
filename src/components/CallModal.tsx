'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useCallTracker } from '@/lib/store';
import {
  categorizeStatus,
  getContractValue,
  getStandingCategory,
  hasGuaranteeIssue,
  hasAccountingChanges,
  getInitials,
  parseDate,
  generateId,
} from '@/lib/call-utils';
import type { Call } from '@/lib/types';
import { t } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Form state shape
// ---------------------------------------------------------------------------

interface FormState {
  accountName: string;
  contactName: string;
  saveStatus: string;
  saveType: string;
  monthlySalesPrice: string;
  newContractDuration: string;
  paymentStanding: string;
  billingFrequency: string;
  meetingDate: string;
  missedGuaranteeReasons: string;
  notes: string;
  refundAmount: string;
  refundDate: string;
  contractSwap: string;
  contractLength: string;
  paymentMethod: string;
  relaunch: string;
  relaunchDate: string;
  dateChanged: string;
  accountingNotes: string;
}

const EMPTY_FORM: FormState = {
  accountName: '',
  contactName: '',
  saveStatus: '',
  saveType: '',
  monthlySalesPrice: '',
  newContractDuration: '',
  paymentStanding: '',
  billingFrequency: '',
  meetingDate: '',
  missedGuaranteeReasons: '',
  notes: '',
  refundAmount: '',
  refundDate: '',
  contractSwap: '',
  contractLength: '',
  paymentMethod: '',
  relaunch: '',
  relaunchDate: '',
  dateChanged: '',
  accountingNotes: '',
};

function formFromCall(call: Call): FormState {
  return {
    accountName: call.accountName || '',
    contactName: call.contactName || '',
    saveStatus: call.saveStatus || '',
    saveType: call.saveType || '',
    monthlySalesPrice: call.monthlySalesPrice || '',
    newContractDuration: call.newContractDuration || '',
    paymentStanding: call.paymentStanding || '',
    billingFrequency: call.billingFrequency || call.newBillingFrequency || '',
    meetingDate: call.meetingDate ? parseDate(call.meetingDate) : '',
    missedGuaranteeReasons: call.missedGuaranteeReasons || '',
    notes: call.notes || '',
    refundAmount: call.refundAmount || '',
    refundDate: call.refundDate || '',
    contractSwap: call.contractSwap || '',
    contractLength: call.contractLength || '',
    paymentMethod: call.paymentMethod || '',
    relaunch: call.relaunch || '',
    relaunchDate: call.relaunchDate || '',
    dateChanged: call.dateChanged || '',
    accountingNotes: call.accountingNotes || '',
  };
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function statusBadgeClass(status: string): string {
  const s = (status || '').toLowerCase();
  if (s.includes('closed won') || s === 'saved') return 'badge-saved';
  if (s.includes('closed lost') || s.includes('cancel')) return 'badge-lost';
  if (s.includes('open') || s.includes('progress') || s.includes('scheduled'))
    return 'badge-pending';
  return 'badge-other';
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0';
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '--';
  const parsed = parseDate(dateStr);
  if (!parsed) return '--';
  const d = new Date(parsed + 'T00:00:00');
  if (isNaN(d.getTime())) return parsed;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CallModal() {
  const {
    calls,
    callModalOpen,
    callModalId,
    closeCallModal,
    updateCall,
    deleteCall,
    addCall,
  } = useCallTracker();

  const call = useMemo(
    () => (callModalId ? calls.find((c) => c.id === callModalId) ?? null : null),
    [calls, callModalId],
  );

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset mode & form whenever the modal opens or the target call changes
  useEffect(() => {
    if (!callModalOpen) return;
    if (call) {
      setMode('view');
      setForm(formFromCall(call));
    } else {
      // New call
      setMode('edit');
      setForm({ ...EMPTY_FORM });
    }
    setConfirmDelete(false);
  }, [callModalOpen, call]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) closeCallModal();
  }

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSave() {
    if (!form.accountName.trim()) return;

    if (callModalId && call) {
      // Editing existing
      updateCall(callModalId, {
        accountName: form.accountName,
        contactName: form.contactName,
        saveStatus: form.saveStatus,
        saveType: form.saveType,
        monthlySalesPrice: form.monthlySalesPrice,
        newContractDuration: form.newContractDuration,
        paymentStanding: form.paymentStanding,
        billingFrequency: form.billingFrequency,
        newBillingFrequency: form.billingFrequency,
        meetingDate: form.meetingDate,
        missedGuaranteeReasons: form.missedGuaranteeReasons,
        notes: form.notes,
        refundAmount: form.refundAmount,
        refundDate: form.refundDate,
        contractSwap: form.contractSwap,
        contractLength: form.contractLength,
        paymentMethod: form.paymentMethod,
        relaunch: form.relaunch,
        relaunchDate: form.relaunchDate,
        dateChanged: form.dateChanged,
        accountingNotes: form.accountingNotes,
      });
      setMode('view');
    } else {
      // New call
      addCall({
        id: generateId(),
        accountName: form.accountName,
        contactName: form.contactName,
        saveStatus: form.saveStatus,
        saveType: form.saveType,
        monthlySalesPrice: form.monthlySalesPrice,
        ratePerMonth: form.monthlySalesPrice,
        newContractDuration: form.newContractDuration,
        paymentStanding: form.paymentStanding,
        billingFrequency: form.billingFrequency,
        newBillingFrequency: form.billingFrequency,
        meetingDate: form.meetingDate,
        saveDateTime: '',
        importDate: new Date().toISOString(),
        missedGuaranteeReasons: form.missedGuaranteeReasons,
        notes: form.notes,
        todoNotes: '',
        opportunityName: '',
        ownerName: '',
        cancellationStage: '',
        cancellationSubReason: '',
        saveSubReason: '',
        refundAmount: form.refundAmount,
        refundDate: form.refundDate,
        contractSwap: form.contractSwap,
        contractLength: form.contractLength,
        paymentMethod: form.paymentMethod,
        relaunch: form.relaunch,
        relaunchDate: form.relaunchDate,
        dateChanged: form.dateChanged,
        accountingNotes: form.accountingNotes,
      });
      closeCallModal();
    }
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (callModalId) {
      deleteCall(callModalId);
      closeCallModal();
    }
  }

  function handleCancel() {
    if (callModalId && call) {
      setMode('view');
      setForm(formFromCall(call));
    } else {
      closeCallModal();
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!callModalOpen) return null;

  const category = call ? categorizeStatus(call.saveStatus, call.saveType) : null;
  const standing = call ? getStandingCategory(call.paymentStanding) : null;
  const guarantee = call ? hasGuaranteeIssue(call) : false;
  const contractValue = call ? getContractValue(call) : 0;
  const monthlyRate = call ? parseFloat(call.monthlySalesPrice) || 0 : 0;

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: t.cardBg,
          borderRadius: 12,
          padding: 24,
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          overflowY: 'auto',
          color: t.fg,
        }}
      >
        {/* ============================================================ */}
        {/* VIEW MODE                                                     */}
        {/* ============================================================ */}
        {mode === 'view' && call ? (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: t.cardBorder,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {getInitials(call.accountName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{call.accountName}</div>
                {call.contactName && (
                  <div style={{ color: t.textSecondary, fontSize: 14 }}>{call.contactName}</div>
                )}
              </div>
              <span className={statusBadgeClass(call.saveStatus)}>
                {call.saveStatus || 'Unknown'}
              </span>
            </div>

            {/* Tags row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {call.saveType && (
                <span
                  style={{
                    background: t.cardBorder,
                    padding: '2px 10px',
                    borderRadius: 9999,
                    fontSize: 12,
                  }}
                >
                  {call.saveType}
                </span>
              )}
              {standing && standing !== 'unknown' && (
                <span
                  style={{
                    background: standing === 'good' ? '#166534' : '#991b1b',
                    padding: '2px 10px',
                    borderRadius: 9999,
                    fontSize: 12,
                  }}
                >
                  {standing === 'good' ? 'Good Standing' : 'Bad Standing'}
                </span>
              )}
              {guarantee && (
                <span
                  style={{
                    background: '#92400e',
                    padding: '2px 10px',
                    borderRadius: 9999,
                    fontSize: 12,
                  }}
                >
                  Guarantee Issue
                </span>
              )}
              {call.newContractDuration && (
                <span
                  style={{
                    background: t.cardBorder,
                    padding: '2px 10px',
                    borderRadius: 9999,
                    fontSize: 12,
                  }}
                >
                  {call.newContractDuration}
                </span>
              )}
            </div>

            {/* Metrics row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <MetricCard label="Monthly Rate" value={formatCurrency(monthlyRate)} />
              <MetricCard label="Contract Value" value={formatCurrency(contractValue)} />
              <MetricCard
                label="Billing Frequency"
                value={call.billingFrequency || call.newBillingFrequency || '--'}
              />
            </div>

            {/* Meeting date */}
            {call.meetingDate && (
              <div style={{ marginBottom: 16, fontSize: 14, color: t.textSecondary }}>
                Meeting: {formatDate(call.meetingDate)}
              </div>
            )}

            {/* Details section */}
            <SectionHeading>Details</SectionHeading>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <DetailRow label="Payment Standing" value={call.paymentStanding || '--'} />
              <DetailRow
                label="Billing Frequency"
                value={call.billingFrequency || call.newBillingFrequency || '--'}
              />
              {call.missedGuaranteeReasons && (
                <DetailRow
                  label="Missed Guarantee Reasons"
                  value={call.missedGuaranteeReasons}
                  fullWidth
                />
              )}
            </div>

            {/* Notes section */}
            {(call.notes || call.saveSubReason) && (
              <>
                <SectionHeading>Notes</SectionHeading>
                {call.notes && (
                  <div
                    style={{
                      background: t.bg,
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 14,
                      whiteSpace: 'pre-wrap',
                      marginBottom: 8,
                      lineHeight: 1.5,
                    }}
                  >
                    {call.notes}
                  </div>
                )}
                {call.saveSubReason && (
                  <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 16 }}>
                    <strong>Save Sub Reason:</strong> {call.saveSubReason}
                  </div>
                )}
              </>
            )}

            {/* Accounting Changes section */}
            {hasAccountingChanges(call) && (
              <>
                <SectionHeading>Accounting Changes</SectionHeading>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  {call.refundAmount && (
                    <DetailRow label="Refund Amount" value={formatCurrency(call.refundAmount)} />
                  )}
                  {call.refundDate && (
                    <DetailRow label="Refund Date" value={formatDate(call.refundDate)} />
                  )}
                  {call.contractSwap && (
                    <div>
                      <div style={{ fontSize: 12, color: t.textSecondary }}>Contract Swap</div>
                      <span style={{
                        display: 'inline-block',
                        background: call.contractSwap === 'Yes' ? '#166534' : t.cardBorder,
                        padding: '2px 10px',
                        borderRadius: 9999,
                        fontSize: 12,
                        marginTop: 2,
                      }}>{call.contractSwap}</span>
                    </div>
                  )}
                  {call.contractLength && (
                    <DetailRow label="Contract Length" value={call.contractLength} />
                  )}
                  {call.paymentMethod && (
                    <DetailRow label="Payment Method" value={call.paymentMethod} />
                  )}
                  {call.relaunch && (
                    <div>
                      <div style={{ fontSize: 12, color: t.textSecondary }}>Relaunch</div>
                      <span style={{
                        display: 'inline-block',
                        background: call.relaunch === 'Yes' ? '#166534' : t.cardBorder,
                        padding: '2px 10px',
                        borderRadius: 9999,
                        fontSize: 12,
                        marginTop: 2,
                      }}>{call.relaunch}</span>
                    </div>
                  )}
                  {call.relaunchDate && (
                    <DetailRow label="Relaunch Date" value={formatDate(call.relaunchDate)} />
                  )}
                  {call.dateChanged && (
                    <DetailRow label="Date Changed" value={formatDate(call.dateChanged)} />
                  )}
                </div>
                {call.accountingNotes && (
                  <div style={{
                    background: t.bg,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    whiteSpace: 'pre-wrap',
                    marginBottom: 8,
                    lineHeight: 1.5,
                  }}>
                    {call.accountingNotes}
                  </div>
                )}
              </>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <ModalButton variant="ghost" onClick={closeCallModal}>
                Close
              </ModalButton>
              <ModalButton
                variant="danger"
                onClick={handleDelete}
              >
                {confirmDelete ? 'Confirm Delete' : 'Delete'}
              </ModalButton>
              <ModalButton
                variant="primary"
                onClick={() => {
                  setMode('edit');
                  setForm(formFromCall(call));
                }}
              >
                Edit
              </ModalButton>
            </div>
          </>
        ) : (
          /* ============================================================ */
          /* EDIT MODE                                                     */
          /* ============================================================ */
          <>
            <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700 }}>
              {callModalId && call ? 'Edit Call' : 'New Call'}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField
                label="Account Name *"
                name="accountName"
                value={form.accountName}
                onChange={handleInputChange}
                fullWidth
              />
              <FormField
                label="Contact Name"
                name="contactName"
                value={form.contactName}
                onChange={handleInputChange}
              />
              <FormSelect
                label="Save Status"
                name="saveStatus"
                value={form.saveStatus}
                onChange={handleInputChange}
                options={[
                  '',
                  'Closed Won',
                  'Closed Lost',
                  'Open',
                  'In Progress',
                  'Scheduled',
                  'Cancelled',
                ]}
              />
              <FormField
                label="Save Type"
                name="saveType"
                value={form.saveType}
                onChange={handleInputChange}
              />
              <FormField
                label="Monthly Sales Price"
                name="monthlySalesPrice"
                value={form.monthlySalesPrice}
                onChange={handleInputChange}
                type="number"
              />
              <FormSelect
                label="New Contract Duration"
                name="newContractDuration"
                value={form.newContractDuration}
                onChange={handleInputChange}
                options={['', 'Annual', 'Biennial', 'Monthly']}
              />
              <FormSelect
                label="Payment Standing"
                name="paymentStanding"
                value={form.paymentStanding}
                onChange={handleInputChange}
                options={['', 'Good Standing', 'Bad Standing']}
              />
              <FormSelect
                label="Billing Frequency"
                name="billingFrequency"
                value={form.billingFrequency}
                onChange={handleInputChange}
                options={['', 'Monthly', 'Annual', 'Biennial']}
              />
              <FormField
                label="Meeting Date"
                name="meetingDate"
                value={form.meetingDate}
                onChange={handleInputChange}
                type="date"
              />
              <FormField
                label="Missed Guarantee Reasons"
                name="missedGuaranteeReasons"
                value={form.missedGuaranteeReasons}
                onChange={handleInputChange}
              />
            </div>

            {/* Notes textarea */}
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>
                Notes
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleInputChange}
                rows={4}
                style={{
                  width: '100%',
                  background: t.bg,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: 6,
                  color: 'white',
                  padding: '8px 12px',
                  fontSize: 14,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Accounting Changes */}
            <SectionHeading>Accounting Changes</SectionHeading>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField
                label="Refund Amount"
                name="refundAmount"
                value={form.refundAmount}
                onChange={handleInputChange}
                type="number"
              />
              <FormField
                label="Refund Date"
                name="refundDate"
                value={form.refundDate}
                onChange={handleInputChange}
                type="date"
              />
              <FormSelect
                label="Contract Swap"
                name="contractSwap"
                value={form.contractSwap}
                onChange={handleInputChange}
                options={['', 'Yes', 'No']}
              />
              <FormSelect
                label="Contract Length"
                name="contractLength"
                value={form.contractLength}
                onChange={handleInputChange}
                options={['', '12 months', '24 months', '36 months', 'Monthly', 'Semi-Annual']}
              />
              <FormSelect
                label="Payment Method"
                name="paymentMethod"
                value={form.paymentMethod}
                onChange={handleInputChange}
                options={['', 'Credit Card', 'ACH', 'Check']}
              />
              <FormSelect
                label="Relaunch"
                name="relaunch"
                value={form.relaunch}
                onChange={handleInputChange}
                options={['', 'Yes', 'No']}
              />
              <FormField
                label="Relaunch Date"
                name="relaunchDate"
                value={form.relaunchDate}
                onChange={handleInputChange}
                type="date"
              />
              <FormField
                label="Date Changed"
                name="dateChanged"
                value={form.dateChanged}
                onChange={handleInputChange}
                type="date"
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>
                Accounting Notes
              </label>
              <textarea
                name="accountingNotes"
                value={form.accountingNotes}
                onChange={handleInputChange}
                rows={3}
                style={{
                  width: '100%',
                  background: t.bg,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: 6,
                  color: 'white',
                  padding: '8px 12px',
                  fontSize: 14,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <ModalButton variant="ghost" onClick={handleCancel}>
                Cancel
              </ModalButton>
              <ModalButton variant="primary" onClick={handleSave}>
                {callModalId && call ? 'Save Changes' : 'Add Call'}
              </ModalButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: t.bg,
        borderRadius: 8,
        padding: 12,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div style={fullWidth ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ fontSize: 12, color: t.textSecondary }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: t.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function ModalButton({
  children,
  variant,
  onClick,
}: {
  children: React.ReactNode;
  variant: 'primary' | 'danger' | 'ghost';
  onClick: () => void;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: t.accent,
      color: 'white',
      border: 'none',
      borderRadius: 6,
      padding: '8px 20px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: 14,
    },
    danger: {
      background: t.danger,
      color: 'white',
      border: 'none',
      borderRadius: 6,
      padding: '8px 20px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: 14,
    },
    ghost: {
      background: 'transparent',
      color: t.textSecondary,
      border: `1px solid ${t.cardBorder}`,
      borderRadius: 6,
      padding: '8px 20px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: 14,
    },
  };

  return (
    <button style={styles[variant]} onClick={onClick}>
      {children}
    </button>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  fullWidth,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  fullWidth?: boolean;
}) {
  return (
    <div style={fullWidth ? { gridColumn: '1 / -1' } : undefined}>
      <label style={{ display: 'block', fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>
        {label}
      </label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        style={{
          width: '100%',
          background: t.bg,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 6,
          color: 'white',
          padding: '8px 12px',
          fontSize: 14,
        }}
      />
    </div>
  );
}

function FormSelect({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>
        {label}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        style={{
          width: '100%',
          background: t.bg,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 6,
          color: 'white',
          padding: '8px 12px',
          fontSize: 14,
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt || '-- Select --'}
          </option>
        ))}
      </select>
    </div>
  );
}
