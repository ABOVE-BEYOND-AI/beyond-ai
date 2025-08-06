import { NextRequest, NextResponse } from 'next/server'
import { 
  getMonthlySalesStats, 
  getMonthlyLeaderboard,
  getCurrentMonth,
  getPreviousMonth,
  getMonthlyTarget,
  formatCurrency 
} from '@/lib/sales-database'

// Slack request signature verification (reused from events)
function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
  signingSecret: string
): boolean {
  const crypto = require('crypto')
  const time = Math.floor(new Date().getTime() / 1000)
  
  // Request must be within 5 minutes
  if (Math.abs(time - parseInt(timestamp)) > 300) {
    return false
  }

  const hmac = crypto.createHmac('sha256', signingSecret)
  hmac.update(`v0:${timestamp}:${body}`)
  const computedSignature = `v0=${hmac.digest('hex')}`
  
  return crypto.timingSafeEqual(
    Buffer.from(computedSignature),
    Buffer.from(signature)
  )
}

// Parse month parameter (this-month, last-month, or YYYY-MM)
function parseMonthParameter(param: string): string {
  param = param.trim().toLowerCase()
  
  if (param === 'this-month' || param === 'current' || param === '') {
    return getCurrentMonth()
  }
  
  if (param === 'last-month' || param === 'previous') {
    return getPreviousMonth()
  }
  
  // Check if it's in YYYY-MM format
  const monthPattern = /^\d{4}-\d{2}$/
  if (monthPattern.test(param)) {
    return param
  }
  
  // Default to current month for invalid formats
  return getCurrentMonth()
}

// Format sales report for Slack
function formatSalesReport(
  monthStats: any,
  leaderboard: any[],
  monthlyTarget: number,
  month: string
): string {
  const monthName = new Date(month + '-01').toLocaleDateString('en-GB', { 
    year: 'numeric', 
    month: 'long' 
  })

  let report = `📊 *Sales Report for ${monthName}*\n\n`

  if (monthStats) {
    const progressPercentage = monthlyTarget > 0 
      ? Math.round((monthStats.total_amount / monthlyTarget) * 100)
      : 0

    report += `💰 *Total Sales:* ${formatCurrency(monthStats.total_amount)}\n`
    report += `🎯 *Monthly Target:* ${formatCurrency(monthlyTarget)}\n`
    report += `📈 *Progress:* ${progressPercentage}% ${progressPercentage >= 100 ? '🎉' : ''}\n`
    report += `📋 *Total Deals:* ${monthStats.total_deals}\n\n`

    if (leaderboard.length > 0) {
      report += `🏆 *Top Performers:*\n`
      leaderboard.slice(0, 5).forEach((rep, index) => {
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔸'
        report += `${emoji} ${rep.name}: ${formatCurrency(rep.monthly_amount)} (${rep.monthly_deals} deals)\n`
      })
    } else {
      report += `📝 No sales recorded for this month yet.\n`
    }
  } else {
    report += `📝 No sales data available for ${monthName}.\n`
  }

  report += `\n🕒 Generated at ${new Date().toLocaleString('en-GB')}`
  
  return report
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    console.log('🔄 Slash Command API: Received /sales-report command')

    // Verify Slack signature for security
    const signature = request.headers.get('x-slack-signature')
    const timestamp = request.headers.get('x-slack-request-timestamp')
    const signingSecret = process.env.SLACK_SIGNING_SECRET

    if (!signature || !timestamp || !signingSecret) {
      console.error('❌ Missing Slack signature verification headers')
      return NextResponse.json({ 
        text: 'Authentication error. Please contact support.',
        response_type: 'ephemeral'
      })
    }

    if (!verifySlackSignature(body, timestamp, signature, signingSecret)) {
      console.error('❌ Invalid Slack signature')
      return NextResponse.json({ 
        text: 'Authentication failed. Please contact support.',
        response_type: 'ephemeral'
      })
    }

    // Parse the form data from Slack
    const formData = new URLSearchParams(body)
    const command = formData.get('command')
    const text = formData.get('text') || ''
    const userId = formData.get('user_id')
    const userName = formData.get('user_name')
    const channelId = formData.get('channel_id')

    console.log('📝 Command details:', { command, text, userId, userName })

    // Validate command
    if (command !== '/sales-report') {
      return NextResponse.json({
        text: 'Unknown command. Use `/sales-report [this-month|last-month|YYYY-MM]`',
        response_type: 'ephemeral'
      })
    }

    // Parse month parameter
    const month = parseMonthParameter(text)
    console.log('📅 Fetching sales report for month:', month)

    try {
      // Fetch sales data
      const [monthStats, leaderboard, monthlyTarget] = await Promise.all([
        getMonthlySalesStats(month),
        getMonthlyLeaderboard(month),
        getMonthlyTarget(month)
      ])

      // Generate report
      const report = formatSalesReport(monthStats, leaderboard, monthlyTarget, month)

      console.log('✅ Sales report generated successfully for', month)

      // Return formatted response
      return NextResponse.json({
        text: report,
        response_type: 'in_channel', // Make it visible to everyone in the channel
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: report
            }
          }
        ]
      })

    } catch (dataError) {
      console.error('❌ Error fetching sales data:', dataError)
      
      return NextResponse.json({
        text: 'Sorry, there was an error fetching the sales report. Please try again later.',
        response_type: 'ephemeral'
      })
    }

  } catch (error) {
    console.error('❌ Slash Command API: Error processing request:', error)
    
    return NextResponse.json({
      text: 'Sorry, there was an error processing your request. Please try again later.',
      response_type: 'ephemeral'
    })
  }
}

// Handle GET requests (for testing)
export async function GET() {
  return NextResponse.json({
    message: 'Sales Slash Command API endpoint is running',
    usage: 'Use /sales-report [this-month|last-month|YYYY-MM]',
    timestamp: new Date().toISOString()
  })
}