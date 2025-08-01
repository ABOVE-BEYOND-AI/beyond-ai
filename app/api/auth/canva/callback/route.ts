import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

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

    if (!code || !state) {
      return NextResponse.redirect(new URL('/itinerary?error=missing_params', request.url))
    }

    // Extract user ID from state
    const [stateToken, userId] = state.split(':')
    if (!userId) {
      return NextResponse.redirect(new URL('/itinerary?error=invalid_state', request.url))
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.CANVA_CLIENT_ID!,
        client_secret: process.env.CANVA_CLIENT_SECRET!,
        redirect_uri: process.env.CANVA_REDIRECT_URI!,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(new URL('/itinerary?error=token_exchange_failed', request.url))
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token, expires_in, scope } = tokenData

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expires_in * 1000)

    // Store tokens in database
    const { error: dbError } = await supabase
      .from('canva_tokens')
      .upsert({
        user_id: userId,
        access_token,
        refresh_token,
        expires_at: expiresAt.toISOString(),
        scope,
      }, {
        onConflict: 'user_id'
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.redirect(new URL('/itinerary?error=db_error', request.url))
    }

    // Redirect back to itinerary page with success
    return NextResponse.redirect(new URL('/itinerary?canva_connected=true', request.url))
  } catch (error) {
    console.error('Error in Canva OAuth callback:', error)
    return NextResponse.redirect(new URL('/itinerary?error=callback_error', request.url))
  }
}