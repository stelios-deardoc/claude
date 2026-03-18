import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRedis, KEYS } from '@/lib/db';
import type { PostCallData } from '@/lib/types';

export const dynamic = 'force-dynamic';

// POST - create a Gmail draft from a post-call email draft
export async function POST(req: NextRequest) {
  const { resultId, draftId, body: editedBody } = await req.json() as {
    resultId: string;
    draftId: string;
    body?: string; // optional edited body
  };

  const session = await auth();
  const accessToken = (session as unknown as Record<string, unknown>)?.accessToken as string | undefined;
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const redis = getRedis();
  const postCallData = await redis.get<PostCallData>(KEYS.POST_CALL_DATA);
  if (!postCallData) {
    return NextResponse.json({ error: 'No post-call data' }, { status: 404 });
  }

  const result = postCallData.results.find(r => r.id === resultId);
  if (!result) {
    return NextResponse.json({ error: 'Result not found' }, { status: 404 });
  }

  const draft = result.emailDrafts.find(d => d.id === draftId);
  if (!draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  const bodyToSend = editedBody || draft.body;

  // Create Gmail draft
  const rawMessage = [
    `To: ${draft.to}`,
    `Subject: ${draft.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    bodyToSend,
  ].join('\r\n');

  const encoded = Buffer.from(rawMessage).toString('base64url');

  const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw: encoded } }),
  });

  if (!gmailRes.ok) {
    const error = await gmailRes.text();
    return NextResponse.json({ error: `Gmail API error: ${error}` }, { status: 500 });
  }

  const gmailData = await gmailRes.json();

  // Update draft status
  draft.gmailDraftId = gmailData.id;
  draft.status = 'drafted';
  if (editedBody) {
    draft.body = editedBody;
    draft.status = 'edited';
  }

  await redis.set(KEYS.POST_CALL_DATA, postCallData);

  return NextResponse.json({
    ok: true,
    gmailDraftId: gmailData.id,
    status: 'Draft created in Gmail - review and send manually',
  });
}
