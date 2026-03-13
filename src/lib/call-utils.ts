import { Call, CallCategory, StandingCategory, Suggestion } from './types';

// Generate random ID
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// Clean currency values - strips $, commas, handles accounting format
export function cleanCurrency(value: string | number | null | undefined): string {
  if (!value) return '';
  let str = String(value).trim();
  if (str === '-' || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null' || str === '') return '';
  const isNegative = str.startsWith('(') && str.endsWith(')');
  if (isNegative) str = str.slice(1, -1);
  str = str.replace(/[$€£¥,\s]/g, '');
  str = str.replace(/[^0-9.\-]/g, '');
  const parts = str.split('.');
  if (parts.length > 2) str = parts[0] + '.' + parts.slice(1).join('');
  if (isNegative && str && !str.startsWith('-')) str = '-' + str;
  return str;
}

// Clean and normalize date values to YYYY-MM-DD
export function cleanDate(value: string | number | null | undefined): string {
  if (!value) return '';
  let str = String(value).trim();
  if (str === '-' || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null' || str === '') return '';
  const date = new Date(str);
  if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  const mdyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mdyMatch) {
    let year = parseInt(mdyMatch[3]);
    if (year < 100) year += 2000;
    const month = mdyMatch[1].padStart(2, '0');
    const day = mdyMatch[2].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return str;
}

// Parse date string and return YYYY-MM-DD, handles Excel serial dates
export function parseDate(dateStr: string): string {
  if (!dateStr) return '';
  // Check for Excel serial date (just a number)
  const num = Number(dateStr);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + num * 86400000);
    return date.toISOString().split('T')[0];
  }
  return cleanDate(dateStr);
}

// Categorize a call's save status
export function categorizeStatus(saveStatus: string, saveType: string): CallCategory {
  const status = (saveStatus || '').toLowerCase();
  const type = (saveType || '').toLowerCase();

  // AM Save Remorse: Always excluded
  if (type.includes('am save remorse') || type.includes('save remorse')) return 'excluded';

  // Check pending FIRST
  if (status.includes('open') || status.includes('pending') || status.includes('working') ||
      status.includes('progress') || status.includes('scheduled') || status === 'new') return 'pending';

  // Rideout counts as saved
  if (type.includes('rideout') || type.includes('ride out') || type.includes('ride-out')) return 'saved';

  // Explicitly closed
  if (status.includes('closed won') || status === 'saved' || type === 'saved') return 'saved';
  if (status.includes('closed lost') || status.includes('cancel') || type.includes('cancel')) return 'lost';

  return 'other';
}

// Calculate contract/revenue value
// Monthly billing = 1 month, Biennial = 24, Annual = 12 (default)
export function getContractValue(call: Call): number {
  const monthlyRate = parseFloat(call.monthlySalesPrice) || 0;
  const billing = (call.billingFrequency || call.newBillingFrequency || '').toLowerCase().trim();
  const duration = (call.newContractDuration || '').toLowerCase().trim();
  if (billing.includes('month')) return monthlyRate * 1;
  if (duration === 'biennial' || duration.includes('biennial')) return monthlyRate * 24;
  return monthlyRate * 12;
}

// Check for guarantee issues
export function hasGuaranteeIssue(call: Call): boolean {
  const reasons = (call.missedGuaranteeReasons || '').toLowerCase();
  const notes = (call.notes || '').toLowerCase();
  const subReason = (call.saveSubReason || '').toLowerCase();
  return reasons.includes('guarantee') || notes.includes('guarantee hit') ||
         notes.includes('60-day') || notes.includes('60 day') || subReason.includes('guarantee');
}

// Check if account is a legal case
export function isLegalCase(call: Call): boolean {
  return (call.saveType || '').toLowerCase().includes('legal');
}

// Check payment standing category
export function getStandingCategory(standing: string): StandingCategory {
  const s = (standing || '').toLowerCase();
  if (s.includes('good')) return 'good';
  if (s.includes('bad') || s.includes('delinquent') || s.includes('past due')) return 'bad';
  return 'unknown';
}

// Fully excluded from commission (0 points) - guarantee or legal
export function isFullyExcludedFromCommission(call: Call): boolean {
  return hasGuaranteeIssue(call) || isLegalCase(call);
}

// Bad standing only (0.5 points) - bad standing but not guarantee/legal
export function isBadStandingOnly(call: Call): boolean {
  return getStandingCategory(call.paymentStanding) === 'bad' &&
         !hasGuaranteeIssue(call) && !isLegalCase(call);
}

// Calculate countable lost: Regular=1, Bad Standing=0.5, Guarantee/Legal=0
export function calculateCountableLost(lostCalls: Call[]): number {
  let countable = 0;
  lostCalls.forEach(call => {
    if (isFullyExcludedFromCommission(call)) countable += 0;
    else if (isBadStandingOnly(call)) countable += 0.5;
    else countable += 1;
  });
  return countable;
}

// Get initials from a name for avatar display
export function getInitials(name: string): string {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// Generate AI-like suggestion for pending account
export function generateSuggestion(call: Call, daysPending: number): Suggestion | null {
  const allNotes = [
    call.notes || '', call.todoNotes || '', call.cancellationSubReason || '',
    call.saveSubReason || '', call.cancellationStage || ''
  ].join(' ').toLowerCase();
  const originalText = call.notes || call.todoNotes || call.cancellationSubReason || '';
  if (!allNotes.trim()) return null;

  const contractValue = getContractValue(call);
  const contactFirst = (call.contactName || '').split(' ')[0] || 'them';
  const daysScore = Math.min(daysPending / 14, 1) * 50;
  const revenueScore = Math.min(contractValue / 10000, 1) * 50;
  const priorityScore = daysScore + revenueScore;
  let priority: 'low' | 'medium' | 'high' = 'low';
  if (priorityScore >= 60) priority = 'high';
  else if (priorityScore >= 35) priority = 'medium';

  let nextStep: string | null = null;

  if (allNotes.match(/urgent|asap|immediately|today|tomorrow|rush|deadline|time sensitive/)) {
    priority = 'high';
    nextStep = `Call ${contactFirst} NOW - marked urgent`;
  } else if (allNotes.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/)) {
    const dayMatch = allNotes.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    nextStep = `Call ${contactFirst} on ${dayMatch![1].charAt(0).toUpperCase() + dayMatch![1].slice(1)}`;
  } else if (allNotes.match(/\d{1,2}(:\d{2})?\s*(am|pm)|morning|afternoon|evening/)) {
    const timeMatch = allNotes.match(/(\d{1,2}(:\d{2})?\s*(am|pm)|morning|afternoon|evening)/);
    nextStep = `Call ${contactFirst} at ${timeMatch![1]}`;
  } else if (allNotes.match(/call back|callback|call again|wants a call|requested call/)) {
    nextStep = `Call ${contactFirst} back - they requested it`;
  } else if (allNotes.match(/voicemail|vm|left message|no answer|didn't answer|didn't pick up/)) {
    nextStep = `Try calling ${contactFirst} again (no answer last time)`;
  } else if (allNotes.match(/waiting on|waiting for|will let us know|thinking about|needs to decide|discussing/)) {
    nextStep = `Check in with ${contactFirst} - waiting on their decision`;
  } else if (allNotes.match(/sent email|emailed|email sent|awaiting reply|waiting for email/)) {
    nextStep = `Follow up on email sent to ${contactFirst}`;
  } else if (allNotes.match(/send email|email them|need to email|send info|send details/)) {
    nextStep = `Send email to ${contactFirst}`;
  } else if (allNotes.match(/payment|past due|balance|owe|declined|card issue|billing issue/)) {
    nextStep = `Discuss payment issue with ${contactFirst}`;
  } else if (allNotes.match(/discount|price|pricing|cheaper|deal|offer|can't afford|too expensive/)) {
    nextStep = `Present discount/pricing options to ${contactFirst}`;
  } else if (allNotes.match(/contract|renewal|extend|terms|agreement/)) {
    nextStep = `Discuss contract terms with ${contactFirst}`;
  } else if (allNotes.match(/competitor|switching|another provider|found cheaper|going with/)) {
    nextStep = `Win back ${contactFirst} - address competitor concerns`;
  } else if (allNotes.match(/issue|problem|bug|broken|not working|complaint|frustrated|unhappy/)) {
    nextStep = `Follow up on service issue with ${contactFirst}`;
  } else if (allNotes.match(/meeting|zoom|demo|presentation|scheduled for|set up/)) {
    nextStep = `Confirm meeting/demo with ${contactFirst}`;
  } else if (allNotes.match(/manager|supervisor|escalate|boss|owner|decision maker/)) {
    nextStep = `Get manager involved for ${contactFirst}'s account`;
  } else if (allNotes.match(/upgrade|downgrade|change plan|different plan|more features|less/)) {
    nextStep = `Present plan change options to ${contactFirst}`;
  } else if (daysPending >= 7) {
    nextStep = `Follow up with ${contactFirst} - ${daysPending} days since last contact`;
  } else if (allNotes.length > 10) {
    nextStep = `Touch base with ${contactFirst}`;
  }

  if (!nextStep) return null;

  return {
    accountId: call.id,
    accountName: call.accountName,
    contactName: call.contactName,
    suggestion: nextStep,
    priority,
    priorityScore,
    originalNotes: originalText.substring(0, 100),
    daysPending,
    contractValue,
  };
}
