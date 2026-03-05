import { NextResponse } from 'next/server';
import { updatePracticeStatus, updatePracticeTitle } from '@/lib/db/queries';
import { getAnonymousId } from '../../anonymous-auth';
import { logger, getTraceId } from '../../../../lib/logger';

const VALID_STATUSES = ['suggested', 'active', 'completed', 'archived'];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ownerId = await getAnonymousId();
    const { id } = await params;

    let body: { status?: string; title?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      const updated = await updatePracticeStatus(
        id,
        ownerId,
        body.status as 'suggested' | 'active' | 'completed' | 'archived'
      );
      if (!updated) {
        return NextResponse.json(
          { error: 'Practice not found' },
          { status: 404 }
        );
      }
    }

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
      }
      const updated = await updatePracticeTitle(id, ownerId, body.title.trim());
      if (!updated) {
        return NextResponse.json(
          { error: 'Practice not found' },
          { status: 404 }
        );
      }
    }

    if (body.status === undefined && body.title === undefined) {
      return NextResponse.json(
        { error: 'Provide status or title to update' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('Practice PATCH failed', {
      path: '/api/practices/[id]',
      status: 500,
      traceId: getTraceId(request),
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to update practice' },
      { status: 500 }
    );
  }
}
