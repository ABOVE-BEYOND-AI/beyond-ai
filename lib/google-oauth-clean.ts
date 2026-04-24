// Google OAuth implementation.
// All sign-in begins server-side at /api/auth/google so we can attach a
// state cookie before redirecting to Google (CSRF protection on OAuth login).
import { GoogleTokens } from './types'

export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: {
    development: 'http://localhost:3000/api/auth/google/callback-clean',
    production: 'https://beyond-ai-zeta.vercel.app/api/auth/google/callback-clean',
  },
  scopes: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/presentations',
  ],
}

export function getRedirectUri(): string {
  const isDevelopment = process.env.NODE_ENV === 'development'
  return isDevelopment
    ? GOOGLE_OAUTH_CONFIG.redirectUri.development
    : GOOGLE_OAUTH_CONFIG.redirectUri.production
}

export interface GoogleAuthUrlOptions {
  state: string
  hd?: string
  loginHint?: string
}

export function getGoogleAuthUrl(options: GoogleAuthUrlOptions): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CONFIG.clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: GOOGLE_OAUTH_CONFIG.scopes.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    state: options.state,
  })

  if (options.hd) params.set('hd', options.hd)
  if (options.loginHint) params.set('login_hint', options.loginHint)

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_OAUTH_CONFIG.clientId,
      client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`)
  }

  const tokens = await response.json()

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : undefined,
    token_type: tokens.token_type || 'Bearer',
    scope: tokens.scope || GOOGLE_OAUTH_CONFIG.scopes.join(' '),
  }
}

// Verified user info — captures email_verified and hd (hosted domain) so the
// caller can enforce workspace membership and reject unverified emails.
export interface VerifiedGoogleUser {
  id: string
  email: string
  name: string
  picture: string
  email_verified: boolean
  hd?: string
}

export async function getUserInfo(accessToken: string): Promise<VerifiedGoogleUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to get user info: ${response.status}`)
  }

  const userInfo = await response.json() as {
    sub: string
    email: string
    email_verified?: boolean
    name?: string
    picture?: string
    hd?: string
  }

  return {
    id: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name || '',
    picture: userInfo.picture || '',
    email_verified: userInfo.email_verified === true,
    hd: userInfo.hd,
  }
}

// Validate an access token by calling Google's tokeninfo endpoint.
export async function validateAccessToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    )
    return response.ok
  } catch {
    return false
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CONFIG.clientId,
      client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`)
  }

  const tokens = await response.json()

  return {
    access_token: tokens.access_token,
    refresh_token: refreshToken,
    expires_at: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : undefined,
    token_type: tokens.token_type || 'Bearer',
    scope: tokens.scope || GOOGLE_OAUTH_CONFIG.scopes.join(' '),
  }
}
