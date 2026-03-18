import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, getUserInfo } from '@/lib/google-oauth-clean'
import { createSecureSession } from '@/lib/session-security'
import { createUser, getUser, updateUser, saveUserTokens } from '@/lib/redis-database'

export async function GET(req: NextRequest) {
  try {
    console.log('🔄 OAuth Callback: Processing Google OAuth response...')

    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      console.error('❌ OAuth Callback: OAuth error:', error)
      return NextResponse.redirect(new URL(`/auth/signin?error=${error}`, req.url))
    }

    if (!code) {
      console.error('❌ OAuth Callback: No authorization code received')
      return NextResponse.redirect(new URL('/auth/signin?error=no_code', req.url))
    }

    console.log('✅ OAuth Callback: Authorization code received, exchanging for tokens...')

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    console.log('✅ OAuth Callback: Tokens received, getting user info...')

    // Get user info from Google
    const googleUser = await getUserInfo(tokens.access_token)

    console.log('✅ OAuth Callback: User info received for:', googleUser.email)

    // Create or update user in database
    let user = await getUser(googleUser.email)
    if (!user) {
      console.log('🆕 OAuth Callback: Creating new user...')
      user = await createUser(googleUser)
    } else {
      // Update avatar/name in case they changed
      user = await updateUser(googleUser.email, {
        name: googleUser.name,
        avatar_url: googleUser.picture,
      })
    }

    // Persist tokens in Redis ONLY — never in cookies
    if (tokens.refresh_token) {
      console.log('🔑 OAuth Callback: Persisting refresh token...')
      await saveUserTokens(googleUser.email, {
        google_refresh_token: tokens.refresh_token,
        google_access_token: tokens.access_token,
        google_token_expires_at: tokens.expires_at,
        google_scopes: tokens.scope,
      })
    } else {
      console.log('🔑 OAuth Callback: Updating access token (no new refresh token)...')
      await saveUserTokens(googleUser.email, {
        google_access_token: tokens.access_token,
        google_token_expires_at: tokens.expires_at,
        google_scopes: tokens.scope,
      })
    }

    // Create signed session token (email + expiry only — NO tokens)
    const sessionToken = await createSecureSession(googleUser.email)

    console.log('🍪 OAuth Callback: Setting session cookies...')

    const response = NextResponse.redirect(new URL('/itinerary', req.url))
    const isProduction = process.env.NODE_ENV === 'production'

    // Auth cookie: httpOnly, signed, contains no secrets
    response.cookies.set('beyond_ai_session', sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    // Display cookie: NOT httpOnly, contains only public user info for client-side UI
    const displayData = btoa(JSON.stringify({
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
    }))
    response.cookies.set('beyond_ai_user', displayData, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    console.log('🎉 OAuth Callback: Authentication complete! Role:', user.role)

    return response

  } catch (error) {
    console.error('❌ OAuth Callback: Error during authentication:', error)

    return NextResponse.redirect(
      new URL(`/auth/signin?error=auth_failed`, req.url)
    )
  }
}
