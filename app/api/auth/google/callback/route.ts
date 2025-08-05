import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCodeForTokens, getUserInfo } from '@/lib/google-auth'
import { createSession, getSessionCookieOptions, COOKIE_NAME } from '@/lib/auth-utils'
import { createUser, getUser } from '@/lib/redis-database'

export async function POST(req: NextRequest) {
  try {
    console.log('🔄 Google Auth API: Processing callback...')
    
    const { code } = await req.json()
    
    if (!code) {
      console.error('❌ Google Auth API: No code provided')
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      )
    }

    console.log('🔄 Google Auth API: Exchanging code for tokens...')
    
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)
    
    console.log('✅ Google Auth API: Tokens received, getting user info...')
    
    // Get user info from Google
    const googleUser = await getUserInfo(tokens.access_token)
    
    console.log('✅ Google Auth API: User info received for:', googleUser.email)
    
    // Check if user exists in our database
    let user = await getUser(googleUser.email)
    
    if (!user) {
      console.log('🆕 Google Auth API: Creating new user...')
      user = await createUser(googleUser)
    } else {
      console.log('👤 Google Auth API: Existing user found')
    }
    
    // Create session
    const sessionToken = await createSession(googleUser, tokens)
    
    console.log('🍪 Google Auth API: Setting session cookie...')
    
    // Set session cookie
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, sessionToken, getSessionCookieOptions())
    
    console.log('🎉 Google Auth API: Authentication complete!')
    
    return NextResponse.json({
      success: true,
      user: {
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      },
    })
    
  } catch (error) {
    console.error('❌ Google Auth API: Error during authentication:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Authentication failed',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}