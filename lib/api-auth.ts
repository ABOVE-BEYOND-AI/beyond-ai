import { NextRequest, NextResponse } from 'next/server'
import { decodeSession, type UserSession } from './google-oauth-clean'
import { createUser, getItinerary, getUser } from './redis-database'
import type { Itinerary, User } from './types'

export class ApiAuthError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
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

  if (error instanceof Error && /not found/i.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}
