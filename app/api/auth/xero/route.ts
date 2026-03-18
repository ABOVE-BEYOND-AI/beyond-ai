import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { getXeroAuthUrl } from '@/lib/xero'

// GET /api/auth/xero — Initiate Xero OAuth flow (admin only)
export async function GET(request: NextRequest) {
  try {
    // Only admins can connect/disconnect Xero — this is an org-wide operation
    const ctx = await requireApiAdmin(request)

    const authUrl = getXeroAuthUrl(ctx.email)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Error initiating Xero OAuth:', error)
    // If not admin, redirect to settings with error instead of JSON
    if (error instanceof Error && error.message.includes('admin')) {
      return NextResponse.redirect(new URL('/settings?xero_error=admin_required', request.url))
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
