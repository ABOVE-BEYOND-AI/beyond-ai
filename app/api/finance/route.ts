import { NextResponse } from 'next/server'
import { getAccountFinancials, getPaymentPlanProgress, getCreditAccounts } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [accounts, paymentPlans, creditAccounts] = await Promise.all([
      getAccountFinancials(),
      getPaymentPlanProgress(),
      getCreditAccounts(),
    ])

    // Compute aggregates from account-level Breadwinner rollups
    let totalInvoiced = 0
    let totalPaid = 0
    let totalDue = 0
    let totalOverdue = 0
    let totalCredits = 0
    let totalDraft = 0

    for (const acct of accounts) {
      totalInvoiced += acct.Bread_Winner__Total_Amount_Invoiced__c ?? 0
      totalPaid += acct.Bread_Winner__Total_Amount_Paid__c ?? 0
      totalDue += acct.Bread_Winner__Total_Amount_Due__c ?? 0
      totalOverdue += acct.Bread_Winner__Total_Amount_Overdue__c ?? 0
      totalCredits += acct.Bread_Winner__Total_Unallocated_Credit__c ?? 0
      totalDraft += acct.Bread_Winner__Total_Draft_Amount__c ?? 0
    }

    const collectionRate = totalInvoiced > 0
      ? Math.round((totalPaid / totalInvoiced) * 10000) / 100
      : 0

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalInvoiced,
          totalPaid,
          totalDue,
          totalOverdue,
          totalCredits,
          totalDraft,
          collectionRate,
        },
        accounts,
        paymentPlans,
        creditAccounts,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240' },
    })
  } catch (error) {
    console.error('Finance API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch finance data', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
