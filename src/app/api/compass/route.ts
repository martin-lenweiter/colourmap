import { NextResponse } from 'next/server';
import { getAnonymousId } from '@/lib/auth';
import { loadLatestCompassReading } from '@/lib/db/queries';
import { generateAndSaveCompassReading } from '@/lib/services/compass';
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
    return NextResponse.json({ error: 'Failed to load compass reading' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const ownerId = await getAnonymousId();
    const reading = await generateAndSaveCompassReading(ownerId);
    return NextResponse.json({ reading, fresh: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate compass reading';
    if (message.includes('onboarding')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    logger.error('Compass POST failed', {
      path: '/api/compass',
      status: 500,
      err: message,
    });
    return NextResponse.json({ error: 'Failed to generate compass reading' }, { status: 500 });
  }
}
