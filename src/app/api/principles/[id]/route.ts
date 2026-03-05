import { NextResponse } from 'next/server';
import { getAnonymousId } from '@/lib/auth';
import { deletePrinciple, updatePrinciple } from '@/lib/db/queries';
import { getTraceId, logger } from '../../../../lib/logger';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await getAnonymousId();
    const { id } = await params;

    let body: { text?: string; confirmed?: boolean };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const updates: { text?: string; confirmed?: boolean } = {};
    if (typeof body.text === 'string') updates.text = body.text.trim();
    if (typeof body.confirmed === 'boolean') updates.confirmed = body.confirmed;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    const updated = await updatePrinciple(id, ownerId, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Principle not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('Principle PATCH failed', {
      path: '/api/principles/[id]',
      status: 500,
      traceId: getTraceId(request),
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to update principle' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await getAnonymousId();
    const { id } = await params;

    const deleted = await deletePrinciple(id, ownerId);
    if (!deleted) {
      return NextResponse.json({ error: 'Principle not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('Principle DELETE failed', {
      path: '/api/principles/[id]',
      status: 500,
      traceId: getTraceId(_request),
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to delete principle' }, { status: 500 });
  }
}
