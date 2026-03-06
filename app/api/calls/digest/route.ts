import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { getCallDashboardData, type CallPeriod } from '@/lib/call-dashboard'
import { generateEventRecap } from '@/lib/event-recap'
import { getRecentTranscripts } from '@/lib/transcript-store'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
const CACHE_TTL = 60 * 15

function buildTeamSummary(input: {
  period: CallPeriod
  totalCalls: number
  answeredCalls: number
  meaningfulCalls: number
  topRepName: string | null
  topRepCalls: number
  topRepAnswerRate: number | null
  dealsClosedToday: number
  dealValueToday: number
  transcriptCount: number
}): string {
  const lines: string[] = []
  const answerRate = input.totalCalls > 0
    ? Math.round((input.answeredCalls / input.totalCalls) * 100)
    : 0

  lines.push(
    `${periodLabel(input.period)} logged ${input.totalCalls} calls with ${input.answeredCalls} answered (${answerRate}% answer rate) and ${input.meaningfulCalls} meaningful conversations over three minutes.`
  )

  if (input.topRepName && input.topRepCalls > 0) {
    const repAnswerRate = input.topRepAnswerRate === null ? '' : `, ${Math.round(input.topRepAnswerRate * 100)}% answered`
    lines.push(`${input.topRepName} led call volume with ${input.topRepCalls} calls${repAnswerRate}.`)
  }

  if (input.dealsClosedToday > 0) {
    lines.push(
      `Sales closed ${input.dealsClosedToday} deal${input.dealsClosedToday === 1 ? '' : 's'} today worth £${Math.round(input.dealValueToday).toLocaleString()}.`
    )
  }

  if (input.transcriptCount === 0) {
    lines.push('Transcript-level AI insights are limited because no stored transcripts are available yet, so this digest is based on cached call activity and the live sales recap.')
  } else {
    lines.push(`${input.transcriptCount} stored transcript${input.transcriptCount === 1 ? '' : 's'} from this period are available for deeper follow-up and objection review.`)
  }

  return lines.join(' ')
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
    .slice(0, 3)
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
    if (highlights.length >= 3) break
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
          ? 'Upcoming event is still behind target and needs sales attention.'
          : 'Upcoming event is tracking steadily based on current booked revenue.',
    }))
    .filter((event) => event.mentions > 0)
    .slice(0, 5)
}

function buildKeyDeals(recap: Awaited<ReturnType<typeof generateEventRecap>>): DigestPayload['key_deals'] {
  return recap.dealsClosedToday.slice(0, 5).map((deal) => ({
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

    const [{ data: callData }, recap, recentTranscripts] = await Promise.all([
      getCallDashboardData(period),
      generateEventRecap(false),
      getRecentTranscripts(50),
    ])

    const startTimestamp = periodStartTimestamp(period)
    const transcriptsInPeriod = recentTranscripts.filter((transcript) => transcript.startedAt >= startTimestamp)
    const topRep = callData.repStats[0]
    const topRepAnswerRate = topRep && topRep.total_calls > 0
      ? topRep.answered_calls / topRep.total_calls
      : null

    const digest: DigestPayload = {
      period: periodLabel(period),
      generated_at: new Date().toISOString(),
      total_calls_analysed: callData.meaningfulCallCount,
      team_summary: buildTeamSummary({
        period,
        totalCalls: callData.stats.total_calls,
        answeredCalls: callData.stats.answered_calls,
        meaningfulCalls: callData.meaningfulCallCount,
        topRepName: topRep?.name || null,
        topRepCalls: topRep?.total_calls || 0,
        topRepAnswerRate,
        dealsClosedToday: recap.dealsClosedToday.length,
        dealValueToday: recap.totalDealValue,
        transcriptCount: transcriptsInPeriod.length,
      }),
      top_objections: [],
      winning_pitches: [],
      event_demand: buildEventDemand(recap),
      competitor_intelligence: [],
      follow_up_gaps: buildFollowUpGaps(callData.repStats),
      coaching_highlights: buildCoachingHighlights(callData.repStats),
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
