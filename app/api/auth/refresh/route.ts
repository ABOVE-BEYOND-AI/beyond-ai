import { NextRequest, NextResponse } from 'next/server'
import { verifySecureSession, createSecureSession } from '@/lib/session-security'
import { getValidGoogleAccessToken } from '@/lib/google-tokens'
import { getUserTokens } from '@/lib/redis-database'

export async function POST(req: NextRequest) {
  try {
    // Read and verify the httpOnly session cookie
    const sessionCookie = req.cookies.get('beyond_ai_session')?.value
    if (!sessionCookie) {
      return NextResponse.json({ error: 'No session' }, { status: 401 })
    }

    const session = await verifySecureSession(sessionCookie)
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const email = session.email

    // Check if the stored access token is still valid (> 5 min left)
    const tokens = await getUserTokens(email)
    if (tokens?.google_token_expires_at && (tokens.google_token_expires_at - Date.now()) > 5 * 60 * 1000) {
      return NextResponse.json({
        refreshed: false,
        message: 'Token still valid',
        expires_at: tokens.google_token_expires_at,
        access_token: tokens.google_access_token,
      })
    }

    // Get a valid access token (refreshes automatically if expired)
    const accessToken = await getValidGoogleAccessToken(email)

    // Get updated expiry
    const updatedTokens = await getUserTokens(email)

    // Refresh the session cookie (extends expiry)
    const newSessionToken = await createSecureSession(email)
    const isProduction = process.env.NODE_ENV === 'production'

    const response = NextResponse.json({
      refreshed: true,
      expires_at: updatedTokens?.google_token_expires_at,
      access_token: accessToken,
    })

    response.cookies.set('beyond_ai_session', newSessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
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
