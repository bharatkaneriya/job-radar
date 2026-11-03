import { NextResponse } from 'next/server';

// Cheap gate: no session cookie → send to /login. The API still checks the token
// (and the role) on every request; the app shell handles expired sessions.
export function proxy(req) {
  if (req.cookies.has('token')) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/dashboard/:path*', '/jobs/:path*', '/profile/:path*', '/admin/:path*'] };
