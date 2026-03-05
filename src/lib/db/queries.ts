import { and, desc, eq, gte, inArray, isNotNull, ne, sql } from 'drizzle-orm';

import type {
  CompassReading,
  FocusItem,
  PatternContext,
  PatternFlag,
  Practice,
  Principle,
  SessionPattern,
  SpaceKey,
  StateDelta,
  UserDataExport,
  UserState,
} from '../domain/types';
import { SPACE_KEYS } from '../domain/state';
import { db } from './client';
import {
  colourmapCompassReadings,
  colourmapFocusItems,
  colourmapMessages,
  colourmapPatternFlags,
  colourmapPractices,
  colourmapSessions,
  colourmapUserState,
  colourmapValues,
} from './schema';

/** DB uses 'love', domain uses 'connection'. */
const DB_TO_SPACE: Record<string, SpaceKey> = {
  health: 'health',
  love: 'connection',
  purpose: 'purpose',
};
const SPACE_TO_DB: Record<SpaceKey, string> = {
  health: 'health',
  connection: 'love',
  purpose: 'purpose',
};

function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
  return [];
}

function genId(): string {
  return crypto.randomUUID();
}

// --- User State ---

export async function loadUserState(ownerId: string): Promise<UserState | null> {
  const [row] = await db
    .select()
    .from(colourmapUserState)
    .where(eq(colourmapUserState.ownerId, ownerId))
    .limit(1);
  if (!row) return null;

  return {
    health: {
      attention: row.healthAttention,
      tone: parseJsonArray(row.healthTone),
      alignment: row.healthAlignment,
      tensions: parseJsonArray(row.healthTensions),
    },
    connection: {
      attention: row.loveAttention,
      tone: parseJsonArray(row.loveTone),
      alignment: row.loveAlignment,
      tensions: parseJsonArray(row.loveTensions),
    },
    purpose: {
      attention: row.purposeAttention,
      tone: parseJsonArray(row.purposeTone),
      alignment: row.purposeAlignment,
      tensions: parseJsonArray(row.purposeTensions),
    },
    energy: row.energy,
    clarity: row.clarity,
  };
}

export async function saveUserState(ownerId: string, state: UserState): Promise<void> {
  const values = {
    id: genId(),
    ownerId,
    healthAttention: state.health.attention,
    healthTone: state.health.tone,
    healthAlignment: state.health.alignment,
    healthTensions: state.health.tensions,
    loveAttention: state.connection.attention,
    loveTone: state.connection.tone,
    loveAlignment: state.connection.alignment,
    loveTensions: state.connection.tensions,
    purposeAttention: state.purpose.attention,
    purposeTone: state.purpose.tone,
    purposeAlignment: state.purpose.alignment,
    purposeTensions: state.purpose.tensions,
    energy: state.energy,
    clarity: state.clarity,
  };

  await db
    .insert(colourmapUserState)
    .values(values)
    .onConflictDoUpdate({
      target: colourmapUserState.ownerId,
      set: {
        healthAttention: values.healthAttention,
        healthTone: values.healthTone,
        healthAlignment: values.healthAlignment,
        healthTensions: values.healthTensions,
        loveAttention: values.loveAttention,
        loveTone: values.loveTone,
        loveAlignment: values.loveAlignment,
        loveTensions: values.loveTensions,
        purposeAttention: values.purposeAttention,
        purposeTone: values.purposeTone,
        purposeAlignment: values.purposeAlignment,
        purposeTensions: values.purposeTensions,
        energy: values.energy,
        clarity: values.clarity,
        updatedAt: new Date(),
      },
    });
}

// --- Sessions ---

export async function createSession(ownerId: string): Promise<string> {
  const id = genId();
  await db.insert(colourmapSessions).values({ id, ownerId });
  return id;
}

export async function findSessionByOwner(
  sessionId: string,
  ownerId: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: colourmapSessions.id })
    .from(colourmapSessions)
    .where(and(eq(colourmapSessions.id, sessionId), eq(colourmapSessions.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

export async function getOrCreateRecentSession(ownerId: string): Promise<string> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const [recent] = await db
    .select({ id: colourmapSessions.id })
    .from(colourmapSessions)
    .where(and(eq(colourmapSessions.ownerId, ownerId), gte(colourmapSessions.createdAt, fiveMinAgo)))
    .orderBy(desc(colourmapSessions.createdAt))
    .limit(1);
  if (recent) return recent.id;
  return createSession(ownerId);
}

export async function listSessions(
  ownerId: string,
): Promise<{ id: string; summary: string | null; created_at: string }[]> {
  const rows = await db
    .select({
      id: colourmapSessions.id,
      summary: colourmapSessions.summary,
      createdAt: colourmapSessions.createdAt,
    })
    .from(colourmapSessions)
    .where(eq(colourmapSessions.ownerId, ownerId))
    .orderBy(desc(colourmapSessions.createdAt));
  return rows.map((r) => ({ id: r.id, summary: r.summary, created_at: r.createdAt.toISOString() }));
}

export async function updateSessionSummary(sessionId: string, summary: string): Promise<void> {
  await db
    .update(colourmapSessions)
    .set({ summary })
    .where(eq(colourmapSessions.id, sessionId));
}

export async function loadLastSessionAt(ownerId: string): Promise<string | null> {
  const [row] = await db
    .select({ createdAt: colourmapSessions.createdAt })
    .from(colourmapSessions)
    .where(eq(colourmapSessions.ownerId, ownerId))
    .orderBy(desc(colourmapSessions.createdAt))
    .limit(1);
  return row?.createdAt.toISOString() ?? null;
}

export async function loadPreviousSessionAt(
  ownerId: string,
  excludeSessionId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ createdAt: colourmapSessions.createdAt })
    .from(colourmapSessions)
    .where(and(eq(colourmapSessions.ownerId, ownerId), ne(colourmapSessions.id, excludeSessionId)))
    .orderBy(desc(colourmapSessions.createdAt))
    .limit(1);
  return row?.createdAt.toISOString() ?? null;
}

// --- Messages ---

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

// --- Practices ---

export async function listPractices(ownerId: string, spaceKey?: SpaceKey): Promise<Practice[]> {
  const conditions = [
    eq(colourmapPractices.ownerId, ownerId),
    ne(colourmapPractices.status, 'archived'),
    ...(spaceKey ? [eq(colourmapPractices.spaceKey, SPACE_TO_DB[spaceKey])] : []),
  ];
  const rows = await db
    .select()
    .from(colourmapPractices)
    .where(and(...conditions))
    .orderBy(desc(colourmapPractices.createdAt));
  return rows.map((r) => ({
    id: r.id,
    spaceKey: (DB_TO_SPACE[r.spaceKey] ?? r.spaceKey) as SpaceKey,
    title: r.title,
    suggestedBy: r.suggestedBy as 'coach' | 'user',
    status: r.status as Practice['status'],
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createPractice(
  ownerId: string,
  spaceKey: SpaceKey,
  title: string,
  suggestedBy: 'coach' | 'user',
): Promise<Practice> {
  const id = genId();
  const status = suggestedBy === 'coach' ? 'suggested' : 'active';
  await db.insert(colourmapPractices).values({
    id,
    ownerId,
    spaceKey: SPACE_TO_DB[spaceKey],
    title,
    suggestedBy,
    status,
  });
  const [row] = await db
    .select()
    .from(colourmapPractices)
    .where(eq(colourmapPractices.id, id))
    .limit(1);
  return {
    id: row.id,
    spaceKey: (DB_TO_SPACE[row.spaceKey] ?? row.spaceKey) as SpaceKey,
    title: row.title,
    suggestedBy: row.suggestedBy as 'coach' | 'user',
    status: row.status as Practice['status'],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function updatePracticeStatus(
  practiceId: string,
  ownerId: string,
  status: Practice['status'],
): Promise<boolean> {
  const rows = await db
    .update(colourmapPractices)
    .set({ status })
    .where(and(eq(colourmapPractices.id, practiceId), eq(colourmapPractices.ownerId, ownerId)))
    .returning({ id: colourmapPractices.id });
  return rows.length > 0;
}

export async function updatePracticeTitle(
  practiceId: string,
  ownerId: string,
  title: string,
): Promise<boolean> {
  const rows = await db
    .update(colourmapPractices)
    .set({ title: title.trim() })
    .where(and(eq(colourmapPractices.id, practiceId), eq(colourmapPractices.ownerId, ownerId)))
    .returning({ id: colourmapPractices.id });
  return rows.length > 0;
}

export async function hasPendingSuggestedPractice(ownerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: colourmapPractices.id })
    .from(colourmapPractices)
    .where(
      and(eq(colourmapPractices.ownerId, ownerId), eq(colourmapPractices.status, 'suggested')),
    )
    .limit(1);
  return row !== undefined;
}

// --- Principles (values) ---

export async function listPrinciples(ownerId: string, spaceKey?: SpaceKey): Promise<Principle[]> {
  const conditions = [
    eq(colourmapValues.ownerId, ownerId),
    ...(spaceKey ? [eq(colourmapValues.spaceKey, SPACE_TO_DB[spaceKey])] : []),
  ];
  const rows = await db
    .select()
    .from(colourmapValues)
    .where(and(...conditions))
    .orderBy(desc(colourmapValues.createdAt));
  return rows.map((r) => ({
    id: r.id,
    spaceKey: (DB_TO_SPACE[r.spaceKey] ?? r.spaceKey) as SpaceKey,
    text: r.text,
    source: r.source as 'coach' | 'user',
    confirmed: r.confirmed ?? false,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createPrinciple(
  ownerId: string,
  spaceKey: SpaceKey,
  text: string,
  source: 'coach' | 'user',
): Promise<Principle> {
  const id = genId();
  const confirmed = source === 'user';
  await db.insert(colourmapValues).values({
    id,
    ownerId,
    spaceKey: SPACE_TO_DB[spaceKey],
    text,
    source,
    confirmed,
  });
  const [row] = await db
    .select()
    .from(colourmapValues)
    .where(eq(colourmapValues.id, id))
    .limit(1);
  return {
    id: row.id,
    spaceKey: (DB_TO_SPACE[row.spaceKey] ?? row.spaceKey) as SpaceKey,
    text: row.text,
    source: row.source as 'coach' | 'user',
    confirmed: row.confirmed ?? false,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function updatePrinciple(
  principleId: string,
  ownerId: string,
  updates: { text?: string; confirmed?: boolean },
): Promise<boolean> {
  const rows = await db
    .update(colourmapValues)
    .set(updates)
    .where(and(eq(colourmapValues.id, principleId), eq(colourmapValues.ownerId, ownerId)))
    .returning({ id: colourmapValues.id });
  return rows.length > 0;
}

export async function deletePrinciple(principleId: string, ownerId: string): Promise<boolean> {
  const rows = await db
    .delete(colourmapValues)
    .where(and(eq(colourmapValues.id, principleId), eq(colourmapValues.ownerId, ownerId)))
    .returning({ id: colourmapValues.id });
  return rows.length > 0;
}

// --- Focus Items ---

export async function listFocusItems(ownerId: string, spaceKey?: SpaceKey): Promise<FocusItem[]> {
  const conditions = [
    eq(colourmapFocusItems.ownerId, ownerId),
    ne(colourmapFocusItems.status, 'archived'),
    ...(spaceKey ? [eq(colourmapFocusItems.spaceKey, SPACE_TO_DB[spaceKey])] : []),
  ];
  const rows = await db
    .select()
    .from(colourmapFocusItems)
    .where(and(...conditions))
    .orderBy(desc(colourmapFocusItems.createdAt));
  return rows.map((r) => ({
    id: r.id,
    spaceKey: (DB_TO_SPACE[r.spaceKey] ?? r.spaceKey) as SpaceKey,
    text: r.text,
    source: r.source as 'coach' | 'user',
    status: r.status as FocusItem['status'],
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
  }));
}

export async function createFocusItem(
  ownerId: string,
  spaceKey: SpaceKey,
  text: string,
  source: 'coach' | 'user',
): Promise<FocusItem> {
  const id = genId();
  const status = source === 'coach' ? 'proposed' : 'active';
  await db.insert(colourmapFocusItems).values({
    id,
    ownerId,
    spaceKey: SPACE_TO_DB[spaceKey],
    text,
    source,
    status,
  });
  const [row] = await db
    .select()
    .from(colourmapFocusItems)
    .where(eq(colourmapFocusItems.id, id))
    .limit(1);
  return {
    id: row.id,
    spaceKey: (DB_TO_SPACE[row.spaceKey] ?? row.spaceKey) as SpaceKey,
    text: row.text,
    source: row.source as 'coach' | 'user',
    status: row.status as FocusItem['status'],
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export async function updateFocusItem(
  focusId: string,
  ownerId: string,
  updates: { status?: FocusItem['status']; text?: string },
): Promise<boolean> {
  const patch: { status?: string; text?: string; completedAt?: Date } = {};
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.text !== undefined) patch.text = updates.text;
  if (updates.status === 'completed') patch.completedAt = new Date();

  const rows = await db
    .update(colourmapFocusItems)
    .set(patch)
    .where(and(eq(colourmapFocusItems.id, focusId), eq(colourmapFocusItems.ownerId, ownerId)))
    .returning({ id: colourmapFocusItems.id });
  return rows.length > 0;
}

// --- Compass Readings ---

export async function saveCompassReading(
  ownerId: string,
  reading: Omit<CompassReading, 'id' | 'generatedAt'>,
): Promise<CompassReading> {
  const id = genId();
  const generatedAt = new Date();
  await db.insert(colourmapCompassReadings).values({
    id,
    ownerId,
    narrative: reading.narrative,
    reinforcements: reading.reinforcements,
    tensions: reading.tensions,
    generatedAt,
  });
  return {
    id,
    narrative: reading.narrative,
    reinforcements: reading.reinforcements,
    tensions: reading.tensions,
    generatedAt: generatedAt.toISOString(),
  };
}

export async function loadLatestCompassReading(ownerId: string): Promise<CompassReading | null> {
  const [row] = await db
    .select()
    .from(colourmapCompassReadings)
    .where(eq(colourmapCompassReadings.ownerId, ownerId))
    .orderBy(desc(colourmapCompassReadings.generatedAt))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    narrative: row.narrative,
    reinforcements: parseJsonArray(row.reinforcements),
    tensions: parseJsonArray(row.tensions),
    generatedAt: row.generatedAt.toISOString(),
  };
}

// --- Pattern Flags ---

export async function listPatternFlags(
  ownerId: string,
  options?: { status?: PatternFlag['status']; minConfidence?: number },
): Promise<PatternFlag[]> {
  const conditions = [
    eq(colourmapPatternFlags.ownerId, ownerId),
    ...(options?.status ? [eq(colourmapPatternFlags.status, options.status)] : []),
    ...(options?.minConfidence != null
      ? [sql`${colourmapPatternFlags.confidence} >= ${options.minConfidence}`]
      : []),
  ];
  const rows = await db
    .select()
    .from(colourmapPatternFlags)
    .where(and(...conditions))
    .orderBy(desc(colourmapPatternFlags.firstObserved));
  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    confidence: r.confidence,
    spaceKey: r.spaceKey ? ((DB_TO_SPACE[r.spaceKey] ?? r.spaceKey) as SpaceKey) : null,
    status: r.status as PatternFlag['status'],
    firstObserved: r.firstObserved.toISOString(),
    lastRelevant: r.lastRelevant.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function confirmPatternFlag(patternId: string, ownerId: string): Promise<boolean> {
  const rows = await db
    .update(colourmapPatternFlags)
    .set({ status: 'confirmed' })
    .where(
      and(
        eq(colourmapPatternFlags.id, patternId),
        eq(colourmapPatternFlags.ownerId, ownerId),
        eq(colourmapPatternFlags.status, 'pending'),
      ),
    )
    .returning({ id: colourmapPatternFlags.id });
  return rows.length > 0;
}

export async function dismissPatternFlag(patternId: string, ownerId: string): Promise<boolean> {
  const rows = await db
    .update(colourmapPatternFlags)
    .set({ status: 'dismissed' })
    .where(
      and(
        eq(colourmapPatternFlags.id, patternId),
        eq(colourmapPatternFlags.ownerId, ownerId),
        eq(colourmapPatternFlags.status, 'pending'),
      ),
    )
    .returning({ id: colourmapPatternFlags.id });
  return rows.length > 0;
}

export async function createPatternFlag(
  ownerId: string,
  flag: {
    description: string;
    confidence: number;
    spaceKey?: SpaceKey | null;
    firstObserved: Date;
    lastRelevant: Date;
  },
): Promise<PatternFlag> {
  const id = genId();
  await db.insert(colourmapPatternFlags).values({
    id,
    ownerId,
    description: flag.description,
    confidence: flag.confidence,
    spaceKey: flag.spaceKey ? SPACE_TO_DB[flag.spaceKey] : null,
    firstObserved: flag.firstObserved,
    lastRelevant: flag.lastRelevant,
  });
  const [row] = await db
    .select()
    .from(colourmapPatternFlags)
    .where(eq(colourmapPatternFlags.id, id))
    .limit(1);
  return {
    id: row.id,
    description: row.description,
    confidence: row.confidence,
    spaceKey: row.spaceKey ? ((DB_TO_SPACE[row.spaceKey] ?? row.spaceKey) as SpaceKey) : null,
    status: row.status as PatternFlag['status'],
    firstObserved: row.firstObserved.toISOString(),
    lastRelevant: row.lastRelevant.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

// --- Export / Delete ---

export async function exportUserData(ownerId: string): Promise<UserDataExport> {
  const [
    state,
    sessions,
    practices,
    values,
    focusItemsRows,
    compassReadingsRows,
    patternFlagsRows,
  ] = await Promise.all([
    loadUserState(ownerId),
    db
      .select()
      .from(colourmapSessions)
      .where(eq(colourmapSessions.ownerId, ownerId))
      .orderBy(colourmapSessions.createdAt),
    db.select().from(colourmapPractices).where(eq(colourmapPractices.ownerId, ownerId)),
    db.select().from(colourmapValues).where(eq(colourmapValues.ownerId, ownerId)),
    db.select().from(colourmapFocusItems).where(eq(colourmapFocusItems.ownerId, ownerId)),
    db
      .select()
      .from(colourmapCompassReadings)
      .where(eq(colourmapCompassReadings.ownerId, ownerId))
      .orderBy(desc(colourmapCompassReadings.generatedAt))
      .limit(10),
    db
      .select()
      .from(colourmapPatternFlags)
      .where(eq(colourmapPatternFlags.ownerId, ownerId))
      .orderBy(desc(colourmapPatternFlags.firstObserved)),
  ]);

  const sessionIds = sessions.map((s) => s.id);
  const allMessages =
    sessionIds.length > 0
      ? await db
          .select()
          .from(colourmapMessages)
          .where(inArray(colourmapMessages.sessionId, sessionIds))
          .orderBy(colourmapMessages.createdAt)
      : [];

  return {
    exportedAt: new Date().toISOString(),
    state,
    patternFlags: patternFlagsRows.map((f) => ({
      description: f.description,
      confidence: f.confidence,
      spaceKey: f.spaceKey,
      status: f.status,
      firstObserved: f.firstObserved.toISOString(),
      lastRelevant: f.lastRelevant.toISOString(),
    })),
    sessions: sessions.map((s) => ({
      id: s.id,
      summary: s.summary,
      createdAt: s.createdAt.toISOString(),
      messages: allMessages
        .filter((m) => m.sessionId === s.id)
        .map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt.toISOString() })),
    })),
    practices: practices.map((p) => ({
      spaceKey: p.spaceKey,
      title: p.title,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
    principles: values.map((v) => ({
      spaceKey: v.spaceKey,
      text: v.text,
      confirmed: v.confirmed,
      createdAt: v.createdAt.toISOString(),
    })),
    focusItems: focusItemsRows.map((f) => ({
      spaceKey: f.spaceKey,
      text: f.text,
      status: f.status,
      createdAt: f.createdAt.toISOString(),
    })),
    compassReadings: compassReadingsRows.map((r) => ({
      narrative: r.narrative,
      reinforcements: parseJsonArray(r.reinforcements),
      tensions: parseJsonArray(r.tensions),
      generatedAt: r.generatedAt.toISOString(),
    })),
  };
}

export async function deleteAllUserData(ownerId: string): Promise<void> {
  const sessions = await db
    .select({ id: colourmapSessions.id })
    .from(colourmapSessions)
    .where(eq(colourmapSessions.ownerId, ownerId));

  const sessionIds = sessions.map((s) => s.id);

  await Promise.all([
    ...(sessionIds.length > 0
      ? [db.delete(colourmapMessages).where(inArray(colourmapMessages.sessionId, sessionIds))]
      : []),
    db.delete(colourmapSessions).where(eq(colourmapSessions.ownerId, ownerId)),
    db.delete(colourmapUserState).where(eq(colourmapUserState.ownerId, ownerId)),
    db.delete(colourmapPractices).where(eq(colourmapPractices.ownerId, ownerId)),
    db.delete(colourmapValues).where(eq(colourmapValues.ownerId, ownerId)),
    db.delete(colourmapFocusItems).where(eq(colourmapFocusItems.ownerId, ownerId)),
    db.delete(colourmapCompassReadings).where(eq(colourmapCompassReadings.ownerId, ownerId)),
    db.delete(colourmapPatternFlags).where(eq(colourmapPatternFlags.ownerId, ownerId)),
  ]);
}
