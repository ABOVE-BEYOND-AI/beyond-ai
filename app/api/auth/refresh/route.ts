import { NextRequest, NextResponse } from 'next/server'
import { decodeSession, encodeSession, UserSession } from '@/lib/google-oauth-clean'
import { refreshAccessToken } from '@/lib/google-oauth-clean'
import { getUserTokens, saveUserTokens } from '@/lib/redis-database'

export async function POST(req: NextRequest) {
  try {
    // Get the session cookie
    const sessionCookie = req.cookies.get('beyond_ai_session')
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'No session' }, { status: 401 })
    }

    const session = decodeSession(sessionCookie.value)
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const email = session.user.email

    // Check if the current access token is still valid (has > 5 min left)
    if (session.tokens.expires_at && (session.tokens.expires_at - Date.now()) > 5 * 60 * 1000) {
      return NextResponse.json({
        refreshed: false,
        message: 'Token still valid',
        expires_at: session.tokens.expires_at,
      })
    }

    // Get the stored refresh token
    let refreshToken = session.tokens.refresh_token

    // If no refresh token in session, check persistent storage
    if (!refreshToken) {
      const storedTokens = await getUserTokens(email)
      refreshToken = storedTokens?.google_refresh_token
    }

    if (!refreshToken) {
      return NextResponse.json({
        error: 'No refresh token available. User needs to re-authenticate.',
        requireReauth: true,
      }, { status: 401 })
    }

    console.log('🔄 Token Refresh: Refreshing access token for', email)

    // Refresh the token with Google
    const newTokens = await refreshAccessToken(refreshToken)

    console.log('✅ Token Refresh: New access token obtained')

    // Update persistent token storage
    await saveUserTokens(email, {
      google_access_token: newTokens.access_token,
      google_token_expires_at: newTokens.expires_at,
      google_refresh_token: refreshToken, // Preserve the refresh token
    })

    // Create new session with updated tokens
    const updatedSession: UserSession = {
      ...session,
      tokens: {
        ...newTokens,
        refresh_token: refreshToken, // Always keep the refresh token
      },
    }

    const newSessionToken = encodeSession(updatedSession)

    // Return the new token info and set updated cookie
    const response = NextResponse.json({
      refreshed: true,
      expires_at: newTokens.expires_at,
      access_token: newTokens.access_token,
    })

    response.cookies.set('beyond_ai_session', newSessionToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response

  } catch (error) {
    console.error('❌ Token Refresh: Failed:', error)
    return NextResponse.json({
      error: 'Token refresh failed',
      requireReauth: true,
    }, { status: 401 })
  }
}
