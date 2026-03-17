export interface Call {
  id: string;
  accountName: string;
  contactName: string;
  saveStatus: string;
  saveType: string;
  monthlySalesPrice: string;
  ratePerMonth: string;
  newContractDuration: string;
  paymentStanding: string;
  billingFrequency: string;
  newBillingFrequency: string;
  meetingDate: string;
  saveDateTime: string;
  importDate: string;
  missedGuaranteeReasons: string;
  notes: string;
  todoNotes: string;
  opportunityName: string;
  ownerName: string;
  cancellationStage: string;
  cancellationSubReason: string;
  saveSubReason: string;
  // Accounting change fields
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

export type CallCategory = 'saved' | 'lost' | 'pending' | 'excluded' | 'other';
export type StandingCategory = 'good' | 'bad' | 'unknown';
export type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';
export type ViewName = 'dashboard' | 'calendar' | 'kanban' | 'list' | 'todo' | 'commission';

export interface Split {
  id: string;
  accountId: string;
  type: 'percent' | 'dollar';
  value: number;
}

export interface Suggestion {
  accountId: string;
  accountName: string;
  contactName: string;
  suggestion: string;
  priority: 'low' | 'medium' | 'high';
  priorityScore: number;
  originalNotes: string;
  daysPending: number;
  contractValue: number;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;        // ISO string
  source: 'gmail' | 'calendar' | 'manual';
  summary: string;          // "Email sent to Dr. Friedman" or "Meeting at 2pm"
  metadata: {
    emailId?: string;       // Gmail message ID for linking
    eventId?: string;       // Calendar event ID
    subject?: string;       // Email subject or event title
  };
}

export interface TodoTask {
  id: string;
  title: string;
  description: string;
  dueDate: string;          // 'YYYY-MM-DD' or ''
  priority: 'high' | 'medium' | 'low';
  category: 'follow-up' | 'email' | 'internal' | 'salesforce' | 'meeting' | 'other';
  linkedAccountId: string;  // '' if not linked
  status: 'active' | 'review' | 'completed';
  completed: boolean;       // kept for backward compat, derived from status
  completedAt: string;      // ISO string or ''
  createdAt: string;        // ISO string
  activityLog: ActivityEntry[];
  lastSyncedAt: string;     // ISO string or ''
  autoCreated?: boolean;    // true if created from calendar sync
}

export interface CDPTier {
  saveRate: number;
  toGoal: number;
  accelerator: number;
  revenuePercent: number;
}

export type CDPLevelKey = 'jram' | 'am1' | 'am2' | 'am3' | 'sram';

export interface CDPLevel {
  name: string;
  tiers: CDPTier[];
}

export interface ImportData {
  headers: string[];
  rows: string[][];
  mapping: Record<string, number>;
  repName: string;
}

export interface AppState {
  calls: Call[];
  currentView: ViewName;
  filterStatus: string;
  sortBy: SortOption;
  currentMonth: Date;
  calendarInitialized: boolean;
  selectedCdpLevel: CDPLevelKey;
  clawbackAmount: number;
}

// ============================================================
// Master Email Workflow Types
// ============================================================

export type EmailPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type EmailStatus = 'needs_response' | 'draft_ready' | 'sent' | 'archived' | 'snoozed';

export interface MatchedAccount {
  accountName: string;
  accountId: string;
  saveStatus: string;
  mrrAtRisk: number;
  contractEnd: string;
  paymentStanding: string;
}

export interface EmailResearch {
  gmailThreadSummary: string;
  slackMentions: string[];
  recentTranscripts: string[];
  calendarContext: string;
  accountTimeline: string;
  accountIntel: string;
  saveDeskNotes: string;
  researchedAt: string;
}

export interface EmailDraft {
  body: string;
  tone: 'value-first' | 'enforcement' | 'hybrid' | 'internal' | 'brief';
  strategy: string;
  createdAt: string;
}

export interface PendingAction {
  action: 'send' | 'archive' | 'snooze';
  emailId: string;
  gmailDraftId?: string;
  snoozeUntil?: string;
  queuedAt: string;
}

export interface ProcessedEmail {
  id: string;
  threadId: string;
  gmailDraftId: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  priority: EmailPriority;
  priorityReason: string;
  status: EmailStatus;
  statusUpdatedAt: string;
  snoozeUntil?: string;
  matchedAccount?: MatchedAccount;
  research?: EmailResearch;
  draft?: EmailDraft;
}

export interface EmailWorkflowRunStats {
  total: number;
  p0: number;
  p1: number;
  p2: number;
  p3: number;
  drafted: number;
  archived: number;
  researchedAccounts: number;
}

export interface EmailWorkflowData {
  lastRunAt: string;
  lastRunStats: EmailWorkflowRunStats;
  pendingActions: PendingAction[];
  emails: ProcessedEmail[];
}
