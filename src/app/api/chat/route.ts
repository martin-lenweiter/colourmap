import { NextResponse } from 'next/server';
import { logger, getTraceId } from '../../../lib/logger';
import { buildCoachSystemPrompt, buildSpacePrompt } from '@/lib/domain/prompts';
import { mergeState, DEFAULT_USER_STATE, SPACE_KEYS } from '@/lib/domain/state';
import type { CoachMessage, SpaceKey, Principle, FocusItem, PatternContext } from '@/lib/domain/types';
import { callCoach } from '@/lib/services/coach';
import {
  loadUserState,
  saveUserState,
  saveMessage,
  getOrCreateRecentSession,
  createPractice,
  createPrinciple,
  listPrinciples,
  listFocusItems,
  loadPatternContext,
  loadPreviousSessionAt,
  hasPendingSuggestedPractice,
} from '@/lib/db/queries';
import { getAnonymousId, clearAnonymousId } from '../anonymous-auth';

export async function POST(request: Request) {
  const start = Date.now();
  const traceId = getTraceId(request);
  logger.info('Chat request started', { path: '/api/chat', traceId });
  try {
    let body: {
      message: string;
      history: { role: 'user' | 'assistant'; content: string }[];
      space?: string;
      isSystemContext?: boolean;
      isUserCorrection?: boolean;
    };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (typeof body.message !== 'string' || body.message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message must be a non-empty string' },
        { status: 400 }
      );
    }

    const ownerId = await getAnonymousId();

    const currentState = (await loadUserState(ownerId)) ?? {
      ...DEFAULT_USER_STATE,
    };

    const sessionId = await getOrCreateRecentSession(ownerId);

    const spaceKey =
      body.space && (SPACE_KEYS as string[]).includes(body.space)
        ? (body.space as SpaceKey)
        : null;

    const rawHistory = body.history ?? [];
    const history = Array.isArray(rawHistory)
      ? rawHistory.filter(
          (m): m is { role: 'user' | 'assistant'; content: string } =>
            m != null &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string'
        )
      : [];

    // Load principles + focus items + pattern context + previous session + pending practice in parallel
    const isSessionStart = history.length === 0;
    const [
      principles,
      focusItems,
      patternContext,
      previousSessionAt,
      pendingPractice,
    ] = await Promise.all([
      listPrinciples(ownerId) as Promise<Principle[]>,
      listFocusItems(ownerId) as Promise<FocusItem[]>,
      isSessionStart
        ? loadPatternContext(ownerId, sessionId)
        : Promise.resolve(undefined as PatternContext | undefined),
      loadPreviousSessionAt(ownerId, sessionId),
      hasPendingSuggestedPractice(ownerId),
    ]);

    const systemPrompt = spaceKey
      ? buildSpacePrompt(
          spaceKey,
          currentState,
          principles.filter((p) => p.spaceKey === spaceKey),
          focusItems.filter((f) => f.spaceKey === spaceKey)
        )
      : buildCoachSystemPrompt(
          currentState,
          history.length,
          principles,
          focusItems,
          patternContext,
          previousSessionAt ?? undefined,
          pendingPractice
        );

    const messages: CoachMessage[] = [
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: body.message },
    ];

    const coachResponse = await callCoach(systemPrompt, messages);

    const isCorrection =
      body.isUserCorrection ??
      /^(actually|that'?s not right|i meant|no,? |correction:)/i.test(
        body.message.trim()
      );
    const newState = mergeState(currentState, coachResponse.stateDeltas, {
      isUserCorrection: isCorrection,
    });

    const saves: Promise<unknown>[] = [
      saveUserState(ownerId, newState),
      ...(body.isSystemContext
        ? []
        : [saveMessage(sessionId, 'user', body.message)]),
      saveMessage(
        sessionId,
        'assistant',
        coachResponse.response,
        coachResponse.stateDeltas
      ),
    ];

    // Handle suggestedFocus / suggestedPractice: create Practice (one at a time)
    const suggestedFocus =
      coachResponse.suggestedFocus ?? coachResponse.suggestedPractice;
    if (suggestedFocus && !pendingPractice) {
      const text =
        ('text' in suggestedFocus
          ? suggestedFocus.text
          : suggestedFocus.title) ?? '';
      saves.push(createPractice(ownerId, suggestedFocus.space, text, 'coach'));
    }

    // Handle suggestedPrinciple
    if (coachResponse.suggestedPrinciple) {
      saves.push(
        createPrinciple(
          ownerId,
          coachResponse.suggestedPrinciple.space,
          coachResponse.suggestedPrinciple.text,
          'coach'
        )
      );
    }

    await Promise.all(saves);

    logger.info('Chat request completed', {
      path: '/api/chat',
      durationMs: Date.now() - start,
      status: 200,
      traceId,
    });
    return NextResponse.json({
      response: coachResponse.response,
      stateDeltas: coachResponse.stateDeltas,
      newState,
      sessionId,
      suggestedFocus,
      suggestedPrinciple: coachResponse.suggestedPrinciple,
    });
  } catch (err) {
    logger.error('Chat request failed', {
      path: '/api/chat',
      durationMs: Date.now() - start,
      status: 500,
      traceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  await clearAnonymousId();
  return NextResponse.json({ reset: true });
}
