import { NextResponse } from 'next/server';
import { confirmPatternFlag, dismissPatternFlag } from '@/lib/db/queries';
import { getAnonymousId } from '@/lib/auth';
import { logger, getTraceId } from '../../../../lib/logger';

/** PATCH: Confirm or dismiss a pattern flag. Body: { action: 'confirm' | 'dismiss' } */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ownerId = await getAnonymousId();
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'Pattern ID required' },
        { status: 400 }
      );
    }

    let body: { action?: string } = {};
    try {
      body = ((await request.json()) as { action?: string }) || {};
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const action = body.action;
    if (action === 'confirm') {
      const ok = await confirmPatternFlag(id, ownerId);
      return NextResponse.json({ ok, status: ok ? 'confirmed' : 'unchanged' });
    }
    if (action === 'dismiss') {
      const ok = await dismissPatternFlag(id, ownerId);
      return NextResponse.json({ ok, status: ok ? 'dismissed' : 'unchanged' });
    }

    return NextResponse.json(
      { error: 'action must be "confirm" or "dismiss"' },
      { status: 400 }
    );
  } catch (err) {
    logger.error('Pattern PATCH failed', {
      path: '/api/patterns/[id]',
      status: 500,
      traceId: getTraceId(request),
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to update pattern' },
      { status: 500 }
    );
  }
}
