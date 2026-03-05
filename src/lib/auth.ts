import { cookies } from 'next/headers';

const COOKIE_NAME = 'colourmap_anon_id';

export async function getAnonymousId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const newId = crypto.randomUUID();
  cookieStore.set(COOKIE_NAME, newId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return newId;
}

export async function clearAnonymousId(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
