import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getRedis, KEYS } from '@/lib/db';
import { getRecentTranscripts, getTranscript, transcriptToText } from '@/lib/api/fireflies';
import { searchNPI } from '@/lib/api/npi';
import { searchMessages as searchSlack, sendPostCallNotification } from '@/lib/api/slack';
import type { Call, PostCallData, PostCallResult, GatheredContext, TranscriptData } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface SaveDeskData {
  calls: Call[];
  selectedCdpLevel: string;
  clawbackAmount: number;
}

interface ActionsData {
  actions: { id: string; task: string; urgency: string; completed: boolean; account: string }[];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Gmail helper (mirrors gmail.ts pattern)
async function gmailSearch(accessToken: string, query: string, maxResults = 5) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.messages?.length) return [];

  const threads: { threadId: string; subject: string; snippet: string; lastDate: string }[] = [];
  const seenThreads = new Set<string>();

  for (const msg of data.messages.slice(0, maxResults)) {
    const detail = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!detail.ok) continue;
    const d = await detail.json();
    const threadId = d.threadId;
    if (seenThreads.has(threadId)) continue;
    seenThreads.add(threadId);

    const headers = d.payload?.headers || [];
    const subject = headers.find((h: { name: string }) => h.name === 'Subject')?.value || '';
    const date = headers.find((h: { name: string }) => h.name === 'Date')?.value || '';
    threads.push({ threadId, subject, snippet: d.snippet || '', lastDate: date });
  }
  return threads;
}

// Calendar helper
async function calendarSearch(accessToken: string, query: string) {
  const now = new Date();
  const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const future14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${encodeURIComponent(query)}&timeMin=${past30}&timeMax=${future14}&maxResults=10&singleEvents=true&orderBy=startTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((e: { id: string; summary: string; start: { dateTime?: string; date?: string }; attendees?: { email: string }[] }) => ({
    id: e.id,
    summary: e.summary || '',
    start: e.start?.dateTime || e.start?.date || '',
    attendees: (e.attendees || []).map((a: { email: string }) => a.email),
  }));
}

// AI output schema
const postCallOutputSchema = z.object({
  summary: z.object({
    overview: z.string().describe('2-3 sentence executive summary of the call'),
    discussionPoints: z.array(z.object({
      topic: z.string(),
      details: z.string(),
      outcome: z.string(),
    })).describe('Key topics discussed'),
    decisions: z.array(z.string()).describe('Decisions made during the call'),
    nextSteps: z.array(z.string()).describe('Next steps mentioned'),
    sentiment: z.enum(['positive', 'neutral', 'negative']).describe('Overall call sentiment'),
    riskFlags: z.array(z.string()).describe('Any concerning items or risks identified'),
  }),
  actionItems: z.array(z.object({
    task: z.string().describe('What needs to be done'),
    details: z.string().describe('Additional context'),
    owner: z.enum(['stelios', 'client', 'internal']).describe('Who owns this action'),
    priority: z.enum(['high', 'medium', 'low']),
    deadline: z.string().describe('Suggested deadline in YYYY-MM-DD format, or empty string'),
    category: z.enum(['follow-up', 'email', 'internal', 'salesforce', 'billing', 'other']),
  })).describe('Action items generated from the call'),
  emailDrafts: z.array(z.object({
    type: z.enum(['client-followup', 'internal-update', 'escalation']),
    to: z.string().describe('Recipient email or name'),
    subject: z.string(),
    body: z.string().describe('Full email body text'),
    tone: z.enum(['value-first', 'enforcement', 'hybrid', 'internal', 'brief']),
    strategy: z.string().describe('Brief note on the email strategy'),
  })).describe('Email drafts to create'),
  accountNotesUpdate: z.string().describe('Markdown notes to append to the account notes log'),
  saveDeskSuggestions: z.array(z.object({
    field: z.string(),
    currentValue: z.string(),
    suggestedValue: z.string(),
    reason: z.string(),
  })).describe('Suggestions for updating the Save Desk record'),
});

const AI_SYSTEM_PROMPT = `You are a post-call analyst for Stelios Anastasiades at DearDoc (healthcare SaaS). Given a call transcript and all available context about the account, produce structured output.

## Context
- DearDoc sells AI-powered tools to dental/medical practices
- Products: AI Chat Widget, AI AutoDialer ($500/mo), Voice AI Receptionist ($1,500/mo), Missed-Call AI ($500/mo), Daily SEO Blogs ($800/mo), Website Rebuild ($5,000 + $200/mo)
- Stelios's role: Senior Director of Existing Business (customer retention / save desk)

## Rules
- No em dashes -- use regular dashes or double hyphens
- Lead with VALUE in follow-up emails, never lead with contract enforcement
- Contract enforcement is LAST RESORT
- Be concise and actionable
- Email drafts should be professional but warm
- For internal updates (Slack-style), be brief and data-focused
- Action items should have specific, measurable tasks
- Flag any churn risk, billing issues, or escalation needs in riskFlags`;

// GET - return all post-call results
export async function GET() {
  const redis = getRedis();
  const data = await redis.get<PostCallData>(KEYS.POST_CALL_DATA);
  return NextResponse.json(data || { results: [], lastProcessedAt: '', processedTranscriptIds: [] });
}

// POST - process a call transcript
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { firefliesTranscriptId, accountName } = body as { firefliesTranscriptId?: string; accountName?: string };

  const session = await auth();
  const accessToken = (session as unknown as Record<string, unknown>)?.accessToken as string | undefined;

  const redis = getRedis();
  const postCallData: PostCallData = (await redis.get<PostCallData>(KEYS.POST_CALL_DATA)) || {
    results: [],
    lastProcessedAt: '',
    processedTranscriptIds: [],
  };

  // Create a pending result
  const resultId = generateId();
  const pendingResult: PostCallResult = {
    id: resultId,
    status: 'gathering',
    firefliesTranscriptId: firefliesTranscriptId || '',
    context: {} as GatheredContext,
    summary: { overview: '', discussionPoints: [], decisions: [], nextSteps: [], sentiment: 'neutral', riskFlags: [] },
    actionItems: [],
    emailDrafts: [],
    accountNotesUpdate: '',
    saveDeskSuggestions: [],
    processedAt: '',
    accountName: '',
    contactName: '',
  };

  try {
    // 1. Fetch transcript
    let transcript;
    if (firefliesTranscriptId) {
      transcript = await getTranscript(firefliesTranscriptId);
    } else {
      // Get most recent transcript, optionally filter by account name
      const recent = await getRecentTranscripts(5);
      if (accountName) {
        transcript = recent.find(t => t.title.toLowerCase().includes(accountName.toLowerCase()));
        if (transcript) {
          transcript = await getTranscript(transcript.id);
        }
      } else if (recent.length > 0) {
        transcript = await getTranscript(recent[0].id);
      }
    }

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript found' }, { status: 404 });
    }

    // Check if already processed
    if (postCallData.processedTranscriptIds.includes(transcript.id)) {
      const existing = postCallData.results.find(r => r.firefliesTranscriptId === transcript!.id);
      if (existing) {
        return NextResponse.json(existing);
      }
    }

    const transcriptText = transcriptToText(transcript);
    const transcriptData: TranscriptData = {
      firefliesId: transcript.id,
      title: transcript.title,
      date: transcript.date,
      duration: transcript.duration,
      participants: transcript.participants,
      transcript: transcriptText,
      summary: transcript.summary?.overview || '',
      actionItems: transcript.summary?.action_items || [],
      topics: transcript.summary?.keywords || [],
    };

    // 2. Extract identifiers from transcript
    const detectedAccount = accountName || transcript.title.replace(/meeting|call|with/gi, '').trim();
    const detectedContact = transcript.participants.find(p => p.toLowerCase() !== 'stelios') || '';

    pendingResult.accountName = detectedAccount;
    pendingResult.contactName = detectedContact;
    pendingResult.firefliesTranscriptId = transcript.id;

    // 3. Match to Save Desk record
    const saveDeskData = await redis.get<SaveDeskData>(KEYS.SAVEDESK_DATA);
    const calls = (saveDeskData?.calls || []) as Call[];
    const q = detectedAccount.toLowerCase();
    const matchedCall = calls.find(c =>
      c.accountName.toLowerCase().includes(q) ||
      c.contactName.toLowerCase().includes(detectedContact.toLowerCase()),
    ) || null;

    // 4. Gather context in parallel
    const [gmailThreads, calendarEvents, npiResults, slackMentions, accountNotes, actionsData] = await Promise.all([
      // Gmail threads
      accessToken && detectedContact
        ? gmailSearch(accessToken, detectedContact, 5).catch(() => [])
        : Promise.resolve([]),
      // Calendar events
      accessToken && detectedAccount
        ? calendarSearch(accessToken, detectedAccount).catch(() => [])
        : Promise.resolve([]),
      // NPI lookup
      detectedContact
        ? (() => {
            const parts = detectedContact.split(' ');
            const first = parts[0]?.replace(/^dr\.?\s*/i, '') || '';
            const last = parts.slice(1).join(' ') || '';
            return first && last ? searchNPI(first, last).catch(() => []) : Promise.resolve([]);
          })()
        : Promise.resolve([]),
      // Slack mentions
      detectedAccount
        ? searchSlack(detectedAccount, 5).catch(() => [])
        : Promise.resolve([]),
      // Account notes
      redis.get<string>(KEYS.ACCOUNT_NOTES).catch(() => ''),
      // Existing actions
      redis.get<ActionsData>(KEYS.ACTIONS_DATA).catch(() => null),
    ]);

    // Filter account notes for this account
    let filteredNotes = '';
    if (accountNotes) {
      const lines = accountNotes.split('\n');
      const aq = detectedAccount.toLowerCase();
      let inSection = false;
      const matched: string[] = [];
      for (const line of lines) {
        if (line.startsWith('##') || line.startsWith('---')) {
          inSection = line.toLowerCase().includes(aq);
        }
        if (inSection) matched.push(line);
      }
      filteredNotes = matched.join('\n').slice(0, 2000);
    }

    // Filter actions for this account
    const existingActions = (actionsData?.actions || [])
      .filter(a => a.account?.toLowerCase().includes(q))
      .map(a => ({ id: a.id, task: a.task, urgency: a.urgency, completed: a.completed }));

    // NPI - take the best match
    const npiData = npiResults.length > 0
      ? { npi: npiResults[0].npi, name: npiResults[0].name, specialty: npiResults[0].specialty, address: npiResults[0].address, phone: npiResults[0].phone }
      : null;

    const context: GatheredContext = {
      transcript: transcriptData,
      matchedCall,
      gmailThreads,
      calendarEvents,
      npiData,
      slackMentions: slackMentions.map(m => ({
        channel: m.channelName,
        text: m.text.slice(0, 200),
        timestamp: m.timestamp,
        user: m.user,
      })),
      accountNotes: filteredNotes,
      existingActions,
      gatheredAt: new Date().toISOString(),
    };

    pendingResult.context = context;
    pendingResult.status = 'processing';

    // 5. AI Processing
    const userMessage = buildAIPrompt(context);

    const { object: aiOutput } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: postCallOutputSchema,
      system: AI_SYSTEM_PROMPT,
      prompt: userMessage,
    });

    // 6. Build final result
    const result: PostCallResult = {
      ...pendingResult,
      status: 'complete',
      summary: aiOutput.summary,
      actionItems: aiOutput.actionItems.map(a => ({
        ...a,
        id: generateId(),
        status: 'pending' as const,
      })),
      emailDrafts: aiOutput.emailDrafts.map(d => ({
        ...d,
        id: generateId(),
        gmailDraftId: '',
        status: 'generated' as const,
      })),
      accountNotesUpdate: aiOutput.accountNotesUpdate,
      saveDeskSuggestions: aiOutput.saveDeskSuggestions,
      processedAt: new Date().toISOString(),
    };

    // 7. Store in Redis
    postCallData.results.unshift(result);
    postCallData.lastProcessedAt = result.processedAt;
    postCallData.processedTranscriptIds.push(transcript.id);
    // Keep last 50 results
    if (postCallData.results.length > 50) {
      postCallData.results = postCallData.results.slice(0, 50);
    }
    await redis.set(KEYS.POST_CALL_DATA, postCallData);

    // 8. Append to account notes
    if (aiOutput.accountNotesUpdate) {
      const currentNotes = (await redis.get<string>(KEYS.ACCOUNT_NOTES)) || '';
      const updated = currentNotes + '\n\n' + aiOutput.accountNotesUpdate;
      await redis.set(KEYS.ACCOUNT_NOTES, updated);
    }

    // 9. Send Slack notification (auto-send internal)
    const slackChannel = process.env.SLACK_NOTIFICATION_CHANNEL;
    if (slackChannel) {
      try {
        await sendPostCallNotification(
          slackChannel,
          result.accountName,
          result.contactName,
          result.summary.overview.slice(0, 200),
          result.actionItems.length,
          result.emailDrafts.length,
        );
      } catch {
        // Slack notification is best-effort
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    pendingResult.status = 'error';
    pendingResult.error = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(pendingResult, { status: 500 });
  }
}

function buildAIPrompt(context: GatheredContext): string {
  const parts: string[] = [];

  parts.push('## Call Transcript');
  parts.push(`**Title:** ${context.transcript.title}`);
  parts.push(`**Date:** ${context.transcript.date}`);
  parts.push(`**Duration:** ${context.transcript.duration} minutes`);
  parts.push(`**Participants:** ${context.transcript.participants.join(', ')}`);
  if (context.transcript.summary) {
    parts.push(`**Fireflies Summary:** ${context.transcript.summary}`);
  }
  parts.push('');
  parts.push(context.transcript.transcript);

  if (context.matchedCall) {
    parts.push('\n## Save Desk Record');
    parts.push(`- Account: ${context.matchedCall.accountName}`);
    parts.push(`- Contact: ${context.matchedCall.contactName}`);
    parts.push(`- Save Status: ${context.matchedCall.saveStatus}`);
    parts.push(`- Save Type: ${context.matchedCall.saveType}`);
    parts.push(`- Monthly Price: ${context.matchedCall.monthlySalesPrice}`);
    parts.push(`- Contract Duration: ${context.matchedCall.newContractDuration}`);
    parts.push(`- Payment Standing: ${context.matchedCall.paymentStanding}`);
    parts.push(`- Billing: ${context.matchedCall.billingFrequency}`);
    if (context.matchedCall.notes) parts.push(`- Notes: ${context.matchedCall.notes}`);
    if (context.matchedCall.cancellationSubReason) parts.push(`- Cancellation Reason: ${context.matchedCall.cancellationSubReason}`);
  }

  if (context.gmailThreads.length > 0) {
    parts.push('\n## Recent Gmail Threads');
    context.gmailThreads.forEach(t => {
      parts.push(`- [${t.lastDate}] ${t.subject}: ${t.snippet}`);
    });
  }

  if (context.calendarEvents.length > 0) {
    parts.push('\n## Calendar Events');
    context.calendarEvents.forEach(e => {
      parts.push(`- [${e.start}] ${e.summary} (${e.attendees.join(', ')})`);
    });
  }

  if (context.npiData) {
    parts.push('\n## NPI Provider Data');
    parts.push(`- Name: ${context.npiData.name}`);
    parts.push(`- NPI: ${context.npiData.npi}`);
    parts.push(`- Specialty: ${context.npiData.specialty}`);
    parts.push(`- Address: ${context.npiData.address}`);
    parts.push(`- Phone: ${context.npiData.phone}`);
  }

  if (context.slackMentions.length > 0) {
    parts.push('\n## Recent Slack Mentions');
    context.slackMentions.forEach(m => {
      parts.push(`- [#${m.channel}] ${m.text}`);
    });
  }

  if (context.accountNotes) {
    parts.push('\n## Existing Account Notes');
    parts.push(context.accountNotes);
  }

  if (context.existingActions.length > 0) {
    parts.push('\n## Existing Action Items');
    context.existingActions.forEach(a => {
      parts.push(`- [${a.completed ? 'DONE' : a.urgency}] ${a.task}`);
    });
  }

  parts.push('\n---');
  parts.push('Based on all the above context, produce the structured post-call analysis.');

  return parts.join('\n');
}
