import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { storeLushaKey, getLushaKey, deleteLushaKey } from '@/lib/lusha'

export const dynamic = 'force-dynamic'

/** POST /api/lusha/connect — Save user's personal Lusha API key */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireApiUser(request)

    const body = await request.json()
    const { apiKey } = body as { apiKey?: string }

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      )
    }

    await storeLushaKey(ctx.email, apiKey.trim())

    return NextResponse.json({
      success: true,
      data: { connected: true, email: ctx.email },
    })
  } catch (error) {
    console.error('Lusha connect error:', error)
    return apiErrorResponse(error, 'Failed to save Lusha API key')
  }
}

/** DELETE /api/lusha/connect — Disconnect (remove stored Lusha API key) */
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requireApiUser(request)

    const existingKey = await getLushaKey(ctx.email)
    if (!existingKey) {
      return NextResponse.json(
        { success: false, error: 'No Lusha API key found for this user' },
        { status: 404 }
      )
    }

    await deleteLushaKey(ctx.email)

    return NextResponse.json({
      success: true,
      data: { connected: false, email: ctx.email },
    })
  } catch (error) {
    console.error('Lusha disconnect error:', error)
    return apiErrorResponse(error, 'Failed to remove Lusha API key')
  }
}
