import { NextResponse } from 'next/server';
import { logger, getTraceId } from '../../../lib/logger';
import { buildCoachSystemPrompt } from '@/lib/domain/prompts';
import { mergeState, DEFAULT_USER_STATE, SPACE_KEYS } from '@/lib/domain/state';
import type { CoachMessage, SpaceKey, Principle, FocusItem, PatternContext } from '@/lib/domain/types';
import { callCoach } from '@/lib/services/coach';
import {
  loadUserState,
  saveUserState,
  saveMessage,
  getOrCreateRecentSession,
  createFocusItem,
  createPrinciple,
  listPrinciples,
  listFocusItems,
  loadPatternContext,
} from '@/lib/db/queries';
import { getAnonymousId } from '@/lib/auth';

/**
 * POST: Ingest journal entry (colourmap.journal.ingest)
 * Processes text through coach and updates state. Feeds same state model as check-ins.
 */
export async function POST(request: Request) {
  const start = Date.now();
  const traceId = getTraceId(request);
  logger.info('Journal ingest started', { path: '/api/journal', traceId });
  try {
    let body: {
      text: string;
      space?: string;
    };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (text.length === 0) {
      return NextResponse.json(
        { error: 'text must be a non-empty string' },
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

    const [principles, focusItems, patternContext] = await Promise.all([
      listPrinciples(ownerId) as Promise<Principle[]>,
      listFocusItems(ownerId) as Promise<FocusItem[]>,
      loadPatternContext(ownerId, sessionId),
    ]);

    const systemPrompt = buildCoachSystemPrompt(
      currentState,
      0,
      principles,
      focusItems,
      patternContext as PatternContext | undefined
    );

    const journalContext = spaceKey
      ? `[Journal entry, tagged to ${spaceKey}]\n\n${text}`
      : `[Journal entry]\n\n${text}`;

    const messages: CoachMessage[] = [
      {
        role: 'user',
        content: journalContext,
      },
    ];

    const coachResponse = await callCoach(systemPrompt, messages);
    const newState = mergeState(currentState, coachResponse.stateDeltas);

    await Promise.all([
      saveUserState(ownerId, newState),
      saveMessage(sessionId, 'user', text),
      saveMessage(
        sessionId,
        'assistant',
        coachResponse.response,
        coachResponse.stateDeltas
      ),
    ]);

    const suggestedFocus =
      coachResponse.suggestedFocus ?? coachResponse.suggestedPractice;
    if (suggestedFocus) {
      await createFocusItem(
        ownerId,
        suggestedFocus.space,
        ('text' in suggestedFocus
          ? suggestedFocus.text
          : suggestedFocus.title) ?? '',
        'coach'
      );
    }

    if (coachResponse.suggestedPrinciple) {
      await createPrinciple(
        ownerId,
        coachResponse.suggestedPrinciple.space,
        coachResponse.suggestedPrinciple.text,
        'coach'
      );
    }

    logger.info('Journal ingest completed', {
      path: '/api/journal',
      durationMs: Date.now() - start,
      status: 200,
      traceId,
    });
    return NextResponse.json({
      newState,
      sessionId,
      response: coachResponse.response,
    });
  } catch (err) {
    logger.error('Journal ingest failed', {
      path: '/api/journal',
      durationMs: Date.now() - start,
      status: 500,
      traceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to process journal entry' },
      { status: 500 }
    );
  }
}
