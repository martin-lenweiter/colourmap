import { desc, eq, inArray } from 'drizzle-orm';

import type { UserDataExport } from '../../domain/types';
import { db } from '../client';
import {
  colourmapCompassReadings,
  colourmapFocusItems,
  colourmapMessages,
  colourmapPatternFlags,
  colourmapPractices,
  colourmapSessions,
  colourmapUserState,
  colourmapValues,
} from '../schema';
import { parseJsonArray } from './_shared';
import { loadUserState } from './state';

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
