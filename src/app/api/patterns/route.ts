import { NextResponse } from 'next/server';
import { getAnonymousId } from '@/lib/auth';
import { listPatternFlags } from '@/lib/db/queries';
import { detectAndPersistPatterns, detectPatterns } from '@/lib/services/detect-patterns';
import { getTraceId, logger } from '../../../lib/logger';

export async function GET(request: Request) {
  try {
    const ownerId = await getAnonymousId();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'pending' | 'confirmed' | 'dismissed' | null;
    const minConfidence = searchParams.get('minConfidence');
    const conf = minConfidence ? parseFloat(minConfidence) : undefined;

    const flags = await listPatternFlags(ownerId, {
      ...(status ? { status } : {}),
      ...(conf != null && !Number.isNaN(conf) ? { minConfidence: conf } : {}),
    });
    return NextResponse.json({ patternFlags: flags });
  } catch (err) {
    logger.error('Patterns GET failed', {
      path: '/api/patterns',
      status: 500,
      traceId: getTraceId(request),
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to list patterns' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await getAnonymousId();
    let body: { create?: boolean } = {};
    try {
      body = ((await request.json()) as { create?: boolean }) || {};
    } catch {
      // no body is fine
    }

    const detected = body.create
      ? await detectAndPersistPatterns(ownerId)
      : await detectPatterns(ownerId);

    return NextResponse.json({
      detected: detected.map((p) => ({
        description: p.description,
        confidence: p.confidence,
        spaceKey: p.spaceKey,
        firstObserved: p.firstObserved,
        lastRelevant: p.lastRelevant,
      })),
    });
  } catch (err) {
    logger.error('Pattern detection failed', {
      path: '/api/patterns',
      status: 500,
      traceId: getTraceId(request),
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to detect patterns' }, { status: 500 });
  }
}
