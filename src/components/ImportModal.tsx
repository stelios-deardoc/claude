'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useCallTracker } from '@/lib/store';
import { autoMapColumns, processImportRow, parseCSVLine } from '@/lib/import-utils';
import { Call } from '@/lib/types';
import * as XLSX from 'xlsx';

const IMPORT_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'accountName', label: 'Account Name', required: true },
  { key: 'contactName', label: 'Contact Name' },
  { key: 'saveStatus', label: 'Save Status', required: true },
  { key: 'saveType', label: 'Save Type' },
  { key: 'monthlySalesPrice', label: 'Monthly Sales Price' },
  { key: 'newContractDuration', label: 'New Contract Duration' },
  { key: 'billingFrequency', label: 'Billing Frequency' },
  { key: 'paymentStanding', label: 'Payment Standing' },
  { key: 'missedGuaranteeReasons', label: 'Missed Guarantee Reasons' },
  { key: 'notes', label: 'Notes' },
  { key: 'saveDateTime', label: 'Save Date/Time' },
  { key: 'meetingDate', label: 'Meeting Date' },
  { key: 'saveSubReason', label: 'Save Sub Reason' },
];

const HEADER_KEYWORDS = [
  'name', 'status', 'date', 'type', 'account', 'contact', 'save',
  'notes', 'reason', 'billing', 'payment', 'frequency', 'duration',
  'price', 'guarantee', 'stage', 'owner', 'opportunity', 'cancel',
];

function scoreHeaderRow(row: string[]): number {
  let score = 0;
  for (const cell of row) {
    if (!cell) continue;
    const lower = String(cell).toLowerCase();
    for (const keyword of HEADER_KEYWORDS) {
      if (lower.includes(keyword)) {
        score++;
        break;
      }
    }
  }
  return score;
}

export default function ImportModal() {
  const { importModalOpen, closeImportModal, importCalls } = useCallTracker();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);

  const resetState = useCallback(() => {
    setStep(1);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setIsDragging(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    closeImportModal();
  }, [resetState, closeImportModal]);

  const cleanHeaders = (raw: string[]): string[] => {
    return raw.map((h) => {
      let cleaned = String(h || '');
      // Remove BOM
      cleaned = cleaned.replace(/^\uFEFF/, '');
      // Normalize whitespace
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      return cleaned;
    });
  };

  const filterDataRows = (dataRows: string[][]): string[][] => {
    return dataRows.filter((row) => {
      const nonEmpty = row.filter((cell) => cell && String(cell).trim() !== '');
      return nonEmpty.length >= 2;
    });
  };

  const processFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) return;

        const parsedHeaders = cleanHeaders(parseCSVLine(lines[0]));
        const dataRows = filterDataRows(
          lines.slice(1).map((line) => parseCSVLine(line))
        );

        setHeaders(parsedHeaders);
        setRows(dataRows);
        setMapping(autoMapColumns(parsedHeaders));
        setStep(2);
      };
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Find best sheet - prefer ones with save/data/report in name
        let bestSheet = workbook.SheetNames[0];
        for (const name of workbook.SheetNames) {
          const lower = name.toLowerCase();
          if (lower.includes('save') || lower.includes('data') || lower.includes('report')) {
            bestSheet = name;
            break;
          }
        }

        const sheet = workbook.Sheets[bestSheet];
        const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          raw: false,
          dateNF: 'yyyy-mm-dd',
          defval: '',
        });

        if (rawRows.length < 2) return;

        // Smart header detection: scan first 25 rows, pick best header row
        const scanLimit = Math.min(25, rawRows.length);
        let bestHeaderIdx = 0;
        let bestScore = 0;
        for (let i = 0; i < scanLimit; i++) {
          const score = scoreHeaderRow(rawRows[i]);
          if (score > bestScore) {
            bestScore = score;
            bestHeaderIdx = i;
          }
        }

        const parsedHeaders = cleanHeaders(rawRows[bestHeaderIdx].map(String));
        const dataRows = filterDataRows(
          rawRows.slice(bestHeaderIdx + 1).map((row) => row.map(String))
        );

        setHeaders(parsedHeaders);
        setRows(dataRows);
        setMapping(autoMapColumns(parsedHeaders));
        setStep(2);
      };
      reader.readAsArrayBuffer(file);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleMappingChange = useCallback((field: string, colIndex: number) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (colIndex === -1) {
        delete next[field];
      } else {
        next[field] = colIndex;
      }
      return next;
    });
  }, []);

  const handleImport = useCallback(() => {
    if (mapping.accountName === undefined) {
      window.alert('Account Name must be mapped to a column.');
      return;
    }

    const validCalls: Call[] = [];
    for (const row of rows) {
      const call = processImportRow(row, mapping);
      if (call && call.accountName) {
        validCalls.push(call);
      }
    }

    if (validCalls.length === 0) {
      window.alert('No valid rows found to import.');
      return;
    }

    importCalls(validCalls);
    handleClose();
    window.alert(`Successfully imported ${validCalls.length} records.`);
  }, [mapping, rows, importCalls, handleClose]);

  const getPreviewValue = (row: string[], field: string): string => {
    const idx = mapping[field];
    if (idx === undefined || idx >= row.length) return '-';
    return row[idx] || '-';
  };

  if (!importModalOpen) return null;

  return (
    <div
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
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          maxWidth: 700,
          width: '100%',
          background: '#1e293b',
          borderRadius: 12,
          padding: 24,
          maxHeight: '90vh',
          overflowY: 'auto',
          color: '#e2e8f0',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#f8fafc' }}>
            Import Salesforce Data
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: 24,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 4px',
            }}
          >
            &times;
          </button>
        </div>

        {step === 1 && (
          /* Step 1: File Upload */
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? '#3b82f6' : '#334155'}`,
              borderRadius: 8,
              padding: 48,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto', display: 'block' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p style={{ color: '#94a3b8', margin: '8px 0 4px', fontSize: 15 }}>
              Drag and drop your file here, or click to browse
            </p>
            <p style={{ color: '#64748b', margin: 0, fontSize: 13 }}>
              Supports .xlsx, .xls, .csv
            </p>
          </div>
        )}

        {step === 2 && (
          /* Step 2: Column Mapping */
          <div>
            {/* Mapping Grid */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#cbd5e1', marginBottom: 12 }}>
                Column Mapping
              </h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px 16px',
                }}
              >
                {IMPORT_FIELDS.map(({ key, label, required }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label
                      style={{
                        fontSize: 13,
                        color: '#94a3b8',
                        minWidth: 120,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                      {required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
                    </label>
                    <select
                      value={mapping[key] !== undefined ? mapping[key] : -1}
                      onChange={(e) => handleMappingChange(key, parseInt(e.target.value, 10))}
                      style={{
                        flex: 1,
                        background: '#0f172a',
                        color: '#e2e8f0',
                        border: '1px solid #334155',
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: 12,
                        minWidth: 0,
                      }}
                    >
                      <option value={-1}>-- Not mapped --</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Table */}
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
                Preview ({rows.length} rows to import)
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr>
                      {['Account', 'Status', 'Type', 'Standing'].map((col) => (
                        <th
                          key={col}
                          style={{
                            textAlign: 'left',
                            padding: '6px 8px',
                            color: '#94a3b8',
                            borderBottom: '1px solid #334155',
                            fontWeight: 500,
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 3).map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#1e293b' : '#172033' }}>
                        <td style={{ padding: '5px 8px', color: '#e2e8f0' }}>
                          {getPreviewValue(row, 'accountName')}
                        </td>
                        <td style={{ padding: '5px 8px', color: '#e2e8f0' }}>
                          {getPreviewValue(row, 'saveStatus')}
                        </td>
                        <td style={{ padding: '5px 8px', color: '#e2e8f0' }}>
                          {getPreviewValue(row, 'saveType')}
                        </td>
                        <td style={{ padding: '5px 8px', color: '#e2e8f0' }}>
                          {getPreviewValue(row, 'paymentStanding')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => {
                  resetState();
                  setStep(1);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#334155',
                  color: '#e2e8f0',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Back
              </button>
              <button
                onClick={handleClose}
                style={{
                  padding: '8px 16px',
                  background: '#334155',
                  color: '#e2e8f0',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                style={{
                  padding: '8px 16px',
                  background: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Import
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
