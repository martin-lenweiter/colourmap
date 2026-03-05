import { and, desc, eq, ne } from 'drizzle-orm';

import type { Practice, SpaceKey } from '../../domain/types';
import { db } from '../client';
import { colourmapPractices } from '../schema';
import { DB_TO_SPACE, genId, SPACE_TO_DB } from './_shared';

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
    .where(and(eq(colourmapPractices.ownerId, ownerId), eq(colourmapPractices.status, 'suggested')))
    .limit(1);
  return row !== undefined;
}
