import { and, desc, eq, sql } from 'drizzle-orm';

import type { PatternFlag, SpaceKey } from '../../domain/types';
import { db } from '../client';
import { colourmapPatternFlags } from '../schema';
import { DB_TO_SPACE, genId, SPACE_TO_DB } from './_shared';

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
