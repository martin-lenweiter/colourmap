import { NextResponse } from 'next/server';
import { getAnonymousId } from '@/lib/auth';
import type { UserState } from '@/lib/domain/types';
import { getFullState, initializeOnboardingState, userHasOnboarded } from '@/lib/services/state';
import { getTraceId, logger } from '../../../lib/logger';

export async function POST(request: Request) {
  const start = Date.now();
  const traceId = getTraceId(request);
  logger.info('State POST started', { path: '/api/state', traceId });
  try {
    const ownerId = await getAnonymousId();
    if (await userHasOnboarded(ownerId)) {
      return NextResponse.json({ error: 'Already onboarded' }, { status: 400 });
    }

    let body: { state: UserState };
    try {
      body = (await request.json()) as { state: UserState };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!body.state || typeof body.state !== 'object') {
      return NextResponse.json(
        { error: 'state must be a valid UserState object' },
        { status: 400 },
      );
    }

    const normalized = await initializeOnboardingState(ownerId, body.state);
    logger.info('State POST completed', {
      path: '/api/state',
      durationMs: Date.now() - start,
      status: 200,
      traceId,
    });
    return NextResponse.json({ ok: true, state: normalized });
  } catch (err) {
    logger.error('State POST failed', {
      path: '/api/state',
      durationMs: Date.now() - start,
      status: 500,
      traceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to save onboarding state' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const start = Date.now();
  const traceId = getTraceId(request);
  logger.info('State GET started', { path: '/api/state', traceId });
  try {
    const ownerId = await getAnonymousId();
    const result = await getFullState(ownerId);

    logger.info('State GET completed', {
      path: '/api/state',
      durationMs: Date.now() - start,
      status: 200,
      traceId,
    });
    return NextResponse.json(result);
  } catch (err) {
    logger.error('State GET failed', {
      path: '/api/state',
      durationMs: Date.now() - start,
      status: 500,
      traceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to load state' }, { status: 500 });
  }
}
