'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { t } from '@/lib/theme';
import type { PostCallData, PostCallResult } from '@/lib/types';
import CallList from '@/components/post-call/CallList';
import CallSummaryTab from '@/components/post-call/CallSummaryTab';
import ActionItemsTab from '@/components/post-call/ActionItemsTab';
import DraftsTab from '@/components/post-call/DraftsTab';
import ContextTab from '@/components/post-call/ContextTab';
import TimelineTab from '@/components/post-call/TimelineTab';

type TabName = 'summary' | 'actions' | 'drafts' | 'context' | 'timeline';

const TABS: { id: TabName; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'actions', label: 'Actions' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'context', label: 'Context' },
  { id: 'timeline', label: 'Timeline' },
];

export default function PostCallPage() {
  const [data, setData] = useState<PostCallData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>('summary');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [unprocessedCount, setUnprocessedCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/post-call');
      const json = await res.json();
      setData(json);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  const checkNew = useCallback(async () => {
    try {
      const res = await fetch('/api/post-call/check');
      const json = await res.json();
      setUnprocessedCount(json.unprocessedCount || 0);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchData();
    checkNew();
    // Poll for new transcripts every 60s
    pollRef.current = setInterval(checkNew, 60000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchData, checkNew]);

  const processLatest = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/post-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      if (result.id) {
        setSelectedId(result.id);
        setActiveTab('summary');
      }
      await fetchData();
      await checkNew();
    } catch {
      // silent
    } finally {
      setProcessing(false);
    }
  };

  const handleAcceptAction = async (resultId: string, actionId: string) => {
    try {
      await fetch('/api/post-call/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId, actionId, action: 'accept' }),
      });
      await fetchData();
    } catch { /* silent */ }
  };

  const handleDismissAction = async (resultId: string, actionId: string) => {
    try {
      await fetch('/api/post-call/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId, actionId, action: 'dismiss' }),
      });
      await fetchData();
    } catch { /* silent */ }
  };

  const handleCreateGmailDraft = async (resultId: string, draftId: string, body?: string) => {
    try {
      await fetch('/api/post-call/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId, draftId, body }),
      });
      await fetchData();
    } catch { /* silent */ }
  };

  // Keyboard nav
  useEffect(() => {
    if (!data?.results?.length) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      const results = data!.results;
      const idx = results.findIndex(r => r.id === selectedId);
      switch (e.key.toLowerCase()) {
        case 'j':
          if (idx < results.length - 1) setSelectedId(results[idx + 1].id);
          else if (idx === -1 && results.length > 0) setSelectedId(results[0].id);
          e.preventDefault();
          break;
        case 'k':
          if (idx > 0) setSelectedId(results[idx - 1].id);
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

  const selected: PostCallResult | null = data?.results?.find(r => r.id === selectedId) || null;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: t.muted }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', margin: '-24px', overflow: 'hidden' }}>
      {/* Left panel - Call list */}
      <div style={{
        width: selected ? '35%' : '100%', minWidth: '300px',
        transition: 'width 0.2s ease',
        borderRight: selected ? `1px solid ${t.cardBorder}` : 'none',
      }}>
        <CallList
          results={data?.results || []}
          selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); setActiveTab('summary'); }}
          onProcessLatest={processLatest}
          onRefresh={() => { fetchData(); checkNew(); }}
          processing={processing}
          unprocessedCount={unprocessedCount}
        />
      </div>

      {/* Right panel - Detail view */}
      {selected && (
        <div style={{ flex: 1, minWidth: '450px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{
            display: 'flex', borderBottom: `1px solid ${t.cardBorder}`,
            padding: '0 16px', gap: '0',
          }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              let badge = '';
              if (tab.id === 'actions') badge = `${selected.actionItems?.filter(a => a.status === 'pending').length || 0}`;
              if (tab.id === 'drafts') badge = `${selected.emailDrafts?.filter(d => !d.gmailDraftId).length || 0}`;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '12px 16px', fontSize: '13px', fontWeight: isActive ? 600 : 400,
                    color: isActive ? t.accent : t.muted,
                    background: 'transparent', border: 'none',
                    borderBottom: isActive ? `2px solid ${t.accent}` : '2px solid transparent',
                    cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  {tab.label}
                  {badge && badge !== '0' && (
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px',
                      background: `${t.accent}22`, color: t.accent,
                    }}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeTab === 'summary' && selected.summary && (
              <CallSummaryTab
                summary={selected.summary}
                accountName={selected.accountName}
                contactName={selected.contactName}
                processedAt={selected.processedAt}
              />
            )}
            {activeTab === 'actions' && (
              <ActionItemsTab
                actions={selected.actionItems || []}
                resultId={selected.id}
                onAccept={handleAcceptAction}
                onDismiss={handleDismissAction}
              />
            )}
            {activeTab === 'drafts' && (
              <DraftsTab
                drafts={selected.emailDrafts || []}
                resultId={selected.id}
                onCreateGmailDraft={handleCreateGmailDraft}
              />
            )}
            {activeTab === 'context' && selected.context && (
              <ContextTab context={selected.context} />
            )}
            {activeTab === 'timeline' && selected.context && (
              <TimelineTab context={selected.context} accountName={selected.accountName} />
            )}
          </div>

          {/* Save Desk Suggestions footer */}
          {activeTab === 'summary' && selected.saveDeskSuggestions?.length > 0 && (
            <div style={{
              padding: '12px 20px', borderTop: `1px solid ${t.cardBorder}`,
              background: 'rgba(59, 130, 246, 0.05)',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: t.accent, marginBottom: '6px', textTransform: 'uppercase' }}>
                Save Desk Update Suggestions
              </div>
              {selected.saveDeskSuggestions.map((s, i) => (
                <div key={i} style={{ fontSize: '12px', color: t.fg, marginBottom: '4px' }}>
                  <strong>{s.field}:</strong> {s.currentValue} → {s.suggestedValue} <span style={{ color: t.muted }}>({s.reason})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
