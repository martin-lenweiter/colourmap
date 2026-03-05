import { describe, expect, it } from 'vitest';
import { parseCoachResponse } from '@/lib/services/coach';

function makeRaw(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    response: 'Hello',
    stateDeltas: {},
    suggestedFocus: null,
    suggestedPrinciple: null,
    ...overrides,
  });
}

describe('parseCoachResponse', () => {
  it('parses plain JSON string', () => {
    const raw = makeRaw({ response: 'Hello', stateDeltas: { health: { attention: 0.7 } } });
    const result = parseCoachResponse(raw);
    expect(result.response).toBe('Hello');
    expect(result.stateDeltas.health?.attention).toBe(0.7);
  });

  it('strips markdown code fences', () => {
    const inner = makeRaw({ response: 'Hi' });
    const raw = `\`\`\`json\n${inner}\n\`\`\``;
    const result = parseCoachResponse(raw);
    expect(result.response).toBe('Hi');
  });

  it('extracts JSON embedded in prose text', () => {
    const inner = makeRaw({ response: 'Sure' });
    const raw = `Here is my answer: ${inner} hope that helps.`;
    const result = parseCoachResponse(raw);
    expect(result.response).toBe('Sure');
  });

  it('throws when no JSON object found', () => {
    expect(() => parseCoachResponse('no json here')).toThrow('No JSON object found in response');
  });

  it('populates suggestedFocus with valid space', () => {
    const raw = makeRaw({ suggestedFocus: { space: 'health', text: 'Rebuild exercise routine' } });
    const result = parseCoachResponse(raw);
    expect(result.suggestedFocus).toEqual({ space: 'health', text: 'Rebuild exercise routine' });
  });

  it('returns null suggestedFocus for invalid space value', () => {
    const raw = makeRaw({ suggestedFocus: { space: 'invalid', text: 'Something' } });
    const result = parseCoachResponse(raw);
    expect(result.suggestedFocus).toBeNull();
  });

  it('populates suggestedPrinciple with valid data', () => {
    const raw = makeRaw({
      suggestedPrinciple: { space: 'purpose', text: 'Daily movement is non-negotiable.' },
    });
    const result = parseCoachResponse(raw);
    expect(result.suggestedPrinciple).toEqual({
      space: 'purpose',
      text: 'Daily movement is non-negotiable.',
    });
  });

  it('maps suggestedPractice (legacy field) to suggestedFocus', () => {
    const raw = makeRaw({
      suggestedFocus: null,
      suggestedPractice: { space: 'health', title: 'Morning walk' },
    });
    const result = parseCoachResponse(raw);
    expect(result.suggestedFocus?.space).toBe('health');
    expect(result.suggestedFocus?.text).toBe('Morning walk');
    expect(result.suggestedPractice).toEqual({ space: 'health', title: 'Morning walk' });
  });

  it('null stateDeltas fields become undefined in normalized output', () => {
    const raw = makeRaw({
      stateDeltas: { health: { attention: null, tone: null, alignment: null, tensions: null } },
    });
    const result = parseCoachResponse(raw);
    expect(result.stateDeltas.health?.attention).toBeUndefined();
    expect(result.stateDeltas.health?.tone).toBeUndefined();
  });

  it('empty stateDeltas object produces empty normalized delta', () => {
    const raw = makeRaw({ stateDeltas: {} });
    const result = parseCoachResponse(raw);
    expect(result.stateDeltas.health).toBeUndefined();
    expect(result.stateDeltas.energy).toBeUndefined();
    expect(result.stateDeltas.clarity).toBeUndefined();
  });
});
