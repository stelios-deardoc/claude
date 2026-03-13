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
