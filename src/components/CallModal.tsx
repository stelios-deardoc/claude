'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useCallTracker } from '@/lib/store';
import {
  categorizeStatus,
  getContractValue,
  getStandingCategory,
  hasGuaranteeIssue,
  getInitials,
  parseDate,
  generateId,
} from '@/lib/call-utils';
import type { Call } from '@/lib/types';

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
          background: '#1e293b',
          borderRadius: 12,
          padding: 24,
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          overflowY: 'auto',
          color: '#e2e8f0',
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
                  background: '#334155',
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
                  <div style={{ color: '#94a3b8', fontSize: 14 }}>{call.contactName}</div>
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
                    background: '#334155',
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
                    background: '#334155',
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
              <div style={{ marginBottom: 16, fontSize: 14, color: '#94a3b8' }}>
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
                      background: '#0f172a',
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
                  <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                    <strong>Save Sub Reason:</strong> {call.saveSubReason}
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
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                Notes
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleInputChange}
                rows={4}
                style={{
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid #334155',
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
        background: '#0f172a',
        borderRadius: 8,
        padding: 12,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
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
      <div style={{ fontSize: 12, color: '#94a3b8' }}>{label}</div>
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
        color: '#64748b',
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
      background: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: 6,
      padding: '8px 20px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: 14,
    },
    danger: {
      background: '#ef4444',
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
      color: '#94a3b8',
      border: '1px solid #334155',
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
      <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
        {label}
      </label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        style={{
          width: '100%',
          background: '#0f172a',
          border: '1px solid #334155',
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
      <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
        {label}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        style={{
          width: '100%',
          background: '#0f172a',
          border: '1px solid #334155',
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
