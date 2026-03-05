import {
  createFocusItem,
  createPractice,
  createPrinciple,
  getOrCreateRecentSession,
  hasPendingSuggestedPractice,
  listFocusItems,
  listPrinciples,
  loadPatternContext,
  loadPreviousSessionAt,
  loadUserState,
  saveMessage,
  saveUserState,
} from '@/lib/db/queries';
import { buildCoachSystemPrompt, buildSpacePrompt } from '@/lib/domain/prompts';
import { DEFAULT_USER_STATE, mergeState, SPACE_KEYS } from '@/lib/domain/state';
import type {
  CoachMessage,
  CoachResponse,
  FocusItem,
  PatternContext,
  Principle,
  SpaceKey,
  UserState,
} from '@/lib/domain/types';
import { callCoach } from './coach';

export interface ChatInput {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  space?: string;
  isSystemContext?: boolean;
  isUserCorrection?: boolean;
}

export interface ChatResult {
  response: string;
  stateDeltas: CoachResponse['stateDeltas'];
  newState: UserState;
  sessionId: string;
  suggestedFocus: CoachResponse['suggestedFocus'] | CoachResponse['suggestedPractice'];
  suggestedPrinciple: CoachResponse['suggestedPrinciple'];
}

export interface JournalResult {
  newState: UserState;
  sessionId: string;
  response: string;
}

export async function processChat(ownerId: string, input: ChatInput): Promise<ChatResult> {
  const currentState = (await loadUserState(ownerId)) ?? { ...DEFAULT_USER_STATE };
  const sessionId = await getOrCreateRecentSession(ownerId);

  const spaceKey =
    input.space && (SPACE_KEYS as string[]).includes(input.space)
      ? (input.space as SpaceKey)
      : null;

  const history = Array.isArray(input.history)
    ? input.history.filter(
        (m): m is { role: 'user' | 'assistant'; content: string } =>
          m != null &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string',
      )
    : [];

  const isSessionStart = history.length === 0;
  const [principles, focusItems, patternContext, previousSessionAt, pendingPractice] =
    await Promise.all([
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
        focusItems.filter((f) => f.spaceKey === spaceKey),
      )
    : buildCoachSystemPrompt(
        currentState,
        history.length,
        principles,
        focusItems,
        patternContext,
        previousSessionAt ?? undefined,
        pendingPractice,
      );

  const messages: CoachMessage[] = [
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: input.message },
  ];

  const coachResponse = await callCoach(systemPrompt, messages);

  const isCorrection =
    input.isUserCorrection ??
    /^(actually|that'?s not right|i meant|no,? |correction:)/i.test(input.message.trim());
  const newState = mergeState(currentState, coachResponse.stateDeltas, {
    isUserCorrection: isCorrection,
  });

  const saves: Promise<unknown>[] = [
    saveUserState(ownerId, newState),
    ...(input.isSystemContext ? [] : [saveMessage(sessionId, 'user', input.message)]),
    saveMessage(sessionId, 'assistant', coachResponse.response, coachResponse.stateDeltas),
  ];

  const suggestedFocus = coachResponse.suggestedFocus ?? coachResponse.suggestedPractice;
  if (suggestedFocus && !pendingPractice) {
    const text = ('text' in suggestedFocus ? suggestedFocus.text : suggestedFocus.title) ?? '';
    saves.push(createPractice(ownerId, suggestedFocus.space, text, 'coach'));
  }

  if (coachResponse.suggestedPrinciple) {
    saves.push(
      createPrinciple(
        ownerId,
        coachResponse.suggestedPrinciple.space,
        coachResponse.suggestedPrinciple.text,
        'coach',
      ),
    );
  }

  await Promise.all(saves);

  return {
    response: coachResponse.response,
    stateDeltas: coachResponse.stateDeltas,
    newState,
    sessionId,
    suggestedFocus,
    suggestedPrinciple: coachResponse.suggestedPrinciple,
  };
}

export async function processJournalEntry(
  ownerId: string,
  text: string,
  space?: string,
): Promise<JournalResult> {
  const currentState = (await loadUserState(ownerId)) ?? { ...DEFAULT_USER_STATE };
  const sessionId = await getOrCreateRecentSession(ownerId);

  const spaceKey = space && (SPACE_KEYS as string[]).includes(space) ? (space as SpaceKey) : null;

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
    patternContext as PatternContext | undefined,
  );

  const journalContext = spaceKey
    ? `[Journal entry, tagged to ${spaceKey}]\n\n${text}`
    : `[Journal entry]\n\n${text}`;

  const messages: CoachMessage[] = [{ role: 'user' as const, content: journalContext }];

  const coachResponse = await callCoach(systemPrompt, messages);
  const newState = mergeState(currentState, coachResponse.stateDeltas);

  const saves: Promise<unknown>[] = [
    saveUserState(ownerId, newState),
    saveMessage(sessionId, 'user', text),
    saveMessage(sessionId, 'assistant', coachResponse.response, coachResponse.stateDeltas),
  ];

  const suggestedFocus = coachResponse.suggestedFocus ?? coachResponse.suggestedPractice;
  if (suggestedFocus) {
    saves.push(
      createFocusItem(
        ownerId,
        suggestedFocus.space,
        ('text' in suggestedFocus ? suggestedFocus.text : suggestedFocus.title) ?? '',
        'coach',
      ),
    );
  }

  if (coachResponse.suggestedPrinciple) {
    saves.push(
      createPrinciple(
        ownerId,
        coachResponse.suggestedPrinciple.space,
        coachResponse.suggestedPrinciple.text,
        'coach',
      ),
    );
  }

  await Promise.all(saves);

  return { newState, sessionId, response: coachResponse.response };
}
