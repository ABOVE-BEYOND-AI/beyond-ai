import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/google-oauth-clean'

export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'beyond_ai_oauth_state'
const STATE_MAX_AGE_SECONDS = 10 * 60 // 10 minutes

/**
 * GET /api/auth/google
 *
 * Initiates the Google OAuth flow. Mints a random `state` value, sets it in a
 * short-lived httpOnly cookie, and redirects the user to Google. The callback
 * compares the cookie against the `state` returned by Google to defend against
 * login-CSRF.
 */
export async function GET(_req: NextRequest) {
  const state = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '')
  const isProduction = process.env.NODE_ENV === 'production'

  const hd = process.env.GOOGLE_OAUTH_HD || undefined

  const url = getGoogleAuthUrl({ state, hd })

  const response = NextResponse.redirect(url)
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: STATE_MAX_AGE_SECONDS,
    path: '/',
  })

  return response
}
