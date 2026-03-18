import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceUser, apiErrorResponse, validateUUID, checkRateLimit, validateCsrf } from '@/lib/api-auth'
import { setChaseStage, CHASE_STAGES } from '@/lib/xero'
import type { ChaseStageKey } from '@/lib/types'

export const dynamic = 'force-dynamic'

// PUT /api/xero/invoices/[id]/stage — Update chase stage
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    validateCsrf(request)
    const ctx = await requireFinanceUser(request)
    await checkRateLimit(ctx.email)

    const { id } = await params
    validateUUID(id, 'Invoice ID')

    const body = await request.json()
    const { stage } = body as { stage: ChaseStageKey }

    if (!stage || !CHASE_STAGES.find(s => s.key === stage)) {
      return NextResponse.json({ error: 'Invalid chase stage' }, { status: 400 })
    }

    await setChaseStage(id, stage, ctx.email)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Chase stage update error:', error instanceof Error ? error.message : error)
    return apiErrorResponse(error, 'Failed to update chase stage')
  }
}
