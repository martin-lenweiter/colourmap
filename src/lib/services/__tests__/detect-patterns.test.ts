import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectPatterns } from '@/lib/services/detect-patterns';

vi.mock('@/lib/db/queries', () => ({
  loadSessionsForPatternDetection: vi.fn(),
  loadMessageDeltasForSessions: vi.fn(),
  createPatternFlag: vi.fn(),
  listPatternFlags: vi.fn(),
}));

import { loadMessageDeltasForSessions, loadSessionsForPatternDetection } from '@/lib/db/queries';

type MockedFn = ReturnType<typeof vi.fn>;

function makeSessions(count: number, baseDate = Date.now()) {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i + 1}`,
    createdAt: new Date(baseDate - (count - i) * 24 * 60 * 60 * 1000),
  }));
}

function makeMessages(
  sessions: { id: string }[],
  deltasFactory: (idx: number) => Record<string, unknown>,
) {
  return sessions.map((s, i) => ({ sessionId: s.id, stateDeltas: deltasFactory(i) }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('detectPatterns', () => {
  it('returns [] when fewer than 4 sessions', async () => {
    (loadSessionsForPatternDetection as MockedFn).mockResolvedValue(makeSessions(3));
    (loadMessageDeltasForSessions as MockedFn).mockResolvedValue([]);
    expect(await detectPatterns('user1')).toEqual([]);
  });

  it('returns [] when fewer than 4 sessions have message data', async () => {
    const sessions = makeSessions(5);
    (loadSessionsForPatternDetection as MockedFn).mockResolvedValue(sessions);
    // Only 2 sessions have messages
    (loadMessageDeltasForSessions as MockedFn).mockResolvedValue([
      { sessionId: 's1', stateDeltas: { health: { attention: 0.8, alignment: 0.6 } } },
      { sessionId: 's2', stateDeltas: { health: { attention: 0.8, alignment: 0.6 } } },
    ]);
    expect(await detectPatterns('user1')).toEqual([]);
  });

  it('health dominant in >=60% of 5 sessions → dominant focus pattern', async () => {
    const sessions = makeSessions(5);
    (loadSessionsForPatternDetection as MockedFn).mockResolvedValue(sessions);
    (loadMessageDeltasForSessions as MockedFn).mockResolvedValue(
      makeMessages(sessions, () => ({
        health: { attention: 0.8, alignment: 0.6 },
        connection: { attention: 0.2, alignment: 0.5 },
        purpose: { attention: 0.1, alignment: 0.5 },
      })),
    );
    const result = await detectPatterns('user1');
    expect(result.some((p) => p.description === 'health is consistently the dominant focus')).toBe(
      true,
    );
  });

  it('love key in stateDeltas maps to connection space with label "love"', async () => {
    const sessions = makeSessions(5);
    (loadSessionsForPatternDetection as MockedFn).mockResolvedValue(sessions);
    (loadMessageDeltasForSessions as MockedFn).mockResolvedValue(
      makeMessages(sessions, () => ({
        love: { attention: 0.9, alignment: 0.6 },
        health: { attention: 0.1, alignment: 0.5 },
        purpose: { attention: 0.1, alignment: 0.5 },
      })),
    );
    const result = await detectPatterns('user1');
    expect(result.some((p) => p.description === 'love is consistently the dominant focus')).toBe(
      true,
    );
  });

  it('avg alignment < 0.35 across 4 sessions → low alignment pattern', async () => {
    const sessions = makeSessions(4);
    (loadSessionsForPatternDetection as MockedFn).mockResolvedValue(sessions);
    (loadMessageDeltasForSessions as MockedFn).mockResolvedValue(
      makeMessages(sessions, () => ({
        health: { attention: 0.5, alignment: 0.2 },
        connection: { attention: 0.3, alignment: 0.5 },
        purpose: { attention: 0.2, alignment: 0.5 },
      })),
    );
    const result = await detectPatterns('user1');
    expect(result.some((p) => p.description === 'health alignment is persistently low')).toBe(true);
  });

  it('engagement diff > 0.15 (last third vs first third) → trending up pattern', async () => {
    const sessions = makeSessions(4);
    (loadSessionsForPatternDetection as MockedFn).mockResolvedValue(sessions);
    // First 2 sessions: low attention; last 2 sessions: high attention
    (loadMessageDeltasForSessions as MockedFn).mockResolvedValue([
      {
        sessionId: 's1',
        stateDeltas: {
          health: { attention: 0.1 },
          connection: { attention: 0.1 },
          purpose: { attention: 0.1 },
        },
      },
      {
        sessionId: 's2',
        stateDeltas: {
          health: { attention: 0.1 },
          connection: { attention: 0.1 },
          purpose: { attention: 0.1 },
        },
      },
      {
        sessionId: 's3',
        stateDeltas: {
          health: { attention: 0.4 },
          connection: { attention: 0.4 },
          purpose: { attention: 0.4 },
        },
      },
      {
        sessionId: 's4',
        stateDeltas: {
          health: { attention: 0.4 },
          connection: { attention: 0.4 },
          purpose: { attention: 0.4 },
        },
      },
    ]);
    const result = await detectPatterns('user1');
    expect(result.some((p) => p.description === 'overall engagement is trending up')).toBe(true);
  });

  it('engagement diff < -0.15 → trending down pattern', async () => {
    const sessions = makeSessions(4);
    (loadSessionsForPatternDetection as MockedFn).mockResolvedValue(sessions);
    (loadMessageDeltasForSessions as MockedFn).mockResolvedValue([
      {
        sessionId: 's1',
        stateDeltas: {
          health: { attention: 0.4 },
          connection: { attention: 0.4 },
          purpose: { attention: 0.4 },
        },
      },
      {
        sessionId: 's2',
        stateDeltas: {
          health: { attention: 0.4 },
          connection: { attention: 0.4 },
          purpose: { attention: 0.4 },
        },
      },
      {
        sessionId: 's3',
        stateDeltas: {
          health: { attention: 0.1 },
          connection: { attention: 0.1 },
          purpose: { attention: 0.1 },
        },
      },
      {
        sessionId: 's4',
        stateDeltas: {
          health: { attention: 0.1 },
          connection: { attention: 0.1 },
          purpose: { attention: 0.1 },
        },
      },
    ]);
    const result = await detectPatterns('user1');
    expect(result.some((p) => p.description === 'overall engagement is trending down')).toBe(true);
  });

  it('all returned patterns have confidence >= 0.6', async () => {
    const sessions = makeSessions(5);
    (loadSessionsForPatternDetection as MockedFn).mockResolvedValue(sessions);
    (loadMessageDeltasForSessions as MockedFn).mockResolvedValue(
      makeMessages(sessions, () => ({
        health: { attention: 0.8, alignment: 0.6 },
        connection: { attention: 0.2, alignment: 0.5 },
        purpose: { attention: 0.1, alignment: 0.5 },
      })),
    );
    const result = await detectPatterns('user1');
    expect(result.every((p) => p.confidence >= 0.6)).toBe(true);
  });
});
