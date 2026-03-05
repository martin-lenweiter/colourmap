import { NextResponse } from 'next/server';
import { exportUserData, deleteAllUserData } from '@/lib/db/queries';
import { getAnonymousId, clearAnonymousId } from '../anonymous-auth';
import { logger } from '../../../lib/logger';

/** GET: Export all user data (JSON) */
export async function GET() {
  try {
    const ownerId = await getAnonymousId();
    const data = await exportUserData(ownerId);
    return NextResponse.json(data, {
      headers: {
        'Content-Disposition': `attachment; filename="colourmap-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    logger.error('Data export failed', {
      path: '/api/data',
      status: 500,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}

/** DELETE: Delete all user data and clear session */
export async function DELETE() {
  try {
    const ownerId = await getAnonymousId();
    await deleteAllUserData(ownerId);
    await clearAnonymousId();
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('Data delete failed', {
      path: '/api/data',
      status: 500,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to delete data' },
      { status: 500 }
    );
  }
}
