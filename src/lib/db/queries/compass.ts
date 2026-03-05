import { desc, eq } from 'drizzle-orm';

import type { CompassReading } from '../../domain/types';
import { db } from '../client';
import { colourmapCompassReadings } from '../schema';
import { genId, parseJsonArray } from './_shared';

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
