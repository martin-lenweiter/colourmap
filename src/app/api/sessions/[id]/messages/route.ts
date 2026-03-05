import { NextResponse } from 'next/server';
import { findSessionByOwner, loadSessionMessages } from '@/lib/db/queries';
import { getAnonymousId } from '@/lib/auth';
import { logger, getTraceId } from '../../../../../lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ownerId = await getAnonymousId();
    const { id } = await params;

    const session = await findSessionByOwner(id, ownerId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const messages = await loadSessionMessages(id);
    return NextResponse.json({ messages });
  } catch (err) {
    logger.error('Session messages GET failed', {
      path: '/api/sessions/[id]/messages',
      status: 500,
      traceId: getTraceId(_request),
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to load messages' },
      { status: 500 }
    );
  }
}
