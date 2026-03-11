import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { getCallDashboardData, type CallPeriod } from '@/lib/call-dashboard'
import { generateEventRecap } from '@/lib/event-recap'
import { getRecentTranscripts, storeTranscript } from '@/lib/transcript-store'
import { getTranscription, formatTranscriptForAI, type AircallCall } from '@/lib/aircall'
import { type CallAnalysis } from '@/lib/call-analysis'
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
 * Batch-fetch Aircall transcriptions for meaningful calls and store them.
 * Returns transcript summaries for AI analysis.
 */
async function batchFetchTranscripts(
  calls: { id: number; direction: string; duration: number; started_at: number; agent_name: string; contact_name: string }[],
  redis: Redis | null,
  existingTranscriptCallIds: Set<number>
): Promise<{ callId: number; agent: string; contact: string; direction: string; duration: number; transcript: string }[]> {
  const results: { callId: number; agent: string; contact: string; direction: string; duration: number; transcript: string }[] = []

  // Limit to 30 calls max to stay within time budget
  const callsToProcess = calls.slice(0, 30)

  // Process in batches of 5 concurrent requests
  for (let i = 0; i < callsToProcess.length; i += 5) {
    const batch = callsToProcess.slice(i, i + 5)
    const batchResults = await Promise.allSettled(
      batch.map(async (call) => {
        // Skip if we already have this transcript stored
        if (existingTranscriptCallIds.has(call.id)) {
          return null
        }

        try {
          const aircallTranscript = await getTranscription(call.id)
          if (!aircallTranscript?.content?.utterances?.length) {
            return null
          }

          // Build transcript text from Aircall's native transcription
          const agentName = call.agent_name || 'Agent'
          const contactName = call.contact_name || 'Contact'
          const fakeCall = {
            user: { name: agentName } as AircallCall['user'],
            contact: { first_name: contactName, last_name: null } as unknown as AircallCall['contact'],
          } as AircallCall
          const transcriptText = formatTranscriptForAI(aircallTranscript, fakeCall)

          if (!transcriptText || transcriptText.split(/\s+/).length < 20) {
            return null
          }

          // Store for future search (non-blocking)
          storeTranscript(call.id, {
            agentName,
            contactName,
            duration: call.duration,
            direction: call.direction as 'inbound' | 'outbound',
            startedAt: call.started_at,
          }, transcriptText).catch(() => {})

          return {
            callId: call.id,
            agent: agentName,
            contact: contactName,
            direction: call.direction,
            duration: call.duration,
            transcript: transcriptText,
          }
        } catch {
          return null
        }
      })
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value)
      }
    }
  }

  return results
}

/**
 * Fetch cached individual call analyses from Redis.
 */
async function getCachedAnalyses(callIds: number[], redis: Redis): Promise<CallAnalysis[]> {
  if (callIds.length === 0) return []

  const analyses: CallAnalysis[] = []
  // Batch fetch in groups of 20
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
 * Extremely cost-effective: ~$0.003 per digest.
 */
async function generateAIDigestInsights(input: {
  transcripts: { callId: number; agent: string; contact: string; direction: string; duration: number; transcript: string }[]
  analyses: CallAnalysis[]
  repStats: { name: string; total_calls: number; answered_calls: number; outbound_calls: number; avg_duration: number }[]
  dealsToday: { name: string; amount: number; owner: string; event: string }[]
  upcomingEvents: { name: string; category: string | null }[]
  period: string
}): Promise<Partial<DigestPayload>> {
  // Build context from both stored analyses and raw transcripts
  const callSummaries: string[] = []

  // Use existing analyses (high quality, already processed by Claude)
  for (const a of input.analyses) {
    callSummaries.push(
      `[Analysed] Agent: ${a.call_id ? 'Rep' : 'Unknown'} | Sentiment: ${a.sentiment} (${a.sentiment_score}/100)\n` +
      `Summary: ${a.summary}\n` +
      `Objections: ${a.objections.length > 0 ? a.objections.join('; ') : 'None'}\n` +
      `Events: ${a.events_mentioned.length > 0 ? a.events_mentioned.join(', ') : 'None'}\n` +
      `Competitors: ${a.competitor_mentions.length > 0 ? a.competitor_mentions.join(', ') : 'None'}\n` +
      `Opportunities: ${a.opportunity_signals.map(o => `${o.type}: ${o.description}`).join('; ') || 'None'}\n` +
      `Coaching: ${a.coaching_notes || 'None'}`
    )
  }

  // Add raw transcripts (truncated to save tokens) for calls without individual analysis
  const analysedCallIds = new Set(input.analyses.map(a => a.call_id))
  for (const t of input.transcripts) {
    // Skip transcripts for calls that already have a cached analysis to avoid redundancy
    if (analysedCallIds.has(t.callId)) continue
    // Truncate each transcript to ~500 words to keep costs down
    const words = t.transcript.split(/\s+/)
    const truncated = words.length > 500 ? words.slice(0, 500).join(' ') + '...' : t.transcript
    callSummaries.push(
      `[Transcript] ${t.agent} <> ${t.contact} (${t.direction}, ${Math.round(t.duration / 60)}min)\n${truncated}`
    )
  }

  if (callSummaries.length === 0) {
    return {}
  }

  const model = google('gemini-2.5-flash')

  const prompt = `You are the AI sales intelligence engine for Above + Beyond, a luxury hospitality company selling premium event packages (Formula 1, The Open, Wimbledon, Six Nations, Cheltenham, Ryder Cup, etc.). You're generating the ${input.period} team digest for the whole company — this will be shown at lunch and end of day.

TEAM REP STATS:
${input.repStats.map(r => `- ${r.name}: ${r.total_calls} calls, ${r.answered_calls} answered, ${r.outbound_calls} outbound, avg ${Math.round(r.avg_duration / 60)}min`).join('\n')}

${input.dealsToday.length > 0 ? `DEALS CLOSED TODAY:\n${input.dealsToday.map(d => `- ${d.name}: £${Math.round(d.amount).toLocaleString()} by ${d.owner} (${d.event})`).join('\n')}` : ''}

${input.upcomingEvents.length > 0 ? `UPCOMING EVENTS:\n${input.upcomingEvents.slice(0, 10).map(e => `- ${e.name}${e.category ? ` (${e.category})` : ''}`).join('\n')}` : ''}

CALL DATA (${callSummaries.length} calls with transcripts/analyses):

${callSummaries.join('\n\n---\n\n')}

Generate a comprehensive team intelligence digest as JSON. Return ONLY valid JSON, no markdown, no explanation:
{
  "team_summary": "3-5 sentence executive summary of the period's activity — call volume, answer rates, deal momentum, key themes from conversations, overall energy and sentiment of the team. Be specific with numbers.",
  "top_objections": [
    { "objection": "the specific objection pattern seen across calls", "frequency": 2, "suggested_response": "practical handle the team should use — specific to luxury hospitality" }
  ],
  "winning_pitches": [
    { "description": "what pitch or approach worked — be specific about the technique", "rep": "who did it", "context": "brief context" }
  ],
  "event_demand": [
    { "event": "event name", "mentions": 3, "sentiment": "brief demand signal — hot/warm/cooling" }
  ],
  "competitor_intelligence": [
    { "competitor": "company name", "mentions": 1, "context": "what was said and how to counter" }
  ],
  "coaching_highlights": [
    { "rep": "name", "type": "strength", "description": "specific observation from their calls — what they did well or should improve" }
  ],
  "follow_up_gaps": [
    { "rep": "name", "description": "specific gap — e.g. prospect expressed interest but no follow-up scheduled" }
  ]
}

CRITICAL GUIDELINES:
- Be SPECIFIC — reference actual client names, events, amounts, and techniques from the calls
- Aggregate patterns across calls, don't just list individual calls
- For objections, give PRACTICAL suggested responses tailored to luxury hospitality
- For coaching, reference specific things said or done in calls
- For winning pitches, explain WHY it worked
- If there aren't enough calls for a category, return an empty array for that field
- Every insight should tell the team what to DO about it
- This is for a sales floor — keep it punchy, actionable, not corporate`

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

function buildFollowUpGaps(repStats: Awaited<ReturnType<typeof getCallDashboardData>>['data']['repStats']) {
  return repStats
    .filter((rep) => rep.total_calls >= 4)
    .map((rep) => ({
      rep: rep.name,
      answeredRate: rep.total_calls > 0 ? rep.answered_calls / rep.total_calls : 0,
      outboundShare: rep.total_calls > 0 ? rep.outbound_calls / rep.total_calls : 0,
    }))
    .filter((rep) => rep.answeredRate < 0.45 || rep.outboundShare > 0.8)
    .slice(0, 5)
    .map((rep) => ({
      rep: rep.rep,
      description:
        rep.answeredRate < 0.45
          ? 'Low answer rate this period. Review callback timing and prioritise warm follow-ups before pushing new outbound volume.'
          : 'Heavy outbound skew. Check whether callbacks and same-day follow-ups are being closed out after first contact.',
    }))
}

function buildCoachingHighlights(repStats: Awaited<ReturnType<typeof getCallDashboardData>>['data']['repStats']) {
  const highlights: DigestPayload['coaching_highlights'] = []
  const topRep = repStats[0]

  if (topRep && topRep.total_calls > 0) {
    highlights.push({
      rep: topRep.name,
      type: 'strength',
      description: `Led the team on call volume with ${topRep.total_calls} calls and an average duration of ${Math.round(topRep.avg_duration / 60)} minutes.`,
    })
  }

  for (const rep of repStats) {
    if (highlights.length >= 5) break
    const answerRate = rep.total_calls > 0 ? rep.answered_calls / rep.total_calls : 0
    if (rep.total_calls >= 4 && answerRate < 0.45) {
      highlights.push({
        rep: rep.name,
        type: 'improvement',
        description: 'Answer rate is lagging behind team pace. Tighten call windows and prioritise contacts with recent engagement.',
      })
    }
  }

  return highlights
}

function buildEventDemand(recap: Awaited<ReturnType<typeof generateEventRecap>>) {
  const dealsByEvent = new Map<string, number>()
  for (const deal of recap.dealsClosedToday) {
    dealsByEvent.set(deal.event, (dealsByEvent.get(deal.event) || 0) + 1)
  }

  return recap.upcomingEvents
    .map((event) => ({
      event: event.name,
      mentions: dealsByEvent.get(event.name) || 0,
      sentiment:
        event.percentageToTarget !== null && event.percentageToTarget < 50
          ? 'Behind target — needs sales push.'
          : 'Tracking steadily on revenue target.',
    }))
    .filter((event) => event.mentions > 0)
    .slice(0, 8)
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
    const existingTranscriptCallIds = new Set(
      recentTranscripts.filter(t => t.startedAt >= startTimestamp).map(t => t.callId)
    )
    const transcriptsInPeriod = recentTranscripts.filter(t => t.startedAt >= startTimestamp)

    // Fetch cached analyses for meaningful calls
    const meaningfulCallIds = callData.analysableCalls.map(c => c.id)
    let cachedAnalyses: CallAnalysis[] = []
    if (redis && meaningfulCallIds.length > 0) {
      cachedAnalyses = await getCachedAnalyses(meaningfulCallIds, redis)
    }

    // Batch-fetch Aircall transcriptions for calls we don't have yet
    console.log(`Digest: ${cachedAnalyses.length} cached analyses, ${transcriptsInPeriod.length} stored transcripts, ${callData.analysableCalls.length} meaningful calls`)
    const newTranscripts = await batchFetchTranscripts(callData.analysableCalls, redis, existingTranscriptCallIds)
    console.log(`Digest: fetched ${newTranscripts.length} new Aircall transcriptions`)

    // Combine existing stored transcripts with newly fetched ones
    const allTranscripts = [
      ...transcriptsInPeriod.map(t => ({
        callId: t.callId,
        agent: t.agentName,
        contact: t.contactName,
        direction: t.direction,
        duration: t.duration,
        transcript: t.transcript,
      })),
      ...newTranscripts,
    ]

    // Deduplicate by callId
    const seenCallIds = new Set<number>()
    const uniqueTranscripts = allTranscripts.filter(t => {
      if (seenCallIds.has(t.callId)) return false
      seenCallIds.add(t.callId)
      return true
    })

    // Generate AI insights if we have any transcript/analysis data
    // Count unique calls (some may appear in both transcripts and analyses)
    const allCallIds = new Set([
      ...uniqueTranscripts.map(t => t.callId),
      ...cachedAnalyses.map(a => a.call_id),
    ])
    const totalAnalysable = allCallIds.size
    let aiInsights: Partial<DigestPayload> = {}

    if (totalAnalysable > 0) {
      aiInsights = await generateAIDigestInsights({
        transcripts: uniqueTranscripts,
        analyses: cachedAnalyses,
        repStats: callData.repStats.map(r => ({
          name: r.name,
          total_calls: r.total_calls,
          answered_calls: r.answered_calls,
          outbound_calls: r.outbound_calls,
          avg_duration: r.avg_duration,
        })),
        dealsToday: recap.dealsClosedToday.map(d => ({
          name: d.name,
          amount: d.amount,
          owner: d.owner,
          event: d.event,
        })),
        upcomingEvents: recap.upcomingEvents.map(e => ({
          name: e.name,
          category: e.category,
        })),
        period: periodLabel(period),
      })
    }

    const topRep = callData.repStats[0]
    const topRepAnswerRate = topRep && topRep.total_calls > 0
      ? topRep.answered_calls / topRep.total_calls
      : null
    const answerRate = callData.stats.total_calls > 0
      ? Math.round((callData.stats.answered_calls / callData.stats.total_calls) * 100)
      : 0

    // Build team summary — use AI if available, otherwise fall back to stats
    const teamSummary = aiInsights.team_summary || [
      `${periodLabel(period)} logged ${callData.stats.total_calls} calls with ${callData.stats.answered_calls} answered (${answerRate}% answer rate) and ${callData.meaningfulCallCount} meaningful conversations over three minutes.`,
      topRep ? `${topRep.name} led call volume with ${topRep.total_calls} calls${topRepAnswerRate !== null ? `, ${Math.round(topRepAnswerRate * 100)}% answered` : ''}.` : '',
      recap.dealsClosedToday.length > 0 ? `Sales closed ${recap.dealsClosedToday.length} deal${recap.dealsClosedToday.length === 1 ? '' : 's'} today worth £${Math.round(recap.totalDealValue).toLocaleString()}.` : '',
      totalAnalysable > 0 ? `AI analysed ${totalAnalysable} call transcripts for this digest.` : 'No transcripts available for AI analysis — insights are based on call activity data.',
    ].filter(Boolean).join(' ')

    // Merge AI insights with stats-based fallbacks
    const statsFollowUpGaps = buildFollowUpGaps(callData.repStats)
    const statsCoaching = buildCoachingHighlights(callData.repStats)
    const statsEventDemand = buildEventDemand(recap)

    const digest: DigestPayload = {
      period: periodLabel(period),
      generated_at: new Date().toISOString(),
      total_calls_analysed: totalAnalysable,
      team_summary: teamSummary,
      top_objections: aiInsights.top_objections || [],
      winning_pitches: aiInsights.winning_pitches || [],
      event_demand: aiInsights.event_demand?.length ? aiInsights.event_demand : statsEventDemand,
      competitor_intelligence: aiInsights.competitor_intelligence || [],
      follow_up_gaps: aiInsights.follow_up_gaps?.length ? aiInsights.follow_up_gaps : statsFollowUpGaps,
      coaching_highlights: aiInsights.coaching_highlights?.length
        ? aiInsights.coaching_highlights
        : statsCoaching,
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
