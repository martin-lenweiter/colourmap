import { and, desc, eq, ne } from 'drizzle-orm';

import type { FocusItem, SpaceKey } from '../../domain/types';
import { db } from '../client';
import { colourmapFocusItems } from '../schema';
import { DB_TO_SPACE, genId, SPACE_TO_DB } from './_shared';

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
