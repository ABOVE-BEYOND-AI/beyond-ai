import { NextRequest, NextResponse } from 'next/server'
import { decodeSession } from '@/lib/google-oauth-clean'
import { refreshAccessToken } from '@/lib/google-oauth-clean'
import { getUserTokens, saveUserTokens } from '@/lib/redis-database'
import { sendEmail } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

/**
 * POST /api/email/send
 * Send a single email via Gmail on behalf of the authenticated user.
 * Body: { to: string, subject: string, body: string }
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth: extract session from cookie ──
    const sessionCookie = request.cookies.get('beyond_ai_session')
    if (!sessionCookie?.value) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const session = decodeSession(sessionCookie.value)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      )
    }

    const email = session.user.email

    // ── Get a valid access token ──
    let accessToken = session.tokens.access_token
    const isExpired = session.tokens.expires_at && Date.now() > session.tokens.expires_at

    if (isExpired) {
      // Try to refresh
      let refreshToken = session.tokens.refresh_token
      if (!refreshToken) {
        const stored = await getUserTokens(email)
        refreshToken = stored?.google_refresh_token
      }

      if (!refreshToken) {
        return NextResponse.json(
          { success: false, error: 'Token expired — please sign in again' },
          { status: 401 }
        )
      }

      const refreshed = await refreshAccessToken(refreshToken)
      accessToken = refreshed.access_token

      await saveUserTokens(email, {
        google_access_token: refreshed.access_token,
        google_token_expires_at: refreshed.expires_at,
        google_refresh_token: refreshToken,
      })
    }

    // ── Parse body ──
    const body = await request.json()
    const { to, subject, body: htmlBody } = body as {
      to?: string
      subject?: string
      body?: string
    }

    if (!to || !subject || !htmlBody) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      )
    }

    // ── Send ──
    const result = await sendEmail(accessToken, { to, subject, htmlBody })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Email send API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send email',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    )
  }
}
