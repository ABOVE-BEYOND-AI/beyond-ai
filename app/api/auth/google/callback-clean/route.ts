import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, getUserInfo, encodeSession, UserSession } from '@/lib/google-oauth-clean'

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
    const user = await getUserInfo(tokens.access_token)
    
    console.log('✅ OAuth Callback: User info received for:', user.email)
    
    // Create session
    const session: UserSession = {
      user,
      tokens,
      created_at: Date.now(),
    }
    
    // Encode session using standard base64
    const sessionToken = encodeSession(session)
    
    console.log('🍪 OAuth Callback: Setting session cookie...')
    
    // Create response with redirect
    const response = NextResponse.redirect(new URL('/itinerary', req.url))
    
    // Set session cookie (NOT httpOnly so client can read it)
    response.cookies.set('beyond_ai_session', sessionToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
    
    console.log('🎉 OAuth Callback: Authentication complete!')
    
    return response
    
  } catch (error) {
    console.error('❌ OAuth Callback: Error during authentication:', error)
    
    return NextResponse.redirect(
      new URL(`/auth/signin?error=auth_failed`, req.url)
    )
  }
}