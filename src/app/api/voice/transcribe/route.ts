import { NextResponse } from 'next/server';
import { logger, getTraceId } from '../../../../lib/logger';
import { transcribe, mimeToFormat, isSttConfigured } from '@/lib/services/voice';

/** POST: Transcribe audio blob to text (STT) */
export async function POST(request: Request) {
  const start = Date.now();
  const traceId = getTraceId(request);
  logger.info('Transcribe request started', {
    path: '/api/voice/transcribe',
    traceId,
  });
  try {
    if (!isSttConfigured()) {
      return NextResponse.json(
        { error: 'Voice not configured (MISTRAL_API_KEY missing)' },
        { status: 503 }
      );
    }

    const formData = (await request.formData()) as unknown as FormData;
    const audio = formData.get('audio') as Blob | null;
    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json(
        { error: 'Missing or invalid audio blob' },
        { status: 400 }
      );
    }

    const bytes = new Uint8Array(await audio.arrayBuffer());
    const mime = audio.type || 'audio/webm';
    const result = await transcribe(
      bytes,
      mimeToFormat(mime),
      (formData.get('language') as string) ?? 'en'
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Voice not configured (MISTRAL_API_KEY missing)' },
        { status: 503 }
      );
    }

    logger.info('Transcribe request completed', {
      path: '/api/voice/transcribe',
      durationMs: Date.now() - start,
      status: 200,
      traceId,
    });
    return NextResponse.json({
      text: result.text ?? '',
      segments: result.segments,
    });
  } catch (err) {
    logger.error('Transcribe request failed', {
      path: '/api/voice/transcribe',
      durationMs: Date.now() - start,
      status: 500,
      traceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Transcription failed' },
      { status: 500 }
    );
  }
}
