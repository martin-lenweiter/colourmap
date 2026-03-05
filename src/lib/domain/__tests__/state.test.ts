import { describe, expect, it } from 'vitest';
import { computeDriftInfo, mergeState } from '@/lib/domain/state';
import type { UserState } from '@/lib/domain/types';

const baseState: UserState = {
  health: { attention: 0.3, tone: [], alignment: 0.5, tensions: [] },
  connection: { attention: 0.3, tone: [], alignment: 0.5, tensions: [] },
  purpose: { attention: 0.3, tone: [], alignment: 0.5, tensions: [] },
  energy: 0.5,
  clarity: 0.5,
};

describe('mergeState', () => {
  it('applies EMA blend: 0.3 * delta + 0.7 * current', () => {
    const result = mergeState(baseState, { health: { attention: 1.0 } });
    expect(result.health.attention).toBeCloseTo(0.3 * 1.0 + 0.7 * 0.3);
  });

  it('with isUserCorrection: true, delta value wins fully', () => {
    const result = mergeState(
      baseState,
      { health: { attention: 0.9 } },
      { isUserCorrection: true },
    );
    expect(result.health.attention).toBe(0.9);
  });

  it('undefined delta fields leave current unchanged', () => {
    const result = mergeState(baseState, { health: {} });
    expect(result.health.attention).toBe(0.3);
    expect(result.health.alignment).toBe(0.5);
  });

  it('applies EMA to energy and clarity', () => {
    const result = mergeState(baseState, { energy: 1.0, clarity: 0.0 });
    expect(result.energy).toBeCloseTo(0.3 * 1.0 + 0.7 * 0.5);
    expect(result.clarity).toBeCloseTo(0.3 * 0.0 + 0.7 * 0.5);
  });

  it('tone and tensions arrays are replaced, not blended', () => {
    const stateWithData = {
      ...baseState,
      health: { ...baseState.health, tone: ['calm'], tensions: ['conflict'] },
    };
    const result = mergeState(stateWithData, { health: { tone: ['anxious'], tensions: [] } });
    expect(result.health.tone).toEqual(['anxious']);
    expect(result.health.tensions).toEqual([]);
  });
});

describe('computeDriftInfo', () => {
  it('alignment < 0.3 → isDrifting: true', () => {
    const state = { ...baseState, health: { ...baseState.health, alignment: 0.2 } };
    const now = new Date().toISOString();
    const result = computeDriftInfo(state, [{ state_deltas: { health: {} }, created_at: now }]);
    expect(result.health.isDrifting).toBe(true);
  });

  it('last message > 2 days ago → isDrifting: true', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const state = { ...baseState, health: { ...baseState.health, alignment: 0.8 } };
    const result = computeDriftInfo(state, [
      { state_deltas: { health: {} }, created_at: threeDaysAgo },
    ]);
    expect(result.health.isDrifting).toBe(true);
    expect(result.health.staleDays).toBeGreaterThanOrEqual(3);
  });

  it('no messages → staleDays: 14, isDrifting: true for all spaces', () => {
    const result = computeDriftInfo(baseState, []);
    expect(result.health.staleDays).toBe(14);
    expect(result.health.isDrifting).toBe(true);
    expect(result.connection.staleDays).toBe(14);
    expect(result.purpose.staleDays).toBe(14);
  });

  it('recent message + good alignment → isDrifting: false', () => {
    const state = { ...baseState, health: { ...baseState.health, alignment: 0.8 } };
    const now = new Date().toISOString();
    const result = computeDriftInfo(state, [{ state_deltas: { health: {} }, created_at: now }]);
    expect(result.health.isDrifting).toBe(false);
    expect(result.health.staleDays).toBeLessThan(1);
  });
});
