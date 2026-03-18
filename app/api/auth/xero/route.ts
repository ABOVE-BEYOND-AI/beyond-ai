import { NextRequest, NextResponse } from 'next/server'
import { decodeSession } from '@/lib/google-oauth-clean'
import { getXeroAuthUrl } from '@/lib/xero'

// GET /api/auth/xero — Initiate Xero OAuth flow (admin only)
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('beyond_ai_session')
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = decodeSession(sessionCookie.value)
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const authUrl = getXeroAuthUrl(session.user.email)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Error initiating Xero OAuth:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
