import { NextResponse } from 'next/server';
import { getAnonymousId } from '@/lib/auth';
import { createPractice, listPractices } from '@/lib/db/queries';
import { SPACE_KEYS } from '@/lib/domain/state';
import type { SpaceKey } from '@/lib/domain/types';
import { getTraceId, logger } from '../../../lib/logger';

export async function GET(request: Request) {
  try {
    const ownerId = await getAnonymousId();

    const url = new URL(request.url);
    const space = url.searchParams.get('space');
    const spaceKey =
      space && (SPACE_KEYS as string[]).includes(space) ? (space as SpaceKey) : undefined;

    const practices = await listPractices(ownerId, spaceKey);
    return NextResponse.json({ practices });
  } catch (err) {
    logger.error('Practices GET failed', {
      path: '/api/practices',
      status: 500,
      traceId: getTraceId(request),
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to load practices' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await getAnonymousId();

    let body: { spaceKey: string; title: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!(SPACE_KEYS as string[]).includes(body.spaceKey) || !body.title?.trim()) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const practice = await createPractice(
      ownerId,
      body.spaceKey as SpaceKey,
      body.title.trim(),
      'user',
    );

    return NextResponse.json({ practice });
  } catch (err) {
    logger.error('Practices POST failed', {
      path: '/api/practices',
      status: 500,
      traceId: getTraceId(request),
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to create practice' }, { status: 500 });
  }
}
