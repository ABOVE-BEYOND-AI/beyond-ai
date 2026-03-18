import { NextRequest, NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { validateOAuthState, exchangeCodeForTokens, saveOrgTokens } from '@/lib/xero'

// GET /api/auth/xero/callback — Handle Xero OAuth callback
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify the user is authenticated and is the admin who initiated the flow
    const ctx = await getApiUser(request)
    if (!ctx) {
      return NextResponse.redirect(new URL('/settings?xero_error=not_authenticated', request.url))
    }

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

    // Validate CSRF state (atomic get-and-delete to prevent replay)
    const stateData = await validateOAuthState(state)
    if (!stateData) {
      return NextResponse.redirect(new URL('/settings?xero_error=invalid_state', request.url))
    }

    // SECURITY: Verify the logged-in user matches the admin who initiated the OAuth flow
    if (ctx.email.toLowerCase() !== stateData.email.toLowerCase()) {
      console.error(`Xero OAuth callback email mismatch: session=${ctx.email}, state=${stateData.email}`)
      return NextResponse.redirect(new URL('/settings?xero_error=email_mismatch', request.url))
    }

    // SECURITY: Verify the user is an admin (only admins can connect org-wide integrations)
    if (!ctx.isAdmin) {
      return NextResponse.redirect(new URL('/settings?xero_error=admin_required', request.url))
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)
    tokens.connected_by = stateData.email

    // Save org-wide tokens
    await saveOrgTokens(tokens)

    return NextResponse.redirect(new URL('/settings?xero_connected=true', request.url))
  } catch (error) {
    console.error('Error in Xero OAuth callback:', error instanceof Error ? error.message : error)
    return NextResponse.redirect(new URL('/settings?xero_error=callback_failed', request.url))
  }
}
