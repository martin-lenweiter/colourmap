import { NextResponse } from 'next/server';
import type { SpaceKey } from '@/lib/domain/types';
import { loadStateHistory } from '@/lib/db/queries';
import { getAnonymousId } from '@/lib/auth';
import { logger, getTraceId } from '../../../../lib/logger';

const VALID_SPACES: SpaceKey[] = ['health', 'connection', 'purpose'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const space = searchParams.get('space') as SpaceKey | null;
    const daysParam = searchParams.get('days');
    const parsed = daysParam ? parseInt(daysParam, 10) : 14;
    const days = Number.isNaN(parsed) ? 14 : Math.min(Math.max(parsed, 1), 365);

    if (!space || !VALID_SPACES.includes(space)) {
      return NextResponse.json(
        { error: 'Invalid space parameter' },
        { status: 400 }
      );
    }

    const ownerId = await getAnonymousId();
    const points = await loadStateHistory(ownerId, space, days);

    return NextResponse.json({ points });
  } catch (err) {
    logger.error('State history GET failed', {
      path: '/api/state/history',
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
