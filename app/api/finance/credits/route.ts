import { NextRequest, NextResponse } from 'next/server'
import { getCreditAccounts } from '@/lib/salesforce'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)
    const creditAccounts = await getCreditAccounts()

    return NextResponse.json({
      success: true,
      data: creditAccounts,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Credits API error:', error)
    return apiErrorResponse(error, 'Failed to fetch credit accounts')
  }
}
