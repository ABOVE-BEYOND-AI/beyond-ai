import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import crypto from 'crypto'

const redis = Redis.fromEnv()

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
    
    // Store the PKCE data temporarily in Redis (expires in 10 minutes)
    const pkceKey = `canva_pkce:${userId}`
    const pkceData = {
      codeVerifier,
      state,
      userId,
      expires_at: Date.now() + 10 * 60 * 1000 // 10 minutes
    }

    try {
      await redis.set(pkceKey, pkceData, { ex: 600 }) // 10 minutes expiry
    } catch (error) {
      console.error('Error storing PKCE data:', error)
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