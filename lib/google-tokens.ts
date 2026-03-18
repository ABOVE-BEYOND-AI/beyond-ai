// Server-side Google token management
// Retrieves tokens from Redis (never from cookies) and refreshes when expired.

import { getUserTokens, saveUserTokens } from './redis-database'
import { refreshAccessToken } from './google-oauth-clean'

/**
 * Get a valid Google access token for the given user.
 * Tokens are stored in Redis, never in cookies.
 * Automatically refreshes if expired.
 */
export async function getValidGoogleAccessToken(email: string): Promise<string> {
  const tokens = await getUserTokens(email)
  if (!tokens?.google_access_token) {
    throw new Error('No Google access token. Please sign in again.')
  }

  // If not expired, return directly
  const isExpired = tokens.google_token_expires_at && Date.now() > tokens.google_token_expires_at
  if (!isExpired) {
    return tokens.google_access_token
  }

  // Need to refresh
  if (!tokens.google_refresh_token) {
    throw new Error('Google token expired and no refresh token available. Please sign in again.')
  }

  const refreshed = await refreshAccessToken(tokens.google_refresh_token)
  await saveUserTokens(email, {
    google_access_token: refreshed.access_token,
    google_token_expires_at: refreshed.expires_at,
    google_refresh_token: tokens.google_refresh_token,
  })
  return refreshed.access_token
}
