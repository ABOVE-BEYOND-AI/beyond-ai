import { NextRequest, NextResponse } from 'next/server'
import { 
  getDeals, 
  getMonthlySalesStats, 
  getMonthlyLeaderboard,
  getCurrentMonth,
  getPreviousMonth,
  getMonthlyTarget,
  formatCurrency,
  saveDeal
} from '@/lib/sales-database'
import { SalesDashboardData } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Sales Data API: Fetching dashboard data...')
    
    const { searchParams } = new URL(request.url)
    // Month parameter for future use (currently using current/previous month)
    searchParams.get('month') // Available if needed in future
    
    // Get current and previous month data
    const currentMonth = getCurrentMonth()
    const previousMonth = getPreviousMonth()
    
    console.log('📊 Fetching data for months:', { currentMonth, previousMonth })
    
    // Fetch base data in parallel
    const [
      currentMonthStats,
      previousMonthStats,
      recentDeals,
      savedLeaderboard,
      monthlyTarget
    ] = await Promise.all([
      getMonthlySalesStats(currentMonth),
      getMonthlySalesStats(previousMonth),
      getDeals(50, 0), // Fetch more and slice below to 10
      getMonthlyLeaderboard(currentMonth),
      getMonthlyTarget(currentMonth)
    ])

    // If monthly stats are missing, compute on the fly from recent deals
    let computedCurrentMonthStats = currentMonthStats
    if (!computedCurrentMonthStats) {
      const monthDeals = recentDeals.filter(d => d.created_at.startsWith(currentMonth))
      const total_amount = monthDeals.reduce((sum, d) => sum + d.amount, 0)
      const total_deals = monthDeals.length
      computedCurrentMonthStats = {
        month: currentMonth,
        total_deals,
        total_amount,
        target_amount: monthlyTarget,
        completion_percentage: monthlyTarget > 0 ? Math.round((total_amount / monthlyTarget) * 100) : 0,
        top_reps: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }

    // If leaderboard is missing, compute from month deals
    let leaderboard = savedLeaderboard
    if (!leaderboard || leaderboard.length === 0) {
      const monthDeals = recentDeals.filter(d => d.created_at.startsWith(currentMonth))
      const repMap: Record<string, { name: string; email: string; monthly_deals: number; monthly_amount: number }> = {}
      for (const d of monthDeals) {
        const key = d.rep_name + '|' + (d.id || '')
        if (!repMap[d.rep_name]) {
          repMap[d.rep_name] = { name: d.rep_name, email: '', monthly_deals: 0, monthly_amount: 0 }
        }
        repMap[d.rep_name].monthly_deals += 1
        repMap[d.rep_name].monthly_amount += d.amount
      }
      leaderboard = Object.values(repMap)
        .sort((a, b) => b.monthly_amount - a.monthly_amount)
        .map((r, idx) => ({ ...r, total_amount: 0, total_deals: 0, rank: idx + 1 })) as any
    }

    // Calculate progress percentage
    const progressPercentage = monthlyTarget > 0 && computedCurrentMonthStats 
      ? Math.round((computedCurrentMonthStats.total_amount / monthlyTarget) * 100)
      : 0

    // Prepare dashboard data
    const dashboardData: SalesDashboardData = {
      current_month: computedCurrentMonthStats!,
      previous_month: previousMonthStats || undefined,
      recent_deals: recentDeals.slice(0, 10),
      leaderboard: leaderboard,
      monthly_target: monthlyTarget,
      progress_percentage: progressPercentage
    }

    console.log('✅ Sales Data API: Successfully fetched dashboard data')
    console.log(`📈 Current month: ${formatCurrency(dashboardData.current_month.total_amount)} / ${formatCurrency(monthlyTarget)} (${progressPercentage}%)`)

    return NextResponse.json({
      success: true,
      data: dashboardData
    })

  } catch (error) {
    console.error('❌ Sales Data API: Error fetching dashboard data:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch sales data',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}

// POST endpoint to manually add deals (for testing)
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Sales Data API: Manual deal submission (fixed)...')
    
    const body = await request.json()
    const { rep_name, rep_email, deal_name, amount, currency = 'GBP', created_at } = body

    if (!rep_name || !rep_email || !deal_name || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: rep_name, rep_email, deal_name, amount' },
        { status: 400 }
      )
    }

    // TODO: Add authentication check here
    // For now, we'll allow manual submissions for testing

    const dealData = {
      slack_ts: `manual_${Date.now()}`, // Unique identifier for manual deals
      rep_name,
      rep_email,
      deal_name,
      amount: typeof amount === 'string' ? parseFloat(amount) : amount, // Amount should already be in pence
      currency,
      source: 'manual' as const,
      slack_channel_id: undefined,
      slack_message_url: undefined
    }

    const dealId = await saveDeal(dealData, created_at)

    console.log(`✅ Manual deal created: ${dealId} for ${rep_name} - ${formatCurrency(dealData.amount)}`)

    return NextResponse.json({
      success: true,
      deal_id: dealId,
      message: `Deal saved successfully for ${rep_name}`
    })

  } catch (error) {
    console.error('❌ Sales Data API: Error creating manual deal:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to create deal',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}