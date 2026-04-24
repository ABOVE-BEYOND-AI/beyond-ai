import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, getUserInfo } from '@/lib/google-oauth-clean'
import { createSecureSession } from '@/lib/session-security'
import { createUser, getUser, updateUser, saveUserTokens } from '@/lib/redis-database'
import { checkLoginAllowed } from '@/lib/auth-allowlist'

export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'beyond_ai_oauth_state'

function denied(req: NextRequest, reason: string): NextResponse {
  const url = new URL('/auth/signin', req.url)
  url.searchParams.set('error', reason)
  const response = NextResponse.redirect(url)
  // Clear state cookie regardless of outcome
  response.cookies.set(STATE_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    if (error) {
      return denied(req, 'oauth_error')
    }

    if (!code || !state) {
      return denied(req, 'invalid_request')
    }

    // Verify the state cookie matches the state Google echoed back. This is
    // login-CSRF protection — without it, an attacker can stitch their OAuth
    // code to an unsuspecting user's session.
    const stateCookie = req.cookies.get(STATE_COOKIE)?.value
    if (!stateCookie || stateCookie !== state) {
      return denied(req, 'invalid_state')
    }

    const tokens = await exchangeCodeForTokens(code)
    const googleUser = await getUserInfo(tokens.access_token)

    // Allowlist check — verifies email_verified, ALLOWED_EMAILS / ALLOWED_DOMAINS
    // membership, and (for workspace domains) the `hd` claim.
    const decision = checkLoginAllowed({
      email: googleUser.email,
      emailVerified: googleUser.email_verified,
      hd: googleUser.hd,
    })
    if (!decision.allowed) {
      console.warn(`Sign-in rejected: ${decision.reason}`)
      return denied(req, decision.reason)
    }

    // Create or update user in database
    let user = await getUser(googleUser.email)
    if (!user) {
      user = await createUser({
        id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      })
    } else {
      user = await updateUser(googleUser.email, {
        name: googleUser.name,
        avatar_url: googleUser.picture,
      })
    }

    // Persist tokens in Redis only — never in cookies.
    if (tokens.refresh_token) {
      await saveUserTokens(googleUser.email, {
        google_refresh_token: tokens.refresh_token,
        google_access_token: tokens.access_token,
        google_token_expires_at: tokens.expires_at,
        google_scopes: tokens.scope,
      })
    } else {
      await saveUserTokens(googleUser.email, {
        google_access_token: tokens.access_token,
        google_token_expires_at: tokens.expires_at,
        google_scopes: tokens.scope,
      })
    }

    const sessionToken = await createSecureSession(googleUser.email)
    const isProduction = process.env.NODE_ENV === 'production'

    const response = NextResponse.redirect(new URL('/', req.url))

    // Auth cookie — httpOnly, signed, contains no secrets
    response.cookies.set('beyond_ai_session', sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24h — matches SESSION_EXPIRY_MS in session-security.ts
      path: '/',
    })

    // Display cookie — non-httpOnly, only public profile data for client-side UI
    const displayData = btoa(JSON.stringify({
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
    }))
    response.cookies.set('beyond_ai_user', displayData, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })

    // Single-use state cookie — clear it now that we've validated
    response.cookies.set(STATE_COOKIE, '', { path: '/', maxAge: 0 })

    return response
  } catch (err) {
    console.error('OAuth callback error:', err instanceof Error ? err.message : 'unknown')
    return denied(req, 'auth_failed')
  }
}
