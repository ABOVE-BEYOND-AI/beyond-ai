import { NextRequest, NextResponse } from 'next/server'

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/itinerary',
  '/itineraries',
  '/settings',
  '/admin',
  '/leads',
  '/sales',
  '/pipeline',
  '/calls',
  '/outreach',
  '/events',
  '/clients',
  '/analytics',
  '/notes',
  '/finance',
  '/dialer',
]

// Routes that should redirect to dashboard if already authenticated
const AUTH_ROUTES = ['/auth/signin']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get('beyond_ai_session')
  const hasSession = !!sessionCookie?.value

  // If visiting auth pages while logged in, redirect to itinerary
  if (AUTH_ROUTES.some(route => pathname.startsWith(route)) && hasSession) {
    return NextResponse.redirect(new URL('/itinerary', request.url))
  }

  // If visiting protected routes without session, redirect to sign in
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route)) && !hasSession) {
    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (they handle their own auth)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, images, etc.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|auth/google).*)',
  ],
}
