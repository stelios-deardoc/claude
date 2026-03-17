import type { ProcessedEmail, EmailPriority, EmailStatus } from './types';

export const PRIORITY_CONFIG: Record<EmailPriority, { label: string; color: string; bgColor: string; borderColor: string; sortOrder: number }> = {
  P0: { label: 'Critical', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444', sortOrder: 0 },
  P1: { label: 'Action Needed', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b', sortOrder: 1 },
  P2: { label: 'FYI', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', borderColor: '#3b82f6', sortOrder: 2 },
  P3: { label: 'Noise', color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', borderColor: '#64748b', sortOrder: 3 },
};

export const STATUS_CONFIG: Record<EmailStatus, { label: string; color: string; bgColor: string; icon: string }> = {
  needs_response: { label: 'Needs Response', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', icon: '!' },
  draft_ready: { label: 'Draft Ready', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', icon: '~' },
  sent: { label: 'Sent', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', icon: '+' },
  archived: { label: 'Archived', color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', icon: '-' },
  snoozed: { label: 'Snoozed', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)', icon: 'z' },
};

export function groupByPriority(emails: ProcessedEmail[]): Record<EmailPriority, ProcessedEmail[]> {
  const groups: Record<EmailPriority, ProcessedEmail[]> = { P0: [], P1: [], P2: [], P3: [] };
  emails.forEach(e => {
    if (groups[e.priority]) {
      groups[e.priority].push(e);
    }
  });
  return groups;
}

export function getSenderName(from: string): string {
  const match = from.match(/^(.+?)\s*<.+>$/);
  if (match) return match[1].trim();
  const emailMatch = from.match(/^([^@]+)@/);
  if (emailMatch) return emailMatch[1];
  return from;
}

export function getSenderInitials(from: string): string {
  const name = getSenderName(from);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getStatusCounts(emails: ProcessedEmail[]): Record<EmailStatus, number> {
  const counts: Record<EmailStatus, number> = {
    needs_response: 0,
    draft_ready: 0,
    sent: 0,
    archived: 0,
    snoozed: 0,
  };
  emails.forEach(e => {
    if (counts[e.status] !== undefined) counts[e.status]++;
  });
  return counts;
}

export function getSnoozeOptions(): { label: string; getTime: () => string }[] {
  return [
    { label: '1 hour', getTime: () => new Date(Date.now() + 3600000).toISOString() },
    { label: '4 hours', getTime: () => new Date(Date.now() + 14400000).toISOString() },
    { label: 'Tomorrow 9am', getTime: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    }},
    { label: 'Next week', getTime: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    }},
  ];
}
