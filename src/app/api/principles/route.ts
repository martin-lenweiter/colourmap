import { NextResponse } from 'next/server';
import { SPACE_KEYS } from '@/lib/domain/state';
import type { SpaceKey } from '@/lib/domain/types';
import { listPrinciples, createPrinciple } from '@/lib/db/queries';
import { getAnonymousId } from '../anonymous-auth';
import { logger, getTraceId } from '../../../lib/logger';

export async function GET(request: Request) {
  try {
    const ownerId = await getAnonymousId();

    const url = new URL(request.url);
    const space = url.searchParams.get('space');
    const spaceKey =
      space && (SPACE_KEYS as string[]).includes(space)
        ? (space as SpaceKey)
        : undefined;

    const principles = await listPrinciples(ownerId, spaceKey);
    return NextResponse.json({ principles });
  } catch (err) {
    logger.error('Principles GET failed', {
      path: '/api/principles',
      status: 500,
      traceId: getTraceId(request),
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to load principles' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await getAnonymousId();

    let body: { spaceKey: string; text: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (
      !(SPACE_KEYS as string[]).includes(body.spaceKey) ||
      !body.text?.trim() ||
      body.text.trim().length > 500
    ) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const principle = await createPrinciple(
      ownerId,
      body.spaceKey as SpaceKey,
      body.text.trim(),
      'user'
    );

    return NextResponse.json({ principle });
  } catch (err) {
    logger.error('Principles POST failed', {
      path: '/api/principles',
      status: 500,
      traceId: getTraceId(request),
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to create principle' },
      { status: 500 }
    );
  }
}
