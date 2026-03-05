import { NextResponse } from 'next/server';
import { generateCompassReading } from '@/lib/services/coach';
import {
  loadLatestCompassReading,
  saveCompassReading,
  loadUserState,
  listPrinciples,
  listFocusItems,
} from '@/lib/db/queries';
import { getAnonymousId } from '../anonymous-auth';
import { logger } from '../../../lib/logger';

export async function GET() {
  try {
    const ownerId = await getAnonymousId();

    const reading = await loadLatestCompassReading(ownerId);

    if (reading) {
      const age = Date.now() - new Date(reading.generatedAt).getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (age < twentyFourHours) {
        return NextResponse.json({ reading, fresh: true });
      }
    }

    return NextResponse.json({ reading, fresh: false });
  } catch (err) {
    logger.error('Compass GET failed', {
      path: '/api/compass',
      status: 500,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to load compass reading' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const ownerId = await getAnonymousId();

    const [state, principles, focusItems] = await Promise.all([
      loadUserState(ownerId),
      listPrinciples(ownerId),
      listFocusItems(ownerId),
    ]);

    if (!state) {
      return NextResponse.json(
        { error: 'No state found — complete onboarding first' },
        { status: 400 }
      );
    }

    const generated = await generateCompassReading(
      state,
      principles,
      focusItems
    );
    const reading = await saveCompassReading(ownerId, generated);

    return NextResponse.json({ reading, fresh: true });
  } catch (err) {
    logger.error('Compass POST failed', {
      path: '/api/compass',
      status: 500,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to generate compass reading' },
      { status: 500 }
    );
  }
}
