import { NextResponse } from 'next/server';
import { updateFocusItem } from '@/lib/db/queries';
import { getAnonymousId } from '../../anonymous-auth';
import { logger, getTraceId } from '../../../../lib/logger';

const VALID_STATUSES = ['proposed', 'active', 'completed', 'archived'];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ownerId = await getAnonymousId();
    const { id } = await params;

    let body: { status?: string; text?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const updates: {
      status?: 'proposed' | 'active' | 'completed' | 'archived';
      text?: string;
    } = {};
    if (body.status && VALID_STATUSES.includes(body.status)) {
      updates.status = body.status as typeof updates.status;
    }
    if (typeof body.text === 'string') {
      updates.text = body.text.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    const updated = await updateFocusItem(id, ownerId, updates);
    if (!updated) {
      return NextResponse.json(
        { error: 'Focus item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('Focus PATCH failed', {
      path: '/api/focus/[id]',
      status: 500,
      traceId: getTraceId(request),
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to update focus item' },
      { status: 500 }
    );
  }
}
