import { describe, expect, it } from 'vitest';
import { buildCoachSystemPrompt } from '@/lib/domain/prompts';
import type { FocusItem, Principle, UserState } from '@/lib/domain/types';

function makeState(overrides: Partial<UserState> = {}): UserState {
  return {
    health: { attention: 0.3, tone: [], alignment: 0.5, tensions: [] },
    connection: { attention: 0.3, tone: [], alignment: 0.5, tensions: [] },
    purpose: { attention: 0.3, tone: [], alignment: 0.5, tensions: [] },
    energy: 0.5,
    clarity: 0.5,
    ...overrides,
  };
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function makePrinciple(overrides: Partial<Principle> = {}): Principle {
  return {
    id: 'p1',
    spaceKey: 'health',
    text: 'Move daily',
    source: 'coach',
    confirmed: true,
    createdAt: daysAgo(10),
    ...overrides,
  };
}

function makeFocus(overrides: Partial<FocusItem> = {}): FocusItem {
  return {
    id: 'f1',
    spaceKey: 'health',
    text: 'Morning run',
    source: 'coach',
    status: 'active',
    createdAt: daysAgo(1),
    completedAt: null,
    ...overrides,
  };
}

describe('buildCoachSystemPrompt — priority signals', () => {
  it('high attention (>0.5) + low alignment (<0.3) → [high] acute signal', () => {
    const state = makeState({ health: { attention: 0.7, tone: [], alignment: 0.2, tensions: [] } });
    const prompt = buildCoachSystemPrompt(state, 0);
    expect(prompt).toContain('## Priority signals');
    expect(prompt).toContain('[high]');
  });

  it('space with active tensions → [high] acute signal', () => {
    const state = makeState({
      health: { attention: 0.3, tone: [], alignment: 0.5, tensions: ['overwork', 'burnout'] },
    });
    const prompt = buildCoachSystemPrompt(state, 0);
    expect(prompt).toContain('[high]');
    expect(prompt).toContain('tensions');
  });

  it('low attention (<0.2) + messageCount > 6 → staleness signal present', () => {
    const state = makeState({ health: { attention: 0.1, tone: [], alignment: 0.5, tensions: [] } });
    const prompt = buildCoachSystemPrompt(state, 7);
    expect(prompt).toContain('## Priority signals');
  });

  it('active focus item age >= 14 days → [high] staleness', () => {
    const prompt = buildCoachSystemPrompt(
      makeState(),
      0,
      [],
      [makeFocus({ createdAt: daysAgo(15) })],
    );
    expect(prompt).toContain('[high]');
  });

  it('active focus item age 7-13 days → [medium] staleness', () => {
    const prompt = buildCoachSystemPrompt(
      makeState(),
      0,
      [],
      [makeFocus({ createdAt: daysAgo(10) })],
    );
    expect(prompt).toContain('[medium]');
  });

  it('unconfirmed principle age >= 3 days → staleness signal', () => {
    const principle = makePrinciple({ confirmed: false, createdAt: daysAgo(5) });
    const prompt = buildCoachSystemPrompt(makeState(), 0, [principle]);
    expect(prompt).toContain('## Priority signals');
  });

  it('confirmed principle + alignment < 0.4 → [high] misalignment signal', () => {
    const state = makeState({ health: { attention: 0.3, tone: [], alignment: 0.3, tensions: [] } });
    const principle = makePrinciple({ confirmed: true, spaceKey: 'health' });
    const prompt = buildCoachSystemPrompt(state, 0, [principle]);
    expect(prompt).toContain('[high]');
    expect(prompt).toContain('gap between intentions and actions');
  });

  it('no confirmed principles + messageCount >= 3 → pattern signal', () => {
    const principle = makePrinciple({ confirmed: false, createdAt: daysAgo(0) });
    const prompt = buildCoachSystemPrompt(makeState(), 3, [principle]);
    expect(prompt).toContain('## Priority signals');
  });

  it('lastSessionAt 28+ days ago → broadening medium signal', () => {
    const prompt = buildCoachSystemPrompt(makeState(), 0, [], [], undefined, daysAgo(30));
    expect(prompt).toContain('[medium]');
    expect(prompt).toContain('monthly reflection');
  });

  it('lastSessionAt 7-27 days ago → broadening low signal', () => {
    const prompt = buildCoachSystemPrompt(makeState(), 0, [], [], undefined, daysAgo(14));
    expect(prompt).toContain('[low]');
    expect(prompt).toContain('weekly reflection');
  });

  it('messageCount % 8 === 0 (e.g. 8) → broadening low signal', () => {
    const prompt = buildCoachSystemPrompt(makeState(), 8);
    expect(prompt).toContain('[low]');
    expect(prompt).toContain('periodic');
  });

  it('messageCount >= 10 → ## Reflection block appears', () => {
    const prompt = buildCoachSystemPrompt(makeState(), 10);
    expect(prompt).toContain('## Reflection');
  });

  it('hasPendingSuggestedPractice: true → IMPORTANT note in prompt', () => {
    const prompt = buildCoachSystemPrompt(makeState(), 0, [], [], undefined, null, true);
    expect(prompt).toContain('IMPORTANT');
    expect(prompt).toContain('pending suggested practice');
  });

  it('state snapshot renders correct percentages', () => {
    const state = makeState({
      health: { attention: 0.6, tone: ['calm'], alignment: 0.4, tensions: [] },
    });
    const prompt = buildCoachSystemPrompt(state, 0);
    expect(prompt).toContain('60%');
    expect(prompt).toContain('40%');
  });

  it('priority block is capped at top 3 signals', () => {
    // Trigger many signals: high attention+low alignment, tensions, low attention on other spaces,
    // plus broadening — but the block should only show 3
    const state = makeState({
      health: { attention: 0.8, tone: [], alignment: 0.2, tensions: ['stress', 'anxiety'] },
      connection: { attention: 0.1, tone: [], alignment: 0.2, tensions: ['conflict'] },
      purpose: { attention: 0.1, tone: [], alignment: 0.2, tensions: ['drift'] },
    });
    const prompt = buildCoachSystemPrompt(state, 8);
    const prioritySection = prompt.split('## Priority signals')[1] ?? '';
    const items = (prioritySection.match(/^- \[/gm) ?? []).length;
    expect(items).toBeLessThanOrEqual(3);
  });
});
