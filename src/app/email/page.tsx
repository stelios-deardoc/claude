'use client';

import { useEffect, useState, useCallback } from 'react';
import { t } from '@/lib/theme';
import type { EmailWorkflowData } from '@/lib/types';
import EmailList from '@/components/EmailList';
import EmailDetail from '@/components/EmailDetail';

export default function EmailPage() {
  const [data, setData] = useState<EmailWorkflowData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/email-workflow');
      const json = await res.json();
      setData(json);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (action: string, emailId: string, extra?: Record<string, string>) => {
    try {
      await fetch('/api/email-workflow/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, emailId, ...extra }),
      });
      await fetchData();
    } catch {
      // silent fail
    }
  };

  const handleSend = (id: string) => handleAction('send', id);
  const handleArchive = (id: string) => handleAction('archive', id);
  const handleSnooze = (id: string, until: string) => handleAction('snooze', id, { snoozeUntil: until });
  const handleSaveDraft = (id: string, body: string) => handleAction('save_draft', id, { draftBody: body });

  // Keyboard shortcuts
  useEffect(() => {
    if (!data) return;
    const activeEmails = data.emails.filter(e => e.status !== 'archived' && e.status !== 'sent');

    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      const currentIndex = activeEmails.findIndex(em => em.id === selectedId);

      switch (e.key.toLowerCase()) {
        case 'j':
          if (currentIndex < activeEmails.length - 1) {
            setSelectedId(activeEmails[currentIndex + 1].id);
          } else if (currentIndex === -1 && activeEmails.length > 0) {
            setSelectedId(activeEmails[0].id);
          }
          e.preventDefault();
          break;
        case 'k':
          if (currentIndex > 0) {
            setSelectedId(activeEmails[currentIndex - 1].id);
          }
          e.preventDefault();
          break;
        case 'e':
          if (selectedId) handleArchive(selectedId);
          e.preventDefault();
          break;
        case 'escape':
          setSelectedId(null);
          e.preventDefault();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data, selectedId]);

  const selectedEmail = data?.emails.find(e => e.id === selectedId) || null;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: t.muted }}>
        Loading...
      </div>
    );
  }

  if (!data || data.emails.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: t.muted, gap: '12px' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        <div style={{ fontSize: '16px', fontWeight: 600, color: t.fg }}>Email Workflow</div>
        <div style={{ fontSize: '13px', textAlign: 'center', maxWidth: '300px' }}>
          Run &quot;clean my inbox&quot; in Claude Code to process your emails and populate this dashboard.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', margin: '-24px', overflow: 'hidden' }}>
      <div style={{ width: selectedEmail ? '40%' : '100%', minWidth: '320px', transition: 'width 0.2s ease', borderRight: selectedEmail ? `1px solid ${t.cardBorder}` : 'none' }}>
        <EmailList
          emails={data.emails}
          selectedId={selectedId}
          lastRunAt={data.lastRunAt}
          onSelectEmail={setSelectedId}
          onRefresh={fetchData}
        />
      </div>
      {selectedEmail && (
        <div style={{ flex: 1, minWidth: '400px' }}>
          <EmailDetail
            email={selectedEmail}
            onArchive={handleArchive}
            onSnooze={handleSnooze}
            onSaveDraft={handleSaveDraft}
          />
        </div>
      )}
    </div>
  );
}
