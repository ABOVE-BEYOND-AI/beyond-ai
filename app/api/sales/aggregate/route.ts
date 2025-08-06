import { NextRequest, NextResponse } from 'next/server'
import {
  getDeals,
  saveMonthlySalesStats,
  saveMonthlyLeaderboard,
  getMonthlySalesStats,
  getMonthlyLeaderboard
} from '@/lib/sales-database'
import { SalesRep } from '@/lib/types'

function getMonthFromDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const monthParam = searchParams.get('month') || getMonthFromDate(new Date())

  try {
    const allDeals = await getDeals(1000) // arbitrary large number
    const monthDeals = allDeals.filter((d) => d.created_at.startsWith(monthParam))

    const total_amount = monthDeals.reduce((sum, d) => sum + d.amount, 0)
    const total_deals = monthDeals.length

    // Aggregate by rep
    const repMap: Record<string, SalesRep> = {}
    monthDeals.forEach((deal) => {
      const key = deal.rep_email
      if (!repMap[key]) {
        repMap[key] = {
          email: deal.rep_email,
          name: deal.rep_name,
          total_deals: 0,
          total_amount: 0,
          monthly_deals: 0,
          monthly_amount: 0
        }
      }
      repMap[key].monthly_deals += 1
      repMap[key].monthly_amount += deal.amount
    })

    const leaderboard = Object.values(repMap)
      .sort((a, b) => b.monthly_amount - a.monthly_amount)
      .map((rep, idx) => ({ ...rep, rank: idx + 1 }))

    // Save stats & leaderboard
    await saveMonthlySalesStats({
      month: monthParam,
      total_deals,
      total_amount,
      target_amount: 0,
      completion_percentage: 0,
      top_reps: leaderboard.slice(0, 5),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    await saveMonthlyLeaderboard(monthParam, leaderboard)

    return NextResponse.json({ success: true, month: monthParam, total_deals, total_amount })
  } catch (err) {
    console.error('❌ Aggregate error', err)
    return NextResponse.json({ error: 'Failed to aggregate' }, { status: 500 })
  }
}
