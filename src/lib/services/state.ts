import {
  listFocusItems,
  listPatternFlags,
  listPrinciples,
  loadLastSessionAt,
  loadRecentMessagesWithDeltas,
  loadUserState,
  saveUserState,
} from '@/lib/db/queries';
import { computeDriftInfo, DEFAULT_USER_STATE } from '@/lib/domain/state';
import type { UserState } from '@/lib/domain/types';

export async function getFullState(ownerId: string) {
  const state = await loadUserState(ownerId);
  if (!state) {
    return {
      state: null,
      hasOnboarded: false,
      drift: null,
      lastSessionAt: null,
      principles: [],
      focusItems: [],
      patternFlags: [],
    };
  }

  const [recentMessages, lastSessionAt, principles, focusItems, patternFlags] = await Promise.all([
    loadRecentMessagesWithDeltas(ownerId),
    loadLastSessionAt(ownerId),
    listPrinciples(ownerId),
    listFocusItems(ownerId),
    listPatternFlags(ownerId, { status: 'pending', minConfidence: 0.6 }),
  ]);

  const drift = computeDriftInfo(state, recentMessages);
  return { state, hasOnboarded: true, drift, lastSessionAt, principles, focusItems, patternFlags };
}

export function normalizeOnboardingState(state: UserState): UserState {
  return {
    health: {
      attention: state.health?.attention ?? DEFAULT_USER_STATE.health.attention,
      alignment: state.health?.alignment ?? 0.5,
      tone: Array.isArray(state.health?.tone) ? state.health.tone : [],
      tensions: Array.isArray(state.health?.tensions) ? state.health.tensions : [],
    },
    connection: {
      attention: state.connection?.attention ?? DEFAULT_USER_STATE.connection.attention,
      alignment: state.connection?.alignment ?? 0.5,
      tone: Array.isArray(state.connection?.tone) ? state.connection.tone : [],
      tensions: Array.isArray(state.connection?.tensions) ? state.connection.tensions : [],
    },
    purpose: {
      attention: state.purpose?.attention ?? DEFAULT_USER_STATE.purpose.attention,
      alignment: state.purpose?.alignment ?? 0.5,
      tone: Array.isArray(state.purpose?.tone) ? state.purpose.tone : [],
      tensions: Array.isArray(state.purpose?.tensions) ? state.purpose.tensions : [],
    },
    energy: typeof state.energy === 'number' ? state.energy : 0.5,
    clarity: typeof state.clarity === 'number' ? state.clarity : 0.5,
  };
}

export async function userHasOnboarded(ownerId: string): Promise<boolean> {
  const state = await loadUserState(ownerId);
  return state !== null;
}

export async function initializeOnboardingState(
  ownerId: string,
  state: UserState,
): Promise<UserState> {
  const normalized = normalizeOnboardingState(state);
  await saveUserState(ownerId, normalized);
  return normalized;
}
