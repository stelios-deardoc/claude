import { Call, ImportData } from './types';
import { generateId, cleanCurrency, cleanDate } from './call-utils';

// Exact Salesforce column name mapping
export const SF_COLUMN_MAP: Record<string, string> = {
  'Save Opportunity: Save Opportunity Name': 'opportunityName',
  'Related Account: Account Name': 'accountName',
  'Related Account: Related Contact': 'contactName',
  'Save Status': 'saveStatus',
  'Save Type': 'saveType',
  'Save Opportunity: Owner Name': 'ownerName',
  'Cancellation Stage': 'cancellationStage',
  'Cancellation Sub-Reason': 'cancellationSubReason',
  'New Billing Frequency': 'newBillingFrequency',
  'New Contract Duration': 'newContractDuration',
  'Monthly Sales Price': 'monthlySalesPrice',
  'Related Account: Rate per Month': 'ratePerMonth',
  'Related Account: Billing Frequency': 'billingFrequency',
  'Related Account: Latest Gateway': 'latestGateway',
  'Account Manager Meeting Scheduled Date': 'meetingDate',
  'Save Date/Time': 'saveDateTime',
  'Related Account: Missed Guarantee Reasons': 'missedGuaranteeReasons',
  'Save/Cancel Notes': 'notes',
  'Save sub Reason': 'saveSubReason',
  'Payment Standing': 'paymentStanding',
};

// Normalize header for matching
export function normalizeHeader(header: string): string {
  if (!header) return '';
  return String(header).toLowerCase().trim()
    .replace(/[\s_\-:]+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

// Fuzzy matching aliases for column auto-detection
const FUZZY_MAP: Record<string, string[]> = {
  accountName: ['related account account name', 'account name', 'accountname', 'account', 'company name', 'company', 'business name', 'client name', 'client'],
  contactName: ['related account related contact', 'related contact', 'contact name', 'contactname', 'contact', 'primary contact', 'poc'],
  saveStatus: ['save status', 'savestatus', 'status', 'outcome', 'result', 'save outcome', 'call status', 'call outcome'],
  saveType: ['save type', 'savetype', 'type', 'save category', 'category', 'offer type', 'resolution type'],
  monthlySalesPrice: ['monthly sales price', 'monthlysalesprice', 'monthly price', 'sales price', 'mrr', 'monthly revenue', 'price', 'monthly rate', 'rate', 'monthly amount', 'amount'],
  newContractDuration: ['new contract duration', 'contract duration', 'duration', 'term', 'contract term', 'contract length', 'length', 'agreement term'],
  ratePerMonth: ['related account rate per month', 'rate per month', 'ratepermonth', 'monthly rate', 'current rate', 'current mrr'],
  newBillingFrequency: ['new billing frequency', 'billing frequency', 'billingfrequency', 'frequency', 'billing cycle', 'payment frequency', 'billing'],
  billingFrequency: ['related account billing frequency', 'billing frequency', 'frequency'],
  paymentStanding: ['payment standing', 'paymentstanding', 'standing', 'payment status', 'account standing', 'financial standing', 'ar status'],
  notes: ['save cancel notes', 'savecancel notes', 'notes', 'comments', 'save notes', 'cancel notes', 'remarks', 'details', 'description'],
  missedGuaranteeReasons: ['related account missed guarantee reasons', 'missed guarantee reasons', 'missed guarantee', 'guarantee reasons', 'guarantee', 'guarantee issues', '60 day guarantee', 'guarantee hit'],
  saveDateTime: ['save date time', 'save datetime', 'savedatetime', 'save date', 'savedate', 'date time', 'datetime', 'close date', 'closed date', 'resolution date', 'completed date'],
  meetingDate: ['account manager meeting scheduled date', 'meeting scheduled date', 'meeting date', 'meetingdate', 'scheduled date', 'appointment date', 'am meeting date', 'call date'],
  saveSubReason: ['save sub reason', 'savesubreason', 'sub reason', 'subreason', 'save reason', 'reason', 'resolution reason'],
  cancellationStage: ['cancellation stage', 'cancellationstage', 'cancel stage', 'stage', 'cancel reason'],
  cancellationSubReason: ['cancellation sub reason', 'cancellation subreason', 'cancel sub reason', 'cancel reason', 'cancellation reason'],
  ownerName: ['save opportunity owner name', 'owner name', 'ownername', 'owner', 'rep name', 'representative', 'agent', 'assigned to'],
  opportunityName: ['save opportunity save opportunity name', 'save opportunity name', 'opportunity name', 'opportunityname', 'opportunity', 'opp name'],
};

// Auto-map columns from headers
export function autoMapColumns(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  const normalizedHeaders = headers.map(h => normalizeHeader(h));
  const originalHeaders = headers.map(h => (h || '').trim());

  // First pass: exact match with SF_COLUMN_MAP
  originalHeaders.forEach((header, index) => {
    if (SF_COLUMN_MAP[header]) {
      mapping[SF_COLUMN_MAP[header]] = index;
    }
  });

  // Second pass: normalized exact match
  Object.entries(SF_COLUMN_MAP).forEach(([sfHeader, field]) => {
    if (mapping[field] !== undefined) return;
    const normalizedSF = normalizeHeader(sfHeader);
    const index = normalizedHeaders.findIndex(h => h === normalizedSF);
    if (index !== -1) mapping[field] = index;
  });

  // Third pass: fuzzy matching
  Object.entries(FUZZY_MAP).forEach(([field, aliases]) => {
    if (mapping[field] !== undefined) return;
    for (const alias of aliases) {
      const normalizedAlias = normalizeHeader(alias);
      let index = normalizedHeaders.findIndex(h => h === normalizedAlias);
      if (index === -1) index = normalizedHeaders.findIndex(h => h && h.includes(normalizedAlias));
      if (index === -1) index = normalizedHeaders.findIndex(h => h && normalizedAlias.includes(h) && h.length > 3);
      if (index !== -1) { mapping[field] = index; break; }
    }
  });

  return mapping;
}

// Extract rep name from filename
export function extractRepName(filename: string): string {
  let name = filename.replace(/\.(xlsx|xls|csv)$/i, '');
  name = name.replace(/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/g, '');
  name = name.replace(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/g, '');
  name = name.replace(/save\s*desk|report|export|data/gi, '');
  name = name.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  name = name.split(' ').filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return name || 'Unknown Rep';
}

// Parse a CSV line handling quoted fields
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += char;
  }
  result.push(current.trim());
  return result;
}

// Process a single import row into a Call object
export function processImportRow(row: string[], mapping: Record<string, number>): Call {
  const get = (field: string): string => {
    const idx = mapping[field];
    if (idx === undefined || idx >= row.length) return '';
    return (row[idx] || '').trim();
  };

  return {
    id: generateId(),
    accountName: get('accountName'),
    contactName: get('contactName'),
    saveStatus: get('saveStatus'),
    saveType: get('saveType'),
    monthlySalesPrice: cleanCurrency(get('monthlySalesPrice')),
    ratePerMonth: cleanCurrency(get('ratePerMonth')),
    newContractDuration: get('newContractDuration'),
    paymentStanding: get('paymentStanding'),
    billingFrequency: get('billingFrequency'),
    newBillingFrequency: get('newBillingFrequency'),
    meetingDate: cleanDate(get('meetingDate')),
    saveDateTime: cleanDate(get('saveDateTime')),
    importDate: new Date().toISOString().split('T')[0],
    missedGuaranteeReasons: get('missedGuaranteeReasons'),
    notes: get('notes'),
    todoNotes: '',
    opportunityName: get('opportunityName'),
    ownerName: get('ownerName'),
    cancellationStage: get('cancellationStage'),
    cancellationSubReason: get('cancellationSubReason'),
    saveSubReason: get('saveSubReason'),
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
}
