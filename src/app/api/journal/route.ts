import { NextResponse } from 'next/server';
import { getAnonymousId } from '@/lib/auth';
import { processJournalEntry } from '@/lib/services/chat';
import { getTraceId, logger } from '../../../lib/logger';

export async function POST(request: Request) {
  const start = Date.now();
  const traceId = getTraceId(request);
  logger.info('Journal ingest started', { path: '/api/journal', traceId });
  try {
    let body: { text: string; space?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (text.length === 0) {
      return NextResponse.json({ error: 'text must be a non-empty string' }, { status: 400 });
    }

    const ownerId = await getAnonymousId();
    const result = await processJournalEntry(ownerId, text, body.space);

    logger.info('Journal ingest completed', {
      path: '/api/journal',
      durationMs: Date.now() - start,
      status: 200,
      traceId,
    });
    return NextResponse.json(result);
  } catch (err) {
    logger.error('Journal ingest failed', {
      path: '/api/journal',
      durationMs: Date.now() - start,
      status: 500,
      traceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to process journal entry' }, { status: 500 });
  }
}
