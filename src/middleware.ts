import { type NextRequest, NextResponse } from 'next/server';

// Session refresh — no business logic here.
// This app uses anonymous cookie auth; see lib/auth.ts.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
