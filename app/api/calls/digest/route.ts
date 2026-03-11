import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { getCallDashboardData, type CallPeriod, type CallListItem } from '@/lib/call-dashboard'
import { generateEventRecap } from '@/lib/event-recap'
import { getRecentTranscripts, storeTranscript } from '@/lib/transcript-store'
import { type CallAnalysis } from '@/lib/call-analysis'
import { getCall } from '@/lib/aircall'
import { transcribeFromUrl } from '@/lib/deepgram'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface DigestPayload {
  period: string
  generated_at: string
  total_calls_analysed: number
  team_summary: string
  top_objections: {
    objection: string
    frequency: number
    suggested_response: string
  }[]
  winning_pitches: {
    description: string
    rep: string
    context: string
  }[]
  event_demand: {
    event: string
    mentions: number
    sentiment: string
  }[]
  competitor_intelligence: {
    competitor: string
    mentions: number
    context: string
  }[]
  follow_up_gaps: {
    rep: string
    description: string
  }[]
  coaching_highlights: {
    rep: string
    type: 'strength' | 'improvement'
    description: string
  }[]
  key_deals: {
    contact: string
    rep: string
    status: string
    next_steps: string
  }[]
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function periodLabel(period: CallPeriod): string {
  if (period === 'today') return 'Today'
  if (period === 'week') return 'This Week'
  return 'This Month'
}

function periodStartTimestamp(period: CallPeriod): number {
  const now = new Date()
  if (period === 'today') {
    return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000)
  }
  if (period === 'week') {
    const day = now.getDay()
    return Math.floor(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((day + 6) % 7)).getTime() / 1000
    )
  }
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000)
}

const DIGEST_KEY = (date: string, period: CallPeriod) => `daily_digest:${date}:${period}`
const ANALYSIS_KEY = (callId: number) => `call_analysis:${callId}`
const CACHE_TTL = 60 * 15

/**
 * Fetch cached individual call analyses from Redis.
 */
async function getCachedAnalyses(callIds: number[], redis: Redis): Promise<CallAnalysis[]> {
  if (callIds.length === 0) return []

  const analyses: CallAnalysis[] = []
  for (let i = 0; i < callIds.length; i += 20) {
    const batch = callIds.slice(i, i + 20)
    const results = await Promise.allSettled(
      batch.map(id => redis.get<CallAnalysis>(ANALYSIS_KEY(id)))
    )
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        analyses.push(result.value)
      }
    }
  }

  return analyses
}

/**
 * Generate AI-powered digest insights using Gemini 2.5 Flash.
 * Works with whatever data is available: transcripts, cached analyses, or just call stats.
 * Cost: ~$0.003 per digest.
 */
async function generateAIDigestInsights(input: {
  transcripts: { callId: number; agent: string; contact: string; direction: string; duration: number; transcript: string }[]
  analyses: CallAnalysis[]
  repStats: { name: string; total_calls: number; answered_calls: number; outbound_calls: number; inbound_calls: number; avg_duration: number; longest_call: number }[]
  meaningfulCalls: CallListItem[]
  totalCalls: number
  answeredCalls: number
  dealsToday: { name: string; amount: number; owner: string; event: string }[]
  upcomingEvents: { name: string; category: string | null; percentageToTarget: number | null }[]
  period: string
}): Promise<Partial<DigestPayload>> {
  const sections: string[] = []

  // Section 1: Rep stats (always available)
  sections.push(`TEAM REP STATS (${input.repStats.length} reps):
${input.repStats.map(r => {
  const answerRate = r.total_calls > 0 ? Math.round((r.answered_calls / r.total_calls) * 100) : 0
  const outboundPct = r.total_calls > 0 ? Math.round((r.outbound_calls / r.total_calls) * 100) : 0
  return `- ${r.name}: ${r.total_calls} calls (${answerRate}% answered, ${outboundPct}% outbound), avg ${Math.round(r.avg_duration / 60)}min, longest ${Math.round(r.longest_call / 60)}min`
}).join('\n')}`)

  // Section 2: Call activity overview
  const answerRate = input.totalCalls > 0 ? Math.round((input.answeredCalls / input.totalCalls) * 100) : 0
  sections.push(`CALL ACTIVITY:
- Total calls: ${input.totalCalls} (${input.answeredCalls} answered, ${answerRate}% answer rate)
- Meaningful calls (3+ min): ${input.meaningfulCalls.length}
- Meaningful call breakdown: ${input.meaningfulCalls.map(c => `${c.agent_name} <> ${c.contact_name} (${c.direction}, ${Math.round(c.duration / 60)}min)`).slice(0, 20).join('; ')}`)

  // Section 3: Deals (if any)
  if (input.dealsToday.length > 0) {
    sections.push(`DEALS CLOSED TODAY:
${input.dealsToday.map(d => `- ${d.name}: £${Math.round(d.amount).toLocaleString()} by ${d.owner} (${d.event})`).join('\n')}`)
  }

  // Section 4: Upcoming events
  if (input.upcomingEvents.length > 0) {
    sections.push(`UPCOMING EVENTS:
${input.upcomingEvents.slice(0, 12).map(e => {
  const target = e.percentageToTarget !== null ? ` (${Math.round(e.percentageToTarget)}% to target)` : ''
  return `- ${e.name}${e.category ? ` (${e.category})` : ''}${target}`
}).join('\n')}`)
  }

  // Section 5: Cached analyses (high quality, already processed by Claude)
  if (input.analyses.length > 0) {
    const analysisSummaries = input.analyses.map(a =>
      `[Analysed Call] Sentiment: ${a.sentiment} (${a.sentiment_score}/100)\n` +
      `Summary: ${a.summary}\n` +
      `Objections: ${a.objections.length > 0 ? a.objections.join('; ') : 'None'}\n` +
      `Events: ${a.events_mentioned.length > 0 ? a.events_mentioned.join(', ') : 'None'}\n` +
      `Competitors: ${a.competitor_mentions.length > 0 ? a.competitor_mentions.join(', ') : 'None'}\n` +
      `Opportunities: ${a.opportunity_signals.map(o => `${o.type}: ${o.description}`).join('; ') || 'None'}\n` +
      `Coaching: ${a.coaching_notes || 'None'}`
    )
    sections.push(`AI-ANALYSED CALL DETAILS (${input.analyses.length} calls):\n\n${analysisSummaries.join('\n\n---\n\n')}`)
  }

  // Section 6: Raw transcripts (for calls without individual analysis)
  const analysedCallIds = new Set(input.analyses.map(a => a.call_id))
  const unanalysedTranscripts = input.transcripts.filter(t => !analysedCallIds.has(t.callId))
  if (unanalysedTranscripts.length > 0) {
    const transcriptSummaries = unanalysedTranscripts.map(t => {
      const words = t.transcript.split(/\s+/)
      const truncated = words.length > 500 ? words.slice(0, 500).join(' ') + '...' : t.transcript
      return `[Transcript] ${t.agent} <> ${t.contact} (${t.direction}, ${Math.round(t.duration / 60)}min)\n${truncated}`
    })
    sections.push(`RAW TRANSCRIPTS (${unanalysedTranscripts.length} calls):\n\n${transcriptSummaries.join('\n\n---\n\n')}`)
  }

  const hasDeepData = input.analyses.length > 0 || input.transcripts.length > 0

  const model = google('gemini-2.5-flash')

  const prompt = `You are the AI sales intelligence engine for Above + Beyond, a luxury hospitality company selling premium event packages (Formula 1, The Open, Wimbledon, Six Nations, Cheltenham, Ryder Cup, etc.). You're generating the ${input.period} team digest — shown to the whole company at lunch and end of day.

${sections.join('\n\n')}

Generate a comprehensive team intelligence digest as JSON. Return ONLY valid JSON, no markdown, no explanation:
{
  "team_summary": "3-5 sentence executive summary. Cover: total call volume, answer rate, meaningful conversations, top performers, deal momentum, ${hasDeepData ? 'key themes from conversations, ' : ''}energy/pace. Be specific with actual numbers and names.",
  "top_objections": [
    { "objection": "specific objection pattern", "frequency": 2, "suggested_response": "1-2 punchy sentences MAX — this is displayed on a sales floor screen, not a manual" }
  ],
  "winning_pitches": [
    { "description": "what worked", "rep": "who", "context": "brief context" }
  ],
  "event_demand": [
    { "event": "event name", "mentions": 3, "sentiment": "HOT/WARM/MIXED/CAUTION/CRITICAL — then a brief note" }
  ],
  "competitor_intelligence": [
    { "competitor": "name", "mentions": 1, "context": "what was said" }
  ],
  "coaching_highlights": [
    { "rep": "name", "type": "strength", "description": "specific observation" }
  ],
  "follow_up_gaps": [
    { "rep": "name", "description": "specific gap" }
  ]
}

GUIDELINES:
- Be SPECIFIC — use actual names, numbers, events from the data${hasDeepData ? '\n- For objections/winning pitches/competitors: pull from transcript and analysis data' : '\n- Without transcript data: focus coaching on call patterns (answer rates, outbound/inbound balance, call durations, volume)'}
- coaching_highlights: analyse each rep — who has strong answer rates, who has long meaningful calls, who needs to improve. Reference specific numbers.
- follow_up_gaps: identify reps with heavy outbound but low answer rates, or reps whose call durations suggest they are not having deep conversations
- event_demand: if deals were closed for specific events, note which events are hot. Use upcoming event target percentages to flag which events need attention.
- Every insight should tell the team what to DO
- Keep it punchy, actionable, not corporate — this is for a sales floor
- Return empty arrays for categories with insufficient data`

  try {
    const result = await generateText({
      model,
      prompt,
    })

    let jsonStr = result.text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr)
    return parsed
  } catch (err) {
    console.error('AI digest generation failed:', err)
    return {}
  }
}

function buildKeyDeals(recap: Awaited<ReturnType<typeof generateEventRecap>>): DigestPayload['key_deals'] {
  return recap.dealsClosedToday.slice(0, 8).map((deal) => ({
    contact: deal.name,
    rep: deal.owner,
    status: `Closed today for £${Math.round(deal.amount).toLocaleString()}`,
    next_steps: `Confirm fulfilment handoff for ${deal.event}.`,
  }))
}

export async function POST(request: NextRequest) {
  try {
    await requireApiUser(request)
    const body = await request.json()
    const period = (body.period || 'today') as CallPeriod
    const forceRefresh = body.force_refresh === true

    const redis = getRedis()
    const today = new Date().toISOString().split('T')[0]

    if (!forceRefresh && redis) {
      try {
        const cachedDigest = await redis.get<DigestPayload>(DIGEST_KEY(today, period))
        if (cachedDigest) {
          return NextResponse.json({ success: true, data: cachedDigest, cached: true })
        }
      } catch (error) {
        console.warn('Redis digest cache read failed:', error)
      }
    }

    // Fetch all data sources in parallel
    const [{ data: callData }, recap, recentTranscripts] = await Promise.all([
      getCallDashboardData(period),
      generateEventRecap(false),
      getRecentTranscripts(100),
    ])

    const startTimestamp = periodStartTimestamp(period)
    const transcriptsInPeriod = recentTranscripts.filter(t => t.startedAt >= startTimestamp)

    // Fetch cached analyses for meaningful calls
    const meaningfulCallIds = callData.analysableCalls.map(c => c.id)
    let cachedAnalyses: CallAnalysis[] = []
    if (redis && meaningfulCallIds.length > 0) {
      cachedAnalyses = await getCachedAnalyses(meaningfulCallIds, redis)
    }

    const transcriptData = transcriptsInPeriod.map(t => ({
      callId: t.callId,
      agent: t.agentName,
      contact: t.contactName,
      direction: t.direction,
      duration: t.duration,
      transcript: t.transcript,
    }))

    // Identify meaningful calls that have neither cached analysis nor stored transcript
    const analysedCallIds = new Set(cachedAnalyses.map(a => a.call_id))
    const storedTranscriptIds = new Set(transcriptsInPeriod.map(t => t.callId))
    const callsNeedingTranscription = callData.analysableCalls.filter(
      c => !analysedCallIds.has(c.id) && !storedTranscriptIds.has(c.id) && c.has_recording
    )

    // Batch transcribe up to 10 calls with Deepgram (in parallel)
    if (callsNeedingTranscription.length > 0) {
      const batchSize = Math.min(callsNeedingTranscription.length, 10)
      const batch = callsNeedingTranscription.slice(0, batchSize)
      console.log(`Digest: batch transcribing ${batchSize} calls with Deepgram...`)

      const transcriptionResults = await Promise.allSettled(
        batch.map(async (c) => {
          try {
            const call = await getCall(c.id)
            const recordingUrl = call.recording || call.asset
            if (!recordingUrl) return null

            const contactName = call.contact
              ? [call.contact.first_name, call.contact.last_name].filter(Boolean).join(' ') || 'Contact'
              : 'Contact'
            const agentName = call.user?.name || 'Agent'

            const result = await transcribeFromUrl(recordingUrl, agentName, contactName, call.direction)

            // Store in Redis for future use (non-blocking)
            storeTranscript(c.id, {
              agentName,
              contactName,
              duration: call.duration,
              direction: call.direction,
              startedAt: call.started_at,
            }, result.transcript).catch(err => console.warn(`Failed to store transcript for ${c.id}:`, err))

            return {
              callId: c.id,
              agent: agentName,
              contact: contactName,
              direction: call.direction,
              duration: call.duration,
              transcript: result.transcript,
            }
          } catch (err) {
            console.warn(`Failed to transcribe call ${c.id} for digest:`, (err as Error).message)
            return null
          }
        })
      )

      let newTranscripts = 0
      for (const result of transcriptionResults) {
        if (result.status === 'fulfilled' && result.value) {
          transcriptData.push(result.value)
          newTranscripts++
        }
      }
      console.log(`Digest: batch transcription complete — ${newTranscripts}/${batchSize} succeeded`)
    }

    console.log(`Digest: ${cachedAnalyses.length} cached analyses, ${transcriptData.length} transcripts, ${callData.analysableCalls.length} meaningful calls, ${callData.stats.total_calls} total calls`)

    // Always generate AI insights — works with stats even without transcripts
    const aiInsights = await generateAIDigestInsights({
      transcripts: transcriptData,
      analyses: cachedAnalyses,
      repStats: callData.repStats.map(r => ({
        name: r.name,
        total_calls: r.total_calls,
        answered_calls: r.answered_calls,
        outbound_calls: r.outbound_calls,
        inbound_calls: r.inbound_calls,
        avg_duration: r.avg_duration,
        longest_call: r.longest_call,
      })),
      meaningfulCalls: callData.analysableCalls,
      totalCalls: callData.stats.total_calls,
      answeredCalls: callData.stats.answered_calls,
      dealsToday: recap.dealsClosedToday.map(d => ({
        name: d.name,
        amount: d.amount,
        owner: d.owner,
        event: d.event,
      })),
      upcomingEvents: recap.upcomingEvents.map(e => ({
        name: e.name,
        category: e.category,
        percentageToTarget: e.percentageToTarget,
      })),
      period: periodLabel(period),
    })

    const digest: DigestPayload = {
      period: periodLabel(period),
      generated_at: new Date().toISOString(),
      total_calls_analysed: callData.meaningfulCallCount,
      team_summary: aiInsights.team_summary || `${periodLabel(period)} logged ${callData.stats.total_calls} calls with ${callData.stats.answered_calls} answered and ${callData.meaningfulCallCount} meaningful conversations.`,
      top_objections: aiInsights.top_objections || [],
      winning_pitches: aiInsights.winning_pitches || [],
      event_demand: aiInsights.event_demand || [],
      competitor_intelligence: aiInsights.competitor_intelligence || [],
      follow_up_gaps: aiInsights.follow_up_gaps || [],
      coaching_highlights: aiInsights.coaching_highlights || [],
      key_deals: buildKeyDeals(recap),
    }

    if (redis) {
      redis.set(DIGEST_KEY(today, period), digest, { ex: CACHE_TTL }).catch((error) => {
        console.warn('Redis digest cache write failed:', error)
      })
    }

    return NextResponse.json({ success: true, data: digest, cached: false })
  } catch (error) {
    console.error('Error generating digest:', error)
    return apiErrorResponse(error, 'Failed to generate digest')
  }
}
