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
import { SalesDashboardData, SalesRep } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Sales Data API: Fetching dashboard data...')
    
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || getCurrentMonth()
    
    // Get current and previous month data
    const currentMonth = getCurrentMonth()
    const previousMonth = getPreviousMonth()
    
    console.log('📊 Fetching data for months:', { currentMonth, previousMonth })
    
    // Fetch all required data in parallel
    const [
      currentMonthStats,
      previousMonthStats,
      recentDeals,
      leaderboard,
      monthlyTarget
    ] = await Promise.all([
      getMonthlySalesStats(currentMonth),
      getMonthlySalesStats(previousMonth),
      getDeals(10, 0), // Get 10 most recent deals
      getMonthlyLeaderboard(currentMonth),
      getMonthlyTarget(currentMonth)
    ])

    // Calculate progress percentage
    const progressPercentage = monthlyTarget > 0 && currentMonthStats 
      ? Math.round((currentMonthStats.total_amount / monthlyTarget) * 100)
      : 0

    // Prepare dashboard data
    const dashboardData: SalesDashboardData = {
      current_month: currentMonthStats || {
        month: currentMonth,
        total_deals: 0,
        total_amount: 0,
        target_amount: monthlyTarget,
        completion_percentage: 0,
        top_reps: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      previous_month: previousMonthStats || undefined,
      recent_deals: recentDeals,
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
    console.log('🔄 Sales Data API: Manual deal submission...')
    
    const body = await request.json()
    const { rep_name, rep_email, deal_name, amount, currency = 'GBP' } = body

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
      amount: typeof amount === 'string' ? parseFloat(amount) * 100 : amount * 100, // Convert to pence
      currency,
      source: 'manual' as const,
      slack_channel_id: undefined,
      slack_message_url: undefined
    }

    const dealId = await saveDeal(dealData)

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