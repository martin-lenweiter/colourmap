import { and, desc, eq } from 'drizzle-orm';

import type { Principle, SpaceKey } from '../../domain/types';
import { db } from '../client';
import { colourmapValues } from '../schema';
import { DB_TO_SPACE, genId, SPACE_TO_DB } from './_shared';

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
  const [row] = await db.select().from(colourmapValues).where(eq(colourmapValues.id, id)).limit(1);
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
