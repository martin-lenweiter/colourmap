import { and, desc, eq, gte, inArray, isNotNull, ne } from 'drizzle-orm';
import { SPACE_KEYS } from '../../domain/state';
import type { PatternContext, SessionPattern, SpaceKey, StateDelta } from '../../domain/types';
import { db } from '../client';
import { colourmapMessages, colourmapSessions } from '../schema';
import { genId } from './_shared';

export async function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  stateDeltas?: StateDelta | null,
): Promise<void> {
  await db.insert(colourmapMessages).values({
    id: genId(),
    sessionId,
    role,
    content,
    stateDeltas: stateDeltas ?? null,
  });
}

export async function loadSessionMessages(
  sessionId: string,
): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const rows = await db
    .select({ role: colourmapMessages.role, content: colourmapMessages.content })
    .from(colourmapMessages)
    .where(eq(colourmapMessages.sessionId, sessionId))
    .orderBy(colourmapMessages.createdAt);
  return rows as { role: 'user' | 'assistant'; content: string }[];
}

export async function loadRecentMessages(
  ownerId: string,
  limit = 20,
): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const sessions = await db
    .select({ id: colourmapSessions.id })
    .from(colourmapSessions)
    .where(eq(colourmapSessions.ownerId, ownerId))
    .orderBy(desc(colourmapSessions.createdAt))
    .limit(3);
  if (!sessions.length) return [];

  const sessionIds = sessions.map((s) => s.id);
  const rows = await db
    .select({ role: colourmapMessages.role, content: colourmapMessages.content })
    .from(colourmapMessages)
    .where(inArray(colourmapMessages.sessionId, sessionIds))
    .orderBy(colourmapMessages.createdAt)
    .limit(limit);
  return rows as { role: 'user' | 'assistant'; content: string }[];
}

export async function loadRecentMessagesWithDeltas(
  ownerId: string,
  limit = 50,
): Promise<{ state_deltas: Record<string, unknown> | null; created_at: string }[]> {
  const sessions = await db
    .select({ id: colourmapSessions.id })
    .from(colourmapSessions)
    .where(eq(colourmapSessions.ownerId, ownerId))
    .orderBy(desc(colourmapSessions.createdAt))
    .limit(10);
  if (!sessions.length) return [];

  const sessionIds = sessions.map((s) => s.id);
  const rows = await db
    .select({
      stateDeltas: colourmapMessages.stateDeltas,
      createdAt: colourmapMessages.createdAt,
    })
    .from(colourmapMessages)
    .where(
      and(
        inArray(colourmapMessages.sessionId, sessionIds),
        eq(colourmapMessages.role, 'assistant'),
        isNotNull(colourmapMessages.stateDeltas),
      ),
    )
    .orderBy(desc(colourmapMessages.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    state_deltas: r.stateDeltas as Record<string, unknown> | null,
    created_at: r.createdAt.toISOString(),
  }));
}

export async function loadStateHistory(
  ownerId: string,
  spaceKey: SpaceKey,
  days = 14,
): Promise<{ attention: number; alignment: number; date: string }[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const sessions = await db
    .select({ id: colourmapSessions.id })
    .from(colourmapSessions)
    .where(and(eq(colourmapSessions.ownerId, ownerId), gte(colourmapSessions.createdAt, since)));
  if (!sessions.length) return [];

  const sessionIds = sessions.map((s) => s.id);
  const rows = await db
    .select({
      stateDeltas: colourmapMessages.stateDeltas,
      createdAt: colourmapMessages.createdAt,
    })
    .from(colourmapMessages)
    .where(
      and(
        inArray(colourmapMessages.sessionId, sessionIds),
        eq(colourmapMessages.role, 'assistant'),
        isNotNull(colourmapMessages.stateDeltas),
        gte(colourmapMessages.createdAt, since),
      ),
    )
    .orderBy(colourmapMessages.createdAt);

  const EMA_W = 0.3;
  let runAtt = 0.5;
  let runAlign = 0.5;
  const raw: { attention: number; alignment: number; date: string }[] = [];

  for (const row of rows) {
    const deltas = row.stateDeltas as Record<string, Record<string, number>> | null;
    const spaceDelta = deltas?.[spaceKey];
    if (!spaceDelta) continue;

    const dAtt = spaceDelta.attention;
    const dAlign = spaceDelta.alignment;
    if (dAtt === undefined && dAlign === undefined) continue;

    if (dAtt !== undefined) runAtt = EMA_W * dAtt + (1 - EMA_W) * runAtt;
    if (dAlign !== undefined) runAlign = EMA_W * dAlign + (1 - EMA_W) * runAlign;

    raw.push({ attention: runAtt, alignment: runAlign, date: row.createdAt.toISOString() });
  }

  const points: typeof raw = [];
  for (const pt of raw) {
    const prev = points[points.length - 1];
    if (
      prev &&
      prev.attention === pt.attention &&
      prev.alignment === pt.alignment &&
      Math.abs(new Date(pt.date).getTime() - new Date(prev.date).getTime()) < 1000
    ) {
      continue;
    }
    points.push(pt);
  }

  return points;
}

export async function loadStateHistoryAllSpaces(
  ownerId: string,
  days = 14,
): Promise<Record<SpaceKey, { attention: number; alignment: number; date: string }[]>> {
  const [health, connection, purpose] = await Promise.all([
    loadStateHistory(ownerId, 'health', days),
    loadStateHistory(ownerId, 'connection', days),
    loadStateHistory(ownerId, 'purpose', days),
  ]);
  return { health, connection, purpose };
}

function relativeDate(dateStr: string): string {
  const days = Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export async function loadPatternContext(
  ownerId: string,
  currentSessionId: string,
): Promise<PatternContext | undefined> {
  const sessions = await db
    .select({ id: colourmapSessions.id, createdAt: colourmapSessions.createdAt })
    .from(colourmapSessions)
    .where(and(eq(colourmapSessions.ownerId, ownerId), ne(colourmapSessions.id, currentSessionId)))
    .orderBy(desc(colourmapSessions.createdAt))
    .limit(5);
  if (!sessions.length) return undefined;

  const sessionIds = sessions.map((s) => s.id);
  const messages = await db
    .select({
      sessionId: colourmapMessages.sessionId,
      stateDeltas: colourmapMessages.stateDeltas,
    })
    .from(colourmapMessages)
    .where(
      and(
        inArray(colourmapMessages.sessionId, sessionIds),
        eq(colourmapMessages.role, 'assistant'),
        isNotNull(colourmapMessages.stateDeltas),
      ),
    );
  if (!messages.length) return undefined;

  const sessionPatterns: SessionPattern[] = [];

  for (const session of sessions) {
    const sessionMsgs = messages.filter((m) => m.sessionId === session.id);
    if (sessionMsgs.length === 0) continue;

    const attentionSums: Record<SpaceKey, number> = { health: 0, connection: 0, purpose: 0 };
    const alignmentSums: Record<SpaceKey, number> = { health: 0, connection: 0, purpose: 0 };
    const counts: Record<SpaceKey, number> = { health: 0, connection: 0, purpose: 0 };
    const allTones = new Set<string>();
    const allTensions = new Set<string>();

    for (const msg of sessionMsgs) {
      const deltas = msg.stateDeltas as Record<string, Record<string, unknown>> | null;
      if (!deltas) continue;

      for (const k of SPACE_KEYS) {
        const sd = deltas[k];
        if (!sd) continue;
        if (typeof sd.attention === 'number') {
          attentionSums[k] += sd.attention;
          counts[k]++;
        }
        if (typeof sd.alignment === 'number') {
          alignmentSums[k] += sd.alignment;
          if (!counts[k]) counts[k] = 1;
        }
        if (Array.isArray(sd.tone)) {
          for (const t of sd.tone) {
            if (typeof t === 'string') allTones.add(t);
          }
        }
        if (Array.isArray(sd.tensions)) {
          for (const t of sd.tensions) {
            if (typeof t === 'string') allTensions.add(t);
          }
        }
      }
    }

    const avgAttention: Record<SpaceKey, number> = { health: 0.3, connection: 0.3, purpose: 0.3 };
    const avgAlignment: Record<SpaceKey, number> = { health: 0.5, connection: 0.5, purpose: 0.5 };

    for (const k of SPACE_KEYS) {
      if (counts[k] > 0) {
        avgAttention[k] = Math.round((attentionSums[k] / counts[k]) * 100) / 100;
        avgAlignment[k] = Math.round((alignmentSums[k] / counts[k]) * 100) / 100;
      }
    }

    let dominantSpace: SpaceKey = 'health';
    let maxAttn = 0;
    for (const k of SPACE_KEYS) {
      if (avgAttention[k] > maxAttn) {
        maxAttn = avgAttention[k];
        dominantSpace = k;
      }
    }

    sessionPatterns.push({
      relativeDate: relativeDate(session.createdAt.toISOString()),
      dominantSpace,
      avgAttention,
      avgAlignment,
      tones: [...allTones].slice(0, 5),
      tensions: [...allTensions].slice(0, 3),
    });
  }

  if (sessionPatterns.length === 0) return undefined;
  return { sessionCount: sessionPatterns.length, sessions: sessionPatterns };
}

export async function loadMessageDeltasForSessions(
  sessionIds: string[],
): Promise<{ sessionId: string; stateDeltas: unknown }[]> {
  return db
    .select({
      sessionId: colourmapMessages.sessionId,
      stateDeltas: colourmapMessages.stateDeltas,
    })
    .from(colourmapMessages)
    .where(
      and(
        inArray(colourmapMessages.sessionId, sessionIds),
        eq(colourmapMessages.role, 'assistant'),
        isNotNull(colourmapMessages.stateDeltas),
      ),
    );
}
