import {
  listFocusItems,
  listPrinciples,
  loadUserState,
  saveCompassReading,
} from '@/lib/db/queries';
import type { CompassReading } from '@/lib/domain/types';
import { generateCompassReading } from './coach';

export async function generateAndSaveCompassReading(ownerId: string): Promise<CompassReading> {
  const [state, principles, focusItems] = await Promise.all([
    loadUserState(ownerId),
    listPrinciples(ownerId),
    listFocusItems(ownerId),
  ]);

  if (!state) throw new Error('No state found — complete onboarding first');

  const generated = await generateCompassReading(state, principles, focusItems);
  return saveCompassReading(ownerId, generated);
}
