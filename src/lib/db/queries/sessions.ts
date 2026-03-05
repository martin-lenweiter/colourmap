import { and, desc, eq, gte, ne } from 'drizzle-orm';

import { db } from '../client';
import { colourmapSessions } from '../schema';
import { genId } from './_shared';

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
    .where(
      and(eq(colourmapSessions.ownerId, ownerId), gte(colourmapSessions.createdAt, fiveMinAgo)),
    )
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
  await db.update(colourmapSessions).set({ summary }).where(eq(colourmapSessions.id, sessionId));
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

export async function loadSessionsForPatternDetection(
  ownerId: string,
  since: Date,
): Promise<{ id: string; createdAt: Date }[]> {
  return db
    .select({ id: colourmapSessions.id, createdAt: colourmapSessions.createdAt })
    .from(colourmapSessions)
    .where(and(eq(colourmapSessions.ownerId, ownerId), gte(colourmapSessions.createdAt, since)))
    .orderBy(colourmapSessions.createdAt);
}
