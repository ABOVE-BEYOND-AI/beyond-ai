import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Generate state parameter for CSRF protection
    const state = crypto.randomUUID()
    
    // Store state temporarily (you might want to use a more robust storage)
    // For now, we'll include it in the redirect and verify on callback
    
    const canvaAuthUrl = new URL('https://www.canva.com/api/oauth/authorize')
    canvaAuthUrl.searchParams.append('client_id', process.env.CANVA_CLIENT_ID!)
    canvaAuthUrl.searchParams.append('redirect_uri', process.env.CANVA_REDIRECT_URI!)
    canvaAuthUrl.searchParams.append('response_type', 'code')
    canvaAuthUrl.searchParams.append('scope', 'design:content:write asset:read')
    canvaAuthUrl.searchParams.append('state', `${state}:${userId}`)

    return NextResponse.redirect(canvaAuthUrl.toString())
  } catch (error) {
    console.error('Error initiating Canva OAuth:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}