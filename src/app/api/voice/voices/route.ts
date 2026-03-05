import { NextResponse } from 'next/server';
import { logger, getTraceId } from '../../../../lib/logger';
import { listVoices, isTtsConfigured } from '@/lib/services/voice';

/** GET: List available TTS voices */
export async function GET(request: Request) {
  const start = Date.now();
  const traceId = getTraceId(request);
  logger.info('List voices request started', {
    path: '/api/voice/voices',
    traceId,
  });
  try {
    if (!isTtsConfigured()) {
      return NextResponse.json(
        { error: 'Voice not configured (ELEVENLABS_API_KEY missing)' },
        { status: 503 }
      );
    }

    const voices = await listVoices();

    logger.info('List voices request completed', {
      path: '/api/voice/voices',
      durationMs: Date.now() - start,
      status: 200,
      traceId,
    });
    return NextResponse.json({ voices });
  } catch (err) {
    logger.error('List voices request failed', {
      path: '/api/voice/voices',
      durationMs: Date.now() - start,
      status: 500,
      traceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to list voices' },
      { status: 500 }
    );
  }
}
