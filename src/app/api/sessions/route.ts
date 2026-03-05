import { NextResponse } from 'next/server';
import { getAnonymousId } from '@/lib/auth';
import { listSessions } from '@/lib/db/queries';
import { logger } from '../../../lib/logger';

export async function GET() {
  try {
    const ownerId = await getAnonymousId();
    const sessions = await listSessions(ownerId);
    return NextResponse.json({ sessions });
  } catch (err) {
    logger.error('Sessions GET failed', {
      path: '/api/sessions',
      status: 500,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}
