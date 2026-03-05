import { NextResponse } from 'next/server';

// This app uses anonymous cookie-based auth only.
// Better-auth endpoints are not active.

export async function GET() {
  return NextResponse.json(null, { status: 200 });
}

export async function POST() {
  return NextResponse.json({ error: 'Auth not configured' }, { status: 501 });
}
