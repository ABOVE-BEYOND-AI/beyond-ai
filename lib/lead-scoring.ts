// App-side lead scoring — Salesforce Score__c is broken (all 99s)
// Calculates a 0-100 score based on real signals

import type { SalesforceLead } from './salesforce-types'
import { daysSince } from './constants'

const HIGH_QUALITY_SOURCES = ['Website', 'Web Form', 'Referral', 'External Referral', 'Employee Referral', 'Customer Event', 'Trade Show']
const MEDIUM_QUALITY_SOURCES = ['Google AdWords', 'LinkedIn', 'Linkedin Ads', 'Facebook Lead Form', 'Organic Search']

export function calculateLeadScore(lead: SalesforceLead): number {
  let score = 0

  // Recency of activity (max 30 points)
  const activityDays = daysSince(lead.LastActivityDate)
  if (activityDays === 0) score += 30
  else if (activityDays <= 3) score += 25
  else if (activityDays <= 7) score += 20
  else if (activityDays <= 14) score += 15
  else if (activityDays <= 30) score += 10
  else if (activityDays <= 90) score += 5

  // Has event of interest (20 points)
  if (lead.Event_of_Interest__c) score += 20

  // Number of guests — bigger deal potential (max 15 points)
  const guests = lead.No_of_Guests__c || 0
  if (guests >= 10) score += 15
  else if (guests >= 5) score += 10
  else if (guests >= 1) score += 5

  // Lead source quality (max 15 points)
  if (lead.LeadSource && HIGH_QUALITY_SOURCES.includes(lead.LeadSource)) score += 15
  else if (lead.LeadSource && MEDIUM_QUALITY_SOURCES.includes(lead.LeadSource)) score += 10
  else score += 5

  // Status progression (max 10 points)
  if (lead.Status === 'Interested') score += 10
  else if (lead.Status === 'Prospect') score += 7
  else if (lead.Status === 'Working') score += 5
  else if (lead.Status === 'Nurturing') score += 3

  // Has been called (5 points)
  if (lead.FirstCallDateTime) score += 5

  // Rating (max 5 points)
  if (lead.Rating === 'Hot') score += 5
  else if (lead.Rating === 'Warm') score += 3

  return Math.min(score, 100)
}

export function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

export function getScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-green-500/15'
  if (score >= 40) return 'bg-yellow-500/15'
  return 'bg-red-500/15'
}
