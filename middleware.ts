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
  '/chat',
]

// Routes that should redirect to dashboard if already authenticated
const AUTH_ROUTES = ['/auth/signin']
// SECURITY: Be as specific as possible — startsWith matching means any sub-path is also public.
// Only include routes that genuinely need unauthenticated access (webhooks, OAuth callbacks).
// NOTE: /api/sales/admin/purge was REMOVED — it's a destructive admin operation that must require auth.
// SECURITY: Be as specific as possible with public routes.
// Only include routes that genuinely need unauthenticated access (webhooks, OAuth callbacks).
const PUBLIC_API_ROUTES = [
  '/api/auth/google',              // Google OAuth initiation + callback
  '/api/auth/canva',               // Canva OAuth initiation + callback
  '/api/auth/xero/callback',       // Xero OAuth callback (has its own auth check inside)
  '/api/auth/refresh',             // Token refresh endpoint
  '/api/email/process-queue',      // Webhook from email provider
  '/api/notifications/generate',   // Internal cron trigger
  '/api/sales/slack-events',       // Slack webhook
  '/api/sales/data',               // TV dashboard data endpoint
  '/api/tv/verify',                // TV screen verification
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get('beyond_ai_session')
  const hasSession = !!sessionCookie?.value

  const isApiRoute = pathname.startsWith('/api/')
  const isPublicApiRoute = PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))

  if (isApiRoute && !isPublicApiRoute && !hasSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, images, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|auth/google).*)',
  ],
}
