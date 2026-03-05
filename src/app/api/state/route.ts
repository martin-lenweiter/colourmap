import { NextResponse } from 'next/server';
import { logger, getTraceId } from '../../../lib/logger';
import { computeDriftInfo, DEFAULT_USER_STATE } from '@/lib/domain/state';
import type { UserState } from '@/lib/domain/types';
import {
  loadUserState,
  saveUserState,
  loadRecentMessagesWithDeltas,
  loadLastSessionAt,
  listPrinciples,
  listFocusItems,
  listPatternFlags,
} from '@/lib/db/queries';
import { getAnonymousId } from '../anonymous-auth';

/** POST: Complete onboarding — persist initial state (colourmap.onboarding.complete) */
export async function POST(request: Request) {
  const start = Date.now();
  const traceId = getTraceId(request);
  logger.info('State POST started', { path: '/api/state', traceId });
  try {
    const ownerId = await getAnonymousId();
    const existing = await loadUserState(ownerId);
    if (existing) {
      return NextResponse.json({ error: 'Already onboarded' }, { status: 400 });
    }

    let body: { state: UserState };
    try {
      body = (await request.json()) as { state: UserState };
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const state = body.state;
    if (!state || typeof state !== 'object') {
      return NextResponse.json(
        { error: 'state must be a valid UserState object' },
        { status: 400 }
      );
    }

    const normalized: UserState = {
      health: {
        attention:
          state.health?.attention ?? DEFAULT_USER_STATE.health.attention,
        alignment: state.health?.alignment ?? 0.5,
        tone: Array.isArray(state.health?.tone) ? state.health.tone : [],
        tensions: Array.isArray(state.health?.tensions)
          ? state.health.tensions
          : [],
      },
      connection: {
        attention:
          state.connection?.attention ??
          DEFAULT_USER_STATE.connection.attention,
        alignment: state.connection?.alignment ?? 0.5,
        tone: Array.isArray(state.connection?.tone)
          ? state.connection.tone
          : [],
        tensions: Array.isArray(state.connection?.tensions)
          ? state.connection.tensions
          : [],
      },
      purpose: {
        attention:
          state.purpose?.attention ?? DEFAULT_USER_STATE.purpose.attention,
        alignment: state.purpose?.alignment ?? 0.5,
        tone: Array.isArray(state.purpose?.tone) ? state.purpose.tone : [],
        tensions: Array.isArray(state.purpose?.tensions)
          ? state.purpose.tensions
          : [],
      },
      energy: typeof state.energy === 'number' ? state.energy : 0.5,
      clarity: typeof state.clarity === 'number' ? state.clarity : 0.5,
    };

    await saveUserState(ownerId, normalized);
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
    return NextResponse.json(
      { error: 'Failed to save onboarding state' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const start = Date.now();
  const traceId = getTraceId(request);
  logger.info('State GET started', { path: '/api/state', traceId });
  try {
    const ownerId = await getAnonymousId();
    const state = await loadUserState(ownerId);

    if (!state) {
      return NextResponse.json({
        state: null,
        hasOnboarded: false,
        drift: null,
        lastSessionAt: null,
        principles: [],
        focusItems: [],
        patternFlags: [],
      });
    }

    const [
      recentMessages,
      lastSessionAt,
      principles,
      focusItems,
      patternFlags,
    ] = await Promise.all([
      loadRecentMessagesWithDeltas(ownerId),
      loadLastSessionAt(ownerId),
      listPrinciples(ownerId),
      listFocusItems(ownerId),
      listPatternFlags(ownerId, { status: 'pending', minConfidence: 0.6 }),
    ]);
    const drift = computeDriftInfo(state, recentMessages);

    logger.info('State GET completed', {
      path: '/api/state',
      durationMs: Date.now() - start,
      status: 200,
      traceId,
    });
    return NextResponse.json({
      state,
      hasOnboarded: true,
      drift,
      lastSessionAt,
      principles,
      focusItems,
      patternFlags,
    });
  } catch (err) {
    logger.error('State GET failed', {
      path: '/api/state',
      durationMs: Date.now() - start,
      status: 500,
      traceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to load state' },
      { status: 500 }
    );
  }
}
