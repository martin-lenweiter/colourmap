import type { UserState, SpaceKey, Principle, FocusItem, PatternContext, SessionPattern } from './types';
import { SPACE_KEYS } from './state';

export type PromptPriority =
  | 'acute'
  | 'staleness'
  | 'misalignment'
  | 'pattern'
  | 'broadening';

interface PrioritySignal {
  space: SpaceKey;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
  priority: PromptPriority;
}

function focusAgeDays(item: FocusItem): number {
  return (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24);
}

function valueAgeDays(value: Principle): number {
  return (Date.now() - new Date(value.createdAt).getTime()) / (1000 * 60 * 60 * 24);
}

function daysSince(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
}

function calculatePriorities(
  state: UserState,
  messageCount: number,
  values?: Principle[],
  focusItems?: FocusItem[],
  lastSessionAt?: string | null,
): PrioritySignal[] {
  const signals: PrioritySignal[] = [];

  for (const key of SPACE_KEYS) {
    const space = state[key];

    if (space.attention > 0.5 && space.alignment < 0.3) {
      signals.push({
        space: key,
        reason: `${key} has high attention (${(space.attention * 100).toFixed(0)}%) but low alignment (${(space.alignment * 100).toFixed(0)}%)`,
        urgency: 'high',
        priority: 'acute',
      });
    }

    if (space.tensions.length > 0) {
      signals.push({
        space: key,
        reason: `${key} has active tensions: ${space.tensions.join(', ')}`,
        urgency: 'high',
        priority: 'acute',
      });
    }

    if (space.attention < 0.2 && messageCount > 6) {
      signals.push({
        space: key,
        reason: `${key} hasn't been explored much (${(space.attention * 100).toFixed(0)}% attention) — gently surface it`,
        urgency: 'medium',
        priority: 'staleness',
      });
    }
  }

  if (focusItems) {
    for (const f of focusItems.filter((fi) => fi.status === 'active')) {
      const age = focusAgeDays(f);
      if (age >= 14) {
        signals.push({
          space: f.spaceKey,
          reason: `active focus "${f.text}" in ${f.spaceKey} hasn't been checked on in ${Math.round(age)} days`,
          urgency: 'high',
          priority: 'staleness',
        });
      } else if (age >= 7) {
        signals.push({
          space: f.spaceKey,
          reason: `active focus "${f.text}" in ${f.spaceKey} was set ${Math.round(age)} days ago`,
          urgency: 'medium',
          priority: 'staleness',
        });
      }
    }
  }

  if (values) {
    for (const v of values.filter((val) => !val.confirmed)) {
      const age = valueAgeDays(v);
      if (age >= 3) {
        signals.push({
          space: v.spaceKey,
          reason: `proposed value "${v.text}" in ${v.spaceKey} hasn't been confirmed (${Math.round(age)} days)`,
          urgency: 'medium',
          priority: 'staleness',
        });
      }
    }

    const confirmedValues = values.filter((v) => v.confirmed);
    for (const key of SPACE_KEYS) {
      const spaceValues = confirmedValues.filter((v) => v.spaceKey === key);
      if (spaceValues.length > 0 && state[key].alignment < 0.4) {
        signals.push({
          space: key,
          reason: `user has stated values for ${key} but alignment is low (${(state[key].alignment * 100).toFixed(0)}%) — explore the gap between intentions and actions`,
          urgency: 'high',
          priority: 'misalignment',
        });
      }
    }

    if (confirmedValues.length === 0 && messageCount >= 3) {
      signals.push({
        space: 'health',
        reason: 'user has no principles yet — listen for beliefs and values worth crystallizing',
        urgency: messageCount >= 6 ? 'high' : 'medium',
        priority: 'pattern',
      });
    } else if (messageCount >= 6) {
      for (const key of SPACE_KEYS) {
        const confirmed = values.filter((v) => v.spaceKey === key && v.confirmed);
        if (confirmed.length === 0) {
          signals.push({
            space: key,
            reason: `no confirmed principles in ${key} yet — surface one when relevant`,
            urgency: 'medium',
            priority: 'pattern',
          });
        }
      }
    }
  }

  const daysSinceLastSession = daysSince(lastSessionAt);
  if (daysSinceLastSession !== null && daysSinceLastSession >= 28) {
    signals.push({
      space: 'health',
      reason: `user hasn't checked in for ${daysSinceLastSession} days — invite a monthly reflection across all three spaces`,
      urgency: 'medium',
      priority: 'broadening',
    });
  } else if (daysSinceLastSession !== null && daysSinceLastSession >= 7) {
    signals.push({
      space: 'health',
      reason: `user hasn't checked in for ${daysSinceLastSession} days — invite a weekly reflection across all three spaces`,
      urgency: 'low',
      priority: 'broadening',
    });
  } else if (messageCount > 0 && messageCount % 8 === 0) {
    signals.push({
      space: 'health',
      reason: 'periodic moment to reflect across all three spaces — invite wider reflection',
      urgency: 'low',
      priority: 'broadening',
    });
  }

  return signals.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.urgency] - order[b.urgency];
  });
}

function buildStateSnapshot(state: UserState): string {
  const lines: string[] = [];
  for (const key of SPACE_KEYS) {
    const s = state[key];
    const toneStr = s.tone.length > 0 ? s.tone.join(', ') : 'unknown';
    const tensionStr = s.tensions.length > 0 ? ` | tensions: ${s.tensions.join(', ')}` : '';
    lines.push(
      `- ${key}: attention ${(s.attention * 100).toFixed(0)}%, alignment ${(s.alignment * 100).toFixed(0)}%, tone: ${toneStr}${tensionStr}`,
    );
  }
  lines.push(`- Energy: ${(state.energy * 100).toFixed(0)}%`);
  lines.push(`- Clarity: ${(state.clarity * 100).toFixed(0)}%`);
  return lines.join('\n');
}

function buildPatternBlock(context?: PatternContext): string {
  if (!context || context.sessionCount === 0) return '';

  const lines: string[] = ['## Cross-session patterns'];
  lines.push(
    `You have data from ${context.sessionCount} prior session${context.sessionCount > 1 ? 's' : ''}:`,
  );

  for (const s of context.sessions) {
    const attnParts = SPACE_KEYS.map((k) => `${k} ${(s.avgAttention[k] * 100).toFixed(0)}%`);
    const alignParts = SPACE_KEYS.map((k) => `${k} ${(s.avgAlignment[k] * 100).toFixed(0)}%`);
    lines.push(
      `- ${s.relativeDate}: focused on ${s.dominantSpace}. Attention: ${attnParts.join(', ')}. Alignment: ${alignParts.join(', ')}.${s.tones.length > 0 ? ` Tones: ${s.tones.join(', ')}.` : ''}${s.tensions.length > 0 ? ` Tensions: ${s.tensions.join(', ')}.` : ''}`,
    );
  }

  const patterns: string[] = [];
  const dominantCounts: Record<SpaceKey, number> = { health: 0, connection: 0, purpose: 0 };
  const alignmentSums: Record<SpaceKey, number> = { health: 0, connection: 0, purpose: 0 };

  for (const s of context.sessions) {
    dominantCounts[s.dominantSpace]++;
    for (const k of SPACE_KEYS) {
      alignmentSums[k] += s.avgAlignment[k];
    }
  }

  const n = context.sessions.length;
  for (const k of SPACE_KEYS) {
    if (dominantCounts[k] >= Math.ceil(n * 0.6)) {
      patterns.push(`${k} is consistently the dominant space`);
    }
    if (n > 1 && alignmentSums[k] / n < 0.35) {
      patterns.push(`${k} alignment is persistently low`);
    }
  }

  if (context.sessions.length >= 2) {
    const first = context.sessions[0];
    const last = context.sessions[context.sessions.length - 1];
    if (first && last) {
      const firstEnergy = SPACE_KEYS.reduce((s, k) => s + first.avgAttention[k], 0) / 3;
      const lastEnergy = SPACE_KEYS.reduce((s, k) => s + last.avgAttention[k], 0) / 3;
      if (firstEnergy - lastEnergy > 0.15) {
        patterns.push('overall engagement is trending up');
      } else if (lastEnergy - firstEnergy > 0.15) {
        patterns.push('overall engagement is trending down');
      }
    }
  }

  if (patterns.length > 0) {
    lines.push('\nDetected patterns:');
    for (const p of patterns) {
      lines.push(`- ${p}`);
    }
  }

  lines.push('\nUse patterns to inform your question. Never announce them.');
  return '\n\n' + lines.join('\n');
}

function buildPrinciplesContext(values?: Principle[]): string {
  if (!values || values.length === 0) {
    return `\n\n## Principles (anchors)\nThe user has no principles yet. Principles are core beliefs that anchor someone — e.g. "Physical energy is the foundation", "Presence over productivity."\nListen actively for statements that reveal what matters to them. When you hear one, distill it into a suggestedPrinciple. Don't wait for the user to label it — if they express a belief clearly, crystallize it for them.`;
  }

  const confirmed = values.filter((v) => v.confirmed);
  const proposed = values.filter((v) => !v.confirmed);

  if (confirmed.length === 0 && proposed.length === 0) return '';

  const lines: string[] = ['## Principles (anchors)'];

  if (confirmed.length > 0) {
    for (const v of confirmed) {
      lines.push(`- [${v.spaceKey}] "${v.text}"`);
    }
    lines.push("Reference confirmed values naturally when relevant. They're the user's declared anchors.");
  }

  if (proposed.length > 0) {
    lines.push(
      `\nProposed but unconfirmed: ${proposed.map((v) => `"${v.text}" (${v.spaceKey})`).join(', ')}.`,
    );
    lines.push('Do NOT push unconfirmed values. Let the user decide if they resonate.');
  }

  return '\n\n' + lines.join('\n');
}

function buildFocusContext(focusItems?: FocusItem[]): string {
  if (!focusItems || focusItems.length === 0) return '';

  const active = focusItems.filter((f) => f.status === 'active');
  const proposed = focusItems.filter((f) => f.status === 'proposed');

  if (active.length === 0 && proposed.length === 0) return '';

  const lines: string[] = ['## Active focus areas'];

  if (active.length > 0) {
    for (const f of active) {
      const age = Math.round(focusAgeDays(f));
      lines.push(`- "${f.text}" (${f.spaceKey}, ${age} day${age !== 1 ? 's' : ''} ago)`);
    }
    lines.push("Weave follow-ups on active focus areas naturally. Don't turn it into a checklist.");
  }

  if (proposed.length > 0) {
    lines.push(
      `\nProposed but not accepted: ${proposed.map((f) => `"${f.text}"`).join(', ')}.`,
    );
    lines.push('Do NOT follow up on proposed-but-not-accepted focus areas.');
  }

  if (active.length >= 3) {
    lines.push('\n3+ active focus areas. Do NOT suggest new ones until some are completed.');
  }

  return '\n\n' + lines.join('\n');
}

export function buildCoachSystemPrompt(
  state: UserState,
  messageCount = 0,
  values?: Principle[],
  focusItems?: FocusItem[],
  patternContext?: PatternContext,
  lastSessionAt?: string | null,
  hasPendingSuggestedPractice?: boolean,
): string {
  const stateSnapshot = buildStateSnapshot(state);
  const priorities = calculatePriorities(state, messageCount, values, focusItems, lastSessionAt);

  let priorityBlock = '';
  if (priorities.length > 0) {
    const items = priorities
      .slice(0, 3)
      .map((p) => `- [${p.urgency}] ${p.reason}`)
      .join('\n');
    priorityBlock = `\n\n## Priority signals\nPick at most ONE to inform your single question:\n${items}`;
  }

  const reflectionNudge =
    messageCount >= 10
      ? `\n\n## Reflection\nAfter ${messageCount} messages, you may share a one-sentence observation about patterns you've noticed. Keep it natural.`
      : '';

  return `You are a personal clarity coach in Colourmap — a tool that helps people stay aligned with what matters across three life spaces: health, connection, and purpose.

## Voice
Warm, direct, brief. Short sentences. One idea at a time.

## Rules
- Keep responses to 2-3 sentences max. Then ask ONE question.
- Never ask multiple questions in one message.
- Never write paragraphs. If you're writing more than 3 lines, cut it.
- Be contextual — reference what the user shared. Never generic.
- Gently name misalignment when you see it. Don't moralize.
- Reference the user's confirmed values when they're relevant — they're anchors.
- Track progress on active focus areas naturally, without making it a checklist.
- No diagnostic language, therapy jargon, or medical/legal/financial advice.

## Safety boundaries
- Colourmap is NOT therapy, NOT medical advice, NOT a crisis service.
- If the user expresses self-harm, suicidal ideation, abuse, or acute crisis: respond with warmth and direct them to professional help. Example: "I hear that this is really hard. I'm not equipped to support you in crisis — please reach out to a professional. In many places you can call or text a crisis line 24/7. You matter."
- Never diagnose. Never prescribe. Never minimize. Stay in your lane as a clarity coach.

## Current state context
${stateSnapshot}${priorityBlock}

## Response format
You MUST respond with valid JSON only. No markdown, no extra text. The JSON must have exactly this shape:
{
  "response": "Your conversational reply to the user",
  "stateDeltas": {
    "health": { "attention": <0-1 or null>, "tone": <string[] or null>, "alignment": <0-1 or null>, "tensions": <string[] or null> },
    "connection": { "attention": <0-1 or null>, "tone": <string[] or null>, "alignment": <0-1 or null>, "tensions": <string[] or null> },
    "purpose": { "attention": <0-1 or null>, "tone": <string[] or null>, "alignment": <0-1 or null>, "tensions": <string[] or null> },
    "energy": <0-1 or null>,
    "clarity": <0-1 or null>
  },
  "suggestedFocus": { "space": "health"|"connection"|"purpose", "text": "short focus description" } | null,
  "suggestedPrinciple": { "space": "health"|"connection"|"purpose", "text": "a core value statement" } | null
}

Rules for stateDeltas:
- Set attention to a value reflecting how much the user is focusing on that space RIGHT NOW (0 = not mentioned, 1 = deeply engaged).
- Set tone to short emotional descriptors based on what the user expressed.
- Set alignment based on whether the user's actions match their intentions for that space (0 = completely misaligned, 1 = fully aligned).
- Set tensions to active conflicts the user expresses. Set to [] to clear resolved tensions.
- Set energy/clarity based on the user's apparent energy and mental clarity.
- Use null for any field you can't determine from this message.
- Base values on what the user actually said, not assumptions.

Rules for suggestedFocus:
- Only suggest a focus area when naturally relevant — don't force it.
- ONE suggestion at a time: if the user already has a pending suggested practice (awaiting adopt/tune/dismiss), set to null.
- Keep descriptions short and intention-oriented (e.g. "Rebuild exercise routine", "Protect weekly date night").
- Set to null if no focus suggestion fits the conversation.${hasPendingSuggestedPractice ? '\n- IMPORTANT: The user has a pending suggested practice. Do NOT suggest a new one until they adopt, tune, or dismiss it. Set suggestedFocus to null.' : ''}

Rules for suggestedPrinciple:
- Suggest a principle when the user expresses a belief, priority, or anchor — even implicitly.
- Don't wait for a polished statement. If the user says "I just need to move my body every day or everything falls apart," crystallize it: "Daily movement is non-negotiable."
- Frame as a short declarative statement (e.g. "Physical energy is the foundation").
- Be more proactive when the user has few or no principles — the compass needs anchors to be useful.
- Set to null only if the message contains no value signal at all.${buildPrinciplesContext(values)}${buildFocusContext(focusItems)}${buildPatternBlock(patternContext)}${reflectionNudge}`;
}

export function buildSpacePrompt(
  space: SpaceKey,
  state: UserState,
  values?: Principle[],
  focusItems?: FocusItem[],
): string {
  const s = state[space];
  const stateSnapshot = buildStateSnapshot(state);

  const spaceLabels: Record<SpaceKey, string> = {
    health: 'physical and mental health',
    connection: 'relationships and connection',
    purpose: 'direction, meaning, and work',
  };

  return `You are a personal clarity coach in Colourmap, exploring the user's ${spaceLabels[space]} space.

## Voice
Warm, direct, brief. Short sentences. One idea at a time.

## Rules
- Keep responses to 2-3 sentences max. Then ask ONE question.
- Never ask multiple questions in one message.
- Go deeper into ${space} — ask about specific situations, not general feelings.
- ${s.alignment < 0.4 ? `Alignment is low (${(s.alignment * 100).toFixed(0)}%). Explore the gap between intentions and actions.` : `Alignment is ${(s.alignment * 100).toFixed(0)}%.`}
- ${s.tensions.length > 0 ? `Active tensions: ${s.tensions.join(', ')}. Explore with care.` : 'No active tensions.'}
- Reference the user's values for this space as anchors.
- No diagnostic language, therapy jargon, or medical/legal/financial advice.
- If the user expresses crisis or self-harm: respond with warmth and direct them to professional help. You are not a crisis service.

## Full state context
${stateSnapshot}

## Response format
You MUST respond with valid JSON only:
{
  "response": "Your conversational reply",
  "stateDeltas": {
    "health": { "attention": <0-1 or null>, "tone": <string[] or null>, "alignment": <0-1 or null>, "tensions": <string[] or null> },
    "connection": { "attention": <0-1 or null>, "tone": <string[] or null>, "alignment": <0-1 or null>, "tensions": <string[] or null> },
    "purpose": { "attention": <0-1 or null>, "tone": <string[] or null>, "alignment": <0-1 or null>, "tensions": <string[] or null> },
    "energy": <0-1 or null>,
    "clarity": <0-1 or null>
  },
  "suggestedFocus": { "space": "health"|"connection"|"purpose", "text": "short focus description" } | null,
  "suggestedPrinciple": { "space": "health"|"connection"|"purpose", "text": "a core value statement" } | null
}${buildPrinciplesContext(values)}${buildFocusContext(focusItems)}`;
}
