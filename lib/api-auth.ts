import { NextRequest, NextResponse } from 'next/server'
import { decodeSession, type UserSession } from './google-oauth-clean'
import { createUser, getItinerary, getUser } from './redis-database'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import type { Itinerary, User } from './types'

export class ApiAuthError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// ── UUID Validation ──

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateUUID(id: string, label = 'ID'): void {
  if (!UUID_REGEX.test(id)) {
    throw new ApiAuthError(400, `Invalid ${label} format`)
  }
}

// ── Date Validation ──

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function validateDateString(date: string, { maxDaysInPast = 90, maxDaysInFuture = 1 } = {}): void {
  if (!DATE_REGEX.test(date)) {
    throw new ApiAuthError(400, 'Invalid date format. Use YYYY-MM-DD')
  }
  const parsed = new Date(date + 'T00:00:00Z')
  if (isNaN(parsed.getTime())) {
    throw new ApiAuthError(400, 'Invalid date')
  }
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays > maxDaysInPast) {
    throw new ApiAuthError(400, `Date cannot be more than ${maxDaysInPast} days in the past`)
  }
  if (diffDays < -maxDaysInFuture) {
    throw new ApiAuthError(400, `Date cannot be more than ${maxDaysInFuture} day(s) in the future`)
  }
}

// ── Rate Limiting ──
// Uses Upstash sliding window: 20 mutation requests per 60 seconds per user

let rateLimiter: Ratelimit | null = null

function getRateLimiter(): Ratelimit {
  if (!rateLimiter) {
    rateLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, '60 s'),
      prefix: 'ratelimit:finance',
    })
  }
  return rateLimiter
}

export async function checkRateLimit(userEmail: string): Promise<void> {
  try {
    const rl = getRateLimiter()
    const { success, remaining } = await rl.limit(userEmail)
    if (!success) {
      throw new ApiAuthError(429, `Rate limit exceeded. Try again shortly. (${remaining} remaining)`)
    }
  } catch (err) {
    // If rate limiter itself fails (Redis down), allow the request through
    // rather than blocking all finance operations
    if (err instanceof ApiAuthError) throw err
    console.error('Rate limiter error (allowing request):', err)
  }
}

// ── CSRF Protection ──

export function validateCsrf(request: NextRequest): void {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // For same-origin requests, at least one of origin/referer must be present and match
  if (!origin && !referer) {
    throw new ApiAuthError(403, 'Missing origin header')
  }

  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : null

  const requestOrigin = origin || (referer ? new URL(referer).origin : null)

  if (allowedOrigin && requestOrigin && requestOrigin !== allowedOrigin) {
    throw new ApiAuthError(403, 'Invalid request origin')
  }
}

export interface ApiUserContext {
  email: string
  isAdmin: boolean
  session: UserSession
  user: User
}

export async function getApiUser(request: NextRequest): Promise<ApiUserContext | null> {
  const sessionCookie = request.cookies.get('beyond_ai_session')?.value
  if (!sessionCookie) return null

  const session = decodeSession(sessionCookie)
  if (!session?.user?.email) return null

  let user = await getUser(session.user.email)
  if (!user) {
    user = await createUser(session.user)
  }

  return {
    email: user.email,
    isAdmin: user.role === 'admin',
    session,
    user,
  }
}

export async function requireApiUser(request: NextRequest): Promise<ApiUserContext> {
  const context = await getApiUser(request)
  if (!context) {
    throw new ApiAuthError(401, 'Unauthorized')
  }
  return context
}

export async function requireApiAdmin(request: NextRequest): Promise<ApiUserContext> {
  const context = await requireApiUser(request)
  if (!context.isAdmin) {
    throw new ApiAuthError(403, 'Forbidden')
  }
  return context
}

export function getScopedUserEmail(
  requestedEmail: string | null | undefined,
  context: ApiUserContext
): string {
  if (!requestedEmail) return context.email

  const normalizedRequested = requestedEmail.trim().toLowerCase()
  const normalizedCurrent = context.email.trim().toLowerCase()

  if (normalizedRequested !== normalizedCurrent && !context.isAdmin) {
    throw new ApiAuthError(403, 'Forbidden')
  }

  return requestedEmail
}

export async function requireItineraryAccess(
  request: NextRequest,
  itineraryId: string
): Promise<{ context: ApiUserContext; itinerary: Itinerary }> {
  const context = await requireApiUser(request)
  const itinerary = await getItinerary(itineraryId)

  if (!itinerary) {
    throw new ApiAuthError(404, 'Itinerary not found')
  }

  if (itinerary.user_email !== context.email && !context.isAdmin) {
    throw new ApiAuthError(403, 'Forbidden')
  }

  return { context, itinerary }
}

export function apiErrorResponse(error: unknown, fallbackMessage = 'Internal server error') {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  // Log full error server-side for debugging, but never expose to client
  console.error('API error:', error instanceof Error ? error.message : error)

  // Only expose "not found" messages — all other internal errors use the safe fallback
  if (error instanceof Error && /not found/i.test(error.message)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}
