import { NextRequest, NextResponse } from 'next/server'
import { validateOAuthState, exchangeCodeForTokens, saveOrgTokens } from '@/lib/xero'

// GET /api/auth/xero/callback — Handle Xero OAuth callback
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('Xero OAuth error:', error)
      return NextResponse.redirect(new URL('/settings?xero_error=oauth_denied', request.url))
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/settings?xero_error=missing_params', request.url))
    }

    // Validate CSRF state
    const stateData = await validateOAuthState(state)
    if (!stateData) {
      return NextResponse.redirect(new URL('/settings?xero_error=invalid_state', request.url))
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)
    tokens.connected_by = stateData.email

    // Save org-wide tokens
    await saveOrgTokens(tokens)

    return NextResponse.redirect(new URL('/settings?xero_connected=true', request.url))
  } catch (error) {
    console.error('Error in Xero OAuth callback:', error)
    return NextResponse.redirect(new URL('/settings?xero_error=callback_failed', request.url))
  }
}
