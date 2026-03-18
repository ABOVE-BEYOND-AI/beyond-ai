import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { getLushaKey, checkCredits } from '@/lib/lusha'

export const dynamic = 'force-dynamic'

/** GET /api/lusha/credits — Check remaining Lusha credits for the current user */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireApiUser(request)

    const apiKey = await getLushaKey(ctx.email)
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        data: { credits: 0, connected: false },
      })
    }

    const result = await checkCredits(apiKey)

    return NextResponse.json({
      success: true,
      data: { credits: result.credits, connected: true },
    })
  } catch (error) {
    console.error('Lusha credits error:', error)

    const message = error instanceof Error ? error.message : ''
    if (message.includes('401') || message.includes('403')) {
      return NextResponse.json({
        success: true,
        data: { credits: 0, connected: false },
      })
    }

    return apiErrorResponse(error, 'Failed to check Lusha credits')
  }
}
