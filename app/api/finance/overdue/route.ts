import { NextRequest, NextResponse } from 'next/server'
import { getAccountFinancials } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    // weeksLimit is accepted as a param but since we query account-level rollups
    // (not individual invoices), we can't filter by date range on the rollup field.
    // It's kept for API compatibility if invoice-level filtering is added later.
    const _weeksLimit = Number(searchParams.get('weeksLimit')) || 16

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
    return NextResponse.json(
      { success: false, error: 'Failed to fetch overdue accounts', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
