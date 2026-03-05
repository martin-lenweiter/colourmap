import type { DriftInfo, SpaceKey, SpaceState, StateDelta, UserState } from './types';

export type { UserState, StateDelta, SpaceState, SpaceKey };

export const DEFAULT_USER_STATE: UserState = {
  health: { attention: 0.3, tone: [], alignment: 0.5, tensions: [] },
  connection: { attention: 0.3, tone: [], alignment: 0.5, tensions: [] },
  purpose: { attention: 0.3, tone: [], alignment: 0.5, tensions: [] },
  energy: 0.5,
  clarity: 0.5,
};

export const SPACE_KEYS: SpaceKey[] = ['health', 'connection', 'purpose'];

const EMA_WEIGHT = 0.3;

export interface MergeStateOptions {
  isUserCorrection?: boolean;
}

function mergeSpace(
  current: SpaceState,
  delta?: Partial<SpaceState>,
  override = false,
): SpaceState {
  if (!delta) return current;
  const blend = (curr: number, next: number) =>
    override ? next : EMA_WEIGHT * next + (1 - EMA_WEIGHT) * curr;
  return {
    attention:
      delta.attention !== undefined ? blend(current.attention, delta.attention) : current.attention,
    tone: delta.tone ?? current.tone,
    alignment:
      delta.alignment !== undefined ? blend(current.alignment, delta.alignment) : current.alignment,
    tensions: delta.tensions ?? current.tensions,
  };
}

export function mergeState(
  current: UserState,
  delta: StateDelta,
  options?: MergeStateOptions,
): UserState {
  const override = options?.isUserCorrection ?? false;
  const blend = (curr: number, next: number) =>
    override ? next : EMA_WEIGHT * next + (1 - EMA_WEIGHT) * curr;
  return {
    health: mergeSpace(current.health, delta.health, override),
    connection: mergeSpace(current.connection, delta.connection, override),
    purpose: mergeSpace(current.purpose, delta.purpose, override),
    energy: delta.energy !== undefined ? blend(current.energy, delta.energy) : current.energy,
    clarity: delta.clarity !== undefined ? blend(current.clarity, delta.clarity) : current.clarity,
  };
}

interface MessageWithDelta {
  state_deltas: Record<string, unknown> | null;
  created_at: string;
}

export function computeDriftInfo(state: UserState, recentMessages: MessageWithDelta[]): DriftInfo {
  const now = Date.now();

  function computeForSpace(space: SpaceKey) {
    const lastMsg = recentMessages.find((m) => m.state_deltas && space in m.state_deltas);
    const staleDays = lastMsg
      ? (now - new Date(lastMsg.created_at).getTime()) / (1000 * 60 * 60 * 24)
      : 14;
    const isDrifting = staleDays > 2 || state[space].alignment < 0.3;
    return { staleDays: Math.round(staleDays * 10) / 10, isDrifting };
  }

  return {
    health: computeForSpace('health'),
    connection: computeForSpace('connection'),
    purpose: computeForSpace('purpose'),
  };
}
