import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { getLushaKey, enrichPerson } from '@/lib/lusha'

export const dynamic = 'force-dynamic'

/** POST /api/lusha/enrich — Enrich a person using the current user's stored Lusha API key */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireApiUser(request)

    const apiKey = await getLushaKey(ctx.email)
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Lusha not connected. Please add your Lusha API key in settings.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { firstName, lastName, company } = body as {
      firstName?: string
      lastName?: string
      company?: string
    }

    if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'firstName is required' },
        { status: 400 }
      )
    }

    if (!lastName || typeof lastName !== 'string' || lastName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'lastName is required' },
        { status: 400 }
      )
    }

    const result = await enrichPerson(apiKey, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      company: company?.trim(),
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Lusha enrich error:', error)
    return apiErrorResponse(error, 'Failed to enrich person')
  }
}
