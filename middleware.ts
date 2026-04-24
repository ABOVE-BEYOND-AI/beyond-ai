import { NextRequest, NextResponse } from 'next/server'
import { verifySecureSession } from './lib/session-security'

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

// The dashboard (/) needs exact-match protection — startsWith('/') would match everything
const EXACT_PROTECTED_ROUTES = ['/']

// Routes that should redirect to dashboard if already authenticated
const AUTH_ROUTES = ['/auth/signin']

// SECURITY: Be as specific as possible — startsWith matching means any sub-path is also public.
// Only include routes that genuinely need unauthenticated access (webhooks, OAuth callbacks).
// Each route below MUST do its own auth check (HMAC signature, shared secret, etc).
const PUBLIC_API_ROUTES = [
  '/api/auth/google',              // OAuth init + callback (sets/verifies state cookie)
  '/api/auth/canva',               // Canva OAuth initiation + callback
  '/api/auth/xero/callback',       // Xero OAuth callback (has its own auth check inside)
  '/api/auth/refresh',             // Token refresh endpoint (verifies session cookie internally)
  '/api/auth/signout',             // Sign-out endpoint (clears httpOnly cookie)
  '/api/email/process-queue',      // Cron — verifies CRON_SECRET internally
  '/api/notifications/generate',   // Cron — verifies CRON_SECRET or admin internally
  '/api/sales/slack-events',       // Slack webhook — verifies HMAC internally
  '/api/tv/verify',                // TV screen key validation
  '/api/webhooks/aircall',         // Aircall webhook — verifies token internally
]

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'X-DNS-Prefetch-Control': 'off',
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value)
  }
  // HSTS: only meaningful over HTTPS, but harmless to send always — browsers
  // ignore it on plain HTTP. 2 years, include subdomains, eligible for preload.
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  )
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get('beyond_ai_session')?.value

  // Verify session: not just cookie presence, but valid HMAC signature + expiry
  const validSession = sessionCookie ? await verifySecureSession(sessionCookie) : null
  const hasValidSession = !!validSession

  const isApiRoute = pathname.startsWith('/api/')
  const isPublicApiRoute = PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))

  if (isApiRoute && !isPublicApiRoute && !hasValidSession) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  // If visiting auth pages while logged in, redirect to dashboard
  if (AUTH_ROUTES.some(route => pathname.startsWith(route)) && hasValidSession) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/', request.url)))
  }

  // If visiting protected routes without session, redirect to sign in
  const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route))
    || EXACT_PROTECTED_ROUTES.includes(pathname)
  if (isProtected && !hasValidSession) {
    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('redirect', pathname)
    return applySecurityHeaders(NextResponse.redirect(signInUrl))
  }

  return applySecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
