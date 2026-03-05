import { NextResponse } from 'next/server';
import { clearAnonymousId, getAnonymousId } from '@/lib/auth';
import { type ChatInput, processChat } from '@/lib/services/chat';
import { getTraceId, logger } from '../../../lib/logger';

export async function POST(request: Request) {
  const start = Date.now();
  const traceId = getTraceId(request);
  logger.info('Chat request started', { path: '/api/chat', traceId });
  try {
    let body: ChatInput;
    try {
      body = (await request.json()) as ChatInput;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (typeof body.message !== 'string' || body.message.trim().length === 0) {
      return NextResponse.json({ error: 'Message must be a non-empty string' }, { status: 400 });
    }

    const ownerId = await getAnonymousId();
    const result = await processChat(ownerId, {
      message: body.message,
      history: body.history ?? [],
      space: body.space,
      isSystemContext: body.isSystemContext,
      isUserCorrection: body.isUserCorrection,
    });

    logger.info('Chat request completed', {
      path: '/api/chat',
      durationMs: Date.now() - start,
      status: 200,
      traceId,
    });
    return NextResponse.json(result);
  } catch (err) {
    logger.error('Chat request failed', {
      path: '/api/chat',
      durationMs: Date.now() - start,
      status: 500,
      traceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}

export async function DELETE() {
  await clearAnonymousId();
  return NextResponse.json({ reset: true });
}
