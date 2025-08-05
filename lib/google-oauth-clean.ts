// Clean Google OAuth implementation using standard web APIs
import { GoogleUser, GoogleTokens } from './types'

// Google OAuth configuration
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

// Generate Google OAuth URL (standard approach)
export function getGoogleAuthUrl(): string {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const redirectUri = isDevelopment 
    ? GOOGLE_OAUTH_CONFIG.redirectUri.development 
    : GOOGLE_OAUTH_CONFIG.redirectUri.production

  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CONFIG.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_OAUTH_CONFIG.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

// Exchange authorization code for tokens (server-side)
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const redirectUri = isDevelopment 
    ? GOOGLE_OAUTH_CONFIG.redirectUri.development 
    : GOOGLE_OAUTH_CONFIG.redirectUri.production

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_OAUTH_CONFIG.clientId,
      client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Token exchange failed:', error)
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

// Get user info from Google API
export async function getUserInfo(accessToken: string): Promise<GoogleUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get user info: ${response.status}`)
  }

  const userInfo = await response.json()
  
  return {
    id: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    verified_email: userInfo.email_verified,
  }
}

// Simple session management using standard web APIs
export interface UserSession {
  user: GoogleUser
  tokens: GoogleTokens
  created_at: number
}

// Encode session (server-side only - uses Buffer)
export function encodeSession(session: UserSession): string {
  return Buffer.from(JSON.stringify(session)).toString('base64')
}

// Decode session (browser-safe - uses atob)
export function decodeSession(sessionToken: string): UserSession | null {
  try {
    // Use standard web API - works everywhere
    const sessionData = atob(sessionToken)
    return JSON.parse(sessionData) as UserSession
  } catch (error) {
    console.error('Failed to decode session:', error)
    return null
  }
}

// Validate access token with Google
export async function validateAccessToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`)
    return response.ok
  } catch {
    return false
  }
}