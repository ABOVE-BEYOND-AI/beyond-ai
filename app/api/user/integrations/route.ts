import { NextRequest, NextResponse } from 'next/server'
import { decodeSession } from '@/lib/google-oauth-clean'
import { getUserTokens, getUser } from '@/lib/redis-database'
import { Redis } from '@upstash/redis'
import { Integration } from '@/lib/types'
import { getOrgTokens } from '@/lib/xero'

const redis = Redis.fromEnv()

// GET /api/user/integrations — Get current user's connected integrations
export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('beyond_ai_session')
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = decodeSession(sessionCookie.value)
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const email = session.user.email
    const user = await getUser(email)
    const tokens = await getUserTokens(email)

    // Check Canva tokens
    const canvaTokens = await redis.get(`canva_token:${email}`) as {
      access_token?: string
      refresh_token?: string
      expires_at?: string
      scope?: string
    } | null

    // Check Xero org-wide tokens
    const xeroTokens = await getOrgTokens()

    const integrations: Integration[] = [
      {
        service: 'google',
        connected: !!(tokens?.google_refresh_token),
        email: email,
        scopes: tokens?.google_scopes?.split(' ') || [],
        connected_at: user?.created_at,
        expires_at: tokens?.google_token_expires_at,
      },
      {
        service: 'canva',
        connected: !!canvaTokens,
        scopes: canvaTokens?.scope?.split(' ') || [],
        expires_at: canvaTokens?.expires_at ? new Date(canvaTokens.expires_at).getTime() : undefined,
      },
      {
        service: 'xero',
        connected: !!xeroTokens?.refresh_token,
        email: xeroTokens?.connected_by,
        connected_at: xeroTokens?.connected_at,
        expires_at: xeroTokens?.expires_at,
        scopes: ['accounting.invoices', 'accounting.payments', 'accounting.contacts', 'accounting.settings'],
      },
    ]

    return NextResponse.json({
      integrations,
      user: user ? { email: user.email, name: user.name, avatar_url: user.avatar_url, role: user.role } : null,
    })
  } catch (error) {
    console.error('Failed to get integrations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
