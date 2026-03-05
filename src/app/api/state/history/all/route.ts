import { NextResponse } from 'next/server';
import { loadStateHistoryAllSpaces } from '@/lib/db/queries';
import { getAnonymousId } from '@/lib/auth';
import { logger, getTraceId } from '../../../../../lib/logger';

/** GET: Load state history for all three spaces (wider-view). Query: ?days=14 (default, max 365) */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const parsed = daysParam ? parseInt(daysParam, 10) : 14;
    const days = Number.isNaN(parsed) ? 14 : Math.min(Math.max(parsed, 1), 365);

    const ownerId = await getAnonymousId();
    const allSpaces = await loadStateHistoryAllSpaces(ownerId, days);

    return NextResponse.json({ spaces: allSpaces });
  } catch (err) {
    logger.error('State history (all) GET failed', {
      path: '/api/state/history/all',
      status: 500,
      traceId: getTraceId(request),
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to load state history' },
      { status: 500 }
    );
  }
}
