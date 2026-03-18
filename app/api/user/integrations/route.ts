import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { getUserTokens } from '@/lib/redis-database'
import { Redis } from '@upstash/redis'
import { Integration } from '@/lib/types'
import { getOrgTokens } from '@/lib/xero'

const redis = Redis.fromEnv()

// GET /api/user/integrations — Get current user's connected integrations
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireApiUser(req)
    const email = ctx.email
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
        connected_at: ctx.user.created_at,
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
      user: { email: ctx.user.email, name: ctx.user.name, avatar_url: ctx.user.avatar_url, role: ctx.user.role },
    })
  } catch (error) {
    console.error('Failed to get integrations:', error)
    return apiErrorResponse(error, 'Internal server error')
  }
}
