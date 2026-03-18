import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import {
  getSequence,
  pauseSequence,
  resumeSequence,
  cancelSequence,
  deleteSequence,
} from '@/lib/email-sequences'

export const dynamic = 'force-dynamic'

/**
 * GET /api/email/sequences/[id]
 * Get a single sequence by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiUser(request)
    const { id } = await params
    const sequence = await getSequence(id)

    if (!sequence) {
      return NextResponse.json(
        { success: false, error: 'Sequence not found' },
        { status: 404 }
      )
    }

    // Ensure the user owns this sequence
    if (sequence.repEmail !== ctx.email) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, data: sequence })
  } catch (error) {
    console.error('Sequence GET error:', error)
    return apiErrorResponse(error, 'Failed to fetch sequence')
  }
}

/**
 * PATCH /api/email/sequences/[id]
 * Update sequence status: pause, resume, or cancel.
 * Body: { action: 'pause' | 'resume' | 'cancel' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiUser(request)
    const { id } = await params
    const existing = await getSequence(id)

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Sequence not found' },
        { status: 404 }
      )
    }

    if (existing.repEmail !== ctx.email) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action } = body as { action?: string }

    let updated
    switch (action) {
      case 'pause':
        updated = await pauseSequence(id)
        break
      case 'resume':
        updated = await resumeSequence(id)
        break
      case 'cancel':
        updated = await cancelSequence(id)
        break
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: pause, resume, or cancel' },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Sequence PATCH error:', error)
    return apiErrorResponse(error, 'Failed to update sequence')
  }
}

/**
 * DELETE /api/email/sequences/[id]
 * Cancel and delete a sequence permanently.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiUser(request)
    const { id } = await params
    const existing = await getSequence(id)

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Sequence not found' },
        { status: 404 }
      )
    }

    if (existing.repEmail !== ctx.email) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    await deleteSequence(id)

    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    console.error('Sequence DELETE error:', error)
    return apiErrorResponse(error, 'Failed to delete sequence')
  }
}
