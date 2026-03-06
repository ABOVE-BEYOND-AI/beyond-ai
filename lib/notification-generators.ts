// Notification generators — check Salesforce for actionable items and create notifications
// Each generator respects user preferences before firing

import { query } from './salesforce'
import { createNotification, getAllNotifications, getPreferences } from './notifications'
import { generateEventRecap } from './event-recap'

interface SFOpportunityRow {
  Id: string
  Name: string
  StageName: string
  Amount: number | null
  LastActivityDate: string | null
  Owner: { Email: string } | null
}

interface SFOverdueAccountRow {
  Id: string
  Name: string
  Bread_Winner__Total_Amount_Overdue__c: number | null
  Bread_Winner__Total_Amount_Due__c: number | null
}

interface SFLeadRow {
  Id: string
  Name: string
  Company: string | null
  CreatedDate: string
  Owner: { Email: string } | null
}

/**
 * Check for stale deals — opportunities with no activity in 14+ days
 * that are still in an open stage.
 */
export async function checkStaleDeals(email: string): Promise<number> {
  const prefs = await getPreferences(email)
  if (!prefs.stale_deals) return 0

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const soql = `
    SELECT Id, Name, StageName, Amount, LastActivityDate, Owner.Email
    FROM Opportunity
    WHERE StageName NOT IN ('Closed Won', 'Closed Lost')
      AND LastActivityDate < ${fourteenDaysAgo}
      AND Owner.Email = '${email}'
    ORDER BY LastActivityDate ASC
    LIMIT 10
  `

  try {
    const result = await query<SFOpportunityRow>(soql)
    let created = 0

    for (const opp of result.records) {
      const daysSince = opp.LastActivityDate
        ? Math.floor((Date.now() - new Date(opp.LastActivityDate).getTime()) / (1000 * 60 * 60 * 24))
        : 14
      await createNotification(email, {
        type: 'stale_deal',
        title: `Stale deal: ${opp.Name}`,
        body: `No activity for ${daysSince} days. Stage: ${opp.StageName}. Amount: ${opp.Amount ? `£${opp.Amount.toLocaleString()}` : 'N/A'}.`,
        link: `/pipeline`,
      })
      created++
    }
    return created
  } catch (error) {
    console.error('checkStaleDeals error:', error)
    return 0
  }
}

/**
 * Check for overdue payments — invoices past their due date with balance remaining.
 * This runs globally (not per-user) so we pass results to relevant users.
 */
export async function checkOverduePayments(): Promise<number> {
  const soql = `
    SELECT Id, Name, Bread_Winner__Total_Amount_Overdue__c, Bread_Winner__Total_Amount_Due__c
    FROM Account
    WHERE Bread_Winner__Total_Amount_Overdue__c > 0
    ORDER BY Bread_Winner__Total_Amount_Overdue__c DESC
    LIMIT 20
  `

  try {
    const result = await query<SFOverdueAccountRow>(soql)
    // For overdue payments, notify all users who have this pref enabled
    // In practice, this would target finance team members
    // For now, we return the count for the caller to handle
    return result.records.length
  } catch (error) {
    console.error('checkOverduePayments error:', error)
    return 0
  }
}

/**
 * Notify a specific user about overdue payments.
 */
export async function notifyOverduePayments(email: string): Promise<number> {
  const prefs = await getPreferences(email)
  if (!prefs.payment_overdue) return 0

  const soql = `
    SELECT Id, Name, Bread_Winner__Total_Amount_Overdue__c, Bread_Winner__Total_Amount_Due__c
    FROM Account
    WHERE Bread_Winner__Total_Amount_Overdue__c > 0
    ORDER BY Bread_Winner__Total_Amount_Overdue__c DESC
    LIMIT 10
  `

  try {
    const result = await query<SFOverdueAccountRow>(soql)
    let created = 0

    for (const account of result.records) {
      const overdue = account.Bread_Winner__Total_Amount_Overdue__c || 0
      const totalDue = account.Bread_Winner__Total_Amount_Due__c || 0
      await createNotification(email, {
        type: 'payment_overdue',
        title: `Overdue payment: ${account.Name}`,
        body: `£${overdue.toLocaleString()} is overdue. Total due on account: £${totalDue.toLocaleString()}.`,
        link: `/finance`,
      })
      created++
    }
    return created
  } catch (error) {
    console.error('notifyOverduePayments error:', error)
    return 0
  }
}

/**
 * Check for new leads assigned to user today.
 */
export async function checkNewLeads(email: string): Promise<number> {
  const prefs = await getPreferences(email)
  if (!prefs.new_leads) return 0

  const soql = `
    SELECT Id, Name, Company, CreatedDate, Owner.Email
    FROM Lead
    WHERE CreatedDate = TODAY
      AND Owner.Email = '${email}'
    ORDER BY CreatedDate DESC
    LIMIT 10
  `

  try {
    const result = await query<SFLeadRow>(soql)
    let created = 0

    for (const lead of result.records) {
      await createNotification(email, {
        type: 'new_lead',
        title: `New lead: ${lead.Name}`,
        body: lead.Company ? `${lead.Name} from ${lead.Company} assigned to you.` : `${lead.Name} assigned to you.`,
        link: `/leads`,
      })
      created++
    }
    return created
  } catch (error) {
    console.error('checkNewLeads error:', error)
    return 0
  }
}

/**
 * Send a single daily recap notification if enabled.
 */
export async function sendDailyRecap(email: string): Promise<number> {
  const prefs = await getPreferences(email)
  if (!prefs.daily_recap) return 0

  try {
    const today = new Date().toISOString().split('T')[0]
    const existingNotifications = await getAllNotifications(email, 50)
    const alreadySent = existingNotifications.some(
      (notification) => notification.type === 'daily_recap' && notification.createdAt.startsWith(today)
    )

    if (alreadySent) {
      return 0
    }

    const recap = await generateEventRecap()
    const upcoming = recap.upcomingEvents.slice(0, 2).map((event) => event.name).join(', ')
    const bodyParts = [
      `${recap.dealCount} deal${recap.dealCount === 1 ? '' : 's'} closed today`,
      `${recap.leadsCreatedToday} new lead${recap.leadsCreatedToday === 1 ? '' : 's'}`,
    ]

    if (recap.callStats) {
      bodyParts.push(`${recap.callStats.total} call${recap.callStats.total === 1 ? '' : 's'} logged`)
    }

    if (upcoming) {
      bodyParts.push(`Next events: ${upcoming}`)
    }

    await createNotification(email, {
      type: 'daily_recap',
      title: `Daily recap: ${recap.date}`,
      body: bodyParts.join('. '),
      link: '/calls',
    })

    return 1
  } catch (error) {
    console.error('sendDailyRecap error:', error)
    return 0
  }
}

/**
 * Run all generators for a given user.
 */
export async function runAllGenerators(email: string): Promise<{ staleDeals: number; overduePayments: number; newLeads: number; dailyRecap: number }> {
  const [staleDeals, overduePayments, newLeads, dailyRecap] = await Promise.all([
    checkStaleDeals(email),
    notifyOverduePayments(email),
    checkNewLeads(email),
    sendDailyRecap(email),
  ])

  return { staleDeals, overduePayments, newLeads, dailyRecap }
}
