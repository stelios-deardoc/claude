// Fireflies.ai GraphQL API client
// Docs: https://docs.fireflies.ai/graphql-api/query/transcripts

const FIREFLIES_API = 'https://api.fireflies.ai/graphql';

function getApiKey(): string {
  const key = process.env.FIREFLIES_API_KEY;
  if (!key) throw new Error('FIREFLIES_API_KEY env var is required');
  return key;
}

async function firefliesQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(FIREFLIES_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fireflies API error (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Fireflies GraphQL error: ${json.errors[0].message}`);
  }
  return json.data;
}

export interface FirefliesTranscript {
  id: string;
  title: string;
  date: string;
  duration: number;
  participants: string[];
  transcript_url: string;
}

export interface FirefliesTranscriptDetail {
  id: string;
  title: string;
  date: string;
  duration: number;
  participants: string[];
  sentences: { speaker_name: string; text: string; raw_text: string; start_time: number; end_time: number }[];
  summary: { overview: string; action_items: string[]; keywords: string[] } | null;
}

export async function getRecentTranscripts(limit = 10): Promise<FirefliesTranscript[]> {
  const data = await firefliesQuery<{ transcripts: FirefliesTranscript[] }>(`
    query RecentTranscripts($limit: Int) {
      transcripts(limit: $limit) {
        id
        title
        date
        duration
        participants
        transcript_url
      }
    }
  `, { limit });
  return data.transcripts || [];
}

export async function getTranscript(id: string): Promise<FirefliesTranscriptDetail | null> {
  const data = await firefliesQuery<{ transcript: FirefliesTranscriptDetail | null }>(`
    query GetTranscript($id: String!) {
      transcript(id: $id) {
        id
        title
        date
        duration
        participants
        sentences {
          speaker_name
          text
          raw_text
          start_time
          end_time
        }
        summary {
          overview
          action_items
          keywords
        }
      }
    }
  `, { id });
  return data.transcript;
}

export async function searchTranscripts(query: string, limit = 10): Promise<FirefliesTranscript[]> {
  // Fireflies search uses the transcripts query with a title filter
  // We fetch recent and filter client-side since the API doesn't have a full-text search on title
  const all = await getRecentTranscripts(Math.min(limit * 3, 50));
  const q = query.toLowerCase();
  return all
    .filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.participants.some(p => p.toLowerCase().includes(q))
    )
    .slice(0, limit);
}

// Convert Fireflies transcript detail to plain text for AI processing
export function transcriptToText(detail: FirefliesTranscriptDetail, maxChars = 15000): string {
  if (!detail.sentences?.length) return '';
  const lines = detail.sentences.map(s => `${s.speaker_name}: ${s.text}`);
  const full = lines.join('\n');
  if (full.length <= maxChars) return full;
  // Truncate from the middle, keeping start and end for context
  const half = Math.floor(maxChars / 2);
  return full.slice(0, half) + '\n\n[... transcript truncated ...]\n\n' + full.slice(-half);
}
