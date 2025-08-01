import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Generate PKCE code verifier and challenge (required by Canva)
    const codeVerifier = crypto.randomBytes(96).toString('base64url')
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url')

    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(96).toString('base64url')
    
    // Store code_verifier and state in database temporarily
    // We'll retrieve these in the callback
    await supabase
      .from('users')
      .upsert({
        id: userId,
        email: null,
      })

    // Store the PKCE data temporarily (expires in 10 minutes)
    const { error: storeError } = await supabase
      .from('canva_tokens')
      .upsert({
        user_id: userId,
        access_token: `temp_verifier:${codeVerifier}`, // Temporary storage
        refresh_token: `temp_state:${state}`,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        scope: 'pending',
      }, {
        onConflict: 'user_id'
      })

    if (storeError) {
      console.error('Error storing PKCE data:', storeError)
      return NextResponse.json({ error: 'Failed to store session data' }, { status: 500 })
    }
    
    const canvaAuthUrl = new URL('https://www.canva.com/api/oauth/authorize')
    canvaAuthUrl.searchParams.append('client_id', process.env.CANVA_CLIENT_ID!)
    canvaAuthUrl.searchParams.append('redirect_uri', process.env.CANVA_REDIRECT_URI!)
    canvaAuthUrl.searchParams.append('response_type', 'code')
    canvaAuthUrl.searchParams.append('scope', 'design:content:write asset:read')
    canvaAuthUrl.searchParams.append('code_challenge', codeChallenge)
    canvaAuthUrl.searchParams.append('code_challenge_method', 'S256')
    canvaAuthUrl.searchParams.append('state', `${state}:${userId}`)

    return NextResponse.redirect(canvaAuthUrl.toString())
  } catch (error) {
    console.error('Error initiating Canva OAuth:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}