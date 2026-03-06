import { NextRequest, NextResponse } from 'next/server'
import { getAccountFinancials } from '@/lib/salesforce'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)
    // weeksLimit remains accepted for backwards compatibility, but the rollups
    // used here are not date-scoped, so the value is intentionally ignored.
    new URL(request.url).searchParams.get('weeksLimit')

    const accounts = await getAccountFinancials()

    // Filter to only accounts with overdue amounts
    const overdueAccounts = accounts
      .filter(acct => (acct.Bread_Winner__Total_Amount_Overdue__c ?? 0) > 0)
      .sort((a, b) =>
        (b.Bread_Winner__Total_Amount_Overdue__c ?? 0) - (a.Bread_Winner__Total_Amount_Overdue__c ?? 0)
      )

    return NextResponse.json({
      success: true,
      data: overdueAccounts,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240' },
    })
  } catch (error) {
    console.error('Overdue API error:', error)
    return apiErrorResponse(error, 'Failed to fetch overdue accounts')
  }
}
