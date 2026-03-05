import Anthropic from '@anthropic-ai/sdk';

import type {
  CoachMessage,
  CoachResponse,
  CompassReading,
  FocusItem,
  Principle,
  SpaceKey,
  StateDelta,
  UserState,
} from '../domain/types';
import { SPACE_KEYS } from '../domain/state';

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');
  return new Anthropic({ apiKey });
}

export function parseCoachResponse(raw: string): CoachResponse {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON object found in response');
  cleaned = jsonMatch[0];

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const deltas = (parsed.stateDeltas ?? {}) as Record<string, Record<string, unknown>>;
  const normalized: StateDelta = {};

  for (const space of ['health', 'connection', 'purpose'] as const) {
    const s = deltas[space];
    if (s) {
      normalized[space] = {
        attention: (s.attention as number | undefined) ?? undefined,
        tone: (s.tone as string[] | undefined) ?? undefined,
        alignment: (s.alignment as number | undefined) ?? undefined,
        tensions: (s.tensions as string[] | undefined) ?? undefined,
      };
    }
  }
  normalized.energy = (deltas.energy as unknown as number | undefined) ?? undefined;
  normalized.clarity = (deltas.clarity as unknown as number | undefined) ?? undefined;

  const rawFocus = parsed.suggestedFocus as Record<string, unknown> | null;
  const rawPractice = parsed.suggestedPractice as Record<string, unknown> | null;

  let suggestedFocus: CoachResponse['suggestedFocus'] = null;
  if (
    rawFocus &&
    typeof rawFocus.space === 'string' &&
    typeof rawFocus.text === 'string' &&
    ['health', 'connection', 'purpose'].includes(rawFocus.space)
  ) {
    suggestedFocus = { space: rawFocus.space as SpaceKey, text: rawFocus.text };
  }

  let suggestedPractice: CoachResponse['suggestedPractice'] = null;
  if (
    !suggestedFocus &&
    rawPractice &&
    typeof rawPractice.space === 'string' &&
    typeof rawPractice.title === 'string' &&
    ['health', 'connection', 'purpose'].includes(rawPractice.space)
  ) {
    suggestedPractice = { space: rawPractice.space as SpaceKey, title: rawPractice.title };
    suggestedFocus = {
      space: rawPractice.space as SpaceKey,
      text: rawPractice.title,
      title: rawPractice.title,
    };
  }

  const rawPrinciple = parsed.suggestedPrinciple as Record<string, unknown> | null;
  let suggestedPrinciple: CoachResponse['suggestedPrinciple'] = null;
  if (
    rawPrinciple &&
    typeof rawPrinciple.space === 'string' &&
    typeof rawPrinciple.text === 'string' &&
    ['health', 'connection', 'purpose'].includes(rawPrinciple.space)
  ) {
    suggestedPrinciple = { space: rawPrinciple.space as SpaceKey, text: rawPrinciple.text };
  }

  return {
    response: parsed.response as string,
    stateDeltas: normalized,
    suggestedPractice,
    suggestedFocus,
    suggestedPrinciple,
  };
}

export async function callCoach(
  systemPrompt: string,
  messages: CoachMessage[],
): Promise<CoachResponse> {
  const client = getClient();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  if (!text.trim()) throw new Error('Empty response from Anthropic');
  return parseCoachResponse(text);
}

export async function generateSessionSummary(
  messages: { role: string; content: string }[],
): Promise<string> {
  const client = getClient();
  const transcript = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    system:
      'You produce ultra-brief session summaries. Output ONLY 1 sentence, max 15 words. No markdown, no quotes, no preamble.',
    messages: [
      {
        role: 'user',
        content: `Summarize this coaching session in one short sentence:\n\n${transcript}`,
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return text?.trim() ?? 'Check-in session';
}

export async function generateCompassReading(
  state: UserState,
  principles: Principle[],
  focusItems: FocusItem[],
): Promise<Omit<CompassReading, 'id' | 'generatedAt'>> {
  const client = getClient();

  const stateLines: string[] = [];
  for (const key of SPACE_KEYS) {
    const s = state[key];
    const spacePrinciples = principles
      .filter((v) => v.spaceKey === key && v.confirmed)
      .map((v) => `"${v.text}"`)
      .join(', ');
    const spaceFocus = focusItems
      .filter((f) => f.spaceKey === key && f.status === 'active')
      .map((f) => `"${f.text}"`)
      .join(', ');
    stateLines.push(
      `${key}: attention ${(s.attention * 100).toFixed(0)}%, alignment ${(s.alignment * 100).toFixed(0)}%, tone: ${s.tone.join(', ') || 'neutral'}${s.tensions.length > 0 ? `, tensions: ${s.tensions.join(', ')}` : ''}${spacePrinciples ? `, principles: ${spacePrinciples}` : ''}${spaceFocus ? `, focus: ${spaceFocus}` : ''}`,
    );
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: `You analyze cross-space patterns in a wellbeing app. Output ONLY valid JSON, no markdown.`,
    messages: [
      {
        role: 'user',
        content: `Given this person's state across three life spaces, identify how their focus areas and principles interact across spaces.

${stateLines.join('\n')}

Respond with JSON:
{
  "narrative": "2-3 sentences describing how the spaces are interacting. Be specific about connections. Warm but honest tone.",
  "reinforcements": ["short phrase describing a positive cross-space connection", ...],
  "tensions": ["short phrase describing a cross-space tension", ...]
}

Keep reinforcements and tensions to 2-4 items each. Be specific, not generic.`,
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in compass response');

  const parsed = JSON.parse(jsonMatch[0]) as {
    narrative: string;
    reinforcements: string[];
    tensions: string[];
  };

  return {
    narrative: parsed.narrative,
    reinforcements: parsed.reinforcements ?? [],
    tensions: parsed.tensions ?? [],
  };
}
