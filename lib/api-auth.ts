import { NextRequest, NextResponse } from 'next/server'
import { verifySecureSession } from './session-security'
import { getItinerary, getUser } from './redis-database'
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
// Per-user: mutations 20/min, reads 60/min.
// Org-wide: 50/min (Xero limit is 60/min, leave headroom).

let mutationLimiter: Ratelimit | null = null
let readLimiter: Ratelimit | null = null
let orgLimiter: Ratelimit | null = null

function getMutationLimiter(): Ratelimit {
  if (!mutationLimiter) {
    mutationLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, '60 s'),
      prefix: 'ratelimit:finance',
    })
  }
  return mutationLimiter
}

function getReadLimiter(): Ratelimit {
  if (!readLimiter) {
    readLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(60, '60 s'),
      prefix: 'ratelimit:finance_read',
    })
  }
  return readLimiter
}

function getOrgLimiter(): Ratelimit {
  if (!orgLimiter) {
    orgLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(50, '60 s'),
      prefix: 'ratelimit:org_xero',
    })
  }
  return orgLimiter
}

export async function checkRateLimit(userEmail: string): Promise<void> {
  try {
    const rl = getMutationLimiter()
    const { success, remaining } = await rl.limit(userEmail)
    if (!success) {
      throw new ApiAuthError(429, `Rate limit exceeded. Try again shortly. (${remaining} remaining)`)
    }
  } catch (err) {
    // If rate limiter fails (Redis down), BLOCK high-risk mutations
    if (err instanceof ApiAuthError) throw err
    console.error('Rate limiter error (blocking mutation):', err)
    throw new ApiAuthError(503, 'Service temporarily unavailable. Please try again.')
  }
}

export async function checkReadRateLimit(userEmail: string): Promise<void> {
  try {
    const rl = getReadLimiter()
    const { success, remaining } = await rl.limit(userEmail)
    if (!success) {
      throw new ApiAuthError(429, `Rate limit exceeded. Try again shortly. (${remaining} remaining)`)
    }
  } catch (err) {
    if (err instanceof ApiAuthError) throw err
    console.error('Read rate limiter error (allowing request):', err)
  }
}

/** Org-wide rate limit — protects shared Xero API quota. */
export async function checkOrgRateLimit(): Promise<void> {
  try {
    const rl = getOrgLimiter()
    const { success } = await rl.limit('org')
    if (!success) {
      throw new ApiAuthError(429, 'Xero API rate limit approaching. Please wait a moment.')
    }
  } catch (err) {
    if (err instanceof ApiAuthError) throw err
    console.error('Org rate limiter error (allowing request):', err)
  }
}

// ── Refresh Cooldown ──
// Atomic SET NX — prevents race conditions with concurrent requests.

const REFRESH_COOLDOWN_SECONDS = 30

export async function checkRefreshCooldown(userEmail: string): Promise<void> {
  try {
    const redis = Redis.fromEnv()
    const key = `ratelimit:refresh:${userEmail}`
    // Atomic: only succeeds if key doesn't exist
    const result = await redis.set(key, '1', { nx: true, ex: REFRESH_COOLDOWN_SECONDS })
    if (result !== 'OK') {
      throw new ApiAuthError(429, 'Please wait before refreshing again')
    }
  } catch (err) {
    if (err instanceof ApiAuthError) throw err
    // Redis down — allow through
  }
}

// ── CSRF Protection ──

export function validateCsrf(request: NextRequest): void {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  if (!origin && !referer) {
    throw new ApiAuthError(403, 'Missing origin header')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const vercelUrl = process.env.VERCEL_URL
  const allowedOrigin = appUrl || (vercelUrl ? `https://${vercelUrl}` : null)

  const requestOrigin = origin || (referer ? new URL(referer).origin : null)

  if (allowedOrigin && requestOrigin && requestOrigin !== allowedOrigin) {
    throw new ApiAuthError(403, 'Invalid request origin')
  }
}

// ── Auth Context ──

export interface ApiUserContext {
  email: string
  isAdmin: boolean
  isFinance: boolean
  user: User
}

export async function getApiUser(request: NextRequest): Promise<ApiUserContext | null> {
  const sessionCookie = request.cookies.get('beyond_ai_session')?.value
  if (!sessionCookie) return null

  // Verify session signature and expiry (HMAC-SHA256 via Web Crypto)
  const session = await verifySecureSession(sessionCookie)
  if (!session?.email) return null

  // Only look up existing users — do NOT auto-create from cookie data
  const user = await getUser(session.email)
  if (!user) return null

  return {
    email: user.email,
    isAdmin: user.role === 'admin',
    isFinance: user.role === 'admin' || user.role === 'finance',
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

/** Require admin or finance role — use for all finance routes */
export async function requireFinanceUser(request: NextRequest): Promise<ApiUserContext> {
  const context = await requireApiUser(request)
  if (!context.isFinance) {
    throw new ApiAuthError(403, 'Forbidden: finance access required')
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

  console.error('API error:', error instanceof Error ? error.message : error)

  if (error instanceof Error && /not found/i.test(error.message)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}
