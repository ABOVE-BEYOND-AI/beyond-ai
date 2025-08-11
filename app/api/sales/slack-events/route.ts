import { NextRequest, NextResponse } from 'next/server'
import { WebClient } from '@slack/web-api'
import crypto from 'crypto'
import { 
  saveDeal, 
  isSlackMessageProcessed, 
  parseCurrencyAmount,
  formatCurrency
} from '@/lib/sales-database'

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

// Slack request signature verification
function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
  signingSecret: string
): boolean {
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

// Parse deal information from Slack message
function parseDealFromMessage(text: string, user: { 
  real_name?: string; 
  name?: string; 
  display_name?: string; 
  profile?: { email?: string }; 
}): {
  rep_name: string
  rep_email: string
  deal_name: string
  amount: number
  currency: string
} | null {
  try {
    console.log('🔍 Parsing deal from message:', text)
    
    // Look for "Deal Signed!" pattern and extract amount
    const dealSignedPattern = /Deal Signed!/i
    if (!dealSignedPattern.test(text)) {
      console.log('❌ Message does not contain "Deal Signed!" pattern')
      return null
    }

    // Extract currency amount (£1,234.56 or $1,234.56)
    const currencyPattern = /[£$][\d,]+\.?\d*/g
    const currencyMatches = text.match(currencyPattern)
    
    if (!currencyMatches || currencyMatches.length === 0) {
      console.log('❌ No currency amount found in message')
      return null
    }

    const amountStr = currencyMatches[0]
    const amount = parseCurrencyAmount(amountStr)
    const currency = amountStr.startsWith('£') ? 'GBP' : 'USD'

    // Extract deal name (could be after "Deal:" or similar)
    let dealName = 'Unknown Deal'
    const dealNamePattern = /(?:deal|contract|agreement):\s*([^.\n]+)/i
    const dealNameMatch = text.match(dealNamePattern)
    if (dealNameMatch) {
      dealName = dealNameMatch[1].trim()
    } else {
      // Fallback: use first line after "Deal Signed!"
      const lines = text.split('\n')
      const dealSignedIndex = lines.findIndex(line => /Deal Signed!/i.test(line))
      if (dealSignedIndex >= 0 && dealSignedIndex + 1 < lines.length) {
        dealName = lines[dealSignedIndex + 1].trim() || dealName
      }
    }

    // Extract rep from message (Sold By: ...), fallback to Slack user info
    let repName = 'Unknown Rep'
    let repEmail = ''
    const soldByMatch = text.match(/Sold By:\s*([^\n]+)/i)
    if (soldByMatch) {
      repName = soldByMatch[1].trim()
      const derived = repName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')
      repEmail = `${derived}@unknown`
    } else {
      repName = user?.real_name || user?.name || user?.display_name || 'Unknown Rep'
      repEmail = user?.profile?.email || `${(user?.name || 'unknown').toLowerCase()}@unknown`
    }

    console.log('✅ Parsed deal:', { repName, repEmail, dealName, amount, currency })

    return {
      rep_name: repName,
      rep_email: repEmail,
      deal_name: dealName,
      amount,
      currency
    }
  } catch (error) {
    console.error('❌ Error parsing deal from message:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const payload = JSON.parse(body)
    
    console.log('🔄 Slack Events API: Received event:', payload.type)

    // Handle URL verification challenge
    if (payload.type === 'url_verification') {
      console.log('✅ Slack URL verification challenge received')
      return NextResponse.json({ challenge: payload.challenge })
    }

    // Verify Slack signature for security
    const signature = request.headers.get('x-slack-signature')
    const timestamp = request.headers.get('x-slack-request-timestamp')
    const signingSecret = process.env.SLACK_SIGNING_SECRET

    if (!signature || !timestamp || !signingSecret) {
      console.error('❌ Missing Slack signature verification headers')
      return NextResponse.json({ error: 'Missing signature headers' }, { status: 400 })
    }

    if (!verifySlackSignature(body, timestamp, signature, signingSecret)) {
      console.error('❌ Invalid Slack signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Handle message events
    if (payload.type === 'event_callback' && payload.event?.type === 'message') {
      const event = payload.event
      
      // Ignore messages without text and destructive subtype events
      if (!event.text) {
        console.log('⏭️ Ignoring message without text')
        return NextResponse.json({ ok: true })
      }

      const ignoredSubtypes = new Set([
        'message_changed',
        'message_deleted',
        'message_replied',
        'thread_broadcast'
      ])
      if (event.subtype && ignoredSubtypes.has(event.subtype)) {
        console.log(`⏭️ Ignoring message with subtype: ${event.subtype}`)
        return NextResponse.json({ ok: true })
      }

      // Check if we've already processed this message
      const alreadyProcessed = await isSlackMessageProcessed(event.channel, event.ts)
      if (alreadyProcessed) {
        console.log('⏭️ Message already processed, skipping')
        return NextResponse.json({ ok: true })
      }

      // Only process messages from the configured sales channel
      const salesChannelId = process.env.SALES_CHANNEL_ID
      if (salesChannelId && event.channel !== salesChannelId) {
        console.log(`⏭️ Message from different channel (${event.channel}), expected ${salesChannelId}`)
        return NextResponse.json({ ok: true })
      }

      console.log('📝 Processing message:', event.text.substring(0, 100) + '...')

      try {
        // Get user information from Slack when present (human poster)
        let userInfo: { user?: { real_name?: string; name?: string; display_name?: string; profile?: { email?: string } } } = { user: {} }
        if (event.user) {
          try {
            userInfo = await slack.users.info({ user: event.user })
          } catch (err) {
            console.log('⚠️ Could not fetch Slack user info, proceeding without it', err)
          }
        }
        
        // Parse deal information from message
        const dealData = parseDealFromMessage(event.text, userInfo.user || {})
        
        if (!dealData) {
          console.log('⏭️ Message does not contain deal information')
          return NextResponse.json({ ok: true })
        }

        // Save the deal to database
        const dealId = await saveDeal({
          slack_ts: event.ts,
          rep_name: dealData.rep_name,
          rep_email: dealData.rep_email,
          deal_name: dealData.deal_name,
          amount: dealData.amount,
          currency: dealData.currency,
          source: 'slack',
          slack_channel_id: event.channel,
          slack_message_url: `https://your-workspace.slack.com/archives/${event.channel}/p${event.ts.replace('.', '')}`
        })

        console.log(`🎉 Deal processed successfully: ${dealId}`)
        console.log(`💰 ${dealData.rep_name} - ${formatCurrency(dealData.amount)} for "${dealData.deal_name}"`)

        // Optionally, react to the message to show it was processed
        try {
          await slack.reactions.add({
            channel: event.channel,
            timestamp: event.ts,
            name: 'moneybag'
          })
        } catch (reactionError) {
          console.log('⚠️ Could not add reaction (not critical):', reactionError)
        }

        return NextResponse.json({ ok: true, deal_id: dealId })

      } catch (error) {
        console.error('❌ Error processing deal message:', error)
        
        // Try to react with error emoji
        try {
          await slack.reactions.add({
            channel: event.channel,
            timestamp: event.ts,
            name: 'x'
          })
        } catch (reactionError) {
          console.log('⚠️ Could not add error reaction:', reactionError)
        }

        return NextResponse.json({ ok: true }) // Still return ok to avoid retries
      }
    }

    // Handle other event types
    console.log('⏭️ Unhandled event type:', payload.type)
    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('❌ Slack Events API: Error processing request:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process Slack event',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}

// Handle GET requests (for testing)
export async function GET() {
  return NextResponse.json({
    message: 'Slack Events API endpoint is running',
    timestamp: new Date().toISOString()
  })
}