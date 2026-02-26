import { streamText, tool, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { cookies } from 'next/headers'
import {
  getLeads,
  getOpenOpportunities,
  getDashboardData,
  getEventsWithInventory,
  getEventOpportunities,
  getContacts,
  getContactDetail,
  getContactOpportunities,
  getContactNotes,
  getMonthlyTargets,
  getCommissionData,
  getChannelAttribution,
  getRepPerformance,
  getEventPerformance,
  getAccountFinancials,
  getPaymentPlanProgress,
  getCreditAccounts,
  getDealsClosedToday,
  getLeadsCreatedToday,
  getUpcomingEvents,
  updateLead,
  updateOpportunityStage,
  createNote,
  type SalesPeriod,
} from '@/lib/salesforce'
import {
  getCallsForPeriod,
  computeCallStats,
  computeRepStats,
  listUsers,
} from '@/lib/aircall'

export const maxDuration = 60

const SYSTEM_PROMPT = `You are the Above + Beyond AI sales assistant. You help the 14-person sales team at Above + Beyond Group, a luxury corporate hospitality company based in London.

## Your Role
- Answer questions about leads, deals, pipeline, events, clients, finances, calls, and sales performance
- Use your tools to fetch live data from Salesforce and Aircall — never guess or make up data
- Present data clearly with key numbers and insights
- When asked about currency, all amounts are in GBP (£)
- Be concise but thorough — this is an internal tool for busy salespeople
- You can also update lead statuses, deal stages, and create notes when asked

## Data Sources
- **Salesforce**: Leads, Contacts, Accounts, Opportunities, Events (Event__c), Commissions (Commission__c), Targets (Target__c), Payments (via Breadwinner), Products (Product2), Notes (A_B_Note__c)
- **Aircall**: Call logs, call stats, rep call activity, user directory

## Business Context
- Above + Beyond sells luxury corporate hospitality packages for Formula 1, tennis (Wimbledon), rugby, football, live music, culinary experiences, and other premium events
- Event categories: Formula 1, Tennis, Rugby, Football, Live Music, Culinary, Luxury Lifestyle, Unique Experiences
- Opportunity stages: Open (New, Deposit Taken, Agreement Sent), Won (Agreement Signed, Amended, Amendment Signed), Lost (Closed Lost, Cancelled)
- Lead statuses: New, Working, Prospect, Interested, Nurturing, Qualified, Unqualified
- Lead sources grouped: Digital Ads, Organic, Outbound, Referral, Events, Database, Email, Other
- Ticket types per event: Event Tickets, Hospitality Tickets, Hotel Tickets, Dinner Tickets, Drinks Tickets, Party Tickets, Flight Tickets, Transfer Tickets — each tracked with Required/Booked/Remaining fields
- Commission tracked monthly via Commission__c records (includes KPI targets, commission rate, clawback)
- Payments tracked via Breadwinner integration (invoice/payment/credit data on Account)

## Response Guidelines
- Format monetary values as £X,XXX or £X,XXX.XX
- For lead/deal lists, summarize the count and highlight top items rather than listing hundreds
- When data is empty, say so clearly — don't speculate
- If a query is ambiguous, ask a clarifying question before calling tools
- After retrieving data, provide analysis and actionable insights when relevant
- You can make multiple tool calls in sequence to answer complex questions
- When showing individual records, include key identifiers (name, stage, amount, owner)
- When discussing data, suggest the user can view more detail on the relevant platform page: /leads, /pipeline, /events, /clients, /sales, /calls, /analytics, /finance, /notes
- For write actions (updating leads, deals, creating notes), confirm what you did and show the updated state

## Date Context
Today: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`

export async function POST(req: Request) {
  // Auth check: validate session cookie
  const cookieStore = await cookies()
  const session = cookieStore.get('beyond_ai_session')
  if (!session?.value) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Decode and validate the session
  try {
    const decoded = JSON.parse(
      Buffer.from(decodeURIComponent(session.value), 'base64').toString()
    )
    if (!decoded?.user?.email) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { messages } = await req.json()

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: [
      {
        role: 'system' as const,
        content: SYSTEM_PROMPT,
        providerOptions: {
          anthropic: { cacheControl: { type: 'ephemeral' } },
        },
      },
    ],
    messages,
    stopWhen: stepCountIs(5),
    tools: {
      searchLeads: tool({
        description: 'Search and filter leads in Salesforce. Use for any query about leads, lead counts, lead status, or lead owners.',
        inputSchema: z.object({
          status: z.string().optional().describe('Lead status: New, Working, Prospect, Interested, Nurturing, Qualified, Unqualified'),
          sourceGroup: z.string().optional().describe('Source group: Digital Ads, Organic, Outbound, Referral, Events, Database, Email, Other'),
          interest: z.string().optional().describe('Interest field name: Formula_1__c, Football__c, Rugby__c, Tennis__c, Live_Music__c, Culinary__c, Luxury_Lifestyle_Celebrity__c, Unique_Experiences__c, Other__c'),
          ownerId: z.string().optional().describe('Salesforce OwnerId to filter by rep'),
          search: z.string().optional().describe('Free text search across lead name, company, email'),
          view: z.enum(['all', 'hot', 'needCalling', 'newThisWeek', 'goingCold', 'eventInterested', 'unqualified']).optional().describe('Predefined smart view'),
        }),
        execute: async (params) => {
          try {
            const leads = await getLeads(params)
            return { count: leads.length, leads: leads.slice(0, 20) }
          } catch (error) {
            return { error: `Failed to fetch leads: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      getPipeline: tool({
        description: 'Get open opportunities (pipeline/deals). Use for pipeline value, deal counts, stage breakdowns, or finding specific deals.',
        inputSchema: z.object({
          ownerId: z.string().optional().describe('Filter by rep OwnerId'),
          eventId: z.string().optional().describe('Filter by Event__c ID'),
          eventCategory: z.string().optional().describe('Filter by event category'),
          minAmount: z.number().optional().describe('Minimum deal amount in £'),
          maxAmount: z.number().optional().describe('Maximum deal amount in £'),
          includeClosed: z.boolean().optional().describe('Include closed deals too'),
        }),
        execute: async (params) => {
          try {
            const deals = await getOpenOpportunities(params)
            const totalValue = deals.reduce((sum, d) => sum + (d.Gross_Amount__c || d.Amount || 0), 0)
            const byStage: Record<string, { count: number; total: number }> = {}
            for (const d of deals) {
              if (!byStage[d.StageName]) byStage[d.StageName] = { count: 0, total: 0 }
              byStage[d.StageName].count++
              byStage[d.StageName].total += d.Gross_Amount__c || d.Amount || 0
            }
            return { count: deals.length, totalValue, byStage, deals: deals.slice(0, 20) }
          } catch (error) {
            return { error: `Failed to fetch pipeline: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      getSalesDashboard: tool({
        description: 'Get sales dashboard data: totals, leaderboard, and recent closed deals for a time period. Use for revenue questions, daily/weekly/monthly sales, and leaderboard.',
        inputSchema: z.object({
          period: z.enum(['today', 'week', 'month', 'year']).describe('Time period for dashboard data'),
        }),
        execute: async ({ period }) => {
          try {
            return await getDashboardData(period as SalesPeriod)
          } catch (error) {
            return { error: `Failed to fetch sales data: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      getEvents: tool({
        description: 'Get all events with ticket inventory data. Use for event availability, ticket counts, upcoming events, or finding specific events.',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const events = await getEventsWithInventory()
            return { count: events.length, events: events.slice(0, 30) }
          } catch (error) {
            return { error: `Failed to fetch events: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      getEventDeals: tool({
        description: 'Get all opportunities/deals linked to a specific event by its Salesforce Event__c ID. Returns the event name and all associated deals.',
        inputSchema: z.object({
          eventId: z.string().describe('The Salesforce Event__c record ID'),
        }),
        execute: async ({ eventId }) => {
          try {
            const deals = await getEventOpportunities(eventId)
            const totalValue = deals.reduce((sum, d) => sum + (d.Gross_Amount__c || d.Amount || 0), 0)
            const eventName = deals[0]?.Event__r?.Name || 'Event'
            return { eventName, count: deals.length, totalValue, deals: deals.slice(0, 25) }
          } catch (error) {
            return { error: `Failed to fetch event deals: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      searchClients: tool({
        description: 'Search contacts/clients in Salesforce. Use for client lookups, spend analysis, or finding contacts.',
        inputSchema: z.object({
          search: z.string().optional().describe('Search by name, email, or company'),
          ownerId: z.string().optional().describe('Filter by rep OwnerId'),
          minSpend: z.number().optional().describe('Minimum total spend in £'),
          maxSpend: z.number().optional().describe('Maximum total spend in £'),
          sortBy: z.enum(['spend', 'activity', 'name', 'created']).optional().describe('Sort order'),
          view: z.enum(['all', 'personal', 'business']).optional(),
        }),
        execute: async (params) => {
          try {
            const contacts = await getContacts(params)
            return { count: contacts.length, contacts: contacts.slice(0, 20) }
          } catch (error) {
            return { error: `Failed to fetch clients: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      getClientDetail: tool({
        description: 'Get full details for a single contact/client including their deals and notes. Use when the user asks about a specific person by their Salesforce Contact ID.',
        inputSchema: z.object({
          contactId: z.string().describe('The Salesforce Contact record ID'),
        }),
        execute: async ({ contactId }) => {
          try {
            const [contact, opportunities, notes] = await Promise.all([
              getContactDetail(contactId),
              getContactOpportunities(contactId),
              getContactNotes(contactId),
            ])
            return { contact, opportunities, notes: notes.slice(0, 10) }
          } catch (error) {
            return { error: `Failed to fetch client detail: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      getFinanceData: tool({
        description: 'Get financial data: account invoices/balances, payment plan progress, or credit accounts. Use for finance, payment, invoice, or credit questions.',
        inputSchema: z.object({
          type: z.enum(['accounts', 'paymentPlans', 'credits']).describe('Which financial view to fetch'),
        }),
        execute: async ({ type }) => {
          try {
            switch (type) {
              case 'accounts':
                return { type: 'accounts', data: await getAccountFinancials() }
              case 'paymentPlans':
                return { type: 'paymentPlans', data: await getPaymentPlanProgress() }
              case 'credits':
                return { type: 'credits', data: await getCreditAccounts() }
            }
          } catch (error) {
            return { error: `Failed to fetch finance data: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      getCallActivity: tool({
        description: 'Get phone call activity data from Aircall. Use for call volume, call stats, or per-rep call breakdowns.',
        inputSchema: z.object({
          period: z.enum(['today', 'week', 'month']).describe('Time period for call data'),
        }),
        execute: async ({ period }) => {
          try {
            const calls = await getCallsForPeriod(period)
            const stats = computeCallStats(calls)
            const repStats = computeRepStats(calls)
            return { period, stats, repStats: repStats.slice(0, 15) }
          } catch (error) {
            return { error: `Failed to fetch call data: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      getAnalytics: tool({
        description: 'Get sales analytics: channel attribution (revenue by lead source), rep performance rankings, or event performance. Use for "which channel", "which rep", or "which event" questions.',
        inputSchema: z.object({
          type: z.enum(['channels', 'reps', 'events']).describe('Which analytics view'),
        }),
        execute: async ({ type }) => {
          try {
            switch (type) {
              case 'channels':
                return { type: 'channels', data: await getChannelAttribution() }
              case 'reps':
                return { type: 'reps', data: await getRepPerformance() }
              case 'events':
                return { type: 'events', data: await getEventPerformance() }
            }
          } catch (error) {
            return { error: `Failed to fetch analytics: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      getTargetsAndCommission: tool({
        description: 'Get monthly sales targets or commission records for a specific year/month.',
        inputSchema: z.object({
          dataType: z.enum(['targets', 'commission']).describe('Whether to fetch targets or commission data'),
          year: z.string().describe('Year as string, e.g. "2026"'),
          month: z.string().optional().describe('Month number as string, e.g. "2" for February. Required for targets.'),
        }),
        execute: async ({ dataType, year, month }) => {
          try {
            if (dataType === 'targets') {
              const m = month || (new Date().getMonth() + 1).toString()
              return { type: 'targets', data: await getMonthlyTargets(year, m) }
            }
            return { type: 'commission', data: await getCommissionData(year) }
          } catch (error) {
            return { error: `Failed to fetch targets/commission: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      getDailyRecap: tool({
        description: 'Get a daily recap: deals closed today, new leads today, and upcoming events. Use for "what happened today" or start-of-day briefing questions.',
        inputSchema: z.object({
          upcomingDays: z.number().optional().describe('How many days ahead to show upcoming events (default 7)'),
        }),
        execute: async ({ upcomingDays }) => {
          try {
            const [closedToday, newLeadsToday, upcomingEvents] = await Promise.all([
              getDealsClosedToday(),
              getLeadsCreatedToday(),
              getUpcomingEvents(upcomingDays || 7),
            ])
            return {
              closedToday: {
                count: closedToday.length,
                totalValue: closedToday.reduce((s, d) => s + (d.Gross_Amount__c || d.Amount || 0), 0),
                deals: closedToday,
              },
              newLeadsToday,
              upcomingEvents: { count: upcomingEvents.length, events: upcomingEvents },
            }
          } catch (error) {
            return { error: `Failed to fetch daily recap: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      // ── Write Tools ──────────────────────────────────────

      updateLeadStatus: tool({
        description: 'Update the status of a lead in Salesforce. Use when the user asks to change a lead\'s status (e.g. "mark lead as Qualified", "move lead to Working").',
        inputSchema: z.object({
          leadId: z.string().describe('The Salesforce Lead record ID'),
          status: z.enum(['New', 'Working', 'Prospect', 'Interested', 'Nurturing', 'Qualified', 'Unqualified']).describe('The new lead status'),
        }),
        execute: async ({ leadId, status }) => {
          try {
            await updateLead(leadId, { Status: status })
            return { success: true, leadId, newStatus: status, message: `Lead status updated to "${status}"` }
          } catch (error) {
            return { error: `Failed to update lead: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      updateDealStage: tool({
        description: 'Update the stage of an opportunity/deal in Salesforce. Use when the user asks to move a deal to a different stage (e.g. "mark deal as Agreement Signed", "move to Deposit Taken").',
        inputSchema: z.object({
          opportunityId: z.string().describe('The Salesforce Opportunity record ID'),
          stage: z.enum(['New', 'Deposit Taken', 'Agreement Sent', 'Agreement Signed', 'Amended', 'Amendment Signed', 'Closed Lost', 'Cancelled']).describe('The new opportunity stage'),
        }),
        execute: async ({ opportunityId, stage }) => {
          try {
            await updateOpportunityStage(opportunityId, stage)
            return { success: true, opportunityId, newStage: stage, message: `Deal stage updated to "${stage}"` }
          } catch (error) {
            return { error: `Failed to update deal: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      addNote: tool({
        description: 'Create a new note in Salesforce (A_B_Note__c). Use when the user wants to log a note about a contact or a general note.',
        inputSchema: z.object({
          contactId: z.string().optional().describe('Salesforce Contact ID to link the note to. Omit for a general note.'),
          body: z.string().describe('The note content/body text'),
        }),
        execute: async ({ contactId, body }) => {
          try {
            const noteId = await createNote(contactId || null, body)
            return { success: true, noteId, message: contactId ? 'Note created and linked to contact' : 'General note created' }
          } catch (error) {
            return { error: `Failed to create note: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),

      // ── Rep/User Resolution ──────────────────────────────

      getSalesReps: tool({
        description: 'Get a list of all sales reps with their Salesforce OwnerId and Aircall user ID. Use this first when the user asks about a specific rep by name (e.g. "show me James\'s pipeline") so you can resolve their name to an ID for other tool calls.',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const [repPerformance, aircallUsers] = await Promise.all([
              getRepPerformance(),
              listUsers().catch(() => []),
            ])
            const reps = repPerformance.map((r) => ({
              name: r.name,
              email: r.email,
              salesforceOwnerId: r.ownerId,
              totalDeals: r.totalDeals,
              totalRevenue: r.totalRevenue,
            }))
            const aircall = aircallUsers.map((u) => ({
              name: u.name,
              email: u.email,
              aircallUserId: u.id,
            }))
            return { salesforceReps: reps, aircallUsers: aircall }
          } catch (error) {
            return { error: `Failed to fetch reps: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}
