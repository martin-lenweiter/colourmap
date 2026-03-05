import { NextResponse } from 'next/server';
import { isTtsConfigured, synthesize } from '@/lib/services/voice';
import { getTraceId, logger } from '../../../../lib/logger';

/** POST: Synthesize text to speech (TTS) */
export async function POST(request: Request) {
  const start = Date.now();
  const traceId = getTraceId(request);
  logger.info('Synthesize request started', {
    path: '/api/voice/synthesize',
    traceId,
  });
  try {
    if (!isTtsConfigured()) {
      return NextResponse.json(
        { error: 'Voice not configured (ELEVENLABS_API_KEY missing)' },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { text: string; voiceId?: string };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'Missing or empty text' }, { status: 400 });
    }

    const result = await synthesize(text, body.voiceId);

    if (!result) {
      return NextResponse.json({ error: 'No audio generated' }, { status: 500 });
    }

    logger.info('Synthesize request completed', {
      path: '/api/voice/synthesize',
      durationMs: Date.now() - start,
      status: 200,
      traceId,
    });
    return new NextResponse(result.audio as BodyInit, {
      headers: { 'Content-Type': result.contentType },
    });
  } catch (err) {
    logger.error('Synthesize request failed', {
      path: '/api/voice/synthesize',
      durationMs: Date.now() - start,
      status: 500,
      traceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Synthesis failed' }, { status: 500 });
  }
}
