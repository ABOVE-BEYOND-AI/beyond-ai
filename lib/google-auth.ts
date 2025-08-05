// Google OAuth utilities for direct authentication
import { GoogleUser, GoogleTokens } from './types'

// Google OAuth configuration
export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: {
    development: 'http://localhost:3000/auth/google/callback',
    production: 'https://beyond-ai-zeta.vercel.app/auth/google/callback',
  },
  scopes: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/presentations',
  ],
}

// Generate Google OAuth URL
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

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const redirectUri = isDevelopment 
    ? GOOGLE_OAUTH_CONFIG.redirectUri.development 
    : GOOGLE_OAUTH_CONFIG.redirectUri.production

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CONFIG.clientId,
      client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const tokens = await tokenResponse.json()

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
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!userResponse.ok) {
    const error = await userResponse.text()
    throw new Error(`Failed to get user info: ${error}`)
  }

  const userData = await userResponse.json()

  return {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    picture: userData.picture,
    given_name: userData.given_name,
    family_name: userData.family_name,
  }
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CONFIG.clientId,
      client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!refreshResponse.ok) {
    const error = await refreshResponse.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  const tokens = await refreshResponse.json()

  return {
    access_token: tokens.access_token,
    refresh_token: refreshToken, // Keep the original refresh token
    expires_at: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : undefined,
    token_type: tokens.token_type || 'Bearer',
    scope: tokens.scope || GOOGLE_OAUTH_CONFIG.scopes.join(' '),
  }
}

// Validate access token
export async function validateAccessToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`)
    return response.ok
  } catch {
    return false
  }
}