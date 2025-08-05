import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('Canva OAuth error:', error)
      return NextResponse.redirect(new URL('/itinerary?error=oauth_failed', request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/itinerary?error=missing_code', request.url))
    }
    
    if (!state) {
      return NextResponse.redirect(new URL('/itinerary?error=missing_state', request.url))
    }

    // Extract user ID from state
    const [stateToken, userId] = state.split(':')
    if (!userId) {
      return NextResponse.redirect(new URL('/itinerary?error=invalid_state', request.url))
    }

    // Retrieve the stored PKCE data from Redis
    const pkceKey = `canva_pkce:${userId}`
    const storedData = await redis.get(pkceKey) as { codeVerifier: string; state: string; userId: string; expires_at: number } | null

    if (!storedData) {
      console.error('Failed to retrieve PKCE data - session expired')
      return NextResponse.redirect(new URL('/itinerary?error=session_expired', request.url))
    }

    // Extract code_verifier and state from storage
    const codeVerifier = storedData.codeVerifier
    const storedState = storedData.state

    // Verify state parameter
    if (stateToken !== storedState) {
      console.error('State mismatch - possible CSRF attack')
      return NextResponse.redirect(new URL('/itinerary?error=invalid_state', request.url))
    }

    // Exchange authorization code for access token using PKCE
    const credentials = Buffer.from(`${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`).toString('base64')
    
    const tokenResponse = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.CANVA_REDIRECT_URI!,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(new URL('/itinerary?error=token_exchange_failed', request.url))
    }

    const tokenResponse_data = await tokenResponse.json()
    const { access_token, refresh_token, expires_in, scope } = tokenResponse_data

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expires_in * 1000)

    // Store real tokens in Redis (replacing temporary PKCE data)
    const tokenKey = `canva_token:${userId}`
    const tokenData = {
      user_id: userId,
      access_token,
      refresh_token,
      expires_at: expiresAt.toISOString(),
      scope,
    }

    try {
      await redis.set(tokenKey, tokenData)
      // Clear the temporary PKCE data
      await redis.del(pkceKey)
    } catch (error) {
      console.error('Redis error:', error)
      return NextResponse.redirect(new URL('/itinerary?error=storage_error', request.url))
    }

    // Redirect back to itinerary page with success
    return NextResponse.redirect(new URL('/itinerary?canva_connected=true', request.url))
  } catch (error) {
    console.error('Error in Canva OAuth callback:', error)
    return NextResponse.redirect(new URL('/itinerary?error=callback_error', request.url))
  }
}