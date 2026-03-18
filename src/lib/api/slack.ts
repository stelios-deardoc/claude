// Slack Web API client
// Used for searching messages and sending internal notifications

const SLACK_API = 'https://slack.com/api';

function getToken(): string {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('SLACK_BOT_TOKEN env var is required');
  return token;
}

async function slackFetch<T>(method: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${SLACK_API}/${method}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Slack API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }
  return data;
}

async function slackPost<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Slack API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }
  return data;
}

export interface SlackMessage {
  channel: string;
  channelName: string;
  text: string;
  timestamp: string;
  user: string;
  permalink: string;
}

interface SearchResponse {
  messages: {
    total: number;
    matches: {
      channel: { id: string; name: string };
      text: string;
      ts: string;
      user: string;
      permalink: string;
    }[];
  };
}

export async function searchMessages(query: string, count = 10): Promise<SlackMessage[]> {
  const data = await slackFetch<SearchResponse>('search.messages', {
    query,
    count: String(count),
    sort: 'timestamp',
    sort_dir: 'desc',
  });

  return (data.messages?.matches || []).map(m => ({
    channel: m.channel.id,
    channelName: m.channel.name,
    text: m.text,
    timestamp: m.ts,
    user: m.user,
    permalink: m.permalink,
  }));
}

export async function sendMessage(channel: string, text: string): Promise<{ ts: string }> {
  const data = await slackPost<{ ts: string }>('chat.postMessage', {
    channel,
    text,
  });
  return { ts: data.ts };
}

// Send a rich notification with blocks
export async function sendPostCallNotification(
  channel: string,
  accountName: string,
  contactName: string,
  summary: string,
  actionCount: number,
  draftCount: number,
): Promise<{ ts: string }> {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Post-Call Notes Ready: ${accountName}` },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Contact:* ${contactName}\n*Summary:* ${summary}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Action Items:* ${actionCount}` },
        { type: 'mrkdwn', text: `*Email Drafts:* ${draftCount}` },
      ],
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: 'Review in the <command-center|Post-Call Command Center>' },
      ],
    },
  ];

  return slackPost<{ ts: string }>('chat.postMessage', {
    channel,
    text: `Post-call notes ready for ${accountName} (${contactName})`,
    blocks,
  });
}
