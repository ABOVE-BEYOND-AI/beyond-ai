// Authentication utilities and session management
import { GoogleUser, GoogleTokens, AuthSession } from './types'
import { validateAccessToken, refreshAccessToken } from './google-oauth-clean'
import { saveUserSession, clearUserSession } from './redis-database'

// JWT-like session token utilities (using simple encoding for now)
export function encodeSessionToken(session: AuthSession): string {
  const sessionData = JSON.stringify(session)
  // Use standard Base64 encoding, reliable on the server
  return Buffer.from(sessionData).toString('base64')
}

export function decodeSessionToken(token: string): AuthSession | null {
  try {
    // Use atob for universal browser support, avoiding Buffer polyfill issues.
    const sessionData = atob(token)
    return JSON.parse(sessionData) as AuthSession
  } catch (error) {
    console.error("Failed to decode session token:", error);
    return null
  }
}

// Session management
export async function createSession(user: GoogleUser, tokens: GoogleTokens): Promise<string> {
  const session: AuthSession = {
    user,
    tokens,
    expires_at: tokens.expires_at || (Date.now() + (3600 * 1000)), // 1 hour default
  }

  // Save session in Redis
  await saveUserSession(user.email, session as unknown as Record<string, unknown>)

  // Return encoded session token
  return encodeSessionToken(session)
}

export async function getValidSession(sessionToken: string): Promise<AuthSession | null> {
  const session = decodeSessionToken(sessionToken)
  if (!session) {
    return null
  }

  // Check if session is expired
  if (Date.now() > session.expires_at) {
    await clearUserSession(session.user.email)
    return null
  }

  // For fresh sessions (within 5 minutes), skip token validation to avoid race conditions
  const sessionAge = Date.now() - (session.expires_at - (3600 * 1000))
  const isFreshSession = sessionAge < (5 * 60 * 1000) // 5 minutes
  
  if (isFreshSession) {
    console.log('✅ Auth Utils: Using fresh session, skipping token validation')
    return session
  }

  // Validate access token with Google for older sessions
  console.log('🔍 Auth Utils: Validating access token for older session...')
  const isTokenValid = await validateAccessToken(session.tokens.access_token)
  console.log('🔍 Auth Utils: Token validation result:', isTokenValid)
  
  if (!isTokenValid) {
    console.log('❌ Auth Utils: Token invalid, attempting refresh...')
    // Try to refresh token if we have a refresh token
    if (session.tokens.refresh_token) {
      try {
        const newTokens = await refreshAccessToken(session.tokens.refresh_token)
        
        // Update session with new tokens
        const updatedSession: AuthSession = {
          ...session,
          tokens: newTokens,
          expires_at: newTokens.expires_at || (Date.now() + (3600 * 1000)),
        }

        await saveUserSession(session.user.email, updatedSession as unknown as Record<string, unknown>)
        return updatedSession
      } catch (error) {
        console.error('Failed to refresh token:', error)
        await clearUserSession(session.user.email)
        return null
      }
    } else {
      await clearUserSession(session.user.email)
      return null
    }
  }

  return session
}

export async function clearSession(sessionToken: string): Promise<void> {
  const session = decodeSessionToken(sessionToken)
  if (session) {
    await clearUserSession(session.user.email)
  }
}

// Cookie utilities
export const COOKIE_NAME = 'beyond_ai_session'

export function getSessionCookieOptions() {
  return {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  }
}

// Google API client utilities
export function createGoogleApiHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

// Helper to check if user is authenticated
export async function requireAuth(sessionToken: string | undefined): Promise<AuthSession> {
  if (!sessionToken) {
    throw new Error('No session token provided')
  }

  const session = await getValidSession(sessionToken)
  if (!session) {
    throw new Error('Invalid or expired session')
  }

  return session
}