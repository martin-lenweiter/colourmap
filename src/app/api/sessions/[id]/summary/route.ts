import { NextResponse } from 'next/server';
import { getAnonymousId } from '@/lib/auth';
import { findSessionByOwner, updateSessionSummary } from '@/lib/db/queries';
import { getOrGenerateSessionSummary } from '@/lib/services/session';
import { getTraceId, logger } from '../../../../../lib/logger';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await getAnonymousId();
    const { id } = await params;

    const session = await findSessionByOwner(id, ownerId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    let body: { correctedSummary: string };
    try {
      body = (await request.json()) as { correctedSummary: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const correctedSummary =
      typeof body.correctedSummary === 'string' ? body.correctedSummary.trim() : '';
    if (correctedSummary.length === 0) {
      return NextResponse.json(
        { error: 'correctedSummary must be a non-empty string' },
        { status: 400 },
      );
    }

    await updateSessionSummary(id, correctedSummary);
    return NextResponse.json({ summary: correctedSummary });
  } catch (err) {
    console.error('Session summary correction error:', err);
    return NextResponse.json({ error: 'Failed to save correction' }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await getAnonymousId();
    const { id } = await params;

    const session = await findSessionByOwner(id, ownerId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const summary = await getOrGenerateSessionSummary(id, ownerId);
    return NextResponse.json({ summary });
  } catch (err) {
    logger.error('Session summary failed', {
      path: '/api/sessions/[id]/summary',
      status: 500,
      traceId: getTraceId(_request),
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
