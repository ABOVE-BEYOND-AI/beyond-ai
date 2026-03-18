import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { decodeSession } from '@/lib/google-oauth-clean'
import { setChaseStage, CHASE_STAGES } from '@/lib/xero'
import type { ChaseStageKey } from '@/lib/types'

export const dynamic = 'force-dynamic'

// PUT /api/xero/invoices/[id]/stage — Update chase stage
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiUser(request)
    const { id } = await params
    const body = await request.json()
    const { stage } = body as { stage: ChaseStageKey }

    if (!stage || !CHASE_STAGES.find(s => s.key === stage)) {
      return NextResponse.json({ error: 'Invalid chase stage' }, { status: 400 })
    }

    const session = decodeSession(request.cookies.get('beyond_ai_session')?.value || '')
    const userEmail = session?.user?.email || 'unknown'

    await setChaseStage(id, stage, userEmail)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Chase stage update error:', error)
    return apiErrorResponse(error, 'Failed to update chase stage')
  }
}
